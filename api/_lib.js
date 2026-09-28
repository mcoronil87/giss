// Utilidades compartidas por las funciones del panel.
// Los archivos que empiezan por "_" dentro de /api no se publican como rutas.
import { createRequire } from 'node:module';
import { timingSafeEqual, createHash } from 'node:crypto';
import { get, put, BlobPreconditionFailedError } from '@vercel/blob';

const require = createRequire(import.meta.url);

// Datos iniciales (los que había en la web antes del panel).
// Se usan mientras Giss no haya guardado ningún cambio desde el panel.
export const STORES = {
  portfolio: { path: 'data/portfolio.json', seed: require('../data/portfolio.json') },
  cv: { path: 'data/cv.json', seed: require('../data/cv.json') },
};

export const CATEGORIES = ['fashion', 'portraits'];

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

// Compara la contraseña sin filtrar pistas por el tiempo de respuesta.
export function isAuthorized(request) {
  const expected = process.env.ADMIN_PASSWORD;
  // El panel la envía codificada (encodeURIComponent) para admitir tildes y ñ.
  let given = request.headers.get('x-admin-password') || '';
  try {
    given = decodeURIComponent(given);
  } catch {
    /* se usa tal cual */
  }
  if (!expected) return false;
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export function unauthorized() {
  return json({ error: 'Contraseña incorrecta' }, 401);
}

// Lee un almacén (portfolio o cv) de Blob. Si todavía no existe, devuelve el inicial.
export async function readStore(name) {
  const { path, seed } = STORES[name];
  const res = await get(path, { access: 'public', useCache: false });
  if (!res || res.statusCode !== 200) {
    return { data: structuredClone(seed), etag: null };
  }
  const text = await new Response(res.stream).text();
  return { data: JSON.parse(text), etag: res.blob.etag };
}

// Guarda un almacén. Si alguien lo cambió mientras tanto (otro móvil, otra pestaña),
// Blob rechaza la escritura y devolvemos un conflicto en vez de pisar cambios.
export async function writeStore(name, data, etag) {
  const { path } = STORES[name];
  const body = JSON.stringify(data);
  const common = { access: 'public', contentType: 'application/json', addRandomSuffix: false };
  try {
    const saved = await put(path, body, {
      ...common,
      cacheControlMaxAge: 60,
      // Con etag: solo guarda si nadie lo ha cambiado. Sin etag: solo si aún no existe.
      ...(etag ? { ifMatch: etag } : {}),
    });
    // Copia de seguridad de cada versión, por si hay que recuperar algo.
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await put(`backups/${name}-${stamp}.json`, body, common).catch(() => {});
    return { ok: true, etag: saved.etag };
  } catch (err) {
    if (err instanceof BlobPreconditionFailedError || /already exists/i.test(err?.message || '')) {
      return { ok: false, conflict: true };
    }
    throw err;
  }
}

// GET público / GET con ?admin (sin caché y con etag) / PUT protegido: igual para los dos almacenes.
export function storeHandlers(name, validate) {
  async function GET(request) {
    const isAdmin = new URL(request.url).searchParams.has('admin');
    try {
      const { data, etag } = await readStore(name);
      if (isAdmin) {
        if (!isAuthorized(request)) return unauthorized();
        return json({ ...data, etag }, 200, { 'cache-control': 'no-store' });
      }
      // La CDN de Vercel guarda la respuesta 30 s: la web va rápida y los cambios
      // de Giss aparecen en menos de un minuto.
      // El navegador siempre pregunta (no-cache); solo la CDN guarda copia.
      return json(data, 200, {
        'cache-control': 'public, no-cache',
        'vercel-cdn-cache-control': 'max-age=30, stale-while-revalidate=300',
      });
    } catch (err) {
      console.error(err);
      return json({ error: 'No se pudieron leer los datos' }, 500);
    }
  }

  async function PUT(request) {
    if (!isAuthorized(request)) return unauthorized();
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Formato no válido' }, 400);
    }
    let clean;
    try {
      clean = validate(body);
    } catch (err) {
      return json({ error: err.message }, 400);
    }
    try {
      const result = await writeStore(name, clean, body.etag || null);
      if (result.conflict) {
        return json(
          { error: 'Los datos han cambiado desde otro sitio. Recarga la página para ver la última versión.' },
          409,
        );
      }
      return json({ ...clean, etag: result.etag }, 200, { 'cache-control': 'no-store' });
    } catch (err) {
      console.error(err);
      return json({ error: 'No se pudo guardar. Inténtalo de nuevo en un momento.' }, 500);
    }
  }

  return { GET, PUT };
}

const isAllowedUrl = (url) =>
  typeof url === 'string' &&
  url.length < 500 &&
  (/^\/images_webp\/[^\s"'<>]+$/.test(url) ||
    /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/[^\s"'<>]+$/i.test(url));

export const cleanText = (value, max) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';

const uniqueId = (ids, raw, prefix, i) => {
  let id = cleanText(raw, 40) || `${prefix}${Date.now().toString(36)}${i}`;
  if (ids.has(id)) id = `${id}-${i}`;
  ids.add(id);
  return id;
};

// Comprueba y limpia el portfolio antes de guardarlo.
export function validatePortfolio(input) {
  if (!input || !Array.isArray(input.campaigns)) throw new Error('Formato no válido');
  const ids = new Set();
  const campaigns = input.campaigns.map((c, i) => {
    const name = cleanText(c.name, 120);
    const role = cleanText(c.role, 80);
    if (!name) throw new Error(`La campaña ${i + 1} no tiene nombre`);
    if (!role) throw new Error(`"${name}" no tiene puesto`);
    if (!CATEGORIES.includes(c.category)) throw new Error(`"${name}" no tiene categoría válida`);
    const photos = (Array.isArray(c.photos) ? c.photos : [])
      .filter((p) => p && isAllowedUrl(p.url))
      .map((p) => ({ url: p.url }));
    if (!photos.length) throw new Error(`"${name}" no tiene fotos`);
    return { id: uniqueId(ids, c.id, 'c', i), name, role, category: c.category, photos };
  });
  return { version: 1, updatedAt: new Date().toISOString(), campaigns };
}

// Comprueba y limpia el CV antes de guardarlo.
export function validateCv(input) {
  if (!input || !Array.isArray(input.film) || !Array.isArray(input.fashion) || !Array.isArray(input.education)) {
    throw new Error('Formato no válido');
  }
  const ids = new Set();
  const maxYear = new Date().getFullYear() + 2;
  const job = (l, i) => {
    const project = cleanText(l.project, 120);
    const es = cleanText(l.role?.es, 100);
    const en = cleanText(l.role?.en, 100) || es;
    const year = Number(l.year);
    if (!project) throw new Error('Hay una línea del CV sin nombre');
    if (!es) throw new Error(`"${project}" no tiene puesto`);
    if (!Number.isInteger(year) || year < 1990 || year > maxYear) throw new Error(`"${project}" tiene un año no válido`);
    return { id: uniqueId(ids, l.id, 'l', i), year, project, role: { es, en } };
  };
  // Siempre ordenado por año (de más reciente a más antiguo), respetando el orden dentro de cada año.
  const byYear = (list) => list.map((l, i) => ({ l, i })).sort((a, b) => b.l.year - a.l.year || a.i - b.i).map((x) => x.l);
  const education = input.education.map((e, i) => {
    const title = cleanText(e.title, 120);
    const school = cleanText(e.school, 120);
    if (!title) throw new Error('Hay una titulación sin nombre');
    return { id: uniqueId(ids, e.id, 'l', i), title, school };
  });
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    film: byYear(input.film.map(job)),
    fashion: byYear(input.fashion.map(job)),
    education,
  };
}

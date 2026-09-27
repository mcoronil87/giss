// Utilidades compartidas por las funciones del panel.
// Los archivos que empiezan por "_" dentro de /api no se publican como rutas.
import { createRequire } from 'node:module';
import { timingSafeEqual, createHash } from 'node:crypto';
import { get, put, BlobPreconditionFailedError } from '@vercel/blob';

const require = createRequire(import.meta.url);
// Portfolio inicial (el que había en la web antes del panel).
// Se usa mientras Giss no haya guardado ningún cambio desde el panel.
const SEED = require('../data/portfolio.json');

export const DATA_PATH = 'data/portfolio.json';
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

// Lee el portfolio guardado en Blob. Si todavía no existe, devuelve el inicial.
export async function readPortfolio() {
  const res = await get(DATA_PATH, { access: 'public', useCache: false });
  if (!res || res.statusCode !== 200) {
    return { data: structuredClone(SEED), etag: null };
  }
  const text = await new Response(res.stream).text();
  return { data: JSON.parse(text), etag: res.blob.etag };
}

// Guarda el portfolio. Si alguien lo cambió mientras tanto (otro móvil, otra pestaña),
// Blob rechaza la escritura y devolvemos un conflicto en vez de pisar cambios.
export async function writePortfolio(data, etag) {
  const body = JSON.stringify(data);
  const common = { access: 'public', contentType: 'application/json', addRandomSuffix: false };
  try {
    const saved = await put(DATA_PATH, body, {
      ...common,
      cacheControlMaxAge: 60,
      // Con etag: solo guarda si nadie lo ha cambiado. Sin etag: solo si aún no existe.
      ...(etag ? { ifMatch: etag } : {}),
    });
    // Copia de seguridad de cada versión, por si hay que recuperar algo.
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await put(`backups/portfolio-${stamp}.json`, body, common).catch(() => {});
    return { ok: true, etag: saved.etag };
  } catch (err) {
    if (err instanceof BlobPreconditionFailedError || /already exists/i.test(err?.message || '')) {
      return { ok: false, conflict: true };
    }
    throw err;
  }
}

const isAllowedUrl = (url) =>
  typeof url === 'string' &&
  url.length < 500 &&
  (/^\/images_webp\/[^\s"'<>]+$/.test(url) ||
    /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/[^\s"'<>]+$/i.test(url));

const cleanText = (value, max) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';

// Comprueba y limpia lo que envía el panel antes de guardarlo.
export function validatePortfolio(input) {
  if (!input || !Array.isArray(input.campaigns)) throw new Error('Formato no válido');
  const ids = new Set();
  const campaigns = input.campaigns.map((c, i) => {
    const name = cleanText(c.name, 120);
    const role = cleanText(c.role, 80);
    if (!name) throw new Error(`La campaña ${i + 1} no tiene nombre`);
    if (!role) throw new Error(`"${name}" no tiene puesto`);
    if (!CATEGORIES.includes(c.category)) throw new Error(`"${name}" no tiene categoría válida`);
    let id = cleanText(c.id, 40) || `c${Date.now().toString(36)}${i}`;
    if (ids.has(id)) id = `${id}-${i}`;
    ids.add(id);
    const photos = (Array.isArray(c.photos) ? c.photos : [])
      .filter((p) => p && isAllowedUrl(p.url))
      .map((p) => ({ url: p.url }));
    if (!photos.length) throw new Error(`"${name}" no tiene fotos`);
    return { id, name, role, category: c.category, photos };
  });
  return { version: 1, updatedAt: new Date().toISOString(), campaigns };
}

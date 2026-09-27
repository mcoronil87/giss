// GET  /api/portfolio        → portfolio público (lo usa la web)
// GET  /api/portfolio?admin=1 → versión sin caché + etag (lo usa el panel)
// PUT  /api/portfolio        → guarda el portfolio completo (requiere contraseña)
import {
  json,
  isAuthorized,
  unauthorized,
  readPortfolio,
  writePortfolio,
  validatePortfolio,
} from './_lib.js';

export async function GET(request) {
  const isAdmin = new URL(request.url).searchParams.has('admin');
  try {
    const { data, etag } = await readPortfolio();
    if (isAdmin) {
      if (!isAuthorized(request)) return unauthorized();
      return json({ ...data, etag }, 200, { 'cache-control': 'no-store' });
    }
    // La CDN de Vercel guarda la respuesta 30 s: la web va rápida y los cambios
    // de Giss aparecen en menos de un minuto.
    return json(data, 200, {
      'cache-control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=300',
    });
  } catch (err) {
    console.error(err);
    return json({ error: 'No se pudo leer el portfolio' }, 500);
  }
}

export async function PUT(request) {
  if (!isAuthorized(request)) return unauthorized();
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Formato no válido' }, 400);
  }
  let clean;
  try {
    clean = validatePortfolio(body);
  } catch (err) {
    return json({ error: err.message }, 400);
  }
  try {
    const result = await writePortfolio(clean, body.etag || null);
    if (result.conflict) {
      return json(
        { error: 'El portfolio ha cambiado desde otro sitio. Recarga la página para ver la última versión.' },
        409,
      );
    }
    return json({ ...clean, etag: result.etag }, 200, { 'cache-control': 'no-store' });
  } catch (err) {
    console.error(err);
    return json({ error: 'No se pudo guardar. Inténtalo de nuevo en un momento.' }, 500);
  }
}

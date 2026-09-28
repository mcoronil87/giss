// POST /api/upload?name=<campaña>  (cuerpo: la imagen ya comprimida por el panel)
// Guarda la foto en Vercel Blob y devuelve su URL pública.
import { put } from '@vercel/blob';
import { json, isAuthorized, unauthorized } from './_lib.js';

const TYPES = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };
const MAX_BYTES = 4 * 1024 * 1024; // Vercel admite hasta 4,5 MB por petición

const slug = (text) =>
  (text || 'foto')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'foto';

export async function POST(request) {
  if (!isAuthorized(request)) return unauthorized();

  const type = (request.headers.get('content-type') || '').split(';')[0].trim();
  const ext = TYPES[type];
  if (!ext) return json({ error: 'Formato de imagen no admitido' }, 415);

  const body = await request.arrayBuffer();
  if (!body.byteLength) return json({ error: 'La foto está vacía' }, 400);
  if (body.byteLength > MAX_BYTES) return json({ error: 'La foto es demasiado grande' }, 413);

  const name = new URL(request.url).searchParams.get('name');
  try {
    const blob = await put(`portfolio/${slug(name)}.${ext}`, body, {
      access: 'public',
      contentType: type,
      addRandomSuffix: true, // nombres únicos: nunca se pisa una foto
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    return json({ url: blob.url });
  } catch (err) {
    console.error(err);
    return json({ error: 'No se pudo subir la foto. Inténtalo de nuevo.' }, 500);
  }
}

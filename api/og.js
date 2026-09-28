// GET /api/og?photo=<id>|portrait → imagen JPG para la vista previa al compartir.
// Algunas apps (LinkedIn, versiones antiguas de WhatsApp) no muestran WebP, así que se convierte a JPG.
import sharp from 'sharp';
import { readStore } from './_lib.js';
import { findPhoto } from './_share.js';

const PORTRAIT = '/images_webp/giss-portrait.webp';

export async function GET(request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('photo') || 'portrait';
  let src = PORTRAIT;
  try {
    if (id !== 'portrait') {
      const { data } = await readStore('portfolio');
      const found = findPhoto(data, id);
      if (found) src = found.photo.url;
    }
    const res = await fetch(new URL(src, url.origin));
    if (!res.ok) throw new Error(`No se pudo leer ${src}`);
    const input = Buffer.from(await res.arrayBuffer());
    const jpg = await sharp(input)
      .rotate()
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    return new Response(jpg, {
      headers: {
        'content-type': 'image/jpeg',
        'cache-control': 'public, max-age=86400',
        'vercel-cdn-cache-control': 'max-age=604800',
      },
    });
  } catch (err) {
    console.error(err);
    return Response.redirect(new URL(PORTRAIT, url.origin), 302);
  }
}

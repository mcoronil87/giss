// Páginas intermedias de los enlaces de compartir:
//   /foto/<id>     → vista previa con esa foto  → abre la web con la foto ampliada
//   /cv/<apartado> → vista previa del CV        → abre la web en esa pestaña del CV
// (las rutas bonitas se definen en vercel.json). Con ?lang=en todo va en inglés.
// WhatsApp, Instagram, LinkedIn… leen las etiquetas og:*; las personas son redirigidas al momento.
import { readStore } from './_lib.js';
import { CV_SECTIONS, findPhoto, escapeHtml } from './_share.js';

const NAME = 'Giss Rodríguez';

function page({ title, description, image, url, target }) {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const dest = escapeHtml(target);
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t}</title>
<meta name="description" content="${d}">
<meta name="robots" content="noindex">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${NAME}">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${escapeHtml(url)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:image:type" content="image/jpeg">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=${dest}">
<style>body{background:#0a0a0a;color:#c9a96e;font-family:Georgia,serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}a{color:inherit}</style>
</head>
<body>
<p><a href="${dest}">${t}</a></p>
<script>location.replace(${JSON.stringify(target)});</script>
</body>
</html>`;
}

export async function GET(request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const en = url.searchParams.get('lang') === 'en';
  const langQuery = en ? '?lang=en' : '';
  const photo = url.searchParams.get('photo');
  const cv = url.searchParams.get('cv');
  let html;

  try {
    if (photo) {
      const { data } = await readStore('portfolio');
      const found = findPhoto(data, photo);
      html = found
        ? page({
            title: `${found.campaign.name} · ${NAME}`,
            description: `${found.campaign.role} · ${NAME}, Make Up & Hair Artist`,
            image: `${origin}/api/og?photo=${encodeURIComponent(photo)}`,
            url: `${origin}/foto/${photo}${langQuery}`,
            target: `/${langQuery}#foto-${photo}`,
          })
        : null; // la foto ya no existe: se muestra la vista general
    } else if (cv && CV_SECTIONS[cv]) {
      const s = CV_SECTIONS[cv];
      html = page({
        title: `${NAME} · CV ${en ? s.en : s.es}`,
        description: en ? 'Make Up & Hair Artist · Film, fashion and editorial' : 'Maquilladora y peluquera · Cine, moda y editorial',
        image: `${origin}/api/og?photo=portrait`,
        url: `${origin}/cv/${cv}${langQuery}`,
        target: `/${langQuery}#cv-${cv}`,
      });
    }
  } catch (err) {
    console.error(err);
  }

  if (!html) {
    html = page({
      title: `${NAME} · Make Up & Hair Artist`,
      description: en ? 'Film, fashion and editorial' : 'Cine, moda y editorial',
      image: `${origin}/api/og?photo=portrait`,
      url: origin,
      target: `/${langQuery}${photo ? '#portfolio' : ''}`,
    });
  }

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, no-cache',
      'vercel-cdn-cache-control': 'max-age=300, stale-while-revalidate=3600',
    },
  });
}

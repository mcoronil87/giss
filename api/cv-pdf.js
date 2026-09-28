// GET /api/cv-pdf → descarga el CV en PDF, generado al momento con los datos del CV.
import { readStore } from './_lib.js';
import { buildCvPdf } from './_cvpdf.js';

export async function GET(request) {
  try {
    const { data } = await readStore('cv');
    const bytes = await buildCvPdf(data);
    return new Response(bytes, {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': 'attachment; filename="cv-giss-rodriguez.pdf"',
        // La CDN lo guarda 1 minuto: siempre al día y sin generarlo en cada descarga.
        'cache-control': 'public, no-cache',
        'vercel-cdn-cache-control': 'max-age=60, stale-while-revalidate=600',
      },
    });
  } catch (err) {
    console.error(err);
    // Si algo falla, se descarga el último PDF hecho a mano.
    return Response.redirect(new URL('/cv-giss-rodriguez-2026.pdf', request.url), 302);
  }
}

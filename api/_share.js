// Utilidades para los enlaces de compartir.

// Identificador corto y estable de cada foto, calculado a partir de su URL.
// OJO: la web (index.html) usa exactamente la misma función; si se cambia aquí, hay que cambiarla allí.
export function photoId(url) {
  let h = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    h ^= url.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

// Apartados del CV: enlace bonito → pestaña de la web y textos para la vista previa.
export const CV_SECTIONS = {
  cine: { tab: 'cine', es: 'Cine y TV', en: 'Film & TV' },
  moda: { tab: 'moda', es: 'Moda y Publicidad', en: 'Fashion & Advertising' },
  formacion: { tab: 'edu', es: 'Titulaciones', en: 'Education' },
};

export function findPhoto(portfolio, id) {
  for (const c of portfolio.campaigns || []) {
    for (const p of c.photos) if (photoId(p.url) === id) return { campaign: c, photo: p };
  }
  return null;
}

export const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

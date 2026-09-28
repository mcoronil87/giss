// GET  /api/cv         → CV público (lo usa la web)
// GET  /api/cv?admin=1 → versión sin caché + etag (lo usa el panel)
// PUT  /api/cv         → guarda el CV completo (requiere contraseña)
import { storeHandlers, validateCv } from './_lib.js';

const handlers = storeHandlers('cv', validateCv);

export function GET(request) {
  return handlers.GET(request);
}

export function PUT(request) {
  return handlers.PUT(request);
}

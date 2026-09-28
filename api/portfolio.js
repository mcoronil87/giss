// GET  /api/portfolio         → portfolio público (lo usa la web)
// GET  /api/portfolio?admin=1 → versión sin caché + etag (lo usa el panel)
// PUT  /api/portfolio         → guarda el portfolio completo (requiere contraseña)
import { storeHandlers, validatePortfolio } from './_lib.js';

const handlers = storeHandlers('portfolio', validatePortfolio);

export function GET(request) {
  return handlers.GET(request);
}

export function PUT(request) {
  return handlers.PUT(request);
}

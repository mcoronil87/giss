// POST /api/auth → comprueba la contraseña del panel (cabecera x-admin-password).
import { json, isAuthorized } from './_lib.js';

export async function POST(request) {
  if (!process.env.ADMIN_PASSWORD) {
    return json({ error: 'Falta configurar ADMIN_PASSWORD en Vercel' }, 500);
  }
  if (!isAuthorized(request)) {
    // Pequeña espera para frenar a quien intente adivinar la contraseña.
    await new Promise((r) => setTimeout(r, 800));
    return json({ error: 'Contraseña incorrecta' }, 401);
  }
  return json({ ok: true });
}

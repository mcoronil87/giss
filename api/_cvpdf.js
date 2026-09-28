// Genera el CV en PDF (A4, fondo negro) a partir de los datos del CV.
// Replica el diseño del PDF que se hacía a mano: una página por sección,
// cabecera con nombre y contacto, y los trabajos en 3 columnas por año.
import { readFileSync } from 'node:fs';
import { PDFDocument, PDFName, PDFString, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const font = (file) => readFileSync(new URL(`../fonts/${file}`, import.meta.url));
const FONT_FILES = {
  serif: 'CormorantGaramond-Regular.ttf',
  serifItalic: 'CormorantGaramond-Italic.ttf',
  light: 'Montserrat-Light.ttf',
  regular: 'Montserrat-Regular.ttf',
  medium: 'Montserrat-Medium.ttf',
};

const hex = (h) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const C = {
  bg: hex('#0a0a0a'),
  gold: hex('#c9a96e'),
  cream: hex('#f5f0e8'),
  grey: hex('#8a8a8a'),
  dim: hex('#777777'),
  line: hex('#3a3326'),
};

// Datos fijos de la cabecera (cámbialos aquí si cambian).
export const CONTACT = {
  phone: '+34 653 710 504',
  email: 'gissrodriguezz@gmail.com',
  web: 'gissrodriguez.vercel.app',
  instagram: '@giss_gissrodriguez',
  tagline: 'MAKE UP & HAIR ARTIST  ·  A CORUÑA, ESPAÑA',
  award: { label: 'NOMINACIÓN', text: 'Premios Fugaz 2020' },
};

const A4 = [595.28, 841.89];
const M = { x: 42, top: 40, bottom: 44 };
const COLS = 3;
const GUTTER = 16;

export async function buildCvPdf(cv, contact = CONTACT) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle('Giss Rodríguez — CV');
  doc.setAuthor('Giss Rodríguez');
  doc.setSubject('Make Up & Hair Artist');
  doc.setLanguage('es-ES');
  const F = {};
  for (const [k, file] of Object.entries(FONT_FILES)) F[k] = await doc.embedFont(font(file), { subset: true });

  const W = A4[0];
  const contentW = W - M.x * 2;
  const colW = (contentW - GUTTER * (COLS - 1)) / COLS;
  let page;
  let y; // distancia desde arriba

  // --- utilidades de dibujo (coordenadas desde arriba, como en diseño) ---
  const text = (str, x, top, f, size, color, opts = {}) =>
    page.drawText(str, { x, y: A4[1] - top - size * 0.8, font: f, size, color, ...opts });
  const spaced = (str, x, top, f, size, color, spacing) => {
    let cx = x;
    for (const ch of str) {
      text(ch, cx, top, f, size, color);
      cx += f.widthOfTextAtSize(ch, size) + spacing;
    }
    return cx - x - spacing;
  };
  const hline = (x1, x2, top, color = C.line, thickness = 0.5) =>
    page.drawLine({ start: { x: x1, y: A4[1] - top }, end: { x: x2, y: A4[1] - top }, thickness, color });
  const wrap = (str, f, size, maxW) => {
    const words = String(str).split(/\s+/);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(next, size) <= maxW || !cur) cur = next;
      else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines;
  };
  const link = (x, top, w, h, url) => {
    const annot = doc.context.obj({
      Type: 'Annot', Subtype: 'Link', Border: [0, 0, 0],
      Rect: [x, A4[1] - top - h, x + w, A4[1] - top],
      A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) },
    });
    const ref = doc.context.register(annot);
    const annots = page.node.lookup(PDFName.of('Annots'));
    if (annots) annots.push(ref); else page.node.set(PDFName.of('Annots'), doc.context.obj([ref]));
  };

  function newPage(sectionTitle) {
    page = doc.addPage(A4);
    page.drawRectangle({ x: 0, y: 0, width: A4[0], height: A4[1], color: C.bg });
    // Nombre
    const nameSize = 24;
    text('Giss', M.x, M.top, F.serif, nameSize, C.cream);
    text('Rodríguez', M.x + F.serif.widthOfTextAtSize('Giss ', nameSize), M.top, F.serifItalic, nameSize, C.gold);
    spaced(contact.tagline, M.x, M.top + 30, F.light, 5.2, C.grey, 1.6);
    // Contacto a la derecha
    const cSize = 6.4;
    const lines = [contact.phone, contact.email, contact.web, contact.instagram];
    lines.forEach((l, i) => {
      const w = F.light.widthOfTextAtSize(l, cSize);
      const top = M.top + 2 + i * 10;
      text(l, W - M.x - w, top, F.light, cSize, C.grey);
      if (l === contact.web) {
        hline(W - M.x - w, W - M.x, top + cSize + 1, C.grey, 0.4);
        link(W - M.x - w, top - 1, w, cSize + 3, `https://${contact.web}`);
      }
      if (l === contact.email) link(W - M.x - w, top - 1, w, cSize + 3, `mailto:${contact.email}`);
    });
    hline(M.x, W - M.x, M.top + 52, C.line, 0.6);
    // Título de sección
    spaced(sectionTitle, M.x, M.top + 68, F.regular, 5.8, C.gold, 2.2);
    hline(M.x, W - M.x, M.top + 80, C.line, 0.4);
    y = M.top + 96;
  }

  // Mide un bloque de año para saber cuánto ocupa
  const PROJECT = { f: () => F.regular, size: 6.6, lh: 8.4 };
  const ROLE = { f: () => F.light, size: 5.6, lh: 7.2 };
  const ITEM_GAP = 6.5;
  const HEAD_H = 26; // año + línea + espacio

  function layoutGroup(group) {
    const items = group.lines.map((l) => ({
      project: wrap(l.project, PROJECT.f(), PROJECT.size, colW),
      role: wrap(l.role.es, ROLE.f(), ROLE.size, colW),
    }));
    const h = HEAD_H + items.reduce((s, it) => s + it.project.length * PROJECT.lh + it.role.length * ROLE.lh + ITEM_GAP, 0);
    return { ...group, items, h };
  }

  function drawGroup(g, x, top) {
    text(String(g.year), x, top, F.serif, 13, C.gold);
    hline(x, x + colW, top + 15.5, C.line, 0.6);
    let t = top + HEAD_H;
    for (const it of g.items) {
      for (const l of it.project) { text(l, x, t, PROJECT.f(), PROJECT.size, C.cream); t += PROJECT.lh; }
      for (const l of it.role) { text(l, x, t, ROLE.f(), ROLE.size, C.dim); t += ROLE.lh; }
      t += ITEM_GAP;
    }
  }

  function yearSection(title, lines) {
    const groups = [];
    for (const l of lines) {
      const last = groups[groups.length - 1];
      if (last && last.year === l.year) last.lines.push(l);
      else groups.push({ year: l.year, lines: [l] });
    }
    const laid = groups.map(layoutGroup);
    newPage(title);
    const maxY = A4[1] - M.bottom;
    for (let i = 0; i < laid.length; i += COLS) {
      const row = laid.slice(i, i + COLS);
      const rowH = Math.max(...row.map((g) => g.h));
      if (y + rowH > maxY && y > M.top + 100) newPage(`${title}  (CONT.)`);
      row.forEach((g, j) => drawGroup(g, M.x + j * (colW + GUTTER), y));
      y += rowH + 14;
    }
  }

  yearSection('CINE Y TELEVISIÓN', cv.film || []);
  yearSection('MODA, PUBLICIDAD Y VIDEOCLIPS', cv.fashion || []);

  // Formación
  newPage('FORMACIÓN');
  const edu = (cv.education || []).map((e) => ({
    title: wrap(e.title, F.regular, 6.6, colW),
    school: wrap(e.school || '', F.light, 5.6, colW),
  }));
  for (let i = 0; i < edu.length; i += COLS) {
    const row = edu.slice(i, i + COLS);
    const rowH = Math.max(...row.map((e) => e.title.length * 8.4 + e.school.length * 7.2));
    row.forEach((e, j) => {
      const x = M.x + j * (colW + GUTTER);
      let t = y;
      for (const l of e.title) { text(l, x, t, F.regular, 6.6, C.cream); t += 8.4; }
      for (const l of e.school) { text(l, x, t, F.light, 5.6, C.gold); t += 7.2; }
    });
    y += rowH + 10;
  }
  if (contact.award) {
    y += 8;
    const w = spaced(contact.award.label, M.x, y + 0.6, F.regular, 5.4, C.gold, 2.2);
    text(contact.award.text, M.x + w + 12, y, F.light, 6.4, C.grey);
  }

  return doc.save();
}

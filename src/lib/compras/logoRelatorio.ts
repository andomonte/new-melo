import fs from 'fs';
import path from 'path';

/** Lê largura/altura do cabeçalho PNG (IHDR) — para preservar a proporção. */
export function lerDimensoesPng(buf: Buffer): { w: number; h: number } | null {
  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  return null;
}

/** Ajusta (wpx,hpx) para caber em (maxW,maxH) preservando a proporção. */
export function ajustarProporcao(
  wpx: number,
  hpx: number,
  maxW: number,
  maxH: number,
): { w: number; h: number } {
  const ratio = wpx > 0 && hpx > 0 ? wpx / hpx : maxW / maxH;
  let w = maxW;
  let h = w / ratio;
  if (h > maxH) {
    h = maxH;
    w = h * ratio;
  }
  return { w, h };
}

/** Logo fixa da Melo (public/images/logoPdf.png) em base64 + dimensões. */
export function getLogoMeloBase64(): { base64: string; largura: number; altura: number } | null {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'images', 'logoPdf.png');
    if (!fs.existsSync(logoPath)) return null;
    const buf = fs.readFileSync(logoPath);
    const dim = lerDimensoesPng(buf);
    return { base64: buf.toString('base64'), largura: dim?.w || 0, altura: dim?.h || 0 };
  } catch {
    return null;
  }
}

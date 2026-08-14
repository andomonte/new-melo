// src/lib/danfe/renderHtmlToPdf.ts
// Renderiza uma string HTML em PDF A4 PAISAGEM via puppeteer (server-side).
// Usado tanto pelo "Salvar PDF" do preview quanto (futuramente) pela emissão,
// garantindo a orientação correta — o print do navegador não respeita @page.
import type { Buffer as NodeBuffer } from 'buffer';

export async function renderHtmlToPdf(html: string): Promise<NodeBuffer> {
  // import dinâmico para não pesar bundles que não usam puppeteer
  const puppeteer = (await import('puppeteer')).default;
  const browser = await puppeteer.launch({
    headless: 'new' as any,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '4mm', bottom: '4mm', left: '4mm', right: '4mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

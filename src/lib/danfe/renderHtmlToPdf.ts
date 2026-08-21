// src/lib/danfe/renderHtmlToPdf.ts
// Renderiza uma string HTML em PDF A4 PAISAGEM via puppeteer (server-side).
// Usado tanto pelo "Salvar PDF" do preview quanto (futuramente) pela emissão,
// garantindo a orientação correta — o print do navegador não respeita @page.
import type { Buffer as NodeBuffer } from 'buffer';
import { existsSync } from 'fs';

// Resolve o executável do Chromium: prioriza PUPPETEER_EXECUTABLE_PATH; se não
// existir, tenta os caminhos comuns do Alpine; senão devolve undefined (dev usa
// o Chromium que o próprio puppeteer baixou).
function resolveChromium(): string | undefined {
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath && existsSync(envPath)) return envPath;
  for (const p of [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/lib/chromium/chromium',
  ]) {
    if (existsSync(p)) return p;
  }
  return undefined;
}

export async function renderHtmlToPdf(
  html: string,
  opts: { landscape?: boolean } = {},
): Promise<NodeBuffer> {
  const landscape = opts.landscape ?? true; // paisagem = padrão (DANFE)
  // import dinâmico para não pesar bundles que não usam puppeteer
  const puppeteer = (await import('puppeteer')).default;
  // Em produção (Alpine) usamos o Chromium do sistema; no dev, o baixado pelo puppeteer.
  const executablePath = resolveChromium();
  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage', // evita crash por /dev/shm pequeno em container
      '--disable-gpu',
    ],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdf = await page.pdf({
      format: 'A4',
      landscape,
      printBackground: true,
      margin: { top: '4mm', bottom: '4mm', left: '4mm', right: '4mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

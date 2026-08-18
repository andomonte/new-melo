import type { NextApiRequest, NextApiResponse } from 'next';
import { renderHtmlToPdf } from '@/lib/danfe/renderHtmlToPdf';

// Recebe o HTML da DANFE (preview) e devolve um PDF A4 paisagem (puppeteer).
// Garante a orientação correta — o "Salvar como PDF" do navegador ignora @page.
export const config = { api: { bodyParser: { sizeLimit: '6mb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
  const { html, filename, orientacao } = req.body || {};
  if (!html || typeof html !== 'string') {
    return res.status(400).json({ error: 'html é obrigatório' });
  }
  try {
    // 'portrait' para a Carta de Correção; padrão paisagem (DANFE).
    const pdf = await renderHtmlToPdf(html, { landscape: orientacao !== 'portrait' });
    const nome = String(filename || 'danfe').replace(/[^\w.-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nome}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    return res.send(pdf);
  } catch (e: any) {
    console.error('Erro ao gerar PDF da DANFE HTML:', e);
    return res.status(500).json({ error: e?.message || 'Erro ao gerar PDF' });
  }
}

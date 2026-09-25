// GET /api/entradas/:id/imprimir-pdf?entrada=1&romaneio=1
// Gera o PDF (A4) da Entrada e/ou Romaneio(s) por armazém (com LOCAÇÃO).
import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { getDadosImpressaoEntrada, gerarHtmlImpressaoEntrada } from '@/lib/entradas/impressaoEntrada';
import { renderHtmlToPdf } from '@/lib/danfe/renderHtmlToPdf';

const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Método não permitido' });
  }
  const codent = String(req.query.id || '').trim();
  if (!codent) return res.status(400).json({ error: 'Código da entrada é obrigatório.' });

  const wantEntrada = req.query.entrada !== '0' && req.query.entrada !== 'false';
  const wantRomaneio = req.query.romaneio !== '0' && req.query.romaneio !== 'false';

  try {
    const dados = await getDadosImpressaoEntrada(pool, codent);
    if (!dados) return res.status(404).json({ error: 'Entrada não encontrada.' });

    const html = gerarHtmlImpressaoEntrada(dados, {
      entrada: wantEntrada,
      romaneio: wantRomaneio,
    });
    const pdf = await renderHtmlToPdf(html, { landscape: false });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="entrada-${codent}.pdf"`);
    return res.status(200).send(pdf);
  } catch (error: any) {
    console.error('Erro ao gerar PDF da entrada:', error);
    return res.status(500).json({ error: 'Erro ao gerar PDF', message: error.message });
  }
}

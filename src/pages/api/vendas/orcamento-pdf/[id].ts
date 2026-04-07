import { NextApiRequest, NextApiResponse } from 'next';
import * as fs from 'fs';
import * as path from 'path';

// Pasta para armazenar PDFs temporários
// No Vercel, apenas /tmp é gravável. Em desenvolvimento, usa pasta local.
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
const PDF_TEMP_DIR = isVercel
  ? '/tmp'
  : path.join(process.cwd(), 'tmp', 'orcamentos');

/**
 * API para servir PDF de orçamento pelo ID
 *
 * GET /api/vendas/orcamento-pdf/[id]
 * - Retorna o PDF para visualização/download
 * - PDFs expiram em 24 horas (limpeza feita na API de geração)
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID do PDF é obrigatório' });
  }

  // Validar formato do ID (UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const pdfFileName = `orcamento_${id}.pdf`;
  const pdfFilePath = path.join(PDF_TEMP_DIR, pdfFileName);

  try {
    // Verificar se o arquivo existe
    if (!fs.existsSync(pdfFilePath)) {
      return res.status(404).json({
        error: 'PDF não encontrado',
        message: 'O orçamento pode ter expirado. Gere um novo PDF.',
      });
    }

    // Ler arquivo
    const pdfBuffer = fs.readFileSync(pdfFilePath);

    // Configurar headers para visualização ou download
    const download = req.query.download === 'true';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);

    if (download) {
      res.setHeader('Content-Disposition', `attachment; filename="orcamento_${id}.pdf"`);
    } else {
      res.setHeader('Content-Disposition', `inline; filename="orcamento_${id}.pdf"`);
    }

    // Cache por 1 hora (já que expira em 24h)
    res.setHeader('Cache-Control', 'private, max-age=3600');

    return res.send(pdfBuffer);
  } catch (error: any) {
    console.error('Erro ao servir PDF:', error);
    return res.status(500).json({
      error: 'Erro ao carregar PDF',
      message: error.message,
    });
  }
}

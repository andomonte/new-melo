import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

// Configuração para aumentar limite de resposta (PDFs podem ser grandes)
export const config = {
  api: {
    responseLimit: '15mb',
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { codfat } = req.query;

  if (!codfat || typeof codfat !== 'string') {
    return res.status(400).json({ error: 'Código da fatura é obrigatório' });
  }

  const client = await pool.connect();
  try {
    // Buscar o PDF da nota na tabela dbfat_nfe
    const result = await client.query(
      `SELECT 
        imagem,
        chave,
        numprotocolo,
        modelo,
        status,
        motivo
       FROM db_manaus.dbfat_nfe 
       WHERE codfat = $1 
       AND status = '100'
       ORDER BY data DESC 
       LIMIT 1`,
      [codfat]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Nota fiscal não encontrada' });
    }

    const nota = result.rows[0];

    if (!nota.imagem) {
      return res.status(404).json({ error: 'PDF da nota não encontrado' });
    }

    // Determinar tipo do documento pelo modelo
    const tipoDocumento = nota.modelo === '65' ? 'NFC-e' : 'NF-e';

    // Converter buffer para base64
    const pdfBase64 = Buffer.isBuffer(nota.imagem) 
      ? nota.imagem.toString('base64')
      : nota.imagem;

    return res.status(200).json({
      pdfBase64,
      chaveAcesso: nota.chave,
      protocolo: nota.numprotocolo,
      tipoDocumento,
      status: nota.status,
      motivo: nota.motivo,
    });
  } catch (error: any) {
    console.error('Erro ao buscar PDF da nota:', error);
    return res.status(500).json({ error: 'Erro ao buscar PDF da nota fiscal' });
  } finally {
    client.release();
  }
}

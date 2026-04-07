import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const client = await getPgPool().connect();

    // Buscar bancos
    const bancos = await client.query(`
      SELECT banco, nome
      FROM dbbanco_cobranca
      ORDER BY nome
    `);

    // Buscar tipos de documento (formas de pagamento)
    const tiposDocumento = await client.query(`
      SELECT codigo, descricao
      FROM db_manaus.dbtipo_documento
      WHERE ativo = true
      ORDER BY ordem, descricao
    `);

    // Buscar tipos de fatura
    const tiposFatura = await client.query(`
      SELECT codigo, descricao
      FROM db_manaus.dbtipo_fatura
      WHERE ativo = true
      ORDER BY ordem, descricao
    `);

    client.release();

    return res.status(200).json({
      bancos: bancos.rows, // [{ banco: '001', nome: 'BRADESCO' }, ...]
      tiposDocumento: tiposDocumento.rows, // [{ codigo: '$', descricao: 'DINHEIRO' }, ...]
      tiposFatura: tiposFatura.rows, // [{ codigo: 'B', descricao: 'BOLETO' }, ...]
    });
  } catch (error) {
    console.error('Erro ao buscar opções de cobrança:', error);
    return res
      .status(500)
      .json({ error: 'Erro interno ao buscar opções de cobrança.' });
  }
}

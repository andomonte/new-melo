import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
  }

  try {
    const { codremessa } = req.query;

    if (!codremessa) {
      return res.status(400).json({ erro: 'Parâmetro codremessa é obrigatório' });
    }

    // Buscar detalhes da remessa
    const query = `
      SELECT
        d."CODREMESSA_DETALHE" as id,
        d."CODREMESSA" as codremessa,
        d."CODCLI" as codcli,
        d."DOCUMENTO" as documento,
        d."VALOR" as valor,
        d."NROBANCO" as nro_banco,
        c.nome as nome_cliente,
        c.cpfcgc as cpf_cnpj
      FROM dbremessa_detalhe d
      LEFT JOIN dbclien c ON c.codcli = d."CODCLI"
      WHERE d."CODREMESSA" = $1
      ORDER BY d."CODREMESSA_DETALHE"
    `;

    const result = await pool.query(query, [codremessa]);

    res.status(200).json({
      detalhes: result.rows,
      total: result.rows.length
    });

  } catch (error: any) {
    console.error('❌ Erro ao consultar detalhes da remessa:', error);
    res.status(500).json({
      erro: 'Erro interno do servidor',
      detalhes: error.message
    });
  }
}
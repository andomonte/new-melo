import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
  }

  const { cod_receb } = req.query;

  if (!cod_receb) {
    return res.status(400).json({ erro: 'cod_receb é obrigatório' });
  }

  const client = await pool.connect();

  try {
    // Buscar histórico de recebimentos (DBFRECEB)
    const queryHistorico = `
      SELECT 
        cod_freceb,
        cod_receb,
        dt_pgto,
        dt_venc,
        dt_emissao,
        valor,
        tipo,
        sf,
        nome as observacao,
        codopera,
        dt_cartao,
        tx_cartao,
        nro_cheque,
        codbc,
        cxgeral,
        fre_cof_id,
        cmc7,
        id_autenticacao,
        codusr,
        cod_conta,
        parcela,
        coddocumento,
        codautorizacao
      FROM db_manaus.dbfreceb
      WHERE cod_receb = $1
      ORDER BY cod_freceb DESC, dt_pgto DESC
    `;

    const resultHistorico = await client.query(queryHistorico, [cod_receb]);

    return res.status(200).json({
      sucesso: true,
      historico: resultHistorico.rows || []
    });

  } catch (error) {
    console.error('Erro ao buscar histórico de recebimentos:', error);
    return res.status(500).json({
      erro: 'Erro interno do servidor',
      detalhes: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  } finally {
    client.release();
  }
}

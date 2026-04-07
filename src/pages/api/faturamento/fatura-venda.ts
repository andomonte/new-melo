import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { codfat } = req.query;
  if (!codfat) {
    return res.status(400).json({ error: 'Parâmetro codfat obrigatório' });
  }

  try {
    const pool = getPgPool();
    const { rows } = await pool.query(
      `SELECT fv.id, fv.codfat, fv.codvenda, fv.data_associacao, fv.valor_venda, fv.observacao, fv.usuario_associacao, fv.status,
              v.nrovenda, v.codvend, v.data, v.obs, v.total, v.codcli, v.transp, c.nome AS cliente_nome, c.nomefant, c.cpfcgc, c.bairro, c.cidade, c.uf, c.cep
       FROM fatura_venda fv
       LEFT JOIN dbvenda v ON fv.codvenda = v.codvenda
       LEFT JOIN dbclien c ON v.codcli = c.codcli
       WHERE fv.codfat = $1`,
      [codfat]
    );
    return res.status(200).json(rows);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar associações fatura-venda', details: String(error) });
  }
}

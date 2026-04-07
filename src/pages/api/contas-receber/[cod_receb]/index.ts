import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
  }

  const { cod_receb } = req.query;

  if (!cod_receb || typeof cod_receb !== 'string') {
    return res.status(400).json({ erro: 'ID da conta é obrigatório' });
  }

  try {
    // Buscar conta específica com todas as informações
    const query = `
      SELECT
        r.cod_receb as id,
        r.cod_conta,
        r.codcli,
        c.nome as nome_cliente,
        r.dt_venc,
        r.dt_pgto,
        r.dt_emissao,
        r.valor_rec,
        r.valor_pgto,
        r.nro_doc,
        r.tipo,
        r.rec,
        r.cancel,
        r.banco,
        r.nro_banco,
        r.nro_docbanco,
        r.bradesco,
        r.forma_fat,
        r.cod_fat,
        r.cod_venda,
        co.nro_conta as descricao_conta,
        COALESCE(r.valor_rec, 0) as total_recebido_historico,
        CAST(NULL AS TEXT) as parcela_atual,
        CASE
          WHEN r.cancel = 'S' THEN 'cancelado'
          WHEN r.rec = 'S' AND COALESCE(r.valor_rec, 0) >= COALESCE(r.valor_pgto, 0) THEN 'recebido'
          WHEN r.rec = 'S' AND COALESCE(r.valor_rec, 0) > 0 THEN 'recebido_parcial'
          WHEN r.dt_venc < CURRENT_DATE THEN 'vencido'
          ELSE 'pendente'
        END as status,
        CASE
          WHEN r.dt_venc < CURRENT_DATE AND (r.rec IS NULL OR r.rec != 'S')
          THEN CURRENT_DATE - r.dt_venc
          ELSE 0
        END as dias_atraso
      FROM db_manaus.dbreceb r
      LEFT JOIN db_manaus.dbclien c ON c.codcli = r.codcli
      LEFT JOIN db_manaus.dbconta co ON co.cod_conta = r.cod_conta
      WHERE r.cod_receb = $1
    `;

    const result = await pool.query(query, [cod_receb]);

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Conta não encontrada' });
    }

    const row = result.rows[0];

    const conta = {
      id: row.id,
      cod_receb: row.id,
      cod_conta: row.cod_conta,
      descricao_conta: row.descricao_conta,
      codcli: row.codcli,
      nome_cliente: row.nome_cliente,
      dt_venc: row.dt_venc,
      dt_pgto: row.dt_pgto,
      dt_emissao: row.dt_emissao,
      valor_rec: parseFloat(row.valor_rec || 0),
      valor_pgto: parseFloat(row.valor_pgto || 0),
      nro_doc: row.nro_doc,
      tipo: row.tipo,
      rec: row.rec,
      cancel: row.cancel,
      banco: row.banco,
      nro_banco: row.nro_banco,
      nro_docbanco: row.nro_docbanco,
      bradesco: row.bradesco,
      forma_fat: row.forma_fat,
      cod_fat: row.cod_fat,
      cod_venda: row.cod_venda,
      status: row.status,
      dias_atraso: parseInt(row.dias_atraso || 0),
      total_recebido_historico: parseFloat(row.total_recebido_historico || 0),
      parcela_atual: row.parcela_atual,
    };

    return res.status(200).json(conta);

  } catch (error) {
    console.error('Erro ao buscar conta a receber:', error);
    return res.status(500).json({
      erro: 'Erro interno do servidor',
      detalhes: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}

import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ erro: 'ID da conta é obrigatório' });
  }

  try {
    // Buscar conta específica com todas as informações
    const query = `
      SELECT
        p.cod_pgto as id,
        p.cod_conta,
        p.cod_credor,
        c.nome as nome_credor,
        p.cod_ccusto,
        cc.descr as descricao_ccusto,
        p.dt_venc,
        p.dt_pgto,
        p.dt_emissao,
        p.valor_pgto,
        p.valor_pago,
        p.nro_nf,
        p.obs,
        p.tem_nota,
        p.tem_cobr,
        p.tipo,
        p.paga,
        p.cancel,
        p.nro_dup,
        p.codcomprador,
        p.valor_juros,
        p.banco,
        p.ordem_compra,
        co.nro_conta as descricao_conta,
        COALESCE(
          (SELECT SUM(f.valor_pgto) 
           FROM db_manaus.dbfpgto f 
           WHERE f.cod_pgto = p.cod_pgto 
             AND (f.cancel IS NULL OR f.cancel != 'S')
          ), 0
        ) as total_pago_historico,
        CASE
          WHEN p.cancel = 'S' THEN 'cancelado'
          WHEN COALESCE(
            (SELECT SUM(f.valor_pgto) 
             FROM db_manaus.dbfpgto f 
             WHERE f.cod_pgto = p.cod_pgto 
               AND (f.cancel IS NULL OR f.cancel != 'S')
            ), 0
          ) >= p.valor_pgto THEN 'pago'
          WHEN COALESCE(
            (SELECT SUM(f.valor_pgto) 
             FROM db_manaus.dbfpgto f 
             WHERE f.cod_pgto = p.cod_pgto 
               AND (f.cancel IS NULL OR f.cancel != 'S')
            ), 0
          ) > 0 THEN 'pago_parcial'
          ELSE 'pendente'
        END as status
      FROM db_manaus.dbpgto p
      LEFT JOIN db_manaus.dbcredor c ON c.cod_credor = p.cod_credor
      LEFT JOIN db_manaus.dbccusto cc ON cc.cod_ccusto = p.cod_ccusto
      LEFT JOIN db_manaus.dbconta co ON co.cod_conta = p.cod_conta
      WHERE p.cod_pgto = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Conta não encontrada' });
    }

    const conta = result.rows[0];

    // Extrair número da parcela do campo nro_dup (formato: "base/01", "base/02")
    let parcela_atual = null;
    if (conta.nro_dup && conta.nro_dup.includes('/')) {
      const partes = conta.nro_dup.split('/');
      parcela_atual = partes[1]; // "01", "02", "03"
    }

    // Formatar dados
    const contaFormatada = {
      ...conta,
      dt_venc: conta.dt_venc ? new Date(conta.dt_venc).toISOString().split('T')[0] : null,
      dt_pgto: conta.dt_pgto ? new Date(conta.dt_pgto).toISOString().split('T')[0] : null,
      dt_emissao: conta.dt_emissao ? new Date(conta.dt_emissao).toISOString().split('T')[0] : null,
      valor_pgto: parseFloat(conta.valor_pgto || 0),
      valor_pago: parseFloat(conta.valor_pago || 0),
      valor_juros: parseFloat(conta.valor_juros || 0),
      parcela_atual: parcela_atual,
      eh_parcelada: parcela_atual !== null
    };

    res.status(200).json({
      conta: contaFormatada
    });

  } catch (error: any) {
    console.error('❌ Erro ao buscar conta:', error);
    res.status(500).json({
      erro: 'Erro interno do servidor',
      detalhes: error.message
    });
  }
}

import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Método não permitido'
    });
  }

  const { entrada_id } = req.query;
  const cookies = parseCookies({ req });
  const filial = cookies.filial || 'manaus';

  let client: PoolClient | null = null;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Buscar contas a pagar relacionadas à entrada
    const query = `
      SELECT
        p.cod_pgto,
        p.cod_credor,
        f.nome as fornecedor_nome,
        f.nome_fant as fornecedor_nome_fantasia,
        p.nro_nf,
        p.valor_pgto,
        p.valor_pago,
        p.valor_juros,
        p.dt_venc,
        p.dt_emissao,
        p.dt_pgto,
        p.paga,
        p.cancel,
        cf.cof_descricao as conta_financeira_nome,
        p.pag_cof_id,
        p.cod_ccusto,
        p.tipo,
        p.obs,
        pe.codent,
        CASE
          WHEN p.paga = 'S' THEN 'PAGA'
          WHEN p.valor_pago > 0 THEN 'PARCIAL'
          ELSE 'PENDENTE'
        END as status_traducido
      FROM dbpgto_ent pe
      INNER JOIN dbpgto p ON p.cod_pgto = pe.codpgto
      LEFT JOIN dbcredor f ON f.cod_credor = p.cod_credor
      LEFT JOIN cad_conta_financeira cf ON cf.cof_id = p.pag_cof_id
      WHERE pe.codent = $1 AND p.cancel = 'N'
      ORDER BY p.dt_venc ASC
    `;

    const result = await client.query(query, [entrada_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Nenhuma conta a pagar encontrada para esta entrada'
      });
    }

    // Calcular totais
    const totais = result.rows.reduce((acc, conta) => {
      acc.valor_total += parseFloat(conta.valor_pgto);
      acc.valor_pago += parseFloat(conta.valor_pago || 0);
      acc.valor_juros += parseFloat(conta.valor_juros || 0);
      return acc;
    }, {
      valor_total: 0,
      valor_pago: 0,
      valor_juros: 0
    });

    const valor_pendente = totais.valor_total + totais.valor_juros - totais.valor_pago;

    // Status geral da entrada
    const statusContas = result.rows.map(c => c.paga);
    let status_geral = 'PENDENTE';

    if (statusContas.every(s => s === 'S')) {
      status_geral = 'PAGA';
    } else if (statusContas.some(s => s === 'S') || result.rows.some(r => parseFloat(r.valor_pago || 0) > 0)) {
      status_geral = 'PARCIAL';
    }

    res.status(200).json({
      success: true,
      data: {
        entrada_id: entrada_id,
        contas: result.rows,
        resumo: {
          total_contas: result.rows.length,
          valor_total: totais.valor_total,
          valor_pago: totais.valor_pago,
          valor_juros: totais.valor_juros,
          valor_pendente: Math.max(0, valor_pendente),
          status_geral
        }
      }
    });

  } catch (error) {
    console.error('Erro ao buscar contas por entrada:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
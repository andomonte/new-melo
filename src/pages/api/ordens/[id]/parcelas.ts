import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'manaus';

  const { id } = req.query;
  const orcId = parseInt(id as string, 10);

  if (isNaN(orcId)) {
    return res.status(400).json({ error: 'ID da ordem de compra inválido' });
  }

  const pool = getPgPool(filial);
  const client = await pool.connect();

  try {
    // Buscar parcelas com informações completas de pagamento
    const result = await client.query(
      `SELECT
        opp.id,
        opp.orc_id,
        opp.numero_parcela,
        opp.valor_parcela,
        opp.data_vencimento,
        opp.status,
        opp.banco,
        opp.tipo_documento,
        opp.dias as prazo_dias,
        opp.created_at,
        opp.updated_at,

        -- Dados da ligação com conta a pagar (se existir)
        opc.cod_pgto,

        -- Dados do pagamento em dbpgto (se existir)
        p.dt_emissao as data_emissao,
        p.dt_venc as data_vencimento_pgto,
        p.valor_pago,
        p.paga as pagamento_realizado,
        p.cancel as pagamento_cancelado,
        p.obs as observacao_pagamento

      FROM db_manaus.ordem_pagamento_parcelas opp
      LEFT JOIN db_manaus.ordem_pagamento_conta opc
        ON opp.orc_id = opc.orc_id
        AND opp.numero_parcela = opc.numero_parcela
      LEFT JOIN db_manaus.dbpgto p
        ON opc.cod_pgto = p.cod_pgto
      WHERE opp.orc_id = $1
      ORDER BY opp.numero_parcela`,
      [orcId]
    );

    // Separar entrada das parcelas normais
    const temEntrada = result.rows.some(row => row.numero_parcela === 0);
    const totalParcelasNormais = result.rows.filter(row => row.numero_parcela > 0).length;

    const parcelas = result.rows.map(row => {
      const isEntrada = row.numero_parcela === 0;

      return {
        id: row.id,
        numero_parcela: row.numero_parcela,
        valor_parcela: parseFloat(row.valor_parcela),
        data_vencimento: row.data_vencimento,
        status: row.status,
        banco: row.banco,
        tipo_documento: row.tipo_documento,
        prazo_dias: row.prazo_dias,

        // Informações de pagamento
        valor_pago: parseFloat(row.valor_pago || 0),
        pagamento_realizado: row.pagamento_realizado === 'S',
        pagamento_cancelado: row.pagamento_cancelado === 'S',
        data_emissao: row.data_emissao,
        observacao_pagamento: row.observacao_pagamento,

        // Código do pagamento para rastreamento
        cod_pgto: row.cod_pgto,

        // Informações para exibição
        is_entrada: isEntrada,
        total_parcelas_normais: totalParcelasNormais,
      };
    });

    res.status(200).json({
      success: true,
      data: parcelas,
      total: parcelas.length,
      tem_entrada: temEntrada,
      total_parcelas_normais: totalParcelasNormais,
    });

  } catch (error: any) {
    console.error('Erro ao buscar parcelas da ordem:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor'
    });
  } finally {
    client.release();
  }
}

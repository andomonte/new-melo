import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  const { id } = req.query;
  const orcId = parseInt(id as string, 10);

  if (isNaN(orcId)) {
    return res.status(400).json({ error: 'ID da ordem de compra inválido' });
  }

  const pool = getPgPool(filial);

  try {
    // Buscar configuração da ordem
    const ordemResult = await pool.query(
      `SELECT
        orc_pagamento_configurado,
        orc_banco,
        orc_tipo_documento,
        orc_valor_entrada
      FROM db_manaus.cmp_ordem_compra
      WHERE orc_id = $1`,
      [orcId]
    );

    if (ordemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ordem de compra não encontrada' });
    }

    const ordem = ordemResult.rows[0];

    // Buscar parcelas
    const parcelasResult = await pool.query(
      `SELECT
        id,
        numero_parcela,
        dias,
        data_vencimento,
        valor_parcela,
        status,
        created_at,
        updated_at
      FROM db_manaus.ordem_pagamento_parcelas
      WHERE orc_id = $1
      ORDER BY numero_parcela ASC`,
      [orcId]
    );

    // Preparar lista de parcelas incluindo entrada se houver
    const parcelasMapeadas = parcelasResult.rows.map(p => ({
      id: p.id,
      numero_parcela: p.numero_parcela,
      dias: p.dias,
      data_vencimento: new Date(p.data_vencimento).toISOString().split('T')[0],
      valor_parcela: parseFloat(p.valor_parcela),
      status: p.status,
    }));

    const configuracao = ordem.orc_pagamento_configurado ? {
      banco: ordem.orc_banco,
      tipoDocumento: ordem.orc_tipo_documento,
      valorEntrada: ordem.orc_valor_entrada ? ordem.orc_valor_entrada.toString() : '0',
      habilitarEntrada: ordem.orc_valor_entrada && parseFloat(ordem.orc_valor_entrada) > 0,
      parcelas: parcelasMapeadas
    } : null;

    res.status(200).json({
      success: true,
      configuracao,
      parcelas: parcelasResult.rows.map(p => ({
        id: p.id,
        numero_parcela: p.numero_parcela,
        dias: p.dias,
        data: new Date(p.data_vencimento).toISOString(),
        valor_parcela: parseFloat(p.valor_parcela),
        status: p.status,
      }))
    });

  } catch (error: any) {
    console.error("Erro ao buscar parcelas:", error);
    res.status(500).json({ error: error.message || 'Erro interno do servidor' });
  }
}

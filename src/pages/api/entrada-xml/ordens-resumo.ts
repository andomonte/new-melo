import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

interface OrdemResumida {
  orc_id: number;
  orc_valor_total: number;
  orc_pagamento_configurado: boolean;
  orc_valor_entrada?: number;
  fornecedor_nome: string;
  total_parcelas?: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { ordensIds } = req.body;

  if (!ordensIds || !Array.isArray(ordensIds) || ordensIds.length === 0) {
    return res.status(400).json({ error: 'ordensIds é obrigatório e deve ser um array' });
  }

  let client;

  try {
    client = await pool.connect();

    // Buscar informações das ordens
    const ordensQuery = `
      SELECT
        o.orc_id,
        o.orc_valor_total,
        o.orc_pagamento_configurado,
        o.orc_valor_entrada,
        COALESCE(f.nome_fant, f.nome) as fornecedor_nome
      FROM db_manaus.cmp_ordem_compra o
      LEFT JOIN db_manaus.cmp_requisicao r
        ON o.orc_req_id = r.req_id
        AND o.orc_req_versao = r.req_versao
      LEFT JOIN db_manaus.dbcredor f
        ON r.req_cod_credor = f.cod_credor
      WHERE o.orc_id = ANY($1)
    `;

    const ordensResult = await client.query(ordensQuery, [ordensIds]);

    // Para cada ordem configurada, buscar número de parcelas
    const ordens: OrdemResumida[] = await Promise.all(
      ordensResult.rows.map(async (ordem) => {
        let totalParcelas = 0;

        if (ordem.orc_pagamento_configurado) {
          const parcelasResult = await client.query(
            `SELECT COUNT(*) as total
             FROM db_manaus.ordem_pagamento_parcelas
             WHERE orc_id = $1`,
            [ordem.orc_id]
          );
          totalParcelas = parseInt(parcelasResult.rows[0]?.total || '0');
        }

        return {
          orc_id: ordem.orc_id,
          orc_valor_total: parseFloat(ordem.orc_valor_total || 0),
          orc_pagamento_configurado: ordem.orc_pagamento_configurado || false,
          orc_valor_entrada: ordem.orc_valor_entrada ? parseFloat(ordem.orc_valor_entrada) : undefined,
          fornecedor_nome: ordem.fornecedor_nome || 'Fornecedor Desconhecido',
          total_parcelas: totalParcelas > 0 ? totalParcelas : undefined
        };
      })
    );

    res.status(200).json({ success: true, ordens });
  } catch (err) {
    console.error('Erro ao buscar resumo das ordens:', err);
    res.status(500).json({
      error: 'Falha ao buscar resumo das ordens',
      message: err instanceof Error ? err.message : 'Erro desconhecido'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

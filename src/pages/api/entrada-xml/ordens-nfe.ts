/**
 * GET /api/entrada-xml/ordens-nfe?nfeId=xxx
 * Busca as ordens de compra associadas a uma NFe
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { nfeId } = req.query;

  if (!nfeId) {
    return res.status(400).json({ error: 'nfeId e obrigatorio' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial || 'manaus';

  let client;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();
    await client.query('SET search_path TO db_manaus');

    // Buscar ordens associadas a esta NFe atraves da tabela de associacao
    const query = `
      SELECT DISTINCT
        o.orc_id,
        o.orc_valor_total,
        o.orc_pagamento_configurado,
        f.nome as orc_fornecedor_nome,
        o.orc_status,
        o.orc_data
      FROM nfe_item_pedido_associacao nipa
      INNER JOIN cmp_ordem_compra o ON o.orc_id = nipa.req_id::bigint
      INNER JOIN cmp_requisicao r ON o.orc_req_id = r.req_id AND o.orc_req_versao = r.req_versao
      LEFT JOIN dbcredor f ON f.cod_credor = r.req_cod_credor
      WHERE nipa.nfe_id = $1
      ORDER BY o.orc_id DESC
    `;

    const result = await client.query(query, [nfeId]);

    const ordens = result.rows.map((row: any) => ({
      orc_id: row.orc_id,
      orc_valor_total: parseFloat(row.orc_valor_total) || 0,
      orc_pagamento_configurado: row.orc_pagamento_configurado === true || row.orc_pagamento_configurado === 1,
      orc_fornecedor_nome: row.orc_fornecedor_nome || 'Fornecedor',
      orc_status: row.orc_status,
      orc_data: row.orc_data
    }));

    return res.status(200).json({ ordens });

  } catch (error) {
    console.error('Erro ao buscar ordens da NFe:', error);
    return res.status(500).json({ error: 'Erro ao buscar ordens' });
  } finally {
    if (client) {
      client.release();
    }
  }
}

import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { id } = req.query;
  const ordemId = parseInt(id as string);

  if (isNaN(ordemId)) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  let client;

  try {
    client = await pool.connect();

    // Buscar ordem com detalhes do fornecedor
    const ordemQuery = `
      SELECT
        o.orc_id,
        o.orc_valor_total,
        o.orc_pagamento_configurado,
        o.orc_valor_entrada,
        o.orc_banco,
        o.orc_tipo_documento,
        o.orc_status,
        o.orc_req_id,
        o.orc_req_versao,
        r.req_cod_credor,
        COALESCE(f.nome_fant, f.nome) as fornecedor_nome
      FROM db_manaus.cmp_ordem_compra o
      LEFT JOIN db_manaus.cmp_requisicao r
        ON o.orc_req_id = r.req_id
        AND o.orc_req_versao = r.req_versao
      LEFT JOIN db_manaus.dbcredor f
        ON r.req_cod_credor = f.cod_credor
      WHERE o.orc_id = $1
    `;

    const ordemResult = await client.query(ordemQuery, [ordemId]);

    if (ordemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ordem não encontrada' });
    }

    const ordem = ordemResult.rows[0];

    // Buscar parcelas se já configurado
    let parcelas = [];
    if (ordem.orc_pagamento_configurado) {
      const parcelasResult = await client.query(
        `SELECT
          numero_parcela,
          valor_parcela,
          dias,
          data_vencimento,
          tipo_documento,
          status
         FROM db_manaus.ordem_pagamento_parcelas
         WHERE orc_id = $1
         ORDER BY numero_parcela`,
        [ordemId]
      );
      parcelas = parcelasResult.rows;
    }

    res.status(200).json({
      orc_id: ordem.orc_id,
      orc_valor_total: parseFloat(ordem.orc_valor_total || 0),
      orc_pagamento_configurado: ordem.orc_pagamento_configurado || false,
      orc_valor_entrada: ordem.orc_valor_entrada ? parseFloat(ordem.orc_valor_entrada) : 0,
      orc_banco: ordem.orc_banco,
      orc_tipo_documento: ordem.orc_tipo_documento,
      orc_status: ordem.orc_status,
      fornecedor_nome: ordem.fornecedor_nome || 'Fornecedor Desconhecido',
      parcelas
    });
  } catch (err) {
    console.error('Erro ao buscar ordem:', err);
    res.status(500).json({
      error: 'Falha ao buscar ordem',
      message: err instanceof Error ? err.message : 'Erro desconhecido'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

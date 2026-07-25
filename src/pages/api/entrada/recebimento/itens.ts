/**
 * Endpoint para buscar itens de uma entrada para conferencia
 * GET /api/entrada/recebimento/itens
 *
 * Query params:
 * - entradaId: ID da entrada
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';

interface ItemEntradaRecebimento {
  id: number;
  entrada_item_id: number;
  produto_cod: string;
  produto_nome: string;
  qtd_esperada: number;
  qtd_recebida: number | null;
  status_item: string;
  observacao: string | null;
  unidade: string;
}

interface ItensResponse {
  data: ItemEntradaRecebimento[];
  meta: {
    total: number;
    conferidos: number;
    pendentes: number;
  };
}

// Itens da entrada (dbitent) + conferência (entrada_itens_recebimento por codent/produto/codreq).
// entrada_item_id = id da linha de conferência (usado pelo frontend em conferir-item).
const ITENS_QUERY = `
  SELECT
    COALESCE(eir.id, 0) as id,
    COALESCE(eir.id, 0) as entrada_item_id,
    ie.codprod as produto_cod,
    COALESCE(p.descr, 'Produto nao identificado') as produto_nome,
    ie.quant as qtd_esperada,
    eir.qtd_recebida,
    COALESCE(eir.status_item, 'PENDENTE') as status_item,
    eir.observacao,
    COALESCE(p.unimed, 'UN') as unidade
  FROM db_manaus.dbitent ie
  LEFT JOIN db_manaus.entrada_itens_recebimento eir
    ON eir.codent = ie.codent AND eir.produto_cod = ie.codprod
   AND COALESCE(eir.codreq,'') = COALESCE(ie.codreq,'')
  LEFT JOIN db_manaus.dbprod p ON p.codprod = ie.codprod
  WHERE ie.codent = $1
  ORDER BY ie.codprod
`;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ItensResponse | { error: string }>,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  const entradaId = (req.query.entradaId as string) || ''; // codent

  if (!entradaId) {
    return res.status(400).json({ error: 'entradaId e obrigatorio' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS';

  const pool = getPgPool(filial);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    const result = await client.query(ITENS_QUERY, [entradaId]);

    const itens: ItemEntradaRecebimento[] = result.rows.map(row => ({
      id: parseInt(row.id),
      entrada_item_id: parseInt(row.entrada_item_id),
      produto_cod: row.produto_cod,
      produto_nome: row.produto_nome,
      qtd_esperada: parseFloat(row.qtd_esperada || 0),
      qtd_recebida: row.qtd_recebida ? parseFloat(row.qtd_recebida) : null,
      status_item: row.status_item,
      observacao: row.observacao,
      unidade: row.unidade,
    }));

    const conferidos = itens.filter(i => i.status_item !== 'PENDENTE').length;
    const pendentes = itens.length - conferidos;

    console.log(`Itens entrada ${entradaId}: ${itens.length} total, ${conferidos} conferidos`);

    return res.status(200).json({
      data: itens,
      meta: {
        total: itens.length,
        conferidos,
        pendentes,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar itens da entrada:', error);

    return res.status(500).json({
      error: 'Erro ao buscar itens',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

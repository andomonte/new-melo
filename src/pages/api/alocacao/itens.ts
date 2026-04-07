/**
 * Endpoint para buscar itens de uma entrada para alocacao
 * GET /api/entrada/alocacao/itens
 *
 * Query params:
 * - entradaId: ID da entrada
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';

interface RomaneioItem {
  arm_id: number;
  arm_descricao: string;
  qtd: number;
  localizacao_existente?: string; // Localização já cadastrada para este produto neste armazém
}

interface ItemEntradaAlocacao {
  id: number;
  entrada_item_id: number;
  produto_cod: string;
  produto_nome: string;
  qtd_recebida: number;
  qtd_alocada: number;
  status_alocacao: string;
  unidade: string;
  romaneio_planejado: RomaneioItem[];
}

interface ItensResponse {
  data: ItemEntradaAlocacao[];
  meta: {
    total: number;
    alocados: number;
    pendentes: number;
  };
}

// Query para buscar numero_entrada
const ENTRADA_QUERY = `
  SELECT numero_entrada FROM entradas_estoque WHERE id = $1
`;

// Query para buscar itens de uma entrada para alocacao
// Nota: dbitent_armazem usa codent (numero_entrada), não entrada_id
// E usa codprod, não cod_produto
// IMPORTANTE: Agrupa alocações por codprod apenas (não por arm_id) para evitar duplicação
const ITENS_QUERY = `
  SELECT
    COALESCE(eir.id, ei.id) as id,
    ei.id as entrada_item_id,
    ei.produto_cod as produto_cod,
    COALESCE(p.descr, 'Produto nao identificado') as produto_nome,
    COALESCE(eir.qtd_recebida, ei.quantidade) as qtd_recebida,
    COALESCE(aloc.qtd_alocada, 0) as qtd_alocada,
    CASE
      WHEN COALESCE(aloc.qtd_alocada, 0) >= COALESCE(eir.qtd_recebida, ei.quantidade) THEN 'ALOCADO'
      WHEN COALESCE(aloc.qtd_alocada, 0) > 0 THEN 'PARCIAL'
      ELSE 'PENDENTE'
    END as status_alocacao,
    'UN' as unidade
  FROM entrada_itens ei
  LEFT JOIN entrada_itens_recebimento eir ON eir.entrada_item_id = ei.id
  LEFT JOIN dbprod p ON p.codprod = ei.produto_cod
  LEFT JOIN (
    SELECT
      codprod,
      SUM(qtd) as qtd_alocada
    FROM dbitent_armazem
    WHERE codent = $2
    GROUP BY codprod
  ) aloc ON aloc.codprod = ei.produto_cod
  WHERE ei.entrada_id = $1
  ORDER BY ei.id
`;

// Query para buscar romaneio planejado (salvo via RomaneioModal) + localização existente
const ROMANEIO_QUERY = `
  SELECT
    da.codprod as produto_cod,
    da.arm_id,
    ca.arm_descricao,
    da.qtd,
    loc.apl_descricao as localizacao_existente
  FROM dbitent_armazem da
  INNER JOIN cad_armazem ca ON ca.arm_id = da.arm_id
  LEFT JOIN cad_armazem_produto_locacao loc
    ON loc.apl_arm_id = da.arm_id AND loc.apl_codprod = da.codprod
  WHERE da.codent = $1
  ORDER BY da.codprod, da.arm_id
`;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ItensResponse | { error: string }>,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  const entradaId = parseInt(req.query.entradaId as string);

  if (!entradaId || isNaN(entradaId)) {
    return res.status(400).json({ error: 'entradaId e obrigatorio' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS';

  const pool = getPgPool(filial);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    // 1. Buscar numero_entrada para poder buscar romaneio
    const entradaResult = await client.query(ENTRADA_QUERY, [entradaId]);
    if (entradaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Entrada nao encontrada' });
    }
    const numeroEntrada = entradaResult.rows[0].numero_entrada;

    // 2. Buscar itens da entrada (passa entradaId e numeroEntrada)
    const result = await client.query(ITENS_QUERY, [entradaId, numeroEntrada]);

    // 3. Buscar romaneio planejado (salvo via RomaneioModal, usa codent = numero_entrada)
    const romaneioResult = await client.query(ROMANEIO_QUERY, [numeroEntrada]);

    // 4. Agrupar romaneio por produto (inclui localização existente se houver)
    const romaneioMap: { [produtoCod: string]: RomaneioItem[] } = {};
    for (const row of romaneioResult.rows) {
      const produtoCod = row.produto_cod;
      if (!romaneioMap[produtoCod]) {
        romaneioMap[produtoCod] = [];
      }
      romaneioMap[produtoCod].push({
        arm_id: parseInt(row.arm_id),
        arm_descricao: row.arm_descricao,
        qtd: parseFloat(row.qtd),
        localizacao_existente: row.localizacao_existente || undefined,
      });
    }

    // 5. Montar itens com romaneio_planejado
    const itens: ItemEntradaAlocacao[] = result.rows.map(row => ({
      id: parseInt(row.id || 0),
      entrada_item_id: parseInt(row.entrada_item_id),
      produto_cod: row.produto_cod,
      produto_nome: row.produto_nome,
      qtd_recebida: parseFloat(row.qtd_recebida || 0),
      qtd_alocada: parseFloat(row.qtd_alocada || 0),
      status_alocacao: row.status_alocacao,
      unidade: row.unidade,
      romaneio_planejado: romaneioMap[row.produto_cod] || [],
    }));

    const alocados = itens.filter(i => i.status_alocacao === 'ALOCADO').length;
    const pendentes = itens.length - alocados;

    console.log(`Itens entrada ${entradaId} para alocacao: ${itens.length} total, ${alocados} alocados, romaneio: ${romaneioResult.rows.length > 0 ? 'sim' : 'nao'}`);

    return res.status(200).json({
      data: itens,
      meta: {
        total: itens.length,
        alocados,
        pendentes,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar itens para alocacao:', error);

    return res.status(500).json({
      error: 'Erro ao buscar itens',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

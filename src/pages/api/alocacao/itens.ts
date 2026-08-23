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

// Itens da entrada (dbitent) para alocação, com conferência (eir) e alocado (dbitent_armazem).
// entrada_item_id = id da linha de conferência (eir.id).
const ITENS_QUERY = `
  SELECT
    COALESCE(eir.id, 0) as id,
    COALESCE(eir.id, 0) as entrada_item_id,
    ie.codprod as produto_cod,
    COALESCE(p.descr, 'Produto nao identificado') as produto_nome,
    COALESCE(eir.qtd_recebida, ie.quant) as qtd_recebida,
    COALESCE(aloc.qtd_alocada, 0) as qtd_alocada,
    CASE
      WHEN COALESCE(aloc.qtd_alocada, 0) >= COALESCE(eir.qtd_recebida, ie.quant) THEN 'ALOCADO'
      WHEN COALESCE(aloc.qtd_alocada, 0) > 0 THEN 'PARCIAL'
      ELSE 'PENDENTE'
    END as status_alocacao,
    COALESCE(p.unimed, 'UN') as unidade
  FROM dbitent ie
  LEFT JOIN entrada_itens_recebimento eir
    ON eir.codent = ie.codent AND eir.produto_cod = ie.codprod
   AND COALESCE(eir.codreq,'') = COALESCE(ie.codreq,'')
  LEFT JOIN dbprod p ON p.codprod = ie.codprod
  LEFT JOIN (
    SELECT codprod, SUM(qtd) as qtd_alocada
    FROM dbitent_armazem WHERE codent = $1 GROUP BY codprod
  ) aloc ON aloc.codprod = ie.codprod
  WHERE ie.codent = $1
  ORDER BY ie.codprod
`;

// Romaneio planejado + localização existente (por codent)
const ROMANEIO_QUERY = `
  SELECT
    da.codprod as produto_cod, da.arm_id, ca.arm_descricao, da.qtd,
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

    // Itens da entrada (codent)
    const result = await client.query(ITENS_QUERY, [entradaId]);

    // Romaneio planejado (por codent)
    const romaneioResult = await client.query(ROMANEIO_QUERY, [entradaId]);

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

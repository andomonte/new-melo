/**
 * Endpoint para listar entradas disponiveis para alocacao
 * GET /api/entrada/alocacao/entradas
 *
 * Query params:
 * - nomeAlocador: filtra entradas em alocacao por este operador
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';

interface RomaneioResumo {
  arm_id: number;
  arm_descricao: string;
  qtd_total: number;
}

interface EntradaParaAlocar {
  id: number;
  entrada_id: string; // codent
  numero_entrada: string;
  nfe_numero: string;
  nfe_serie: string;
  fornecedor: string;
  valor_total: number;
  qtd_itens: number;
  data_recebimento: string;
  status: string;
  status_label: string;
  alocador_nome?: string;
  inicio_alocacao?: string;
  tem_divergencia: boolean;
  tem_romaneio: boolean;
  romaneio_resumo: RomaneioResumo[];
}

interface EntradasResponse {
  data: EntradaParaAlocar[];
  meta: {
    total: number;
  };
}

// Query para buscar entradas recebidas disponiveis para alocacao
const ENTRADAS_QUERY = `
  SELECT
    op.id,
    e.codent as entrada_id,
    e.codent as numero_entrada,
    COALESCE(n.nnf::text, '') as nfe_numero,
    COALESCE(n.serie::text, '') as nfe_serie,
    COALESCE(emit.xnome, 'Fornecedor nao identificado') as fornecedor,
    COALESCE(e.totalnf, 0) as valor_total,
    COALESCE((SELECT COUNT(*) FROM dbitent WHERE codent = e.codent), 0) as qtd_itens,
    COALESCE(op.fim_recebimento, e.dtent) as data_recebimento,
    COALESCE(op.status, 'RECEBIDO') as status,
    CASE COALESCE(op.status, 'RECEBIDO')
      WHEN 'RECEBIDO' THEN 'Recebido'
      WHEN 'EM_ALOCACAO' THEN 'Em Alocacao'
      WHEN 'ALOCADO' THEN 'Alocado'
      ELSE 'Desconhecido'
    END as status_label,
    op.alocador_nome,
    op.inicio_alocacao,
    COALESCE(op.tem_divergencia, false) as tem_divergencia
  FROM dbent e
  INNER JOIN entrada_operacoes op ON op.codent = e.codent
  LEFT JOIN dbnfe_ent n ON n.chave = e.chave
  LEFT JOIN dbnfe_ent_emit emit ON n.codnfe_ent = emit.codnfe_ent
  WHERE
    (
      op.status = 'RECEBIDO'
      OR (op.status = 'EM_ALOCACAO' AND op.alocador_nome = $1)
    )
  ORDER BY
    CASE WHEN op.alocador_nome = $1 AND op.status = 'EM_ALOCACAO' THEN 0 ELSE 1 END,
    op.fim_recebimento DESC
  LIMIT 50
`;

// Romaneio resumido por entrada (por codent)
const ROMANEIO_QUERY = `
  SELECT
    da.codent as numero_entrada,
    da.arm_id,
    ca.arm_descricao,
    SUM(da.qtd) as qtd_total
  FROM dbitent_armazem da
  INNER JOIN cad_armazem ca ON ca.arm_id = da.arm_id
  WHERE da.codent = ANY($1)
  GROUP BY da.codent, da.arm_id, ca.arm_descricao
  ORDER BY da.codent, da.arm_id
`;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<EntradasResponse | { error: string }>,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS';
  const nomeAlocador = (req.query.nomeAlocador as string) || '';

  const pool = getPgPool(filial);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    const result = await client.query(ENTRADAS_QUERY, [nomeAlocador]);

    // Buscar números de entrada para buscar romaneio
    const numerosEntrada = result.rows.map(r => r.numero_entrada);

    // Buscar romaneio de todas as entradas de uma vez
    const romaneioResult = numerosEntrada.length > 0
      ? await client.query(ROMANEIO_QUERY, [numerosEntrada])
      : { rows: [] };

    // Agrupar romaneio por numero_entrada
    const romaneioMap: { [numEntrada: string]: RomaneioResumo[] } = {};
    for (const row of romaneioResult.rows) {
      const numEntrada = row.numero_entrada;
      if (!romaneioMap[numEntrada]) {
        romaneioMap[numEntrada] = [];
      }
      romaneioMap[numEntrada].push({
        arm_id: parseInt(row.arm_id),
        arm_descricao: row.arm_descricao,
        qtd_total: parseFloat(row.qtd_total),
      });
    }

    const entradas: EntradaParaAlocar[] = result.rows.map(row => {
      const romaneio = romaneioMap[row.numero_entrada] || [];
      return {
        id: parseInt(row.id),
        entrada_id: row.entrada_id, // codent
        numero_entrada: row.numero_entrada,
        nfe_numero: row.nfe_numero,
        nfe_serie: row.nfe_serie,
        fornecedor: row.fornecedor,
        valor_total: parseFloat(row.valor_total || 0),
        qtd_itens: parseInt(row.qtd_itens || 0),
        data_recebimento: row.data_recebimento,
        status: row.status,
        status_label: row.status_label,
        alocador_nome: row.alocador_nome,
        inicio_alocacao: row.inicio_alocacao,
        tem_divergencia: row.tem_divergencia,
        tem_romaneio: romaneio.length > 0,
        romaneio_resumo: romaneio,
      };
    });

    console.log(`Entradas para alocacao: ${entradas.length} encontradas`);

    return res.status(200).json({
      data: entradas,
      meta: { total: entradas.length },
    });
  } catch (error) {
    console.error('Erro ao buscar entradas para alocacao:', error);

    return res.status(500).json({
      error: 'Erro ao buscar entradas',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';

interface RomaneioItem {
  arm_id: number;
  arm_descricao: string;
  qtd: number;
}

interface ItemRomaneio {
  produto_cod: string;
  produto_ref: string | null;
  produto_descr: string | null;
  quantidade_total: number;
  multiplo: number;
  romaneio: RomaneioItem[];
}

interface BuscarRomaneioResponse {
  entrada_id: number;
  numero_entrada: string;
  status: string;
  armazem_padrao_id: number;
  armazem_padrao_nome: string;
  tem_romaneio_salvo: boolean;
  itens: ItemRomaneio[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BuscarRomaneioResponse | { error: string }>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      error: 'ID da entrada é obrigatório'
    });
  }

  let client;

  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();

    // 1. Buscar dados da entrada
    const entradaResult = await client.query(`
      SELECT
        id,
        numero_entrada,
        status,
        nfe_id,
        COALESCE(est_alocado, 0) as est_alocado
      FROM db_manaus.entradas_estoque
      WHERE id = $1
    `, [parseInt(id)]);

    if (entradaResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Entrada não encontrada'
      });
    }

    const entrada = entradaResult.rows[0];

    // 2. Buscar itens da entrada com informações do produto
    const itensResult = await client.query(`
      SELECT
        ei.id,
        ei.produto_cod,
        p.ref AS produto_ref,
        p.descr AS produto_descr,
        ei.quantidade AS quantidade_total,
        COALESCE(p.multiplo, 1) AS multiplo,
        ei.req_id
      FROM db_manaus.entrada_itens ei
      LEFT JOIN db_manaus.dbprod p ON ei.produto_cod = p.codprod
      WHERE ei.entrada_id = $1
      ORDER BY ei.id
    `, [parseInt(id)]);

    // 3. Verificar se já existe romaneio salvo
    const romaneioResult = await client.query(`
      SELECT
        da.codprod,
        da.arm_id,
        ca.arm_descricao,
        da.qtd
      FROM db_manaus.dbitent_armazem da
      INNER JOIN db_manaus.cad_armazem ca ON da.arm_id = ca.arm_id
      WHERE da.codent = $1
      ORDER BY da.codprod, da.arm_id
    `, [entrada.numero_entrada]);

    // 4. Organizar romaneio por produto
    const romaneioMap: { [produto_cod: string]: RomaneioItem[] } = {};

    for (const rom of romaneioResult.rows) {
      if (!romaneioMap[rom.codprod]) {
        romaneioMap[rom.codprod] = [];
      }
      romaneioMap[rom.codprod].push({
        arm_id: rom.arm_id,
        arm_descricao: rom.arm_descricao,
        qtd: parseFloat(rom.qtd)
      });
    }

    // 5. Montar resposta com itens e romaneio
    const itens: ItemRomaneio[] = itensResult.rows.map(item => ({
      produto_cod: item.produto_cod,
      produto_ref: item.produto_ref,
      produto_descr: item.produto_descr,
      quantidade_total: parseFloat(item.quantidade_total),
      multiplo: parseInt(item.multiplo),
      romaneio: romaneioMap[item.produto_cod] || []
    }));

    return res.status(200).json({
      entrada_id: entrada.id,
      numero_entrada: entrada.numero_entrada,
      status: entrada.status,
      armazem_padrao_id: 1003,
      armazem_padrao_nome: 'PADRAO_SISTEMA',
      tem_romaneio_salvo: romaneioResult.rows.length > 0,
      itens
    });

  } catch (error: any) {
    console.error('Erro ao buscar romaneio:', error);
    return res.status(500).json({
      error: `Erro ao buscar romaneio: ${error.message}`
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
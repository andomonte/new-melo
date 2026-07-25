import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

interface EntradaItem {
  id: string;
  produto_cod: string;
  produto_descricao: string;
  referencia: string;
  ordem_compra: string;
  estoque_anterior: number;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  custo: number;
  armazens: string;
  unimed: string;
}

interface EntradaItensResponse {
  success: boolean;
  data: EntradaItem[];
  total: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<EntradaItensResponse | { error: string }>
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

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || cookies.filial || 'MANAUS';

  let client;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Buscar itens da entrada (modelo Delphi dbitent, por codent) — colunas
    // espelhando o grid de baixo do Delphi: Referência, Ordem de Compra,
    // Estoque Anterior, Quant., Custo e distribuição por armazém (romaneio).
    const itensQuery = `
      SELECT
        ie.codprod,
        ie.codreq,
        COALESCE(p.descr, 'Produto nao encontrado') as produto_descricao,
        COALESCE(p.ref, '') as referencia,
        COALESCE(ie.quantant, 0) as estoque_anterior,
        ie.quant,
        ie.prunit,
        COALESCE(ie.prcusto, 0) as custo,
        ROUND(COALESCE(ie.quant,0) * COALESCE(ie.prunit,0), 2) as valor_total,
        COALESCE(p.unimed, 'UN') as unimed,
        (
          SELECT STRING_AGG(ca.arm_descricao || ': ' || ia.qtd::text, ', ' ORDER BY ca.arm_descricao)
          FROM db_manaus.dbitent_armazem ia
          JOIN db_manaus.cad_armazem ca ON ca.arm_id = ia.arm_id
          WHERE ia.codent = ie.codent
            AND ia.codprod = ie.codprod
            AND COALESCE(ia.codreq,'') = COALESCE(ie.codreq,'')
        ) as armazens
      FROM db_manaus.dbitent ie
      LEFT JOIN db_manaus.dbprod p ON ie.codprod = p.codprod
      WHERE ie.codent = $1
      ORDER BY ie.codprod ASC
    `;

    const result = await client.query(itensQuery, [id]);
    const items = result.rows;

    res.status(200).json({
      success: true,
      data: items.map(item => ({
        id: `${item.codprod}-${item.codreq ?? '0'}`,
        produto_cod: item.codprod,
        produto_descricao: item.produto_descricao,
        referencia: item.referencia || '',
        ordem_compra: item.codreq || '',
        estoque_anterior: Number(item.estoque_anterior),
        quantidade: Number(item.quant),
        valor_unitario: Number(item.prunit),
        valor_total: Number(item.valor_total),
        custo: Number(item.custo),
        armazens: item.armazens || '',
        unimed: item.unimed || 'UN'
      })),
      total: items.length
    });

  } catch (error) {
    console.error('Erro ao buscar itens da entrada:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
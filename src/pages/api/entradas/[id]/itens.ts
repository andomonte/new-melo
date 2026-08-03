import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { previewCustosEntrada } from '@/lib/compras/gerarEntradaDbent';

interface EntradaItem {
  id: string;
  produto_cod: string;
  produto_descricao: string;
  referencia: string;
  ordem_compra: string;
  estoque_anterior: number;
  quantidade: number;
  valor_unitario: number;
  preco_nf: number;
  valor_total: number;
  custo: number;
  custo_fe: number;
  custo_zf: number;
  valor_ipi: number;
  valor_st: number;
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
        COALESCE(ie.prunitnf, ie.prunit) as prunitnf,
        COALESCE(ie.prcusto, 0) as custo,
        COALESCE(ie.prcusto_fe, 0) as custo_fe,
        COALESCE(ie.prcusto_zf, 0) as custo_zf,
        COALESCE(ie.valor_ipi, 0) as valor_ipi,
        COALESCE(ie.valor_icms_subst, 0) as valor_st,
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

    // Custo calculado AO VIVO (mesmo motor do confirmar-preço, sem gravar). Na
    // entrada ainda não confirmada, o dbitent.prcusto está zerado — este preview
    // mostra o custo que SERÁ aplicado, para conferência (paridade com o Delphi).
    let custosPreview: Map<string, { prcusto: number; prcusto_zf: number; prcusto_fe: number }>;
    try {
      custosPreview = await previewCustosEntrada(client, id);
    } catch (e) {
      console.error('Falha ao calcular preview de custo (segue com valores gravados):', e);
      custosPreview = new Map();
    }
    const custoDe = (codprod: string, codreq: any, campo: 'prcusto' | 'prcusto_zf' | 'prcusto_fe', gravado: number) => {
      const c = custosPreview.get(`${codprod}|${codreq ?? ''}`);
      const v = c ? Number(c[campo]) : 0;
      return v > 0 ? v : gravado; // usa o preview; cai no gravado se preview=0
    };

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
        preco_nf: Number(item.prunitnf),
        valor_total: Number(item.valor_total),
        custo: custoDe(item.codprod, item.codreq, 'prcusto', Number(item.custo)),
        custo_fe: custoDe(item.codprod, item.codreq, 'prcusto_fe', Number(item.custo_fe)),
        custo_zf: custoDe(item.codprod, item.codreq, 'prcusto_zf', Number(item.custo_zf)),
        valor_ipi: Number(item.valor_ipi),
        valor_st: Number(item.valor_st),
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
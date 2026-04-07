import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';

interface ProdutoArmazem {
  arm_id: number;
  arm_descricao: string;
  arp_qtest: number;
  arp_qtest_reservada: number;
  arp_bloqueado: string;
  estoque_disponivel: number;
  percentual_reservado: number;
}

interface ProdutoInfo {
  codprod: string;
  descricao: string;
  estoque_total_geral: number;
  estoque_total_armazens: number;
  valor_unitario: number;
}

interface ProdutoArmazensResponse {
  success: boolean;
  produto: ProdutoInfo;
  armazens: ProdutoArmazem[];
  resumo: {
    total_armazens: number;
    armazens_com_estoque: number;
    maior_estoque: {
      arm_id: number;
      arm_descricao: string;
      quantidade: number;
    } | null;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProdutoArmazensResponse | { error: string }>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { codprod } = req.query;
  const { incluir_sem_estoque = 'false' } = req.query;

  if (!codprod || typeof codprod !== 'string') {
    return res.status(400).json({
      error: 'Código do produto é obrigatório'
    });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial || 'manaus';

  let client: PoolClient | null = null;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // 1. Verificar se produto existe e buscar informações básicas
    const produtoResult = await client.query(`
      SELECT codprod, descr, qtest as estoque_geral, prvenda
      FROM dbprod
      WHERE codprod = $1
    `, [codprod]);

    if (produtoResult.rows.length === 0) {
      return res.status(404).json({
        error: `Produto ${codprod} não encontrado`
      });
    }

    const produto = produtoResult.rows[0];

    // 2. Buscar estoque em todos os armazéns
    let whereCondition = 'ap.arp_codprod = $1';
    if (incluir_sem_estoque !== 'true') {
      whereCondition += ' AND ap.arp_qtest > 0';
    }

    const armazensQuery = `
      SELECT
        a.arm_id,
        a.arm_descricao,
        ap.arp_qtest,
        COALESCE(ap.arp_qtest_reservada, 0) as arp_qtest_reservada,
        ap.arp_bloqueado,
        (ap.arp_qtest - COALESCE(ap.arp_qtest_reservada, 0)) as estoque_disponivel,
        CASE
          WHEN ap.arp_qtest > 0 THEN
            ROUND((COALESCE(ap.arp_qtest_reservada, 0) * 100.0 / ap.arp_qtest), 2)
          ELSE 0
        END as percentual_reservado
      FROM cad_armazem_produto ap
      INNER JOIN cad_armazem a ON ap.arp_arm_id = a.arm_id
      WHERE ${whereCondition}
      ORDER BY ap.arp_qtest DESC, a.arm_descricao ASC
    `;

    // 3. Calcular estoque total nos armazéns
    const totalArmazensQuery = `
      SELECT
        COUNT(*) as total_armazens,
        COUNT(*) FILTER (WHERE ap.arp_qtest > 0) as armazens_com_estoque,
        SUM(ap.arp_qtest) as estoque_total_armazens
      FROM cad_armazem_produto ap
      WHERE ap.arp_codprod = $1
    `;

    // Executar queries em paralelo
    const [armazensResult, totalResult] = await Promise.all([
      client.query(armazensQuery, [codprod]),
      client.query(totalArmazensQuery, [codprod])
    ]);

    const armazens = armazensResult.rows;
    const totais = totalResult.rows[0];

    // 4. Encontrar armazém com maior estoque
    const maiorEstoque = armazens.length > 0 ? {
      arm_id: armazens[0].arm_id,
      arm_descricao: armazens[0].arm_descricao,
      quantidade: armazens[0].arp_qtest
    } : null;

    console.log(`🔍 Localizando produto ${codprod} - encontrado em ${totais.armazens_com_estoque} armazéns`);

    res.status(200).json({
      success: true,
      produto: {
        codprod: produto.codprod,
        descricao: produto.descr,
        estoque_total_geral: produto.estoque_geral,
        estoque_total_armazens: parseInt(totais.estoque_total_armazens || 0),
        valor_unitario: parseFloat(produto.prvenda || 0)
      },
      armazens: armazens,
      resumo: {
        total_armazens: parseInt(totais.total_armazens),
        armazens_com_estoque: parseInt(totais.armazens_com_estoque),
        maior_estoque: maiorEstoque
      }
    });

  } catch (error) {
    console.error('Erro ao localizar produto nos armazéns:', error);
    res.status(500).json({
      error: 'Erro interno do servidor ao localizar produto'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
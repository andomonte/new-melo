import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';

interface EstoqueArmazem {
  arp_codprod: string;
  produto_descricao: string;
  arp_qtest: number;
  arp_qtest_reservada: number;
  arp_bloqueado: string;
  estoque_disponivel: number;
  valor_unitario?: number;
  valor_total_estoque?: number;
}

interface EstoqueResponse {
  success: boolean;
  data: EstoqueArmazem[];
  meta: {
    armazem_id: number;
    armazem_nome: string;
    total_produtos: number;
    total_com_estoque: number;
    valor_total_armazem: number;
    page: number;
    per_page: number;
    total_pages: number;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<EstoqueResponse | { error: string }>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { id } = req.query;
  const {
    page = '1',
    per_page = '50',
    search = '',
    com_estoque = 'false'
  } = req.query;

  if (!id || isNaN(Number(id))) {
    return res.status(400).json({
      error: 'ID do armazém é obrigatório e deve ser um número válido'
    });
  }

  const armazemId = Number(id);
  const pageNum = Number(page);
  const perPageNum = Number(per_page);
  const offset = (pageNum - 1) * perPageNum;
  const searchTerm = `%${search}%`;

  const cookies = parseCookies({ req });
  const filial = cookies.filial || 'manaus';

  let client: PoolClient | null = null;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // 1. Verificar se armazém existe
    const armazemResult = await client.query(`
      SELECT arm_id, arm_descricao
      FROM cad_armazem
      WHERE arm_id = $1
    `, [armazemId]);

    if (armazemResult.rows.length === 0) {
      return res.status(404).json({
        error: `Armazém ${armazemId} não encontrado`
      });
    }

    const armazem = armazemResult.rows[0];

    // 2. Construir filtros
    let whereConditions = ['ap.arp_arm_id = $1'];
    const params: any[] = [armazemId];
    let paramIndex = 2;

    if (search) {
      whereConditions.push(`(p.codprod ILIKE $${paramIndex} OR p.descr ILIKE $${paramIndex})`);
      params.push(searchTerm);
      paramIndex++;
    }

    if (com_estoque === 'true') {
      whereConditions.push('ap.arp_qtest > 0');
    }

    const whereClause = whereConditions.join(' AND ');

    // 3. Query principal com paginação
    const estoqueQuery = `
      SELECT
        ap.arp_codprod,
        p.descr as produto_descricao,
        ap.arp_qtest,
        ap.arp_qtest_reservada,
        ap.arp_bloqueado,
        (ap.arp_qtest - COALESCE(ap.arp_qtest_reservada, 0)) as estoque_disponivel,
        p.prvenda as valor_unitario,
        ((ap.arp_qtest - COALESCE(ap.arp_qtest_reservada, 0)) * COALESCE(p.prvenda, 0)) as valor_total_estoque
      FROM cad_armazem_produto ap
      INNER JOIN dbprod p ON ap.arp_codprod = p.codprod
      WHERE ${whereClause}
      ORDER BY ap.arp_qtest DESC, p.descr ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(perPageNum, offset);

    // 4. Query de contagem
    const countQuery = `
      SELECT COUNT(*) as total
      FROM cad_armazem_produto ap
      INNER JOIN dbprod p ON ap.arp_codprod = p.codprod
      WHERE ${whereClause}
    `;

    const countParams = params.slice(0, params.length - 2);

    // 5. Query de resumo do armazém
    const resumoQuery = `
      SELECT
        COUNT(*) as total_produtos,
        COUNT(*) FILTER (WHERE ap.arp_qtest > 0) as total_com_estoque,
        SUM((ap.arp_qtest - COALESCE(ap.arp_qtest_reservada, 0)) * COALESCE(p.prvenda, 0)) as valor_total_armazem
      FROM cad_armazem_produto ap
      INNER JOIN dbprod p ON ap.arp_codprod = p.codprod
      WHERE ap.arp_arm_id = $1
    `;

    // Executar queries em paralelo
    const [estoqueResult, countResult, resumoResult] = await Promise.all([
      client.query(estoqueQuery, params),
      client.query(countQuery, countParams),
      client.query(resumoQuery, [armazemId])
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / perPageNum);
    const resumo = resumoResult.rows[0];

    console.log(`📊 Consultando estoque do armazém ${armazemId} - ${resumo.total_com_estoque} produtos com estoque`);

    res.status(200).json({
      success: true,
      data: estoqueResult.rows,
      meta: {
        armazem_id: armazemId,
        armazem_nome: armazem.arm_descricao,
        total_produtos: parseInt(resumo.total_produtos),
        total_com_estoque: parseInt(resumo.total_com_estoque),
        valor_total_armazem: parseFloat(resumo.valor_total_armazem || 0),
        page: pageNum,
        per_page: perPageNum,
        total_pages: totalPages
      }
    });

  } catch (error) {
    console.error('Erro ao consultar estoque do armazém:', error);
    res.status(500).json({
      error: 'Erro interno do servidor ao consultar estoque'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
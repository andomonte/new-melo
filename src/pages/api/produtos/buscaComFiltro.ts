import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

interface Filtro {
  campo: string;
  tipo: string;
  valor: string;
}

interface RequestBody {
  page: number;
  perPage: number;
  productSearch: string;
  tipoPreco?: string;
  filtros: Filtro[];
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const {
    page = 1,
    perPage = 10,
    productSearch = '',
    filtros = [],
  }: RequestBody = req.body;
  let client: PoolClient | undefined;

  try {
    const pool = getPgPool();
    client = await pool.connect();

    const currentPage = Number(page);
    const itemsPerPage = Number(perPage);
    const offset = (currentPage - 1) * itemsPerPage;

    // Construir a cláusula WHERE (com alias p. para uso na query principal)
    const whereConditions: string[] = [];
    const whereConditionsCount: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    // Busca geral
    if (productSearch && productSearch.trim()) {
      whereConditions.push(
        `(p.codprod ILIKE $${paramIndex} OR p.descr ILIKE $${paramIndex} OR p.ref ILIKE $${paramIndex})`,
      );
      whereConditionsCount.push(
        `(codprod ILIKE $${paramIndex} OR descr ILIKE $${paramIndex} OR ref ILIKE $${paramIndex})`,
      );
      queryParams.push(`%${productSearch.trim()}%`);
      paramIndex++;
    }

    // Filtros específicos por coluna
    for (const filtro of filtros) {
      if (!filtro.campo || !filtro.tipo) continue;

      const campo = filtro.campo;
      const campoAlias = `p.${campo}`;
      const tipo = filtro.tipo;
      const valor = filtro.valor;

      switch (tipo) {
        case 'igual':
          whereConditions.push(`${campoAlias} = $${paramIndex}`);
          whereConditionsCount.push(`${campo} = $${paramIndex}`);
          queryParams.push(valor);
          paramIndex++;
          break;
        case 'diferente':
          whereConditions.push(`${campoAlias} != $${paramIndex}`);
          whereConditionsCount.push(`${campo} != $${paramIndex}`);
          queryParams.push(valor);
          paramIndex++;
          break;
        case 'contém':
          whereConditions.push(`${campoAlias} ILIKE $${paramIndex}`);
          whereConditionsCount.push(`${campo} ILIKE $${paramIndex}`);
          queryParams.push(`%${valor}%`);
          paramIndex++;
          break;
        case 'começa':
          whereConditions.push(`${campoAlias} ILIKE $${paramIndex}`);
          whereConditionsCount.push(`${campo} ILIKE $${paramIndex}`);
          queryParams.push(`${valor}%`);
          paramIndex++;
          break;
        case 'termina':
          whereConditions.push(`${campoAlias} ILIKE $${paramIndex}`);
          whereConditionsCount.push(`${campo} ILIKE $${paramIndex}`);
          queryParams.push(`%${valor}`);
          paramIndex++;
          break;
        case 'maior':
          whereConditions.push(`${campoAlias} > $${paramIndex}`);
          whereConditionsCount.push(`${campo} > $${paramIndex}`);
          queryParams.push(valor);
          paramIndex++;
          break;
        case 'maior_igual':
          whereConditions.push(`${campoAlias} >= $${paramIndex}`);
          whereConditionsCount.push(`${campo} >= $${paramIndex}`);
          queryParams.push(valor);
          paramIndex++;
          break;
        case 'menor':
          whereConditions.push(`${campoAlias} < $${paramIndex}`);
          whereConditionsCount.push(`${campo} < $${paramIndex}`);
          queryParams.push(valor);
          paramIndex++;
          break;
        case 'menor_igual':
          whereConditions.push(`${campoAlias} <= $${paramIndex}`);
          whereConditionsCount.push(`${campo} <= $${paramIndex}`);
          queryParams.push(valor);
          paramIndex++;
          break;
        case 'nulo':
          whereConditions.push(`${campoAlias} IS NULL`);
          whereConditionsCount.push(`${campo} IS NULL`);
          break;
        case 'nao_nulo':
          whereConditions.push(`${campoAlias} IS NOT NULL`);
          whereConditionsCount.push(`${campo} IS NOT NULL`);
          break;
        default:
          console.warn(`Tipo de filtro não reconhecido: ${tipo}`);
      }
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';
    const whereClauseCount =
      whereConditionsCount.length > 0
        ? `WHERE ${whereConditionsCount.join(' AND ')}`
        : '';

    // Buscar os produtos com contagem de armazéns
    const produtosQuery = `
      SELECT p.*,
        COALESCE((
          SELECT COUNT(DISTINCT cap.arp_arm_id)
          FROM cad_armazem_produto cap
          WHERE cap.arp_codprod = p.codprod AND COALESCE(cap.arp_qtest, 0) > 0
        ), 0) as qtd_armazens
      FROM db_manaus.dbprod p
      ${whereClause}
      ORDER BY p.descr
      OFFSET $${paramIndex} LIMIT $${paramIndex + 1}
    `;

    queryParams.push(offset, itemsPerPage);
    const produtosResult = await client.query(produtosQuery, queryParams);

    // Contar o totalll
    const countQuery = `
      SELECT COUNT(*) as total FROM db_manaus.dbprod
      ${whereClauseCount}
    `;

    const countParams = queryParams.slice(0, -2); // Remove offset e limit
    const countResult = await client.query(countQuery, countParams);

    const produtos = produtosResult.rows;
    const count = parseInt(countResult.rows[0].total, 10);

    // DEBUG: Log dos campos retornados
    if (produtos.length > 0) {
      console.log('🔍 API buscaComFiltro - Campos retornados:', Object.keys(produtos[0]));
      console.log('🔍 API buscaComFiltro - Primeiro produto:', produtos[0].codprod);
      console.log('🔍 API buscaComFiltro - Marca do primeiro produto:', produtos[0].codmarca);
    }

    res.status(200).json({
      data: produtos.map((produto) => serializeBigInt(produto)),
      meta: {
        total: count,
        lastPage: Math.max(1, Math.ceil(count / itemsPerPage)),
        currentPage: Math.max(1, currentPage),
        perPage: itemsPerPage,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar produtos com filtro:', error);
    res.status(500).json({ error: 'Erro ao buscar produtos com filtro' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
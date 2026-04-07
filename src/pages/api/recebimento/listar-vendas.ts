import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { getUserFromRequest } from '@/lib/authHelper';
import { executeQuery } from '@/lib/databaseHelpers';

interface FiltrosConsulta {
  codigo?: string;
  nrodoc?: string;
  codcf?: string;
  impresso?: 'S' | 'N';
  data_inicio?: string;
  data_fim?: string;
  page?: number;
  limit?: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Validar autenticação
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Usuário não autenticado' });
  }

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    const {
      codigo,
      nrodoc,
      codcf,
      impresso,
      data_inicio,
      data_fim,
      page = 1,
      limit = 50,
    }: FiltrosConsulta = req.query as any;

    // Validar paginação
    const pageNum = Math.max(1, parseInt(String(page)) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit)) || 50));
    const offset = (pageNum - 1) * limitNum;

    // Construir WHERE clause dinamicamente
    const whereConditions: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (codigo) {
      whereConditions.push(`"CODIGO" = $${paramIndex}`);
      queryParams.push(codigo);
      paramIndex++;
    }

    if (nrodoc) {
      whereConditions.push(`"NRODOC" = $${paramIndex}`);
      queryParams.push(nrodoc);
      paramIndex++;
    }

    if (codcf) {
      whereConditions.push(`"CODCF" = $${paramIndex}`);
      queryParams.push(codcf);
      paramIndex++;
    }

    if (impresso && (impresso === 'S' || impresso === 'N')) {
      whereConditions.push(`"IMPRESSO" = $${paramIndex}`);
      queryParams.push(impresso);
      paramIndex++;
    }

    if (data_inicio) {
      whereConditions.push(`"DATA" >= $${paramIndex}`);
      queryParams.push(data_inicio);
      paramIndex++;
    }

    if (data_fim) {
      whereConditions.push(`"DATA" <= $${paramIndex}`);
      queryParams.push(data_fim);
      paramIndex++;
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

    // Query para contar total de registros
    const countQuery = `
      SELECT COUNT(*) as total
      FROM dbservimp
      ${whereClause}
    `;

    const countResult = await executeQuery(
      client,
      countQuery,
      queryParams,
      'contar vendas na dbservimp',
    );

    if (!countResult.success) {
      return res.status(500).json({
        error: 'Erro ao contar registros',
        details: countResult.error,
      });
    }

    const total = parseInt(countResult.data?.[0]?.total || '0');

    // Query para buscar dados paginados
    const dataQuery = `
      SELECT 
        "CODIGO",
        "NRODOC",
        "TIPODOC",
        "CODCF",
        "NOMECF",
        "NOMEUSR",
        "VALOR",
        "DATA",
        "HORA",
        "NROIMP",
        "IMPRESSO",
        "ARMAZEM"
      FROM dbservimp
      ${whereClause}
      ORDER BY "DATA" DESC, "HORA" DESC, CAST("NROIMP" AS INTEGER) DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const dataParams = [...queryParams, limitNum, offset];

    const dataResult = await executeQuery(
      client,
      dataQuery,
      dataParams,
      'buscar vendas na dbservimp',
    );

    if (!dataResult.success) {
      return res.status(500).json({
        error: 'Erro ao buscar registros',
        details: dataResult.error,
      });
    }

    const vendas = dataResult.data || [];

    // Calcular informações de paginação
    const totalPages = Math.ceil(total / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    return res.status(200).json({
      data: vendas,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalRecords: total,
        limit: limitNum,
        hasNextPage,
        hasPrevPage,
      },
      filters: {
        codigo,
        nrodoc,
        codcf,
        impresso,
        data_inicio,
        data_fim,
      },
      summary: {
        total_vendas: total,
        valor_total: vendas.reduce(
          (sum: number, venda: any) => sum + (parseFloat(venda.valor) || 0),
          0,
        ),
        pendentes_impressao: vendas.filter((v: any) => v.impresso === 'N')
          .length,
        impressas: vendas.filter((v: any) => v.impresso === 'S').length,
      },
    });
  } catch (error) {
    console.error('Erro ao consultar vendas da dbservimp:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'development' ? error : undefined,
    });
  } finally {
    client.release();
  }
}

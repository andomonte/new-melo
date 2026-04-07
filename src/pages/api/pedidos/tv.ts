import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

interface PedidoTV {
  NrVenda: string;
  Cliente: string;
  horario: string;
  status: string;
  responsavel: string;
  previsao: number;
  inicioseparacao: string | null;
  statusPedido: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Extrair parâmetros de query
  const {
    page = '1',
    perPage = '100', // Padrão aumentado para tela TV
    search = '',
    sortBy = 'dtupdate', // Padrão corrigido para ordenação por data de update
    sortOrder = 'DESC', // Mais recente primeiro
  } = req.query;

  const pageNumber = parseInt(page as string, 10);
  const itemsPerPage = parseInt(perPage as string, 10);
  const offset = (pageNumber - 1) * itemsPerPage;
  const searchTerm = search as string;
  const sortField = sortBy as string;
  const sortDirection = (sortOrder as string).toUpperCase();

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    // Query para contar total de registros (excluindo status NULL, F e Conferidos)
    const countQuery = `
      SELECT COUNT(*) as total
      FROM dbvenda v
      LEFT JOIN dbclien c ON v.codcli = c.codcli
      WHERE v.statuspedido IN ('1', '2', '3', '4')
        AND (
          $1 = '' OR 
          v.codvenda::text ILIKE $1 OR 
          c.nome ILIKE $1
        )
    `;

    // Query principal com paginação e filtro - ordenação priorizando dtupdate não nulos
    let orderByClause = 'ORDER BY v.dtupdate DESC NULLS LAST';

    if (sortField === 'codvenda') {
      orderByClause = `ORDER BY v.codvenda ${sortDirection}`;
    } else if (sortField === 'cliente') {
      orderByClause = `ORDER BY c.nome ${sortDirection}`;
    } else if (sortField === 'dtupdate') {
      orderByClause = `ORDER BY v.dtupdate ${sortDirection} NULLS LAST`;
    }

    const dataQuery = `
      SELECT 
        v.codvenda as NrVenda,
        COALESCE(c.nome, 'Cliente não encontrado') as Cliente,
        COALESCE(v.dtupdate, v.data) as horario,
        CASE 
          WHEN v.statuspedido = '1' THEN 'Aguardando'
          WHEN v.statuspedido = '2' THEN 'Em Separação'
          WHEN v.statuspedido = '3' THEN 'Separado'
          WHEN v.statuspedido = '4' THEN 'Em Conferência'
          WHEN v.statuspedido = '5' THEN 'Conferido'
          WHEN v.statuspedido IS NULL THEN 'Aguardando'
          ELSE 'Desconhecido'
        END as status,
        CASE 
          WHEN v.statuspedido = '2' THEN 
            COALESCE(
              (SELECT f.nome FROM dbfunc_estoque f WHERE f.matricula = v.separador), 
              v.separador, 
              ''
            )
          WHEN v.statuspedido = '3' THEN 
            COALESCE(
              (SELECT f.nome FROM dbfunc_estoque f WHERE f.matricula = v.separador), 
              v.separador, 
              ''
            )
          WHEN v.statuspedido = '4' THEN 
            COALESCE(
              (SELECT f.nome FROM dbfunc_estoque f WHERE f.matricula = v.conferente), 
              v.conferente, 
              ''
            )
          WHEN v.statuspedido = '5' THEN 
            COALESCE(
              (SELECT f.nome FROM dbfunc_estoque f WHERE f.matricula = v.conferente), 
              v.conferente, 
              ''
            )
          ELSE ''
        END as responsavel,
        COALESCE(
          (SELECT COUNT(*) * 2 
           FROM dbitvenda iv 
           WHERE iv.codvenda = v.codvenda), 
          0
        ) as previsao,
        v.inicioseparacao,
        v.statuspedido
      FROM dbvenda v
      LEFT JOIN dbclien c ON v.codcli = c.codcli
      WHERE v.statuspedido IN ('1', '2', '3', '4')
        AND (
          $1 = '' OR 
          v.codvenda::text ILIKE $1 OR 
          c.nome ILIKE $1
        )
      ${orderByClause}
      LIMIT $2 OFFSET $3
    `;

    const searchPattern = searchTerm ? `%${searchTerm}%` : '';

    // Executar queries
    const countResult = await client.query(countQuery, [searchPattern]);
    const dataResult = await client.query(dataQuery, [
      searchPattern,
      itemsPerPage,
      offset,
    ]);

    const total = parseInt(countResult.rows[0].total, 10);
    const lastPage = Math.ceil(total / itemsPerPage);

    const pedidos: PedidoTV[] = dataResult.rows.map((row: any) => ({
      NrVenda: row.nrvenda,
      Cliente: row.cliente,
      horario: row.horario,
      status: row.status,
      responsavel: row.responsavel,
      previsao: parseInt(row.previsao, 10) || 0,
      inicioseparacao: row.inicioseparacao,
      statusPedido: row.statuspedido,
    }));

    return res.status(200).json({
      data: pedidos,
      meta: {
        total,
        currentPage: pageNumber,
        lastPage,
        perPage: itemsPerPage,
        from: offset + 1,
        to: Math.min(offset + itemsPerPage, total),
      },
    });
  } catch (error) {
    console.error('Erro ao buscar pedidos para TV:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    client.release();
  }
}

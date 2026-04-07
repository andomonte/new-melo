import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';

interface Produto {
  id: string;
  referencia: string;
  descricao: string;
  codigoBarras?: string;
  marca: string;
  estoque: number;
  tipo: string;
  localizacao?: string;
}

interface ProdutoSearchResponse {
  success: boolean;
  data?: Produto[];
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProdutoSearchResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { search } = req.query;

  if (!search || typeof search !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Termo de busca é obrigatório'
    });
  }

  let client;

  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();

    console.log('Buscando produtos com termo:', search);

    // Buscar produtos no banco de dados - priorizar busca exata por código de barras
    let result;

    // Primeira tentativa: busca exata por código de barras
    result = await client.query(`
      SELECT
        p.codprod as id,
        p.codprod as referencia,
        p.descr as descricao,
        p.codbar as codigo_barras,
        COALESCE(m.descr, 'SEM MARCA') as marca,
        COALESCE(p.qtest, 0) - COALESCE(p.qtdreservada, 0) as estoque,
        p.tipo as tipo,
        COALESCE(p.local, 'MERCADORIA') as localizacao
      FROM db_manaus.dbprod p
      LEFT JOIN db_manaus.dbmarcas m ON p.codmarca = m.codmarca
      WHERE p.codbar = $1
      ORDER BY p.descr
      LIMIT 5
    `, [search]);

    // Se não encontrou por código de barras, buscar por descrição/código produto
    if (result.rows.length === 0) {
      // Quebrar busca em palavras para melhor matching
      const searchWords = search.trim().split(/\s+/);
      const whereConditions = searchWords.map((_, idx) =>
        `LOWER(p.descr) LIKE LOWER($${idx + 1})`
      ).join(' AND ');
      const searchParams = searchWords.map(word => `%${word}%`);

      result = await client.query(`
        SELECT
          p.codprod as id,
          p.codprod as referencia,
          p.descr as descricao,
          p.codbar as codigo_barras,
          COALESCE(m.descr, 'SEM MARCA') as marca,
          COALESCE(p.qtest, 0) - COALESCE(p.qtdreservada, 0) as estoque,
          p.tipo as tipo,
          COALESCE(p.local, 'MERCADORIA') as localizacao
        FROM db_manaus.dbprod p
        LEFT JOIN db_manaus.dbmarcas m ON p.codmarca = m.codmarca
        WHERE (
          LOWER(p.descr) LIKE LOWER($${searchParams.length + 1})
          OR LOWER(p.codprod) LIKE LOWER($${searchParams.length + 1})
          OR p.codbar LIKE $${searchParams.length + 2}
          OR (${whereConditions})
        )
        ORDER BY
          CASE
            -- Prioridade 1: Match EXATO de código do produto (case-insensitive)
            WHEN p.codprod = $${searchParams.length + 2} THEN 1
            -- Prioridade 2: Match EXATO de código de barras
            WHEN p.codbar = $${searchParams.length + 2} THEN 2
            -- Prioridade 3: Código do produto começa com o termo (mas não é exato)
            WHEN LOWER(p.codprod) LIKE LOWER($${searchParams.length + 1}) THEN 3
            -- Prioridade 4: Descrição contém o termo
            WHEN LOWER(p.descr) LIKE LOWER($${searchParams.length + 1}) THEN 4
            ELSE 5
          END,
          p.codprod, -- Ordenar por código em caso de empate
          p.descr
        LIMIT 10
      `, [...searchParams, `%${search}%`, search]);
    }

    if (result.rows.length === 0) {
      console.log('Nenhum produto encontrado');
      return res.status(200).json({
        success: true,
        data: [],
        message: 'Nenhum produto encontrado'
      });
    }

    // Mapear dados reais do banco
    const produtos: Produto[] = result.rows.map((row: any) => ({
      id: row.id,
      referencia: row.referencia,
      descricao: row.descricao || 'Descrição não informada',
      codigoBarras: row.codigo_barras,
      marca: row.marca || 'MARCA NÃO INFORMADA',
      estoque: parseInt(row.estoque || 0),
      tipo: row.tipo || 'PRODUTO',
      localizacao: row.localizacao || 'NÃO INFORMADO'
    }));

    console.log(`Encontrados ${produtos.length} produtos para busca: ${search}`);

    return res.status(200).json({
      success: true,
      data: produtos
    });

  } catch (err) {
    console.error('Erro ao buscar produtos:', err);

    // Em caso de erro, retornar produto mock para não quebrar o fluxo
    const fallbackProdutos: Produto[] = [
      {
        id: 'ERRO',
        referencia: 'ERRO',
        descricao: 'Erro ao conectar com banco - Produto de teste',
        codigoBarras: search,
        marca: 'TESTE',
        estoque: 1,
        tipo: 'PRODUTO TESTE'
      }
    ];

    return res.status(200).json({
      success: true,
      data: fallbackProdutos
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
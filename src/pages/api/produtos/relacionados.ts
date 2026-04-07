import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * API para consultar produtos relacionados
 *
 * Retorna lista de produtos complementares/acessórios do produto informado
 *
 * POST /api/produtos/relacionados
 * Body: {
 *   codprod: string
 * }
 */
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { codprod } = req.body;

  console.log('📦 API Relacionados - Produto:', codprod);

  if (!codprod) {
    return res.status(400).json({ error: 'Código do produto é obrigatório' });
  }

  const pool = getPgPool();

  try {
    // Buscar produtos relacionados ao produto informado
    // A tabela pode ter diferentes nomes: dbprodrelacionado, dbprodutorelacionado, etc.
    // Vamos tentar algumas possibilidades

    let query = `
      SELECT
        pr.codrelacionado,
        p.ref,
        p.descr,
        m.descr as marca,
        p.qtest as qtd,
        p.prvenda,
        p.prcompra,
        p.prcustoatual
      FROM db_manaus.dbprodrelacionado pr
      INNER JOIN db_manaus.dbproduto p ON pr.codrelacionado = p.codprod
      LEFT JOIN db_manaus.dbmarcas m ON p.codmarca = m.codmarca
      WHERE pr.codprod = $1
        AND p.excluido = 0
      ORDER BY p.ref
    `;

    let result;

    try {
      result = await pool.query(query, [codprod]);
    } catch (error: any) {
      // Se a tabela dbprodrelacionado não existir, tentar dbprodutorelacionado
      if (error.code === '42P01') {
        query = `
          SELECT
            pr.codrelacionado,
            p.ref,
            p.descr,
            m.descr as marca,
            p.qtest as qtd,
            p.prvenda,
            p.prcompra,
            p.prcustoatual
          FROM db_manaus.dbprodutorelacionado pr
          INNER JOIN db_manaus.dbproduto p ON pr.codrelacionado = p.codprod
          LEFT JOIN db_manaus.dbmarcas m ON p.codmarca = m.codmarca
          WHERE pr.codprod = $1
            AND p.excluido = 0
          ORDER BY p.ref
        `;

        try {
          result = await pool.query(query, [codprod]);
        } catch (error2: any) {
          // Se ainda não encontrar, retornar vazio
          if (error2.code === '42P01') {
            return res.status(200).json({
              relacionados: [],
              message:
                'Tabela de produtos relacionados não encontrada. Funcionalidade não disponível.',
            });
          }
          throw error2;
        }
      } else {
        throw error;
      }
    }

    const relacionados = result.rows.map((row) => ({
      codprod: row.codrelacionado,
      referencia: row.ref,
      descricao: row.descr,
      marca: row.marca || '-',
      qtd: parseFloat(row.qtd || 0),
      prVenda: parseFloat(row.prvenda || 0),
      prCompra: parseFloat(row.prcompra || 0),
      prCustoAtual: parseFloat(row.prcustoatual || 0),
    }));

    console.log(`📦 API Relacionados - Retornando ${relacionados.length} produtos`);

    return res.status(200).json({
      relacionados,
      total: relacionados.length,
    });
  } catch (error: any) {
    console.error('Erro ao buscar produtos relacionados:', error);

    return res.status(500).json({
      error: 'Erro ao buscar produtos relacionados',
      message: error.message,
    });
  }
}

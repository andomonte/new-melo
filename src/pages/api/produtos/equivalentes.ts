import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * API para consultar produtos equivalentes
 *
 * Retorna lista de produtos que podem substituir o produto informado
 *
 * POST /api/produtos/equivalentes
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

  console.log('🔗 API Equivalentes - Produto:', codprod);

  if (!codprod) {
    return res.status(400).json({ error: 'Código do produto é obrigatório' });
  }

  const pool = getPgPool();

  try {
    // Buscar o grupo de equivalência do produto (CODGPE)
    const queryGrupo = `
      SELECT codgpe
      FROM db_manaus.dbprodequi
      WHERE codprod = $1
      LIMIT 1
    `;

    const resultGrupo = await pool.query(queryGrupo, [codprod]);

    if (resultGrupo.rows.length === 0) {
      // Produto não tem equivalentes cadastrados
      return res.status(200).json({
        equivalentes: [],
        message: 'Produto não possui equivalentes cadastrados',
      });
    }

    const codgpe = resultGrupo.rows[0].codgpe;

    // Buscar todos os produtos do mesmo grupo de equivalência
    const queryEquivalentes = `
      SELECT
        p.codprod,
        p.ref,
        p.descr,
        m.descr as marca,
        p.qtest as qtd,
        p.prvenda,
        p.prcompra,
        p.prcustoatual,
        p.prfabr
      FROM db_manaus.dbprodequi pe
      INNER JOIN db_manaus.dbproduto p ON pe.codprod = p.codprod
      LEFT JOIN db_manaus.dbmarcas m ON p.codmarca = m.codmarca
      WHERE pe.codgpe = $1
        AND pe.codprod != $2
        AND p.excluido = 0
      ORDER BY p.ref
    `;

    const resultEquivalentes = await pool.query(queryEquivalentes, [
      codgpe,
      codprod,
    ]);

    const equivalentes = resultEquivalentes.rows.map((row) => ({
      codprod: row.codprod,
      referencia: row.ref,
      descricao: row.descr,
      marca: row.marca || '-',
      qtd: parseFloat(row.qtd || 0),
      prVenda: parseFloat(row.prvenda || 0),
      prCompra: parseFloat(row.prcompra || 0),
      prCustoAtual: parseFloat(row.prcustoatual || 0),
      prFabr: parseFloat(row.prfabr || 0),
    }));

    console.log(`🔗 API Equivalentes - Retornando ${equivalentes.length} produtos (CODGPE: ${codgpe})`);

    return res.status(200).json({
      equivalentes,
      codgpe,
      total: equivalentes.length,
    });
  } catch (error: any) {
    console.error('Erro ao buscar produtos equivalentes:', error);

    // Se a tabela não existir, retornar vazio
    if (error.code === '42P01') {
      return res.status(200).json({
        equivalentes: [],
        message:
          'Tabela de equivalentes não encontrada. Funcionalidade não disponível.',
      });
    }

    return res.status(500).json({
      error: 'Erro ao buscar produtos equivalentes',
      message: error.message,
    });
  }
}

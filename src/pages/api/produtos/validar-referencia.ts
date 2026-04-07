import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';

/**
 * API para validar se referência já existe
 *
 * Regra do Delphi (CheckRefProdutos):
 * - Verifica se REF já existe em outro produto
 * - Permite mesma REF no mesmo produto (edição)
 *
 * Retorna:
 * - OK: Referência disponível
 * - NOK: Referência já cadastrada
 */
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { ref, codprod } = req.body;

  // Se não informou REF, não precisa validar
  if (!ref || ref === '') {
    return res.status(200).json({ resultado: 'OK', message: 'Referência não informada' });
  }

  try {
    const pool = getPgPool('MANAUS');
    const client = await pool.connect();

    try {
      // Verificar se REF já existe em outro produto
      let query = `
        SELECT codprod, ref, descr
        FROM db_manaus.dbprod
        WHERE UPPER(TRIM(ref)) = UPPER(TRIM($1))
      `;
      const params: any[] = [ref];

      // Se está editando, excluir o próprio produto da busca
      if (codprod) {
        query += ` AND codprod != $2`;
        params.push(codprod);
      }

      const result = await client.query(query, params);

      if (result.rows.length > 0) {
        const produto = result.rows[0];
        return res.status(200).json({
          resultado: 'NOK',
          message: `Referência "${ref}" já cadastrada no produto ${produto.codprod} - ${produto.descr}`,
          produto: {
            codprod: produto.codprod,
            ref: produto.ref,
            descr: produto.descr
          }
        });
      }

      // Referência disponível
      return res.status(200).json({
        resultado: 'OK',
        message: 'Referência disponível'
      });

    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Erro ao validar referência:', error);
    return res.status(500).json({
      error: 'Erro ao validar referência',
      message: error.message
    });
  }
}

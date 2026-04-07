// pages/api/grupos-de-produtos/atualizar.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

// Define the interface for the updatable fields in the request body
interface DbgpprodUpdateBody {
  codvend?: string;
  descbalcao?: number; // Prisma uses 'number' for Decimal types in TypeScript
  dscrev30?: number;
  dscrev45?: number;
  dscrev60?: number;
  dscrv30?: number;
  dscrv45?: number;
  dscrv60?: number;
  dscbv30?: number;
  dscbv45?: number;
  dscbv60?: number;
  dscpv30?: number;
  dscpv45?: number;
  dscpv60?: number;
  descr?: string; // Although unique, it can still be updated if the new value is also unique
  comgpp?: number;
  comgpptmk?: number;
  comgppextmk?: number;
  codseg?: string;
  diasreposicao?: number;
  codcomprador?: string;
  ramonegocio?: string;
  gpp_id?: number;
  p_comercial?: number;
  v_marketing?: number;
  codgpc?: string;
  margem_min_venda?: number;
  margem_med_venda?: number;
  margem_ide_venda?: number;
  bloquear_preco?: string;
  codgrupai?: number;
  codgrupoprod?: number;
  DSCBALCAO?: number; // Note: case sensitive in Prisma, adjust if needed
}

// Define the interface for URL parameters, where 'codgpp' will be passed
interface UpdateParams {
  codgpp?: string; // The primary key of the product group to be updated
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  // Ensure it's a PUT request
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Método não permitido. Use PUT.' });
  }

  const { codgpp } = req.query as UpdateParams; // Extract 'codgpp' from URL parameters
  const updateData: DbgpprodUpdateBody = req.body; // Extract update data from request body

  if (!codgpp || typeof codgpp !== 'string') {
    return res
      .status(400)
      .json({
        error:
          'CODGP_P do grupo de produtos é obrigatório e deve ser uma string.',
      });
  }

  // Check if there is at least one field to update
  if (Object.keys(updateData).length === 0) {
    return res
      .status(400)
      .json({ error: 'Nenhum dado fornecido para atualização.' });
  }

  const pool = getPgPool();
  let client: PoolClient | undefined;

  try {
    client = await pool.connect();

    const updateFields = Object.keys(updateData)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');

    const updateValues = Object.values(updateData);

    const updatedGrupoProdutoResult = await client.query(
      `UPDATE dbgpprod SET ${updateFields} WHERE codgpp = $1 RETURNING *`,
      [codgpp, ...updateValues],
    );

    if (updatedGrupoProdutoResult.rows.length === 0) {
      return res
        .status(404)
        .json({
          error: `Grupo de produtos com CODGP_P ${codgpp} não encontrado.`,
        });
    }

    res
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .json({
        data: serializeBigInt(updatedGrupoProdutoResult.rows[0]),
        message: `Grupo de produtos com CODGP_P ${codgpp} atualizado com sucesso.`,
      });
  } catch (error: any) {
    console.error('Erro ao atualizar grupo de produtos:', error);

    if (error.code === '23505') {
      // PostgreSQL unique constraint violation
      res
        .status(409)
        .json({
          error:
            'A descrição fornecida já está em uso por outro grupo de produtos.',
        });
    } else {
      res
        .status(500)
        .json({
          error: error.message || 'Erro ao atualizar grupo de produtos.',
        });
    }
  } finally {
    if (client) {
      client.release();
    }
  }
}

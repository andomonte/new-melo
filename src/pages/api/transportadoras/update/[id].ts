import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { serializeBigInt } from '@/utils/serializeBigInt';

import { Transportadora } from '@/data/transportadoras/transportadoras';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { id } = req.query;
  const data: Transportadora = req.body;

  if (!id || typeof id !== 'string') {
    return res
      .status(400)
      .json({ error: 'ID da transportadora é obrigatório' });
  }

  if (!data.nome) {
    return res.status(400).json({
      error: 'Nome da transportadora é obrigatório',
    });
  }

  // Validação do nome (máximo 50 caracteres)
  if (data.nome.length > 50) {
    return res.status(400).json({
      error: 'Nome da transportadora deve ter no máximo 50 caracteres',
    });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Inicia uma transação
    await client.query('BEGIN');

    // Verificar se a transportadora existe
    const checkQuery = 'SELECT codtransp FROM dbtransp WHERE codtransp = $1';
    const checkResult = await client.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Transportadora não encontrada' });
    }

    // Construir a query de UPDATE dinamicamente baseada nos campos fornecidos
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    // Percorre todos os campos na 'data' (Transportadora) para construir o UPDATE
    // Exclua 'codtransp' se não quiser que ele seja atualizado
    for (const key in data) {
      if (
        Object.prototype.hasOwnProperty.call(data, key) &&
        key !== 'codtransp' &&
        key !== 'data_cad' // Não atualizar data de cadastro
      ) {
        if (
          key === 'codpais' &&
          data[key] !== null &&
          data[key] !== undefined
        ) {
          updateFields.push(`"${key}" = $${paramIndex}`);
          updateValues.push(parseInt(data[key].toString()) || null);
        } else {
          updateFields.push(`"${key}" = $${paramIndex}`);
          // Converter string vazia para null para campos opcionais
          const value = data[key as keyof Transportadora];
          updateValues.push(value === '' ? null : value);
        }
        paramIndex++;
      }
    }

    // Adiciona o id da condição WHERE
    updateValues.push(id);

    const updateQuery = `
      UPDATE dbtransp
      SET ${updateFields.join(', ')}
      WHERE codtransp = $${paramIndex}
      RETURNING *;
    `;

    const result = await client.query(updateQuery, updateValues);
    const transportadoraAtualizada = result.rows[0];

    await client.query('COMMIT'); // Confirma a transação

    res
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .json({
        data: serializeBigInt(transportadoraAtualizada),
        message: `Transportadora ${transportadoraAtualizada?.nome} atualizada com sucesso.`,
      });
  } catch (error: any) {
    await client?.query('ROLLBACK'); // Reverte a transação em caso de erro
    console.error('Erro ao atualizar transportadora:', error);

    // Verificar se é erro de violação de constraint
    if (error instanceof Error) {
      if (error.message.includes('duplicate key')) {
        return res.status(400).json({
          error: 'Já existe uma transportadora com este código',
        });
      }

      if (error.message.includes('violates not-null constraint')) {
        return res.status(400).json({
          error: 'Campos obrigatórios não foram preenchidos',
        });
      }

      if (error.message.includes('value too long')) {
        return res.status(400).json({
          error: 'Um ou mais campos excedem o tamanho máximo permitido',
        });
      }
    }

    res
      .status(500)
      .json({ error: error.message || 'Erro ao atualizar transportadora.' });
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Sugestão de caminho: pages/api/kickback/[id].ts

import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  const { id } = req.query;
  const clienteId = parseInt(id as string, 10);

  if (isNaN(clienteId)) {
    res.status(400).json({ message: 'O ID fornecido é inválido.' });
    return;
  }

  let client: PoolClient | undefined;

  try {
    client = await getPgPool(filial).connect();

    // --- ROTA DE ATUALIZAÇÃO ---
    if (req.method === 'PUT') {
      const { body } = req;

      // Lista de campos que são permitidos para atualização.
      // Isso é uma medida de segurança para evitar que campos indesejados (como 'id') sejam alterados.
      const allowedFields = ['codcli', 'class', 'status', 'g'];

      const fieldsToUpdate = Object.keys(body).filter((key) =>
        allowedFields.includes(key),
      );

      if (fieldsToUpdate.length === 0) {
        res.status(400).json({
          message: 'Nenhum campo válido para atualização foi fornecido.',
        });
        return;
      }

      // Constrói a cláusula SET dinamicamente: "campo1" = $1, "campo2" = $2, ...
      const setClause = fieldsToUpdate
        .map((field, index) => `"${field}" = $${index + 1}`)
        .join(', ');
      const values = fieldsToUpdate.map((field) => body[field]);

      const updateQuery = `
        UPDATE cliente_kickback
        SET ${setClause}
        WHERE id = $${fieldsToUpdate.length + 1}
        RETURNING *;
      `;

      const result = await client.query(updateQuery, [...values, clienteId]);

      if (result.rowCount === 0) {
        res.status(404).json({
          message: `Cliente Kickback com ID ${clienteId} não encontrado.`,
        });
        return;
      }

      res.status(200).json(serializeBigInt(result.rows[0]));

      // --- ROTA DE DELEÇÃO ---
    } else if (req.method === 'DELETE') {
      const deleteQuery = `
        DELETE FROM cliente_kickback 
        WHERE id = $1
        RETURNING *; 
      `;
      // Usamos RETURNING * para saber se algo foi realmente deletado.
      const result = await client.query(deleteQuery, [clienteId]);

      if (result.rowCount === 0) {
        res.status(404).json({
          message: `Cliente Kickback com ID ${clienteId} não encontrado para deletar.`,
        });
        return;
      }

      res.status(204).end();

      // --- MÉTODO NÃO PERMITIDO ---
    } else {
      res.setHeader('Allow', ['PUT', 'DELETE']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error(`Erro na API para o cliente ID ${clienteId}:`, error);
    res.status(500).json({
      message: `Erro interno ao processar a requisição para o ID ${clienteId}.`,
      error: (error as Error).message,
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

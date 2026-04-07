import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID inválido' });
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

    if (req.method === 'GET') {
      // ✅ CORREÇÃO: Usamos LEFT JOIN para buscar dados das tabelas relacionadas.
      const query = `
        SELECT 
          c.*, -- Todas as colunas da tabela principal de credores (fornecedores)
          rf.* -- Todas as colunas das regras de faturamento
        FROM 
          db_manaus.dbcredor c
        LEFT JOIN 
          db_manaus.cad_credor_regra_faturamento rf ON c.cod_credor = rf.crf_id
        WHERE 
          c.cod_credor = $1;
      `;

      const result = await client.query(query, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Fornecedor não encontrado' });
      }

      // O resultado da query já vem com os campos das duas tabelas combinados
      const fornecedorCompleto = result.rows[0];

      res.status(200).json(serializeBigInt(fornecedorCompleto));
    } else if (req.method === 'PUT') {
      const dataToUpdate = req.body;

      // ✅ MELHORIA: Removemos a chave primária do objeto de atualização por segurança.
      delete dataToUpdate.cod_credor;

      const keys = Object.keys(dataToUpdate);
      if (keys.length === 0) {
        return res.status(400).json({ error: 'Nenhum dado para atualizar.' });
      }

      const setClause = keys
        .map((key, index) => `"${key}" = $${index + 1}`)
        .join(', ');
      const values = Object.values(dataToUpdate);

      const query = `
        UPDATE db_manaus.dbcredor 
        SET ${setClause}
        WHERE cod_credor = $${keys.length + 1}
        RETURNING *
      `;

      const result = await client.query(query, [...values, id]);

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ error: 'Fornecedor não encontrado para atualizar' });
      }

      res.status(200).json(serializeBigInt(result.rows[0]));
    } else {
      res.setHeader('Allow', ['GET', 'PUT']);
      res.status(405).json({ error: 'Método não permitido' });
    }
  } catch (error: any) {
    console.error('Erro na operação com fornecedor:', error);
    res
      .status(500)
      .json({ error: 'Erro interno no servidor', details: error.message });
  } finally {
    if (client) {
      client.release();
    }
  }
}

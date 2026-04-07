import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg'; // Importe PoolClient do 'pg'
import { getPgPool } from '@/lib/pgClient'; // Importe sua função getPgPool
import { parseCookies } from 'nookies'; // Para ler o cookie da filial

import { Banco } from '@/data/bancos/bancos'; // Mantenha sua interface Banco

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  // Certifique-se de que o método da requisição é PUT ou PATCH para atualização
  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  const { banco, nome }: Banco = req.body; // 'banco' aqui é o código do banco, usado como ID

  if (!banco || !nome) {
    res.status(400).json({ error: 'Código do banco e nome são obrigatórios.' });
    return;
  }

  let client: PoolClient | undefined; // Declare client aqui para garantir que ele esteja disponível no bloco finally

  try {
    const pool = getPgPool(filial); // Obtém o pool de conexão baseado na filial
    client = await pool.connect(); // Obtém um cliente de conexão do pool

    const updateQuery = `
      UPDATE dbbanco_cobranca
      SET nome = $1
      WHERE banco = $2
      RETURNING *; -- Retorna a linha atualizada
    `;

    // Converte 'banco' para string se necessário
    const result = await client.query(updateQuery, [nome, banco.toString()]);

    if (result.rowCount === 0) {
      // Se rowCount for 0, significa que nenhuma linha foi afetada, ou seja, o banco não foi encontrado.
      return res.status(404).json({
        error: `Banco com código ${banco} não encontrado.`,
      });
    }

    const updatedBanco = result.rows[0]; // O registro atualizado

    res
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .json({ data: updatedBanco });
  } catch (error: any) {
    console.error('Erro ao atualizar banco:', error); // Melhor log de erro
    res
      .status(500)
      .json({ error: error.message || 'Erro ao atualizar banco.' });
  } finally {
    if (client) {
      client.release(); // Libera o cliente de volta para o pool
    }
  }
}

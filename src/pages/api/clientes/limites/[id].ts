import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg'; // Importe PoolClient do 'pg'
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient'; // Importe sua função getPgPool
import { serializeBigInt } from '@/utils/serializeBigInt'; // Mantenha se precisar serializar BigInts

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  // Certifique-se de que o método da requisição é GET para buscar
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { id } = req.query; // Extrai o ID do cliente dos parâmetros da URL
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  if (!id || typeof id !== 'string') {
    res.status(400).json({ error: 'ID Obrigatório e deve ser uma string.' });
    return;
  }

  let client: PoolClient | undefined; // Declare client aqui para garantir que ele esteja disponível no bloco finally

  try {
    const pool = getPgPool(filial); // Obtém o pool de conexão baseado na filial
    client = await pool.connect(); // Obtém um cliente de conexão do pool

    // Consulta para buscar o último limite de cliente para um dado codcli
    const limiteClienteResult = await client.query(
      `
      SELECT *
      FROM dbcliente_limite
      WHERE codcli = $1
      ORDER BY codclilim DESC
      LIMIT 1;
      `,
      [id], // Passa o ID como parâmetro
    );

    const limiteCliente = limiteClienteResult.rows[0]; // Pega o primeiro (e único) registro retornado

    // O Prisma retornaria `null` se não encontrasse, o pg retorna `undefined` para `rows[0]`
    if (!limiteCliente) {
      // Se nenhum limite for encontrado, retorna 200 com null/vazio, ou 404 se preferir
      // O código original do Prisma retornava 200 com null. Mantive esse comportamento.
      return res
        .status(200)
        .setHeader('Content-Type', 'application/json')
        .json(null); // Retorna null como no comportamento do findFirst do Prisma se não encontrar
    }

    // Se tiver BigInts, use serializeBigInt. Caso contrário, o objeto já deve estar pronto.
    res
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .json(serializeBigInt(limiteCliente)); // Aplica a serialização se necessário
  } catch (error: any) {
    console.error('Erro ao buscar limite do cliente:', error); // Melhor log de erro
    res
      .status(500)
      .json({ error: error.message || 'Erro ao buscar limite do cliente.' });
  } finally {
    if (client) {
      client.release(); // Libera o cliente de volta para o pool
    }
  }
}

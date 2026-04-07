import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient'; // Importe sua função getPgPool

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let client: PoolClient | undefined;
  const data = req.body;

  const nome = data.nome; // Extrai o nome do corpo da requisição

  if (!nome) {
    return res.status(400).json({ error: 'Nome do banco é obrigatório.' });
  }

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Inicia uma transação para garantir a consistência
    await client.query('BEGIN');

    // Busca o próximo código disponível de forma mais robusta
    let nextBanco: string;
    let attempts = 0;
    const maxAttempts = 100; // Limite de tentativas para evitar loop infinito

    do {
      // Converte a coluna para numérica para ordenação correta e encontra o próximo disponível
      const nextBankResult = await client.query(
        `
        SELECT COALESCE(MAX(CAST(banco AS INTEGER)), 0) + 1 + $1 as next_banco 
        FROM dbbanco_cobranca 
        WHERE banco ~ '^[0-9]+$'
      `,
        [attempts],
      );

      nextBanco = nextBankResult.rows[0].next_banco.toString();

      // Verifica se o código já existe
      const existsResult = await client.query(
        'SELECT 1 FROM dbbanco_cobranca WHERE banco = $1',
        [nextBanco],
      );

      if (existsResult.rows.length === 0) {
        // Código disponível, sai do loop
        break;
      }

      attempts++;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      throw new Error(
        'Não foi possível encontrar um código disponível para o banco',
      );
    }

    // Prepara a query de inserção
    const insertBancoQuery =
      'INSERT INTO dbbanco_cobranca (banco, nome) VALUES ($1, $2) RETURNING *';

    // Executa a inserção
    const bancoResult = await client.query(insertBancoQuery, [nextBanco, nome]);
    const banco = bancoResult.rows[0];

    // Commita a transação
    await client.query('COMMIT');

    res.status(201).json({ data: banco });
  } catch (error) {
    // Em caso de erro, faz rollback da transação
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Erro ao criar banco de cobrança:', error);
    res.status(500).json({ error: 'Erro ao criar banco de cobrança' });
  } finally {
    if (client) {
      client.release();
    }
  }
}

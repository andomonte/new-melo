import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * Handler da API para buscar um cliente pelo seu codcli.
 * Espera uma requisição GET para /api/cliente/[codcli]
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // 1. Validar o método HTTP, deve ser apenas GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res
      .status(405)
      .json({ error: `Método ${req.method} não permitido` });
  }

  // 2. Extrair o codcli da URL (ex: /api/cliente/00194)
  const { codcli } = req.query;

  // Valida se o codcli foi fornecido
  if (!codcli || typeof codcli !== 'string') {
    return res.status(400).json({ error: 'O codcli é obrigatório' });
  }

  // 3. Conectar ao banco de dados
  const client = await getPgPool().connect();

  try {
    // 4. Executar a query para buscar os dados do cliente de forma segura
    const query = 'SELECT * FROM dbclien WHERE codcli = $1';
    const { rows } = await client.query(query, [codcli]);

    // 5. Verificar se o cliente foi encontrado
    if (rows.length === 0) {
      return res
        .status(404)
        .json({ error: `Cliente com codcli '${codcli}' não encontrado` });
    }

    // 6. Retornar os dados do cliente encontrado
    return res.status(200).json(rows[0]);
  } catch (error: any) {
    // 7. Tratamento de erro genérico do servidor
    console.error('Erro ao buscar dados do cliente:', error);
    return res.status(500).json({
      error: 'Erro interno no servidor',
      details: error.message,
    });
  } finally {
    // 8. Liberar o cliente de volta para o pool, etapa crucial para evitar vazamento de conexões
    client.release();
  }
}

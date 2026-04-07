import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient'; // Certifique-se de que este é o caminho correto para sua função getPgPool
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function buscarCliente(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let client: PoolClient | undefined;

  // Extrai 'descricao' do corpo da requisição (POST)
  const { descricao, page = '1', perPage = '10' } = req.body;

  // Validação básica para 'descricao'
  if (!descricao) {
    return res
      .status(400)
      .json({
        error: 'Parâmetro "descricao" é obrigatório no corpo da requisição.',
      });
  }

  try {
    const pool = getPgPool(filial); // Passa a filial para obter o pool correto
    client = await pool.connect();

    const pageNumber = Number(page);
    const perPageNumber = Number(perPage);

    // Validação de números para paginação
    if (
      isNaN(pageNumber) ||
      pageNumber < 1 ||
      isNaN(perPageNumber) ||
      perPageNumber < 1
    ) {
      return res
        .status(400)
        .json({
          error:
            'Os parâmetros "page" e "perPage" devem ser números positivos.',
        });
    }

    const offset = (pageNumber - 1) * perPageNumber;

    // 1. Consulta Principal com LIMIT e OFFSET
    // Adicionei ORDER BY para garantir uma ordem consistente na paginação.
    // CONSIDERE APENAS RETORNAR AS COLUNAS NECESSÁRIAS AQUI, não um SELECT *.
    const clientesQuery = `
      SELECT * FROM DBCLIEN 
      WHERE NOME ILIKE $1 OR CPFCGC ILIKE $2 OR CODCLI ILIKE $3
      ORDER BY NOME ASC -- Adicione uma ordem para garantir paginação consistente
      LIMIT $4 OFFSET $5;
    `;

    const clientesResult = await client.query(clientesQuery, [
      `%${descricao}%`,
      `%${descricao}%`,
      `%${descricao}%`,
      perPageNumber,
      offset,
    ]);
    const clientes = clientesResult.rows;

    // 2. Consulta para Contagem Total
    // Esta consulta é crucial para saber o total de itens para a paginação.
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM DBCLIEN
      WHERE NOME ILIKE $1 OR CPFCGC ILIKE $2 OR CODCLI ILIKE $3;
    `;

    const countResult = await client.query(countQuery, [
      `%${descricao}%`,
      `%${descricao}%`,
      `%${descricao}%`,
    ]);
    const totalCount = parseInt(countResult.rows[0].total, 10);

    // --- CÓDIGO PARA FORMATAR AS CHAVES PARA CAIXA ALTA (mantido) ---
    const clientesFormatado = clientes.map((item) => {
      const formattedItem: { [key: string]: any } = {};
      for (const key in item) {
        if (Object.prototype.hasOwnProperty.call(item, key)) {
          formattedItem[key.toUpperCase()] = item[key];
        }
      }
      return serializeBigInt(formattedItem);
    });
    // --- FIM DO CÓDIGO DE FORMATAÇÃO ---

    res.status(200).json(
      serializeBigInt({
        data: clientesFormatado,
        meta: {
          total: totalCount,
          lastPage: totalCount > 0 ? Math.ceil(totalCount / perPageNumber) : 1,
          currentPage: totalCount > 0 ? pageNumber : 1,
          perPage: perPageNumber,
        },
      }),
    );
  } catch (error) {
    console.error('Erro ao buscar dados do cliente no PostgreSQL:', error);
    res.status(500).json({ error: 'Erro ao buscar dados do cliente' });
  } finally {
    if (client) {
      client.release();
    }
  }
}

import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg'; // Importe PoolClient do 'pg'
import { getPgPool } from '@/lib/pgClient'; // Importe sua função getPgPool
import { parseCookies } from 'nookies';

// Defina a interface para os dados que podem ser atualizados no corpo da requisição
interface ContaUpdateBody {
  banco?: string;
  tipo?: string;
  nroconta?: string;
  convenio?: string;
  variacao?: string;
  carteira?: string;
  melo?: string;
  agencia?: string;
}

// Defina a interface para os parâmetros da URL, onde o 'id' da conta será passado
interface UpdateParams {
  id?: string; // O ID da conta a ser atualizada
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  // Certifique-se de que o método da requisição é PUT ou PATCH para atualização
  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { id } = req.query as UpdateParams; // Extrai o ID da conta dos parâmetros da URL
  const updateData: ContaUpdateBody = req.body; // Extrai os dados para atualização do corpo da requisição

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  if (!id || typeof id !== 'string') {
    return res
      .status(400)
      .json({ error: 'ID da conta é obrigatório e deve ser uma string.' });
  }

  // Verifica se há pelo menos um campo para atualizar
  // Filtrar para garantir que apenas campos válidos e não-nulos/indefinidos sejam usados
  const validUpdateData = Object.keys(updateData).reduce((acc, key) => {
    const value = updateData[key as keyof ContaUpdateBody];
    if (value !== undefined) {
      // Garante que apenas valores definidos sejam incluídos
      (acc as any)[key] = value;
    }
    return acc;
  }, {} as Partial<ContaUpdateBody>); // Usar Partial para tipagem correta

  if (Object.keys(validUpdateData).length === 0) {
    return res
      .status(400)
      .json({ error: 'Nenhum dado válido fornecido para atualização.' });
  }

  let client: PoolClient | undefined; // Declare client aqui para garantir que ele esteja disponível no bloco finally

  try {
    const pool = getPgPool(filial); // Usa a mesma função para obter o pool de conexão baseado na filial
    client = await pool.connect(); // Obtém um cliente do pool

    // Construir dinamicamente a query SQL e os valores
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const key in validUpdateData) {
      if (Object.prototype.hasOwnProperty.call(validUpdateData, key)) {
        updates.push(`"${key}" = $${paramIndex}`); // Aspas duplas para nomes de coluna no PostgreSQL
        values.push(validUpdateData[key as keyof ContaUpdateBody]);
        paramIndex++;
      }
    }

    // Adiciona o ID da conta aos valores
    const contaId = parseInt(id, 10);
    values.push(contaId);

    const query = `
      UPDATE dbdados_banco
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *; -- Retorna a linha atualizada
    `;

    const result = await client.query(query, values);

    if (result.rowCount === 0) {
      // Se rowCount for 0, significa que nenhuma linha foi afetada, ou seja, o ID não foi encontrado.
      return res
        .status(404)
        .json({ error: `Conta com ID ${id} não encontrada.` });
    }

    const updatedConta = result.rows[0]; // Pega o primeiro (e único) registro retornado

    // O serializeBigInt é importante se o seu modelo dbdados_banco tiver campos BigInt
    // No seu GET, você está usando, então manter aqui é uma boa prática.
    res
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .json({
        data: updatedConta,
        message: `Conta com ID ${id} atualizada com sucesso.`,
      });
  } catch (error: any) {
    console.error('Erro ao atualizar conta:', error);
    // Erros gerais do banco de dados (ex: problema de conexão, sintaxe SQL inválida)
    res
      .status(500)
      .json({ error: error.message || 'Erro ao atualizar conta.' });
  } finally {
    if (client) {
      client.release(); // Libera o cliente de volta para o pool
    }
  }
}

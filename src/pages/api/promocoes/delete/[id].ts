// pages/api/promocoes/delete/[id].ts

import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient'; // Importe sua função getPgPool

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  // Garante que a requisição seja do tipo DELETE
  if (req.method !== 'DELETE') {
    return res
      .status(405)
      .json({ message: 'Método não permitido. Use DELETE.' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo; // Obtém a filial do cookie

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let client: PoolClient | undefined; // Declara client fora do try/catch para garantir liberação no finally
  const { id } = req.query; // Obtém o ID da URL da requisição (ex: /api/promocoes/delete/123)

  // Validação do ID da promoção
  if (!id || typeof id !== 'string' || isNaN(Number(id))) {
    return res
      .status(400)
      .json({
        error: 'ID da promoção é obrigatório e deve ser um número válido.',
      });
  }

  const promocaoId = Number(id); // Converte o ID para número

  try {
    const pool = getPgPool(filial); // Obtém o pool de conexão para a filial
    client = await pool.connect(); // Obtém uma conexão do pool

    // ✨ PASSO 1: INICIA A TRANSAÇÃO.
    // Todas as operações de banco de dados a seguir serão parte desta transação.
    // Elas só serão salvas permanentemente se um COMMIT for executado.
    // Se ocorrer um erro, um ROLLBACK desfarará todas as alterações.
    await client.query('BEGIN');

    // 1. Verifica se a promoção existe antes de tentar deletar
    const promocaoExistsResult = await client.query(
      'SELECT id_promocao FROM dbpromocao WHERE id_promocao = $1',
      [promocaoId],
    );

    if (promocaoExistsResult.rowCount === 0) {
      // Se a promoção não for encontrada, faz rollback imediato e retorna erro.
      await client.query('ROLLBACK');
      return res
        .status(404)
        .json({ message: `Promoção com ID ${promocaoId} não encontrada.` });
    }

    // 2. Deleta os itens relacionados na tabela 'dbpromocao_item' primeiro.
    // Isso é CRUCIAL para respeitar a integridade referencial (FOREIGN KEY)
    // antes de deletar a promoção principal. Se esta operação falhar,
    // o bloco catch fará o ROLLBACK de toda a transação.
    await client.query('DELETE FROM dbpromocao_item WHERE id_promocao = $1', [
      promocaoId,
    ]);

    // 3. Deleta a promoção principal da tabela 'dbpromocao'.
    // Se esta operação falhar, o bloco catch fará o ROLLBACK de toda a transação,
    // inclusive da exclusão dos itens acima.
    await client.query('DELETE FROM dbpromocao WHERE id_promocao = $1', [
      promocaoId,
    ]);

    // ✨ PASSO 2: COMMITA A TRANSAÇÃO.
    // Se chegamos até aqui, todas as operações foram bem-sucedidas.
    // As alterações são agora salvas permanentemente no banco de dados.
    await client.query('COMMIT');

    res
      .status(200)
      .json({
        message: `Promoção com ID ${promocaoId} e seus itens foram excluídos com sucesso.`,
      });
  } catch (error: any) {
    // ✨ PASSO 3: ROLLBACK EM CASO DE ERRO.
    // Se qualquer erro ocorrer em qualquer operação de banco de dados
    // dentro do bloco 'try' (após o 'BEGIN'), este bloco 'catch' será executado.
    // O 'ROLLBACK' desfaz TODAS as alterações feitas desde o 'BEGIN',
    // garantindo que o banco de dados permaneça no estado original.
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Erro ao excluir promoção e seus itens no backend:', error);
    // Retorna uma mensagem de erro apropriada para o frontend
    res.status(500).json({
      message: 'Erro interno do servidor ao excluir a promoção.',
      error: error.message || 'Erro desconhecido',
    });
  } finally {
    // ✨ PASSO 4: SEMPRE LIBERA A CONEXÃO.
    // Garante que a conexão com o banco de dados seja liberada de volta ao pool,
    // independentemente de a transação ter sido bem-sucedida ou ter falhado.
    if (client) {
      client.release();
    }
  }
}

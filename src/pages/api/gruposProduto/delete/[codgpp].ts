// src/pages/api/gruposProduto/delete.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  // Verifique se a requisição é um DELETE
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Método não permitido. Use DELETE.' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let client: PoolClient | undefined;
  // ATENÇÃO: O 'id' na query string agora se refere ao 'codgpp' da sua tabela dbgpprod
  const { codgpp } = req.query; // Usando codgpp conforme sua interface GrupoProduto

  if (!codgpp || typeof codgpp !== 'string' || codgpp.trim() === '') {
    return res
      .status(400)
      .json({ error: 'O código do grupo de produtos (codgpp) é obrigatório e deve ser uma string válida.' });
  }

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Inicia a transação
    await client.query('BEGIN');

    // Verifica se o grupo de produtos existe antes de tentar excluir
    // *** CORRIGIDO AQUI: USANDO 'dbgpprod' E 'codgpp' ***
    const productGroupExistsResult = await client.query(
      'SELECT codgpp FROM dbgpprod WHERE codgpp = $1',
      [codgpp],
    );

    if (productGroupExistsResult.rowCount === 0) {
      throw new Error(`Grupo de produtos com CODGP_P ${codgpp} não encontrado.`);
    }

    // Exclui o grupo de produtos
    // *** CORRIGIDO AQUI: USANDO 'dbgpprod' E 'codgpp' ***
    await client.query('DELETE FROM dbgpprod WHERE codgpp = $1', [codgpp]);

    // Confirma a transação
    await client.query('COMMIT');

    res
      .status(200)
      .json({ message: `Grupo de produtos com CODGP_P ${codgpp} foi excluído com sucesso.` });
  } catch (error: any) {
    // Reverte em caso de erro
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Erro ao excluir grupo de produtos:', error);
    res
      .status(500)
      .json({ error: error.message || 'Erro ao excluir grupo de produtos' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
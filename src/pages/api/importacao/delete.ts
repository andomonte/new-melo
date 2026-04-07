/**
 * DELETE /api/importacao/delete?id=X
 * Exclui uma importação e seus dados relacionados (contratos, entradas, itens)
 * APENAS PARA TESTES - não vai para produção
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import type { PoolClient } from 'pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const id = parseInt(req.query.id as string);
  if (!id || isNaN(id)) {
    return res.status(400).json({ message: 'ID é obrigatório' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS';
  const pool = getPgPool(filial);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Verificar se existe
    const existe = await client.query(
      'SELECT id, nro_di FROM db_manaus.dbent_importacao WHERE id = $1',
      [id],
    );

    if (existe.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: `Importação ID ${id} não encontrada` });
    }

    const nroDi = existe.rows[0].nro_di;

    // Excluir na ordem correta (filhos primeiro)
    await client.query('DELETE FROM db_manaus.dbent_importacao_it_ent WHERE id_importacao = $1', [id]);
    await client.query('DELETE FROM db_manaus.dbent_importacao_entrada WHERE id_importacao = $1', [id]);
    await client.query('DELETE FROM db_manaus.dbent_importacao_contratos WHERE id_importacao = $1', [id]);
    await client.query('DELETE FROM db_manaus.dbent_importacao WHERE id = $1', [id]);

    await client.query('COMMIT');

    console.log(`[TESTE] Importação excluída: ID=${id}, DI=${nroDi}`);

    return res.status(200).json({
      success: true,
      message: `Importação ${nroDi} excluída com sucesso`,
    });
  } catch (error: any) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Erro ao excluir importação:', error);
    return res.status(500).json({
      message: error.message || 'Erro ao excluir importação',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

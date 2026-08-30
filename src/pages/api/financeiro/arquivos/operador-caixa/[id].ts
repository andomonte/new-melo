// Financeiro > Arquivos > Operador Caixa — leitura, alteração e remoção do vínculo.
// O id é "usuario|perfil|codigo_filial" (chave composta de tb_user_perfil).

import type { NextApiRequest, NextApiResponse } from 'next';
import type { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pg';
import { lerIdOperador, SELECT_OPERADOR } from '@/lib/financeiro/operadorCaixa';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const chave = lerIdOperador(String(req.query.id ?? ''));
  if (!chave) return res.status(400).json({ error: 'Operador inválido.' });

  const params = [chave.user_login_id, chave.perfil_name, chave.codigo_filial];
  const filtro =
    'p.user_login_id = $1 AND p.perfil_name = $2 AND p.codigo_filial = $3';

  let client: PoolClient | undefined;
  try {
    client = await getPgPool().connect();

    if (req.method === 'GET') {
      const { rows } = await client.query(
        `SELECT ${SELECT_OPERADOR}
         FROM tb_user_perfil p
         LEFT JOIN dbconta c ON c.cod_conta = p.cod_conta
         WHERE ${filtro}`,
        params,
      );
      if (!rows.length) {
        return res.status(404).json({ error: 'Operador não encontrado.' });
      }
      return res.status(200).json(rows[0]);
    }

    if (req.method === 'PUT') {
      // btnAlterarClick do Delphi só troca a conta — o usuário fica travado
      // (meAltCodUsuario.ReadOnly := True).
      const conta = String(req.body?.cod_conta ?? '').trim();
      if (!conta) return res.status(400).json({ error: 'Conta inválida.' });

      const existe = await client.query(
        'SELECT 1 FROM dbconta WHERE cod_conta = $1 LIMIT 1',
        [conta],
      );
      if (!existe.rows.length) {
        return res.status(400).json({ error: 'Conta inválida.' });
      }

      const { rowCount } = await client.query(
        `UPDATE tb_user_perfil p SET cod_conta = $4 WHERE ${filtro}`,
        [...params, conta],
      );
      if (!rowCount) {
        return res.status(404).json({ error: 'Operador não encontrado.' });
      }
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      // Remover o operador = limpar a conta do perfil (a linha de
      // tb_user_perfil continua existindo, o usuário só deixa de ser caixa).
      const { rowCount } = await client.query(
        `UPDATE tb_user_perfil p SET cod_conta = NULL WHERE ${filtro}`,
        params,
      );
      if (!rowCount) {
        return res.status(404).json({ error: 'Operador não encontrado.' });
      }
      return res.status(204).end();
    }

    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (erro: any) {
    console.error('Erro no operador de caixa:', erro);
    return res.status(500).json({ error: erro.message });
  } finally {
    client?.release();
  }
}

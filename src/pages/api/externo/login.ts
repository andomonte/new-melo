/**
 * Login da Venda Externa — POST /api/externo/login { usuario, senha, codigoFilial }
 * Mesmo usuário/senha do sistema (db_manaus.tb_login_user, bcrypt). A filial vem do link
 * (/externo/<codigo_filial>) e o usuário precisa ter CÓDIGO DE VENDEDOR nela
 * (tb_user_perfil.codvend). Devolve o passe de 7 dias (lib/vendaExterna/token.ts).
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { compare } from 'bcryptjs';
import { getPgPool } from '@/lib/pg';
import { emitirPasse, VALIDADE_PASSE_DIAS } from '@/lib/vendaExterna/token';
import { validarUsuarioExterno } from '@/lib/vendaExterna/usuario';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const usuario = String(req.body?.usuario || '').trim();
  const senha = String(req.body?.senha || '');
  const codigoFilial = Number(req.body?.codigoFilial);
  if (!usuario || !senha) return res.status(400).json({ error: 'Informe usuário e senha.' });
  if (!Number.isFinite(codigoFilial)) return res.status(400).json({ error: 'Link de filial inválido.' });

  const central = getPgPool();
  try {
    const f = await central.query(
      `SELECT nome_filial FROM db_manaus.tb_login_filiais WHERE codigo_filial = $1 LIMIT 1`,
      [codigoFilial],
    );
    const filial = String(f.rows[0]?.nome_filial || '').trim().toUpperCase();
    if (!filial) return res.status(404).json({ error: `Filial de código ${codigoFilial} não encontrada. Confira o link.` });

    const u = await central.query(
      `SELECT login_user_login, login_user_password FROM db_manaus.tb_login_user
        WHERE UPPER(login_user_login) = UPPER($1) LIMIT 1`,
      [usuario],
    );
    const row = u.rows[0];
    if (!row || !(await compare(senha, row.login_user_password || ''))) {
      return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }

    const v = await validarUsuarioExterno(row.login_user_login, filial);
    if (!v.ok) return res.status(v.status).json({ error: v.error });

    const { token, passe } = emitirPasse({ u: v.login, n: v.nome, f: filial, v: v.codvend, p: v.perfil });
    return res.status(200).json({ token, passe, validadeDias: VALIDADE_PASSE_DIAS });
  } catch (e: any) {
    console.error('Erro em externo/login:', e);
    return res.status(500).json({ error: 'Erro ao entrar. Tente novamente.' });
  }
}

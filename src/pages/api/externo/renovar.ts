/**
 * POST /api/externo/renovar (Authorization: Bearer <passe>)
 * Renova o passe por mais 7 dias se ainda válido e se o usuário continua liberado
 * (não bloqueado, com código de vendedor na filial).
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { emitirPasse, passeDaRequisicao, VALIDADE_PASSE_DIAS } from '@/lib/vendaExterna/token';
import { validarUsuarioExterno } from '@/lib/vendaExterna/usuario';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  const atual = passeDaRequisicao(req);
  if (!atual) return res.status(401).json({ error: 'Sessão vencida. Entre de novo com usuário e senha.' });
  try {
    const v = await validarUsuarioExterno(atual.u, atual.f);
    if (!v.ok) return res.status(v.status).json({ error: v.error });
    const { token, passe } = emitirPasse({ u: v.login, n: v.nome, f: atual.f, v: v.codvend, p: v.perfil });
    return res.status(200).json({ token, passe, validadeDias: VALIDADE_PASSE_DIAS });
  } catch (e: any) {
    console.error('Erro em externo/renovar:', e);
    return res.status(500).json({ error: 'Erro ao renovar a sessão.' });
  }
}

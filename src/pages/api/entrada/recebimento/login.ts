/**
 * Login do Recebimento de Entradas — POST /api/entrada/recebimento/login
 *   { matricula, codigoAcesso }   (filial no header x-filial-recebimento)
 *
 * Mesmo modelo das estações de Separação/Conferência (dbfunc_estoque):
 *  - matrícula identifica; o código pessoal é a senha;
 *  - PRIMEIRO ACESSO (código ainda igual à matrícula) → { primeiroAcesso: true } e a
 *    tela obriga a criar um código (POST /api/conferencia/estacao/criar-codigo).
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { poolRecebimento } from '@/lib/recebimentoEntrada/filial';
import { autenticarSeparador } from '@/lib/separacao/estacaoAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido', code: 'METHOD_NOT_ALLOWED' });
  }

  const { filial, pool } = poolRecebimento(req);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    const auth = await autenticarSeparador(client, req.body?.matricula, req.body?.codigoAcesso);
    if (!auth.ok) {
      console.warn('Falha login recebimento:', {
        matricula: String(req.body?.matricula || '').slice(0, 3) + '***',
        filial,
        code: auth.code,
      });
      return res.status(auth.status).json({ error: auth.error, code: auth.code });
    }

    return res.status(200).json({
      data: { matricula: auth.matricula, nome: auth.nome, primeiroAcesso: auth.primeiroAcesso, filial },
    });
  } catch (error) {
    console.error('Erro login recebimento:', error);
    return res.status(500).json({ error: 'Erro interno do servidor', code: 'INTERNAL_SERVER_ERROR' });
  } finally {
    if (client) client.release();
  }
}

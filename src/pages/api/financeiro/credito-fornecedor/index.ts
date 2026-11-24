import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { credoresComCredito, grupoDoCredor, listarGruposComCredito } from '@/lib/compras/creditoFornecedor';

/**
 * Crédito de Fornecedor — lista dos fornecedores (grupo matriz + filiais) com crédito.
 *   GET ?q=nome|cnpj&todos=1           → grupos (todos=1 inclui os zerados)
 *   GET ?credores=1                    → códigos de credor com crédito (selo do Contas a Pagar)
 *   GET ?cod_credor=00030              → { grupo } do credor (atalho do selo)
 * Roteiro: docs/saldo-fornecedor/roteiro-adiantamento-nfe-credito.md (fase 4).
 */
const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ erro: 'Método não permitido' });
  }
  try {
    if (req.query.credores) return res.status(200).json({ credores: await credoresComCredito(pool) });
    if (typeof req.query.cod_credor === 'string') {
      return res.status(200).json({ grupo: await grupoDoCredor(pool, req.query.cod_credor.trim()) });
    }
    const grupos = await listarGruposComCredito(pool, {
      q: typeof req.query.q === 'string' ? req.query.q : '',
      todos: req.query.todos === '1' || req.query.todos === 'true',
    });
    return res.status(200).json({ grupos });
  } catch (e: any) {
    if (e?.code === '42P01' || e?.code === '42883') return res.status(200).json({ grupos: [], credores: [] });
    console.error('Erro na lista de crédito de fornecedor:', e);
    return res.status(500).json({ erro: 'Erro ao buscar créditos de fornecedor', detalhes: e?.message });
  }
}

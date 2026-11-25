import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { listarTomadas } from '@/lib/nfse/tomadas';

/**
 * NFS-e tomadas (baixadas do portal nacional). GET ?de=&ate=&situacao=pendentes|com_titulo|canceladas|todas&q=
 * Regras: src/lib/nfse/tomadas.ts.
 */
const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ erro: 'Método não permitido' });
  }
  const s = (k: string) => (req.query[k] ? String(req.query[k]) : null);
  const situacao = (['pendentes', 'com_titulo', 'canceladas', 'todas'].includes(String(req.query.situacao))
    ? String(req.query.situacao) : 'pendentes') as 'pendentes' | 'com_titulo' | 'canceladas' | 'todas';
  try {
    const r = await listarTomadas(pool, { de: s('de'), ate: s('ate'), situacao, q: s('q') });
    return res.status(200).json(r);
  } catch (e: any) {
    if (e?.code === '42P01') return res.status(200).json({ notas: [], totais: { qtd: 0, servico: 0, liquido: 0, titulos: 0 }, aviso: 'Rode a migration 098.' });
    console.error('Erro ao listar NFS-e tomadas:', e);
    return res.status(500).json({ erro: e?.message || 'Erro ao listar as notas tomadas' });
  }
}

/**
 * POST /api/externo/equivalentes (Authorization: Bearer <passe>)
 *   { grupos: string[], prvenda: string, arm?: number }
 * → { equivalentes: [{ codprod, ref, descr, marca, codgpe, disp, preco }] }
 * Produtos COM estoque nos grupos de equivalência pedidos (preço na tabela do cliente).
 * Sem internet o app usa o pacote do aparelho (lib/vendaExterna/fonteLocal.ts).
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { poolDaFilial } from '@/lib/estacaoDb';
import { passeDaRequisicao } from '@/lib/vendaExterna/token';
import { buscarEquivalentes } from '@/lib/vendaExterna/equivalentes';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  const passe = passeDaRequisicao(req);
  if (!passe) return res.status(401).json({ error: 'Sessão vencida. Entre de novo.' });

  const grupos = Array.isArray(req.body?.grupos) ? req.body.grupos.map(String) : [];
  const arm = Math.floor(Number(req.body?.arm)) || 1001;
  try {
    const equivalentes = await buscarEquivalentes(poolDaFilial(passe.f), grupos, {
      arm,
      prvenda: String(req.body?.prvenda ?? '0'),
    });
    return res.status(200).json({ equivalentes });
  } catch (e: any) {
    console.error('Erro em externo/equivalentes:', e);
    return res.status(500).json({ error: 'Falha ao buscar equivalentes.' });
  }
}

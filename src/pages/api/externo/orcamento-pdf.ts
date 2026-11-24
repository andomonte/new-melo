/**
 * POST /api/externo/orcamento-pdf (Authorization: Bearer <passe>)   { draft_id }
 * → { pdf_url, nome_arquivo }  — o mesmo PDF do orçamento da Nova Venda
 *   (/api/vendas/orcamento-pdf/gerar, chamado por dentro com a filial do passe).
 * Só gera PDF de orçamento feito pelo próprio vendedor.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { poolDaFilial } from '@/lib/estacaoDb';
import { passeDaRequisicao } from '@/lib/vendaExterna/token';
import { chamarRota } from '@/lib/vendaExterna/chamarRota';
import gerarPdf from '@/pages/api/vendas/orcamento-pdf/gerar';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  const passe = passeDaRequisicao(req);
  if (!passe) return res.status(401).json({ error: 'Sessão vencida. Entre de novo.' });

  const draftId = String(req.body?.draft_id || '').trim();
  if (!/^\d+$/.test(draftId)) return res.status(400).json({ error: 'Orçamento inválido.' });

  try {
    const dono = await poolDaFilial(passe.f).query(
      `SELECT 1 FROM venda_externa_pedido
        WHERE codvenda = $1 AND upper(login) = upper($2) AND payload->>'_tipo' = 'ORCAMENTO' LIMIT 1`,
      [draftId, passe.u],
    );
    if (dono.rowCount === 0) return res.status(404).json({ error: 'Orçamento não encontrado entre os seus.' });

    const r = await chamarRota(gerarPdf as any, { filial: passe.f, body: { draft_id: draftId } });
    if (!r.data?.pdf_url) return res.status(r.status >= 400 ? r.status : 500).json({ error: r.data?.error || 'Falha ao gerar o PDF.' });
    return res.status(200).json({ pdf_url: r.data.pdf_url, nome_arquivo: r.data.nome_arquivo || `orcamento_${draftId}` });
  } catch (e: any) {
    console.error('Erro em externo/orcamento-pdf:', e);
    return res.status(500).json({ error: 'Falha ao gerar o PDF.' });
  }
}

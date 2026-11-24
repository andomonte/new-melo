/**
 * POST /api/externo/enviar-orcamento (Authorization: Bearer <passe>)
 *   { uuid, numero_local, criado_em, payload }   payload = { header, itens, prazos } (regras.ts)
 *
 * Orçamento feito na Venda Externa (com ou sem internet). Grava pela MESMA rotina do
 * "Salvar Orçamento" da Nova Venda (/api/vendas/salvar-draft, chamada por dentro), então
 * aparece nos orçamentos do sistema e gera o mesmo PDF.
 *  - Não duplica: o uuid do aparelho é chave (venda_externa_pedido, payload._tipo = ORCAMENTO).
 *    Reenvio devolve o mesmo nº de orçamento.
 *  - Validade: tb_parametros.prazo_validade_orcamento da filial (7 dias desde a 083),
 *    contada a partir do envio.
 *  - Orçamento não reserva estoque nem passa pela análise de crédito.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { poolDaFilial } from '@/lib/estacaoDb';
import { passeDaRequisicao } from '@/lib/vendaExterna/token';
import { chamarRota } from '@/lib/vendaExterna/chamarRota';
import salvarDraft from '@/pages/api/vendas/salvar-draft';
import { aplicarVendedorOperador } from '@/lib/vendaExterna/vendedorOperador';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRAZO_PADRAO = 7;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  const passe = passeDaRequisicao(req);
  if (!passe) return res.status(401).json({ error: 'Sessão vencida. Entre de novo para enviar os orçamentos.' });

  const uuid = String(req.body?.uuid || '').trim();
  const payload = req.body?.payload;
  if (!UUID_RE.test(uuid)) return res.status(400).json({ error: 'Orçamento sem identificação válida.' });
  if (!payload?.header?.codcli || !Array.isArray(payload?.itens) || payload.itens.length === 0) {
    return res.status(400).json({ error: 'Orçamento incompleto (cliente ou itens).' });
  }

  const filial = passe.f;
  const pool = poolDaFilial(filial);

  payload._tipo = 'ORCAMENTO';
  payload.header.statusVenda = 'VENDA LIBERADA'; // igual ao "Salvar Orçamento" da Nova Venda
  payload.itens = payload.itens.map((i: any) => ({
    ...i,
    quantidade: i.qtd,
    precoItemEditado: i.prunit,
    total_item: Math.round((Number(i.qtd) || 0) * (Number(i.prunit) || 0) * 100) / 100,
  }));
  const total = payload.itens.reduce((a: number, i: any) => a + (Number(i.total_item) || 0), 0);

  try {
    // vendedor = do cliente; operador = dono do passe (regra da Nova Venda)
    await aplicarVendedorOperador(pool, payload, passe);
    payload.header.codvend = payload.header.vendedor; // nome do vendedor no PDF

    // 1) registra/trava pelo uuid
    const ins = await pool.query(
      `INSERT INTO venda_externa_pedido
         (uuid, login, codvend, numero_local, codcli, total, payload, status, criado_no_aparelho, tentativas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'PROCESSANDO',$8,1)
       ON CONFLICT (uuid) DO NOTHING
       RETURNING uuid`,
      [uuid, passe.u, passe.v, String(req.body?.numero_local || ''), String(payload.header.codcli), total,
        JSON.stringify(payload), req.body?.criado_em ? new Date(req.body.criado_em) : null],
    );
    let draftExistente: string | null = null;
    if (ins.rowCount === 0) {
      const ex = (await pool.query(`SELECT * FROM venda_externa_pedido WHERE uuid = $1`, [uuid])).rows[0];
      if (ex.login.toUpperCase() !== passe.u.toUpperCase()) {
        return res.status(403).json({ error: 'Este orçamento pertence a outro usuário.' });
      }
      if (ex.payload?._tipo !== 'ORCAMENTO') return res.status(409).json({ error: 'Identificação já usada por um pedido.' });
      const recente = Date.now() - new Date(ex.updated_at).getTime() < 2 * 60 * 1000;
      if (ex.status === 'PROCESSANDO' && recente) {
        return res.status(409).json({ error: 'Este orçamento já está sendo enviado. Aguarde.' });
      }
      // já enviado e o vendedor ajustou: atualiza o MESMO orçamento (mesmo nº)
      draftExistente = ex.codvenda || null;
      await pool.query(
        `UPDATE venda_externa_pedido SET status='PROCESSANDO', payload=$2, total=$3, codcli=$4,
                tentativas=tentativas+1, mensagem=NULL, updated_at=now() WHERE uuid=$1`,
        [uuid, JSON.stringify(payload), total, String(payload.header.codcli)],
      );
    }

    // 2) validade pelo parâmetro da filial
    const pr = await pool.query(`SELECT valor FROM tb_parametros WHERE chave = 'prazo_validade_orcamento' LIMIT 1`);
    const prazo = Number(pr.rows[0]?.valor) > 0 ? Number(pr.rows[0].valor) : PRAZO_PADRAO;
    const vence = new Date();
    vence.setDate(vence.getDate() + prazo);

    // 3) grava pela rota do "Salvar Orçamento" da Nova Venda
    const corpo = { ...payload, expires_at: vence.toISOString(), draft_id: draftExistente || undefined };
    if (draftExistente) corpo.header = { ...corpo.header, draft_id: draftExistente };
    const r = await chamarRota(salvarDraft as any, { filial, body: corpo });
    const draftId = r.data?.draft_id ? String(r.data.draft_id) : null;

    if (r.data?.ok && draftId) {
      const validade = vence.toLocaleDateString('pt-BR', { timeZone: 'America/Manaus' });
      const msg = `Orçamento nº ${draftId} — válido até ${validade}.`;
      await pool.query(
        `UPDATE venda_externa_pedido SET status='ENVIADO', mensagem=$2, codvenda=$3, nrovenda=$3, updated_at=now() WHERE uuid=$1`,
        [uuid, msg, draftId],
      );
      return res.status(200).json({ ok: true, draft_id: draftId, validade: vence.toISOString(), mensagem: msg });
    }

    const erro = String(r.data?.error || r.data?.message || 'Falha ao salvar o orçamento.');
    const negocio = r.status === 400;
    await pool.query(`UPDATE venda_externa_pedido SET status=$2, mensagem=$3, updated_at=now() WHERE uuid=$1`, [
      uuid,
      negocio ? 'PENDENCIA' : 'ERRO',
      erro,
    ]);
    if (negocio) return res.status(200).json({ ok: false, pendencia: true, mensagem: erro });
    return res.status(502).json({ ok: false, tentarDeNovo: true, error: erro });
  } catch (e: any) {
    console.error('Erro em externo/enviar-orcamento:', e);
    try {
      await pool.query(`UPDATE venda_externa_pedido SET status='ERRO', mensagem=$2, updated_at=now() WHERE uuid=$1`, [
        uuid,
        String(e?.message || e),
      ]);
    } catch {
      /* */
    }
    return res.status(500).json({ ok: false, tentarDeNovo: true, error: 'Falha ao enviar. O aparelho tenta de novo.' });
  }
}

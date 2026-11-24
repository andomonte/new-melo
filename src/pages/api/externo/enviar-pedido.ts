/**
 * POST /api/externo/enviar-pedido (Authorization: Bearer <passe>)
 *   { uuid, numero_local, criado_em, payload, liberaPreco }
 *   payload = mesmo corpo da Nova Venda para /api/vendas/postgresql/finalizarVenda.
 *
 * Envio de pedido da Venda Externa (feito com ou sem internet):
 *  - NUNCA duplica: o uuid do aparelho é chave (venda_externa_pedido). Reenvio de pedido
 *    já gravado devolve o resultado do primeiro envio.
 *  - Refaz as conferências como numa venda normal: crédito (validarCredito), preço da
 *    tabela ATUAL (abaixo dela vai bloqueada para análise, como na Nova Venda), estoque e
 *    impostos (dentro do finalizarVenda).
 *  - Resultado: ENVIADO (nº da venda) | PENDENCIA (motivo, o vendedor ajusta e reenvia) |
 *    ERRO (falha técnica, o aparelho tenta de novo).
 * Arquitetura: docs/VENDAS-EXTERNAS-OFFLINE.md
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import type { Pool } from 'pg';
import { poolDaFilial } from '@/lib/estacaoDb';
import { buscarEquivalentes } from '@/lib/vendaExterna/equivalentes';
import { aplicarVendedorOperador } from '@/lib/vendaExterna/vendedorOperador';
import { passeDaRequisicao } from '@/lib/vendaExterna/token';
import { chamarRota } from '@/lib/vendaExterna/chamarRota';
import finalizarVenda from '@/pages/api/vendas/postgresql/finalizarVenda';
import validarCredito from '@/pages/api/vendas/postgresql/validarCredito';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Um envio por vez neste servidor: o número da venda é MAX+1 no finalizarVenda, e vários
// aparelhos sincronizando juntos colidiriam. (Vendas do escritório não passam por aqui.)
let fila: Promise<unknown> = Promise.resolve();
function emSerie<T>(fn: () => Promise<T>): Promise<T> {
  const p = fila.then(fn, fn);
  fila = p.catch(() => undefined);
  return p;
}

/**
 * Itens do pedido sem estoque suficiente AGORA e, para cada um, quantos equivalentes têm
 * estoque. faltas = { codprod: disponível } (o aparelho atualiza o carrinho com isso e
 * mostra o botão "Ver equivalentes").
 */
async function analisarFaltas(pool: Pool, payload: any) {
  const itens: any[] = payload.itens || [];
  const arm = Number(itens[0]?.arm_id) || 1001;
  const cods = itens.map((i) => String(i.codprod));
  const r = await pool.query(
    `SELECT p.codprod, btrim(COALESCE(p.codgpe,'')) AS codgpe,
            COALESCE((SELECT SUM(COALESCE(arp_qtest,0) - COALESCE(arp_qtest_reservada,0))
                        FROM cad_armazem_produto
                       WHERE arp_arm_id = $2 AND arp_codprod = p.codprod AND COALESCE(arp_bloqueado,'N') <> 'S'), 0) AS disp
       FROM dbprod p WHERE p.codprod = ANY($1::text[])`,
    [cods, arm],
  );
  const info = new Map(r.rows.map((x: any) => [String(x.codprod).trim(), { codgpe: x.codgpe as string, disp: Number(x.disp) || 0 }]));
  const faltando = itens.filter((i) => (info.get(String(i.codprod))?.disp ?? 0) < Number(i.qtd || 0));
  const faltas: Record<string, number> = {};
  for (const i of faltando) faltas[String(i.codprod)] = Math.max(0, info.get(String(i.codprod))?.disp ?? 0);

  const cli = await pool.query(`SELECT COALESCE(NULLIF(btrim(prvenda::text),''),'0') AS tipo FROM dbclien WHERE codcli=$1`, [
    String(payload.header?.codcli || ''),
  ]);
  const grupos = faltando.map((i) => info.get(String(i.codprod))?.codgpe || '').filter(Boolean);
  const eqs = await buscarEquivalentes(pool, grupos, { arm, prvenda: cli.rows[0]?.tipo ?? '0' });
  const linhas = faltando.map((i) => {
    const inf = info.get(String(i.codprod));
    const n = eqs.filter((e) => e.codgpe === inf?.codgpe && e.codprod !== String(i.codprod)).length;
    const base = `${i.ref || i.codprod}: pediu ${i.qtd}, disponível ${Math.max(0, inf?.disp ?? 0)}`;
    return n > 0 ? `${base} — tem ${n} equivalente(s) com estoque` : base;
  });
  return { faltas, linhas };
}

const ehErroDeNegocio = (msg: string) =>
  /ESTOQUE INSUFICIENTE|obrigat|inv[aá]lid|n[aã]o encontrad|bloquead/i.test(msg);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  const passe = passeDaRequisicao(req);
  if (!passe) return res.status(401).json({ error: 'Sessão vencida. Entre de novo para enviar os pedidos.' });

  const uuid = String(req.body?.uuid || '').trim();
  const payload = req.body?.payload;
  if (!UUID_RE.test(uuid)) return res.status(400).json({ error: 'Pedido sem identificação válida.' });
  if (!payload?.header?.codcli || !Array.isArray(payload?.itens) || payload.itens.length === 0) {
    return res.status(400).json({ error: 'Pedido incompleto (cliente ou itens).' });
  }

  const filial = passe.f;
  const pool = poolDaFilial(filial);

  const total = payload.itens.reduce((a: number, i: any) => a + (Number(i.qtd) || 0) * (Number(i.prunit) || 0), 0);

  try {
    // vendedor = do cliente; operador = dono do passe (regra da Nova Venda)
    await aplicarVendedorOperador(pool, payload, passe);

    // 1) registra/trava o pedido pelo uuid
    const ins = await pool.query(
      `INSERT INTO venda_externa_pedido
         (uuid, login, codvend, numero_local, codcli, total, payload, status, criado_no_aparelho, tentativas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'PROCESSANDO',$8,1)
       ON CONFLICT (uuid) DO NOTHING
       RETURNING uuid`,
      [uuid, passe.u, passe.v, String(req.body?.numero_local || ''), String(payload.header.codcli), total,
        JSON.stringify(payload), req.body?.criado_em ? new Date(req.body.criado_em) : null],
    );
    if (ins.rowCount === 0) {
      const ex = (await pool.query(`SELECT * FROM venda_externa_pedido WHERE uuid = $1`, [uuid])).rows[0];
      if (ex.login.toUpperCase() !== passe.u.toUpperCase()) {
        return res.status(403).json({ error: 'Este pedido pertence a outro usuário.' });
      }
      if (ex.payload?._tipo === 'ORCAMENTO') {
        return res.status(409).json({ error: 'Identificação já usada por um orçamento.' });
      }
      if (ex.status === 'ENVIADO') {
        return res.status(200).json({ ok: true, repetido: true, codvenda: ex.codvenda, nrovenda: ex.nrovenda, mensagem: ex.mensagem });
      }
      const recente = Date.now() - new Date(ex.updated_at).getTime() < 2 * 60 * 1000;
      if (ex.status === 'PROCESSANDO' && recente) {
        return res.status(409).json({ error: 'Este pedido já está sendo enviado. Aguarde.' });
      }
      // PENDENCIA / ERRO / PROCESSANDO antigo: reprocessa com o conteúdo atual (vendedor ajustou)
      await pool.query(
        `UPDATE venda_externa_pedido SET status='PROCESSANDO', payload=$2, total=$3, codcli=$4,
                tentativas=tentativas+1, mensagem=NULL, updated_at=now() WHERE uuid=$1`,
        [uuid, JSON.stringify(payload), total, String(payload.header.codcli)],
      );
    }

    const marcar = (status: string, mensagem: string | null, extra: { codvenda?: string; nrovenda?: string } = {}) =>
      pool.query(
        `UPDATE venda_externa_pedido SET status=$2, mensagem=$3, codvenda=COALESCE($4,codvenda),
                nrovenda=COALESCE($5,nrovenda), updated_at=now() WHERE uuid=$1`,
        [uuid, status, mensagem, extra.codvenda || null, extra.nrovenda || null],
      );

    // 2) crédito do cliente AGORA (mesma regra da Nova Venda)
    const cred = await chamarRota(validarCredito as any, {
      filial,
      body: { codcli: payload.header.codcli, valorSolicitado: total, formaPagamento: payload.header.formaPagamento || '' },
    });
    if (cred.data?.passou === 'NOK') {
      const msg = cred.data?.mensagem || 'Cliente com restrição de crédito.';
      await marcar('PENDENCIA', msg);
      return res.status(200).json({ ok: false, pendencia: true, mensagem: msg });
    }

    // 3) preço: compara com a tabela ATUAL do cliente; abaixo dela vai bloqueada p/ análise
    if (!req.body?.liberaPreco && payload.header.bloqueada !== 'S') {
      const cli = await pool.query(`SELECT COALESCE(NULLIF(btrim(prvenda::text),''),'0') AS tipo FROM dbclien WHERE codcli=$1`, [
        String(payload.header.codcli),
      ]);
      const tipo = cli.rows[0]?.tipo ?? '0';
      const cods = payload.itens.map((i: any) => String(i.codprod));
      const pr = await pool.query(
        `SELECT "CODPROD" AS codprod, "PRECOVENDA" AS preco FROM dbformacaoprvenda
          WHERE "TIPOPRECO"::text = $1::text AND "CODPROD" = ANY($2::text[])`,
        [tipo, cods],
      );
      const tabela = new Map(pr.rows.map((r: any) => [String(r.codprod), Number(r.preco)]));
      const abaixo = payload.itens.some((i: any) => {
        const t = tabela.get(String(i.codprod)) || 0;
        return t > 0 && Number(i.prunit) < t - 0.01;
      });
      if (abaixo) payload.header.bloqueada = 'S';
    }

    // 4) grava pela rota da Nova Venda (estoque, impostos, número), um envio por vez
    const r = await emSerie(async () => {
      let tentativa = await chamarRota(finalizarVenda as any, { filial, body: payload });
      const msg = String(tentativa.data?.error || '');
      if (!tentativa.data?.ok && /duplicate key|23505/i.test(msg)) {
        tentativa = await chamarRota(finalizarVenda as any, { filial, body: payload }); // número colidiu
      }
      return tentativa;
    });

    if (r.data?.ok) {
      const msg = r.data.status === 'B' ? 'Enviada para análise (preço abaixo da tabela).' : 'Venda gravada.';
      await marcar('ENVIADO', msg, { codvenda: r.data.codvenda, nrovenda: r.data.nrovenda });
      return res.status(200).json({ ok: true, codvenda: r.data.codvenda, nrovenda: r.data.nrovenda, statusVenda: r.data.status, mensagem: msg });
    }

    const erro = String(r.data?.error || 'Falha ao gravar a venda.');
    if (ehErroDeNegocio(erro) || r.status === 400) {
      // falta de estoque: diz quais itens faltam e se há equivalente com estoque
      let faltas: Record<string, number> | undefined;
      let msg = erro;
      if (/ESTOQUE/i.test(erro)) {
        try {
          const f = await analisarFaltas(pool, payload);
          if (f.linhas.length) {
            faltas = f.faltas;
            msg = `${erro}\n${f.linhas.join('\n')}`;
          }
        } catch (e) {
          console.error('externo/enviar-pedido: análise de faltas', e);
        }
      }
      await marcar('PENDENCIA', msg);
      return res.status(200).json({ ok: false, pendencia: true, mensagem: msg, faltas });
    }
    await marcar('ERRO', erro);
    return res.status(502).json({ ok: false, tentarDeNovo: true, error: erro });
  } catch (e: any) {
    console.error('Erro em externo/enviar-pedido:', e);
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

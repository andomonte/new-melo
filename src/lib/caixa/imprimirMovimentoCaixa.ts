// src/lib/caixa/imprimirMovimentoCaixa.ts
//
// Comprovante de FECHAMENTO DE CAIXA (A4). Agrega o DIA INTEIRO da conta
// (não existe turno): soma recebimentos, sangrias e suprimentos de todas as
// sessões, usa o fundo da 1ª sessão como troco do dia e concilia o dinheiro na
// gaveta. Quando houve reabertura, lista as sessões do dia para transparência.
// O detalhado por título fica no Financeiro (Movimento Diário / Fluxo de Caixa).

const FORMA_LABEL: Record<string, string> = {
  DINHEIRO: 'Dinheiro', CREDITO: 'Cartão Crédito', DEBITO: 'Cartão Débito',
  PIX: 'PIX', CHEQUE: 'Cheque', OUTRO: 'Outro',
};
const rot = (f: string) => FORMA_LABEL[f] || f;
const brl = (n: number) => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const agora = () => new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export async function imprimirMovimentoCaixa(opts: { data: string; conta?: string; operadorLabel?: string; sessaoId?: string | number }) {
  const qm = new URLSearchParams();
  if (opts.data) qm.set('data', opts.data);
  if (opts.conta) qm.set('conta', opts.conta);
  if (opts.sessaoId) qm.set('sessao', String(opts.sessaoId));
  const rm = await fetch('/api/caixa/movimentos-caixa?' + qm.toString());
  const mov = await rm.json();
  if (!rm.ok || !mov.ok) throw new Error(mov.erro || 'Falha ao gerar o fechamento do caixa.');

  const se = mov.sessao_info;
  if (!se) throw new Error('Nenhuma sessão de caixa encontrada para gerar o fechamento.');

  const recebForma: { forma: string; valor: number }[] = mov.recebimentosPorForma || [];
  const totalReceb = recebForma.reduce((a, x) => a + x.valor, 0);

  const movRows = [
    ...mov.suprimentos.map((s: any) => ({ ...s, tipo: 'SUPRIMENTO' })),
    ...mov.sangrias.map((s: any) => ({ ...s, tipo: 'SANGRIA' })),
  ];
  const sessoes: any[] = mov.sessoesDoDia || [];
  const multiSessao = sessoes.length > 1;
  const caixaAberto = !!se.caixaAberto;

  const troco = Number(se.fundoInicial || 0);
  const supr = Number(mov.totalSuprimento || 0);
  const sang = Number(mov.totalSangria || 0);
  const din = Number(mov.recebidoDinheiro || 0);
  // Saldo do fechamento (todas as formas) = troco + entradas (recebido + suprimentos) − saídas (sangrias/vales)
  const saldoFechamento = Math.round((troco + totalReceb + supr - sang) * 100) / 100;

  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) throw new Error('Não foi possível abrir a janela (pop-up bloqueado pelo navegador).');

  const linha = (label: string, valor: string, forte = false) =>
    `<tr class="${forte ? 'forte' : ''}"><td>${label}</td><td class="num">${valor}</td></tr>`;

  // Data do dia por extenso (a partir do YYYY-MM-DD)
  const dataBR = /^\d{4}-\d{2}-\d{2}$/.test(se.data || opts.data || '')
    ? (se.data || opts.data).split('-').reverse().join('/') : (se.data || opts.data || '—');

  w.document.write(`<html><head><title>Fechamento de Caixa</title><style>
    @page { size: A4; margin: 14mm; }
    body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;max-width:720px;margin:0 auto}
    h1{font-size:16px;text-align:center;margin:0 0 2px}
    h2{font-size:12px;text-transform:uppercase;letter-spacing:.5px;margin:16px 0 6px;border-bottom:1px solid #999;padding-bottom:3px}
    .sub{text-align:center;color:#444;margin-bottom:10px}
    .hdr{display:flex;flex-wrap:wrap;gap:4px 24px;margin-bottom:8px}
    .hdr div{min-width:200px}
    table{border-collapse:collapse;width:100%}
    th,td{border:1px solid #bbb;padding:4px 8px}
    th{background:#1e40af;color:#fff;text-align:left}
    .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
    .forte{background:#eef2ff;font-weight:bold}
    .aviso{background:#fff7ed;border:1px solid #fdba74;color:#9a3412;padding:6px 10px;border-radius:4px;margin:8px 0;font-size:11px}
    .resumo{width:100%}
    /* blocos que não podem partir no meio ao imprimir */
    .bloco{break-inside:avoid;page-break-inside:avoid;margin-bottom:6px}
    .bloco h2{margin-top:10px}
    .cols{display:flex;flex-wrap:wrap;gap:0 24px;align-items:flex-start}
    .cols .bloco{flex:1 1 300px;min-width:300px}
    .ass{width:320px;margin:48px auto 0;text-align:center;border-top:1px solid #333;padding-top:4px;font-size:11px;break-inside:avoid}
    .foot{margin-top:16px;font-size:10px;color:#666;text-align:center}
    thead{display:table-header-group}
    tfoot{display:table-footer-group}
    tr{break-inside:avoid;page-break-inside:avoid}
  </style></head><body>
    <h1>FECHAMENTO DE CAIXA</h1>
    <div class="sub">MELO DISTRIBUIDORA DE PECAS LTDA.</div>
    <div class="hdr">
      <div><b>Operador:</b> ${opts.operadorLabel || se.operador || se.operadorFechamento || se.operadorAbertura || '—'}</div>
      <div><b>Caixa (conta):</b> ${se.codConta || opts.conta || '—'}</div>
      <div><b>Data:</b> ${dataBR}</div>
      <div><b>Fundo de caixa (troco):</b> ${brl(se.fundoInicial || 0)}</div>
      <div><b>Situação:</b> ${se.status || '—'}${multiSessao ? ` · ${se.qtdSessoes} aberturas` : ''}</div>
    </div>

    ${caixaAberto ? `<div class="aviso"><b>Atenção:</b> ainda há caixa <b>aberto</b> neste dia. O saldo informado e a diferença só são apurados quando todas as aberturas do dia estiverem fechadas.</div>` : ''}

    <div class="cols">
      <div class="bloco">
        <h2>Recebimentos por forma (vendas do dia)</h2>
        <table class="resumo">
          <thead><tr><th>Forma</th><th class="num">Valor recebido</th></tr></thead>
          <tbody>${recebForma.length ? recebForma.map((c) => `<tr><td>${rot(c.forma)}</td><td class="num">${brl(c.valor)}</td></tr>`).join('') : '<tr><td colspan="2">Sem recebimentos no dia.</td></tr>'}</tbody>
          <tfoot><tr class="forte"><td>Total recebido</td><td class="num">${brl(totalReceb)}</td></tr></tfoot>
        </table>
      </div>

      <div class="bloco">
        <h2>Resumo do fechamento (todas as formas)</h2>
        <table class="resumo"><tbody>
          ${linha('Saldo Abertura (fundo de troco)', brl(troco))}
          ${linha('(+) Total recebido (vendas do dia)', brl(totalReceb))}
          ${linha('(+) Suprimentos', brl(supr))}
          ${linha('(−) Sangrias / Vales', brl(sang))}
          ${linha('= Saldo do fechamento', brl(saldoFechamento), true)}
        </tbody></table>
      </div>
    </div>

    <div class="bloco">
      <h2>Conferência do dinheiro na gaveta</h2>
      <table class="resumo" style="max-width:420px"><tbody>
        ${linha('Saldo Abertura (fundo de troco)', brl(troco))}
        ${linha('(+) Recebido em dinheiro', brl(din))}
        ${linha('(+) Suprimentos', brl(supr))}
        ${linha('(−) Sangrias / Vales', brl(sang))}
        ${linha('= Esperado em dinheiro', brl(se.saldoEsperado || 0), true)}
        ${linha('Saldo Informado (contado)', se.saldoInformado == null ? '—' : brl(se.saldoInformado))}
        ${linha('Diferença (quebra)', se.quebra == null ? '—' : brl(se.quebra), true)}
      </tbody></table>
    </div>

    ${movRows.length ? `
    <h2>Sangrias / Vales e Suprimentos</h2>
    <table><thead><tr><th>Tipo</th><th>Hora</th><th>Forma</th><th>Motivo / Beneficiário</th><th class="num">Valor</th></tr></thead>
    <tbody>${movRows.map((m: any) => `<tr><td>${m.tipo}</td><td>${m.hora || ''}</td><td>${m.forma_pagamento || ''}</td><td>${m.motivo || '-'}</td><td class="num">${brl(m.valor)}</td></tr>`).join('')}</tbody>
    <tfoot><tr class="forte"><td colspan="4">Total sangrias / vales</td><td class="num">${brl(mov.totalSangria)}</td></tr></tfoot></table>` : ''}

    <div class="ass">Assinatura Operador</div>
    <div class="foot">Impresso em: ${agora()}</div>
  </body></html>`);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 400);
}

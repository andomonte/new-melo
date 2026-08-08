import React, { useState } from 'react';
import AutocompletePessoa from '@/components/common/AutoCompletePessoa';

/**
 * FaturamentoNotaV2 — LAYOUT (apresentacional) reconstruído de faturamento-compacto.html.
 * FASE DE LAYOUT: só apresentação. Markup plano estilizado pelo CSS escopado `.densidade-compacta`.
 *
 * Consome um `ctx` (valores + set + data + actions) fornecido pelo componente que detém a
 * LÓGICA (FaturamentoNota antigo) — assim reaproveita 100% do carregamento/salvamento testados,
 * sem duplicar regra/cálculo/API. Se `ctx` não vier, usa estado local (preview standalone).
 */

type Aba = 'dados' | 'cobranca' | 'produtos';

export type FatV2Ctx = {
  f: Record<string, any>;                         // valores dos campos (nomes = estado do antigo)
  set: (k: string, v: any) => void;               // setter genérico
  data?: {
    titulo?: string;
    itens?: any[];
    cliente?: any;
    resumo?: any;
    operacoes?: { value: string; label: string }[];
    bancos?: { value: string; label: string }[];
    tiposFatura?: { value: string; label: string }[];
    modalidades?: { value: string; label: string }[];
    parcelas?: { parcela: any; dias: any; vencimento: string; valor: string }[];
    totalParcelas?: string;
    mensagens?: { codigo: any; descricao: string }[];
    sugestoes?: { codigo: any; descricao: string }[];
  };
  actions?: {
    onClose?: () => void;
    emitir?: () => void;
    opcoes?: () => void;
    gerarParcelas?: () => void;
    atualizarVencimento?: (idx: number, isoDate: string) => void;
    removerParcela?: (idx: number) => void;
    addMensagem?: () => void;
    removerMensagem?: (codigo: any) => void;
    buscaMensagem?: (texto: string) => void;
    selecionarMensagem?: (codigo: any) => void;
  };
};

const n = (v: any) => Number(v ?? 0);
const money = (v: any) =>
  n(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function FaturamentoNotaV2({ ctx }: { ctx?: FatV2Ctx }) {
  const [aba, setAba] = useState<Aba>('dados');

  // Fallback local (preview) se não vier ctx
  const [local, setLocal] = useState<Record<string, any>>({
    tipodoc: 'N', cobranca: 'N', inscFat: '04', nfeAmbiente: '2', nfeFinalidade: '1', nfeFormaEmissao: '1',
    tipoMovimentacao: 'SAIDA', operacaoFiscal: 'VENDA', naturezaOperacao: '', cfop: '', origem: '',
    zerarIpi: false, zerarIcms: false, zerarSubstituicao: false, descontoSuframa: false, impostoAntecipado: false, mvaAntecipado: '',
    modalidadeTransporte: '', pedido: '', transportadora: '', vendedor: '',
    observacoes: '', infoComplementares: '', informarNoCorpoNF: false,
    descRadio: 'N', percDesconto: '', desconto: '0,00', acresRadio: 'N', percAcrescimo: '', acrescimo: '0,00',
    frete: '0', quantidade: '', especie: '', marca: '', numero: '', pesoBruto: '', pesoLiquido: '',
  });

  const f = ctx ? ctx.f : local;
  const set = ctx ? ctx.set : (k: string, v: any) => setLocal((p) => ({ ...p, [k]: v }));
  const data = ctx?.data ?? {};
  const act = ctx?.actions ?? {};
  const itens = data.itens ?? [];
  const resumo = data.resumo ?? {};
  const titulo = data.titulo ?? 'FATURA · VENDA · CLIENTE';
  // vencimento mínimo = amanhã (não permite data <= hoje)
  const minVenc = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const OPER = data.operacoes ?? [
    { value: 'VENDA', label: 'Venda' }, { value: 'TRANSFERENCIA', label: 'Transferência' },
    { value: 'DEVOLUCAO_COMPRA', label: 'Dev. de compras' },
  ];
  const BANCOS = data.bancos ?? [{ value: '', label: 'Selecione…' }];
  const TIPOS_FAT = data.tiposFatura ?? [{ value: 'BOLETO', label: 'Boleto' }];
  const MODAIS = data.modalidades ?? [{ value: '', label: 'Selecione…' }];
  const PARCELAS = data.parcelas ?? [];
  const MENSAGENS = data.mensagens ?? [];
  const SUGESTOES = data.sugestoes ?? [];

  // Totalizador por CFOP
  const porCfop = new Map<string, any>();
  for (const it of itens) {
    const c = String(it.cfop ?? '—');
    const g = porCfop.get(c) ?? { itens: 0, prod: 0, icms: 0, st: 0, ipi: 0 };
    g.itens++; g.prod += n(it.totalproduto) || n(it.qtd) * n(it.prunit);
    g.icms += n(it.totalicms); g.st += n(it.totalsubst_trib); g.ipi += n(it.totalipi);
    porCfop.set(c, g);
  }
  const grupos = [...porCfop.entries()];
  const totCfop = grupos.reduce((s, [, g]) => ({
    prod: s.prod + g.prod, icms: s.icms + g.icms, st: s.st + g.st, ipi: s.ipi + g.ipi,
  }), { prod: 0, icms: 0, st: 0, ipi: 0 });

  const TAB = (id: Aba, label: string) => (
    <button type="button" role="tab" aria-selected={aba === id} className="fat-tab" onClick={() => setAba(id)}>{label}</button>
  );
  const chk = (k: string, label: string, cls = 'fat-c2') => (
    <label className={`fat-ck ${cls}`}><input type="checkbox" checked={!!f[k]} onChange={(e) => set(k, e.target.checked)} /> {label}</label>
  );

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
      <div className="densidade-compacta bg-white dark:bg-zinc-900 w-full h-full flex flex-col overflow-hidden text-gray-800 dark:text-gray-100">

        {/* CABEÇALHO */}
        <div className="flex-shrink-0 flex items-center gap-3 px-3 border-b border-gray-200 dark:border-zinc-800 bg-gray-100 dark:bg-zinc-800" style={{ height: 34 }}>
          <span className="text-[12px] font-semibold text-blue-600 dark:text-blue-300 whitespace-nowrap">{titulo}</span>
          <div className="fat-tabs ml-1">{TAB('dados', 'Dados da fatura')}{TAB('cobranca', 'Cobrança e valores')}{TAB('produtos', 'Produtos')}</div>
          <div className="ml-auto flex items-center gap-1.5">
            <button type="button" className="h-[22px] px-2.5 text-[11px] rounded border border-gray-300 dark:border-zinc-600" onClick={act.opcoes}>⚙️ Opções</button>
            <button type="button" className="h-[22px] px-2.5 text-[11px] rounded bg-green-600 text-white font-semibold" onClick={act.emitir}>Emitir e salvar</button>
            <button type="button" className="h-[22px] w-[22px] rounded border border-gray-300 dark:border-zinc-600" onClick={act.onClose}>✕</button>
          </div>
        </div>

        {/* CONTEÚDO */}
        <div className="flex-1 overflow-auto" style={{ padding: '10px 12px' }}>

          {aba === 'dados' && (
            <>
              <div className="fat-sec"><div className="fat-sec-header"><span>Faturamento e status</span></div>
                <div className="fat-g">
                  <div className="fat-c3"><label>Tipo documentação</label>
                    <select value={f.tipodoc} onChange={(e) => set('tipodoc', e.target.value)} disabled>
                      <option value="N">Nota fiscal</option><option value="F">FAG</option></select></div>
                  <div className="fat-c2"><label>Gerar cobrança</label>
                    <select value={f.cobranca} onChange={(e) => set('cobranca', e.target.value)}>
                      <option value="S">Sim</option><option value="N">Não</option></select></div>
                  <div className="fat-c3"><label>Insc. estadual (AM)</label>
                    <select value={f.inscFat} onChange={(e) => set('inscFat', e.target.value)}>
                      <option value="04">Inscrição estadual 04</option><option value="07">Inscrição estadual 07</option></select></div>
                  <div className="fat-c2"><label>NF-e · ambiente</label>
                    <select value={f.nfeAmbiente} onChange={(e) => set('nfeAmbiente', e.target.value)}>
                      <option value="2">2 · Homologação</option><option value="1">1 · Produção</option></select></div>
                  <div className="fat-c2"><label>NF-e · finalidade</label>
                    <select value={f.nfeFinalidade} onChange={(e) => set('nfeFinalidade', e.target.value)}>
                      <option value="1">1 · Normal</option><option value="2">2 · Complementar</option>
                      <option value="3">3 · Ajuste</option><option value="4">4 · Devolução</option></select></div>
                </div>
              </div>

              <div className="fat-sec"><div className="fat-sec-header"><span>Operação fiscal</span></div>
                <div className="fat-g">
                  <div className="fat-c2"><label>Tipo de movimentação</label>
                    <select value={f.tipoMovimentacao} onChange={(e) => set('tipoMovimentacao', e.target.value)}>
                      <option value="SAIDA">Saída</option><option value="ENTRADA">Entrada</option></select></div>
                  <div className="fat-c2"><label>Operação ({f.tipoMovimentacao === 'ENTRADA' ? 'entrada' : 'saída'})</label>
                    <select value={f.operacaoFiscal} onChange={(e) => set('operacaoFiscal', e.target.value)}>
                      {OPER.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
                  <div className="fat-c3"><label>Natureza da operação</label>
                    <input type="text" value={f.naturezaOperacao ?? ''} onChange={(e) => set('naturezaOperacao', e.target.value)} /></div>
                  <div className="fat-c2"><label>CFOP</label>
                    <input type="text" placeholder="calculado" value={f.cfop ?? ''} onChange={(e) => set('cfop', e.target.value)} /></div>
                  <div className="fat-c1"><label>Origem</label>
                    <input type="text" value={f.origem ?? ''} onChange={(e) => set('origem', e.target.value)} /></div>
                  <div className="fat-c2"><label>NF-e · forma de emissão</label>
                    <select value={f.nfeFormaEmissao} onChange={(e) => set('nfeFormaEmissao', e.target.value)}>
                      <option value="1">1 · Normal</option><option value="2">2 · Contingência FS-IA</option>
                      <option value="9">9 · Off-line (NFC-e)</option></select></div>
                </div>
              </div>

              <div className="fat-sec"><div className="fat-sec-header"><span>Ajustes de imposto</span></div>
                <div className="fat-g">
                  {chk('zerarIpi', 'Zerar IPI')}{chk('zerarIcms', 'Zerar ICMS')}{chk('zerarSubstituicao', 'Zerar substituição')}
                  {chk('descontoSuframa', 'Desconto ICMS Suframa')}{chk('impostoAntecipado', 'Imposto antecipado')}
                  <div className="fat-c2"><label>MVA antecipado (%)</label>
                    <input type="text" value={f.mvaAntecipado ?? ''} onChange={(e) => set('mvaAntecipado', e.target.value)} /></div>
                </div>
                <div className="fat-dica">Recalcula o imposto por item. Aplica-se à operação Venda; demais operações mantêm o cálculo da venda.</div>
              </div>

              <div className="fat-sec"><div className="fat-sec-header"><span>Transporte e identificação</span></div>
                <div className="fat-g">
                  <div className="fat-c3"><label>Modalidade de transporte</label>
                    <select value={f.modalidadeTransporte} onChange={(e) => set('modalidadeTransporte', e.target.value)}>
                      {MODAIS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
                  <div className="fat-c2"><label>Pedido</label><input type="text" value={f.pedido ?? ''} onChange={(e) => set('pedido', e.target.value)} /></div>
                  <div className="fat-c3"><AutocompletePessoa label="Transportadora" tipo="transportadora" value={f.transportadora ?? ''} onChange={(cod) => set('transportadora', cod)} /></div>
                  <div className="fat-c4"><label>Vendedor</label><input type="text" value={f.vendedor ?? ''} onChange={(e) => set('vendedor', e.target.value)} /></div>
                </div>
              </div>

              <div className="fat-sec"><div className="fat-sec-header"><span>Textos da NF</span></div>
                <div className="fat-g">
                  <div className="fat-c4"><label>Observações</label>
                    <textarea value={f.observacoes ?? ''} onChange={(e) => set('observacoes', e.target.value)} /></div>
                  <div className="fat-c5"><label>Informações complementares</label>
                    <textarea placeholder="Informações complementares da NF…" value={f.infoComplementares ?? ''} onChange={(e) => set('infoComplementares', e.target.value)} /></div>
                  <div className="fat-c3" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                    <label className="fat-ck"><input type="checkbox" checked={!!f.informarNoCorpoNF} onChange={(e) => set('informarNoCorpoNF', e.target.checked)} /> Informar no corpo da NF</label></div>
                </div>
              </div>

              <div className="fat-sec"><div className="fat-sec-header"><span>Mensagens NF</span></div>
                <div className="fat-g">
                  <div className="fat-c10"><input type="text" placeholder="Digite o código ou parte do texto da mensagem…"
                    value={f.textoBuscaMensagem ?? ''} onChange={(e) => { set('textoBuscaMensagem', e.target.value); act.buscaMensagem?.(e.target.value); }} /></div>
                  <div className="fat-c2" style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button type="button" className="w-full h-[26px] text-[12px] rounded bg-blue-600 text-white" onClick={act.addMensagem}>+ Adicionar</button></div>
                </div>
                {SUGESTOES.length > 0 && (
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, marginTop: 2, maxHeight: 180, overflowY: 'auto', background: 'var(--fat-field)', border: '1px solid var(--fat-border-soft)', borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,.18)' }}>
                      {SUGESTOES.map((m) => (
                        <div key={String(m.codigo)} onMouseDown={(e) => { e.preventDefault(); act.selecionarMensagem?.(m.codigo); }}
                          style={{ padding: '4px 8px', fontSize: 11, cursor: 'pointer', borderBottom: '1px solid var(--fat-border-soft)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(52,122,182,.12)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                          <b>{m.codigo}</b> {m.descricao}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {MENSAGENS.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                    {MENSAGENS.map((m) => (
                      <span key={String(m.codigo)} style={{ border: '1px solid var(--fat-border-soft)', borderRadius: 3, padding: '2px 6px', fontSize: 11 }}>
                        <b>{m.codigo}</b> {m.descricao}{' '}
                        <i style={{ color: '#ef4444', cursor: 'pointer', fontStyle: 'normal' }} onClick={() => act.removerMensagem?.(m.codigo)}>✕</i>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {aba === 'cobranca' && (
            <>
              <div className="fat-sec"><div className="fat-sec-header"><span>Cobrança</span></div>
                <div className="fat-g">
                  <div className="fat-c3"><label>Banco</label>
                    <select value={f.banco ?? ''} onChange={(e) => set('banco', e.target.value)}>
                      {BANCOS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
                  <div className="fat-c3"><label>Tipo de fatura/documento</label>
                    <select value={f.tipoFatura ?? 'BOLETO'} onChange={(e) => set('tipoFatura', e.target.value)}>
                      {TIPOS_FAT.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
                  <div className="fat-c2"><label>Intervalo de dias</label>
                    <input type="text" inputMode="numeric" placeholder="Ex: 30" value={f.intervaloDias ?? ''} onChange={(e) => set('intervaloDias', e.target.value.replace(/\D/g, ''))} /></div>
                  <div className="fat-c2"><label>Quantidade (vezes)</label>
                    <input type="text" inputMode="numeric" placeholder="Ex: 3" value={f.qtdParcelas ?? ''} onChange={(e) => set('qtdParcelas', e.target.value.replace(/\D/g, ''))} /></div>
                  <div className="fat-c2" style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button type="button" className="w-full h-[26px] text-[12px] rounded bg-blue-600 text-white" onClick={act.gerarParcelas}>+ Gerar parcelas</button></div>
                  {chk('habilitarValor', 'Habilitar valor de entrada', 'fat-c3')}
                  {chk('impostoNa1Parcela', 'Cobrar impostos na 1ª parcela', 'fat-c3')}
                  {chk('freteNa1Parcela', 'Cobrar frete na 1ª parcela', 'fat-c3')}
                  {chk('diferenciada', 'Comissão diferenciada', 'fat-c3')}
                </div>
                <div className="fat-sub">Parcelas</div>
                <div className="fat-tbl-wrap"><table className="fat-tbl">
                  <thead><tr><th className="l">Parcela</th><th>Dias</th><th className="l">Vencimento</th><th>Valor</th><th style={{ width: 28 }}></th></tr></thead>
                  <tbody>
                    {PARCELAS.map((p: any, i: number) => (
                      <tr key={i}>
                        <td className="l">{p.parcela}</td>
                        <td className="n">{p.dias}</td>
                        <td className="l">
                          <input type="date" value={p.vencimento} min={minVenc} style={{ height: 20, width: 130 }}
                            onChange={(e) => act.atualizarVencimento?.(p.idx ?? i, e.target.value)} />
                        </td>
                        <td className="n">{p.valor}</td>
                        <td className="n"><i style={{ color: '#ef4444', cursor: 'pointer', fontStyle: 'normal' }}
                          onClick={() => act.removerParcela?.(p.idx ?? i)}>✕</i></td>
                      </tr>
                    ))}
                    {!PARCELAS.length && <tr><td className="l" colSpan={5}>Sem parcelas. Informe intervalo + quantidade e clique em “Gerar parcelas”.</td></tr>}
                  </tbody>
                  <tfoot><tr><td className="l">Total</td><td></td><td></td><td className="n">{data.totalParcelas ?? '0,00'}</td><td></td></tr></tfoot>
                </table></div>
              </div>

              <div className="fat-sec"><div className="fat-sec-header"><span>Valores e ajustes</span></div>
                <div className="fat-g">
                  <div className="fat-c2"><label>Desconto</label>
                    <div className="fat-rd">
                      <label><input type="radio" name="d" checked={(f.descRadio ?? 'N') === 'N'} onChange={() => set('descRadio', 'N')} /> Não</label>
                      <label><input type="radio" name="d" checked={f.descRadio === 'S'} onChange={() => set('descRadio', 'S')} /> Sim</label></div></div>
                  <div className="fat-c2"><label>Desconto %</label><input type="text" value={f.percDesconto ?? ''} onChange={(e) => set('percDesconto', e.target.value)} /></div>
                  <div className="fat-c2"><label>Desconto R$</label><input type="text" value={typeof f.desconto === 'number' ? money(f.desconto) : (f.desconto ?? '0,00')} readOnly /></div>
                  <div className="fat-c2"><label>Acréscimo</label>
                    <div className="fat-rd">
                      <label><input type="radio" name="a" checked={(f.acresRadio ?? 'N') === 'N'} onChange={() => set('acresRadio', 'N')} /> Não</label>
                      <label><input type="radio" name="a" checked={f.acresRadio === 'S'} onChange={() => set('acresRadio', 'S')} /> Sim</label></div></div>
                  <div className="fat-c2"><label>Acréscimo %</label><input type="text" value={f.percAcrescimo ?? ''} onChange={(e) => set('percAcrescimo', e.target.value)} /></div>
                  <div className="fat-c2"><label>Acréscimo R$</label><input type="text" value={typeof f.acrescimo === 'number' ? money(f.acrescimo) : (f.acrescimo ?? '0,00')} readOnly /></div>
                </div>
              </div>

              <div className="fat-sec"><div className="fat-sec-header"><span>Volumes e frete</span></div>
                <div className="fat-g">
                  <div className="fat-c2"><label>Valor do frete</label><input type="text" value={f.frete ?? '0'} onChange={(e) => set('frete', e.target.value)} /></div>
                  <div className="fat-c2"><label>Quantidade</label><input type="text" value={f.quantidade ?? ''} onChange={(e) => set('quantidade', e.target.value)} /></div>
                  <div className="fat-c2"><label>Espécie</label><input type="text" value={f.especie ?? ''} onChange={(e) => set('especie', e.target.value)} /></div>
                  <div className="fat-c2"><label>Marca</label><input type="text" value={f.marca ?? ''} onChange={(e) => set('marca', e.target.value)} /></div>
                  <div className="fat-c2"><label>Número</label><input type="text" value={f.numero ?? ''} onChange={(e) => set('numero', e.target.value)} /></div>
                  <div className="fat-c1"><label>Peso bruto</label><input type="text" value={f.pesoBruto ?? ''} onChange={(e) => set('pesoBruto', e.target.value)} /></div>
                  <div className="fat-c1"><label>Peso líq.</label><input type="text" value={f.pesoLiquido ?? ''} onChange={(e) => set('pesoLiquido', e.target.value)} /></div>
                </div>
              </div>
            </>
          )}

          {aba === 'produtos' && (
            <div className="fat-sec"><div className="fat-sec-header"><span>Produtos ({itens.length})</span></div>
              <div className="fat-tbl-wrap"><table className="fat-tbl">
                <thead><tr>
                  <th className="l">Código</th><th className="l">Descrição</th><th>Qtde</th><th>Unitário</th><th>CFOP</th>
                  <th>Base ICMS</th><th>Alíq</th><th>ICMS</th><th>Base ST</th><th>MVA</th><th>ST</th>
                  <th>Base IPI</th><th>Alíq</th><th>IPI</th><th>Total</th></tr></thead>
                <tbody>
                  {itens.map((it: any, i: number) => (
                    <tr key={i}>
                      <td className="l n">{it.codprod}</td><td className="l">{it.descr}</td>
                      <td className="n">{n(it.qtd ?? it.qtde)}</td><td className="n">{money(it.prunit)}</td><td className="n">{it.cfop}</td>
                      <td className="n">{money(it.baseicms)}</td><td className="n">{n(it.aliquota_icms ?? it.icms)}%</td><td className="n">{money(it.totalicms)}</td>
                      <td className="n">{money(it.basesubst_trib)}</td><td className="n">{n(it.mva)}</td><td className="n">{money(it.totalsubst_trib)}</td>
                      <td className="n">{money(it.baseipi)}</td><td className="n">{n(it.aliquota_ipi ?? it.ipi)}%</td><td className="n">{money(it.totalipi)}</td>
                      <td className="n">{money(n(it.totalproduto) || n(it.qtd ?? it.qtde) * n(it.prunit))}</td>
                    </tr>
                  ))}
                  {!itens.length && <tr><td className="l" colSpan={15}>Nenhum item para exibir.</td></tr>}
                </tbody>
              </table></div>
              <div className="fat-sub">Totalizador por CFOP</div>
              <div className="fat-tbl-wrap"><table className="fat-tbl">
                <thead><tr><th className="l">CFOP</th><th>Itens</th><th>Produtos</th><th>ICMS</th><th>ST</th><th>IPI</th></tr></thead>
                <tbody>{grupos.map(([c, g]) => (
                  <tr key={c}><td className="l n">{c}</td><td className="n">{g.itens}</td><td className="n">{money(g.prod)}</td>
                    <td className="n">{money(g.icms)}</td><td className="n">{money(g.st)}</td><td className="n">{money(g.ipi)}</td></tr>))}</tbody>
                <tfoot><tr><td className="l">Total</td><td className="n">{itens.length}</td><td className="n">{money(totCfop.prod)}</td>
                  <td className="n">{money(totCfop.icms)}</td><td className="n">{money(totCfop.st)}</td><td className="n">{money(totCfop.ipi)}</td></tr></tfoot>
              </table></div>
            </div>
          )}
        </div>

        {/* RODAPÉ / RESUMO */}
        <div className="flex-shrink-0 border-t border-gray-200 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800">
          <div className="fat-rodape">
            <div className="fat-rodape-t">Resumo financeiro</div>
            <div className="fat-rz">
              <div className="fat-rb"><h4 style={{ color: '#22d3ee' }}>IBS <span className="fat-prov">provisório</span></h4>
                <div className="fat-rl"><span>Alíquota</span><b>{n(resumo.ibs_aliq ?? 0.1).toFixed(2)}%</b></div>
                <div className="fat-rl"><span>Municipal / Estadual</span><b style={{ color: '#22d3ee' }}>{money(resumo.ibs_mun ?? 0)} / {money(resumo.ibs_est ?? 0)}</b></div>
                <div className="fat-rl"><span>Valor</span><b style={{ color: '#22d3ee' }}>R$ {money(resumo.ibs_valor)}</b></div></div>
              <div className="fat-rb"><h4 style={{ color: '#a78bfa' }}>CBS <span className="fat-prov">provisório</span></h4>
                <div className="fat-rl"><span>Alíquota</span><b>{n(resumo.cbs_aliq ?? 0.9).toFixed(2)}%</b></div>
                <div className="fat-rl"><span>Valor</span><b style={{ color: '#a78bfa' }}>R$ {money(resumo.cbs_valor)}</b></div></div>
              <div className="fat-rb"><h4 style={{ color: '#f59e0b' }}>ICMS</h4>
                <div className="fat-rl"><span>Alíquota</span><b>{n(resumo.icms_aliq).toFixed(2)}%</b></div>
                <div className="fat-rl"><span>Base</span><b>R$ {money(resumo.icms_base)}</b></div>
                <div className="fat-rl"><span>Valor</span><b style={{ color: '#f59e0b' }}>R$ {money(resumo.icms_valor)}</b></div></div>
              <div className="fat-rb"><h4 style={{ color: '#ef4444' }}>IPI / ST</h4>
                <div className="fat-rl"><span>IPI</span><b>R$ {money(resumo.ipi_valor)}</b></div>
                <div className="fat-rl"><span>Substituição</span><b>R$ {money(resumo.st_valor)}</b></div></div>
              <div className="fat-rb"><h4 style={{ color: '#16a34a' }}>Frete / produtos</h4>
                <div className="fat-rl"><span>Frete</span><b style={{ color: '#16a34a' }}>R$ {money(resumo.frete)}</b></div>
                <div className="fat-rl"><span>Produtos</span><b style={{ color: '#16a34a' }}>R$ {money(resumo.produtos)}</b></div></div>
              <div className="fat-total"><span>Valor total da NF</span><strong>R$ {money(resumo.totalNf)}</strong></div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

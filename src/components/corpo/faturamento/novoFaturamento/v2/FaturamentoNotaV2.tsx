import React, { useState } from 'react';
import AutocompletePessoa from '@/components/common/AutoCompletePessoa';
import { calcularTotaisFatura } from '@/lib/faturamento/calcularTotaisFatura';

/**
 * FaturamentoNotaV2 — LAYOUT (apresentacional) em 4 abas:
 *   Natureza da Nota · Dados da Fatura · Produtos · Cobrança e valores
 *
 * Consome um `ctx` (valores + set + data + actions) fornecido pelo componente que detém a
 * LÓGICA (FaturamentoNota) — reaproveita 100% do carregamento/salvamento testados, sem
 * duplicar regra/cálculo/API. Se `ctx` não vier, usa estado local (preview standalone).
 */

type Aba = 'natureza' | 'dados' | 'produtos' | 'cobranca';

export type FatV2Ctx = {
  f: Record<string, any>;                         // valores dos campos (nomes = estado do antigo)
  set: (k: string, v: any) => void;               // setter genérico
  data?: {
    titulo?: string;
    // Preenchido no modo AGRUPAMENTO (gerar cobrança de N faturas do mesmo cliente).
    agrupamento?: {
      clienteNome: string;
      clienteCod: string;
      documentos: { codfat: string; nf: string; valor: number }[];
      total: number;
    };
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
    recalculandoImposto?: boolean;
  };
  actions?: {
    onClose?: () => void;
    emitir?: () => void;
    opcoes?: () => void;
    gerarParcelas?: () => void;
    atualizarVencimento?: (idx: number, isoDate: string) => void;
    atualizarDias?: (idx: number, dias: string) => void;
    removerParcela?: (idx: number) => void;
    addMensagem?: () => void;
    removerMensagem?: (codigo: any) => void;
    buscaMensagem?: (texto: string) => void;
    selecionarMensagem?: (codigo: any) => void;
    salvarComissao?: () => void;
    recalcularImpostos?: () => void;
  };
};

const n = (v: any) => Number(v ?? 0);
const money = (v: any) =>
  n(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const txt = (v: any) => (v === undefined || v === null || v === '' ? '—' : String(v));

export default function FaturamentoNotaV2({ ctx }: { ctx?: FatV2Ctx }) {
  const [aba, setAba] = useState<Aba>('natureza');

  // Fallback local (preview) se não vier ctx
  const [local, setLocal] = useState<Record<string, any>>({
    tipodoc: 'N', cobranca: 'N', inscFat: '04', nfeAmbiente: '2', nfeFinalidade: '1', nfeFormaEmissao: '1',
    tipoMovimentacao: 'SAIDA', operacaoFiscal: 'VENDA', naturezaOperacao: '', cfop: '', origem: '',
    zerarIpi: false, zerarIcms: false, zerarSubstituicao: false, descontoSuframa: false, impostoAntecipado: false, mvaAntecipado: '',
    modalidadeTransporte: '', pedido: '', transportadora: '', vendedor: '',
    observacoes: '', infoComplementares: '', informarNoCorpoNF: false,
    descRadio: 'N', percDesconto: '', desconto: '0,00', acresRadio: 'N', percAcrescimo: '', acrescimo: '0,00',
    frete: '0', quantidade: '', especie: '', marca: '', numero: '', pesoBruto: '', pesoLiquido: '',
    comissaoExterno: '', comissaoInterno: '', diferenciada: false,
  });

  const f = ctx ? ctx.f : local;
  const set = ctx ? ctx.set : (k: string, v: any) => setLocal((p) => ({ ...p, [k]: v }));
  const data = ctx?.data ?? {};
  const act = ctx?.actions ?? {};
  const itens = data.itens ?? [];
  const resumo = data.resumo ?? {};
  const titulo = data.titulo ?? 'FATURA · VENDA · CLIENTE';
  const agr = data.agrupamento; // preenchido só no modo agrupamento
  const cli: any = data.cliente ?? {};

  // Natureza da operação (cabeçalho) = derivada da OPERAÇÃO (tipo_operacao),
  // NÃO do CFOP dos itens (o CFOP fica POR ITEM). Em "Escolher Outros" o usuário
  // informa o CFOP e a natureza manualmente (CFOP/Natureza só aparecem nesse caso).
  const isOperacaoOutros =
    String(f.operacaoFiscal ?? '').toUpperCase() === 'OUTROS';
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

  // Espelho dos valores da fatura — porte de FATURAMENTOS.CALCULAR_TOTAIS (rateio de frete
  // na base de ICMS + desconto/acréscimo %). IBS/CBS (Reforma) ficam numa faixa extra.
  // % digitado pode vir com vírgula (pt-BR); frete já é ponto-decimal ("200.00").
  const pct = (v: any) => (typeof v === 'number' ? v : Number(String(v ?? '0').replace(',', '.')) || 0);
  const esp = calcularTotaisFatura(itens as any, {
    descontoPerc: f.descRadio === 'S' ? pct(f.percDesconto) : 0,
    acrescimoPerc: f.acresRadio === 'S' ? pct(f.percAcrescimo) : 0,
    totalfrete: Number(f.frete) || 0,
    freteNf: true,
    descontoNf: true,
    acrescimoNf: true,
  });

  const TAB = (id: Aba, label: string) => (
    <button type="button" role="tab" aria-selected={aba === id} className="fat-tab"
      onClick={() => { setAba(id); if (id === 'produtos') act.recalcularImpostos?.(); }}>{label}</button>
  );
  const chk = (k: string, label: string, cls = 'fat-c2') => (
    <label className={`fat-ck ${cls}`}><input type="checkbox" checked={!!f[k]} onChange={(e) => set(k, e.target.checked)} /> {label}</label>
  );
  const two = { display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 10 } as React.CSSProperties;
  // Tile do espelho de valores (label pequeno + valor)
  const rzt = (label: string, val: number, color: string = '#dc2626', big?: boolean) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
      <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fat-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      <b style={{ fontVariantNumeric: 'tabular-nums', color: color || 'inherit', fontSize: big ? 16 : 12, fontWeight: big ? 800 : 600 }}>R$ {money(val)}</b>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
      <div className="densidade-compacta fat-v2 bg-white dark:bg-zinc-900 w-full h-full flex flex-col overflow-hidden text-gray-800 dark:text-gray-100">

        {/* CABEÇALHO */}
        <div className="flex-shrink-0 flex items-center gap-3 px-3 border-b border-gray-200 dark:border-zinc-800 bg-gray-100 dark:bg-zinc-800" style={{ minHeight: 34 }}>
          {agr ? (
            <span className="flex items-baseline gap-2 whitespace-nowrap overflow-hidden">
              <span className="text-[15px] font-extrabold text-red-600 dark:text-red-400">
                {agr.clienteNome}{agr.clienteCod ? ` (${agr.clienteCod})` : ''}
              </span>
              <span className="text-[11px] text-gray-600 dark:text-gray-300 truncate">
                · Documentos: <b>{agr.documentos.map((d) => d.nf).join(', ')}</b>
              </span>
            </span>
          ) : (
            <span className="text-[12px] font-semibold text-blue-600 dark:text-blue-300 whitespace-nowrap">{titulo}</span>
          )}
          <div className="fat-tabs ml-1">{TAB('natureza', 'Natureza da Nota')}{TAB('dados', 'Dados da Fatura')}{TAB('produtos', 'Produtos')}{TAB('cobranca', 'Cobrança e valores')}</div>
          <div className="ml-auto flex items-center gap-1.5">
            <button type="button" className="h-[22px] px-2.5 text-[11px] rounded border border-gray-300 dark:border-zinc-600" onClick={act.opcoes}>⚙️ Opções</button>
            <button type="button" className="h-[22px] px-2.5 text-[11px] rounded bg-green-600 text-white font-semibold" onClick={act.emitir}>Emitir e salvar</button>
            <button type="button" className="h-[22px] w-[22px] rounded border border-gray-300 dark:border-zinc-600" onClick={act.onClose}>✕</button>
          </div>
        </div>

        {/* CONTEÚDO */}
        <div className="flex-1 overflow-auto" style={{ padding: '10px 12px' }}>

          {/* ===================== NATUREZA DA NOTA ===================== */}
          {aba === 'natureza' && (
            <>
              <div className="fat-sec"><div className="fat-sec-header"><span>Faturamento e status</span></div>
                <div className="fat-g">
                  <div className="fat-c3"><label>Tipo documentação</label>
                    <select value={f.tipodoc} onChange={(e) => set('tipodoc', e.target.value)} disabled>
                      <option value="N">Nota fiscal</option><option value="F">FAG</option></select></div>
                  <div className="fat-c3"><label>Insc. estadual (AM)</label>
                    <input type="text" readOnly title="Definida pela venda/empresa"
                      value={f.inscEstadualNumero || (f.inscFat === '07' ? 'Inscrição estadual 07' : 'Inscrição estadual 04')} /></div>
                  <div className="fat-c3"><label>Tipo de movimentação</label>
                    <select value={f.tipoMovimentacao} onChange={(e) => set('tipoMovimentacao', e.target.value)}>
                      <option value="SAIDA">Saída</option><option value="ENTRADA">Entrada</option></select></div>
                  <div className="fat-c3"><label>Operação ({f.tipoMovimentacao === 'ENTRADA' ? 'entrada' : 'saída'})</label>
                    <select value={f.operacaoFiscal} onChange={(e) => set('operacaoFiscal', e.target.value)}>
                      {OPER.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>

                  {/* CFOP + Natureza só aparecem em "Escolher Outros" */}
                  {isOperacaoOutros && (
                    <>
                      <div className="fat-c2"><label>CFOP</label>
                        <input type="text" placeholder="Ex.: 5405" value={f.cfop ?? ''} onChange={(e) => set('cfop', e.target.value)} /></div>
                      <div className="fat-c4"><label>Natureza da operação</label>
                        <input type="text" placeholder="Informe a natureza da operação" value={f.naturezaOperacao ?? ''} onChange={(e) => set('naturezaOperacao', e.target.value)} /></div>
                    </>
                  )}
                </div>

                {/* Ajuste de imposto (sem cabeçalho próprio) */}
                <div className="fat-g" style={{ marginTop: 6 }}>
                  <span className="fat-c12" style={{ fontSize: 10, color: 'var(--fat-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Ajuste de imposto</span>
                  {chk('zerarIpi', 'Zerar IPI')}{chk('zerarIcms', 'Zerar ICMS')}{chk('zerarSubstituicao', 'Zerar substituição')}
                  {chk('descontoSuframa', 'Desconto ICMS Suframa')}{chk('impostoAntecipado', 'Imposto antecipado')}
                  <div className="fat-c2"><label>MVA antecipado (%)</label>
                    <input type="text" value={f.mvaAntecipado ?? ''} onChange={(e) => set('mvaAntecipado', e.target.value)} /></div>
                </div>
                <div className="fat-dica">Recalcula o imposto por item. Aplica-se à operação Venda; demais operações mantêm o cálculo da venda.</div>
              </div>

              <div style={two}>
                <div className="fat-sec"><div className="fat-sec-header"><span>Modalidade e transporte</span></div>
                  <div className="fat-g">
                    <div className="fat-c6"><label>Modalidade de transporte</label>
                      <select value={f.modalidadeTransporte} onChange={(e) => set('modalidadeTransporte', e.target.value)}>
                        {MODAIS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
                    <div className="fat-c6"><AutocompletePessoa label="Transportadora" tipo="transportadora" value={f.transportadora ?? ''} onChange={(cod) => set('transportadora', cod)} /></div>
                    <div className="fat-c4"><label>Valor do frete</label>
                      <input type="text" inputMode="numeric" value={`R$ ${money(f.frete)}`}
                        onChange={(e) => { const d = e.target.value.replace(/\D/g, ''); set('frete', (Number(d) / 100).toFixed(2)); }} /></div>
                    <div className="fat-c4"><label>Quantidade</label><input type="text" value={f.quantidade ?? ''} onChange={(e) => set('quantidade', e.target.value)} /></div>
                    <div className="fat-c4"><label>Espécie</label><input type="text" value={f.especie ?? ''} onChange={(e) => set('especie', e.target.value)} /></div>
                    <div className="fat-c4"><label>Marca</label><input type="text" value={f.marca ?? ''} onChange={(e) => set('marca', e.target.value)} /></div>
                    <div className="fat-c4"><label>Número</label><input type="text" value={f.numero ?? ''} onChange={(e) => set('numero', e.target.value)} /></div>
                    <div className="fat-c2"><label>Peso bruto</label><input type="text" value={f.pesoBruto ?? ''} onChange={(e) => set('pesoBruto', e.target.value)} /></div>
                    <div className="fat-c2"><label>Peso líq.</label><input type="text" value={f.pesoLiquido ?? ''} onChange={(e) => set('pesoLiquido', e.target.value)} /></div>
                  </div>
                </div>

                <div className="fat-sec"><div className="fat-sec-header"><span>Valores e ajustes</span></div>
                  <div className="fat-g">
                    <div className="fat-c12"><label>Desconto</label>
                      <div className="fat-rd">
                        <label><input type="radio" name="d" checked={(f.descRadio ?? 'N') === 'N'} onChange={() => set('descRadio', 'N')} /> Não</label>
                        <label><input type="radio" name="d" checked={f.descRadio === 'S'} onChange={() => set('descRadio', 'S')} /> Sim</label></div></div>
                    <div className="fat-c6"><label>Desconto %</label><input type="text" value={f.descRadio === 'S' ? (f.percDesconto ?? '') : ''} onChange={(e) => set('percDesconto', e.target.value)} disabled={f.descRadio !== 'S'} /></div>
                    <div className="fat-c6"><label>Desconto R$</label><input type="text" value={typeof f.desconto === 'number' ? money(f.desconto) : (f.desconto ?? '0,00')} readOnly /></div>
                    <div className="fat-c12"><label>Acréscimo</label>
                      <div className="fat-rd">
                        <label><input type="radio" name="a" checked={(f.acresRadio ?? 'N') === 'N'} onChange={() => set('acresRadio', 'N')} /> Não</label>
                        <label><input type="radio" name="a" checked={f.acresRadio === 'S'} onChange={() => set('acresRadio', 'S')} /> Sim</label></div></div>
                    <div className="fat-c6"><label>Acréscimo %</label><input type="text" value={f.acresRadio === 'S' ? (f.percAcrescimo ?? '') : ''} onChange={(e) => set('percAcrescimo', e.target.value)} disabled={f.acresRadio !== 'S'} /></div>
                    <div className="fat-c6"><label>Acréscimo R$</label><input type="text" value={typeof f.acrescimo === 'number' ? money(f.acrescimo) : (f.acrescimo ?? '0,00')} readOnly /></div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ===================== DADOS DA FATURA ===================== */}
          {aba === 'dados' && (
            <>
              <div style={two}>
                <div className="fat-sec"><div className="fat-sec-header"><span>Dados do cliente</span></div>
                  <div className="fat-g">
                    <div className="fat-c3"><label>Código</label><input type="text" readOnly value={txt(cli.codcli)} /></div>
                    <div className="fat-c9"><label>Nome</label><input type="text" readOnly value={txt(cli.nome)} /></div>
                    <div className="fat-c5"><label>CPF/CNPJ</label><input type="text" readOnly value={txt(cli.cpfcgc ?? cli.cpf_cgc ?? cli.cnpj ?? cli.cpf)} /></div>
                    <div className="fat-c2"><label>UF</label><input type="text" readOnly value={txt(cli.uf)} /></div>
                    <div className="fat-c2"><label>Final</label><input type="text" readOnly value={txt(cli.final ?? cli.consumidor_final)} /></div>
                    <div className="fat-c2"><label>Classe pgto</label><input type="text" readOnly value={txt(cli.claspgto ?? cli.classe_pgto)} /></div>
                    <div className="fat-c6"><label>Suframa</label><input type="text" readOnly value={txt(cli.isuframa ?? cli.suframa)} /></div>
                    <div className="fat-c6">
                      <AutocompletePessoa
                        label="Vendedor"
                        value={f.vendedor ?? ''}
                        onChange={(cod) => set('vendedor', cod)}
                        tipo="vendedor"
                      />
                    </div>
                  </div>
                </div>

                <div className="fat-sec"><div className="fat-sec-header"><span>Comissão diferenciada</span></div>
                  <div className="fat-g">
                    <label className="fat-ck fat-c12"><input type="checkbox" checked={!!f.diferenciada} onChange={(e) => set('diferenciada', e.target.checked)} /> Diferenciada</label>
                    {f.diferenciada && (
                      <>
                        <div className="fat-c6"><label>Vendedor externo (%)</label><input type="number" step="0.01" value={f.comissaoExterno ?? ''} onChange={(e) => set('comissaoExterno', e.target.value)} /></div>
                        <div className="fat-c6"><label>Vendedor interno (%)</label><input type="number" step="0.01" value={f.comissaoInterno ?? ''} onChange={(e) => set('comissaoInterno', e.target.value)} /></div>
                      </>
                    )}
                    {act.salvarComissao && (
                      <div className="fat-c6" style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button type="button" className="w-full h-[26px] text-[12px] rounded bg-blue-600 text-white" onClick={act.salvarComissao}>Salvar</button></div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 10 }}>
                <div className="fat-sec"><div className="fat-sec-header"><span>Textos da NF</span></div>
                  <div className="fat-g">
                    <div className="fat-c4"><label>Pedido</label><input type="text" value={f.pedido ?? ''} onChange={(e) => set('pedido', e.target.value)} /></div>
                    <div className="fat-c8" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                      <label className="fat-ck"><input type="checkbox" checked={!!f.informarNoCorpoNF} onChange={(e) => set('informarNoCorpoNF', e.target.checked)} /> Informar no corpo da NF</label></div>
                    <div className="fat-c6"><label>Observações</label>
                      <textarea value={f.observacoes ?? ''} onChange={(e) => set('observacoes', e.target.value)} /></div>
                    <div className="fat-c6"><label>Informações complementares</label>
                      <textarea placeholder="Informações complementares da NF…" value={f.infoComplementares ?? ''} onChange={(e) => set('infoComplementares', e.target.value)} /></div>
                  </div>
                </div>

                <div className="fat-sec"><div className="fat-sec-header"><span>Mensagens NF</span></div>
                  <div className="fat-g">
                    <div className="fat-c8"><input type="text" placeholder="Código ou parte do texto da mensagem…"
                      value={f.textoBuscaMensagem ?? ''} onChange={(e) => { set('textoBuscaMensagem', e.target.value); act.buscaMensagem?.(e.target.value); }} /></div>
                    <div className="fat-c4" style={{ display: 'flex', alignItems: 'flex-end' }}>
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
              </div>
            </>
          )}

          {/* ===================== PRODUTOS ===================== */}
          {aba === 'produtos' && (
            <div className="fat-sec"><div className="fat-sec-header"><span>Produtos ({itens.length})</span>{data.recalculandoImposto && <span style={{ fontSize: 10, color: '#2563eb', textTransform: 'none', letterSpacing: 0 }}>· recalculando impostos…</span>}</div>
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

          {/* ===================== COBRANÇA E VALORES ===================== */}
          {aba === 'cobranca' && (
            <div className="fat-sec"><div className="fat-sec-header"><span>Cobrança</span></div>
              <div className="fat-g">
                <div className="fat-c3"><label>Gerar cobrança</label>
                  {/* Cobrança só é permitida em Movimentação = SAÍDA e Operação = VENDA.
                      Qualquer outra combinação trava o campo em "Não". */}
                  <select
                    value={
                      String(f.tipoMovimentacao).toUpperCase() === 'SAIDA' &&
                      String(f.operacaoFiscal).toUpperCase() === 'VENDA'
                        ? f.cobranca
                        : 'N'
                    }
                    disabled={
                      !(String(f.tipoMovimentacao).toUpperCase() === 'SAIDA' &&
                        String(f.operacaoFiscal).toUpperCase() === 'VENDA')
                    }
                    onChange={(e) => set('cobranca', e.target.value)}
                  >
                    <option value="S">Sim</option><option value="N">Não</option></select></div>
                <div className="fat-c4"><label>Banco</label>
                  <select value={f.banco ?? ''} onChange={(e) => set('banco', e.target.value)}>
                    {BANCOS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
                <div className="fat-c5"><label>Tipo de fatura/documento</label>
                  <select value={f.tipoFatura ?? 'BOLETO'} onChange={(e) => set('tipoFatura', e.target.value)}>
                    {TIPOS_FAT.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
                <div className="fat-c3"><label>Intervalo de dias</label>
                  <input type="text" inputMode="numeric" placeholder="Ex: 30" disabled={f.cobranca !== 'S'} value={f.intervaloDias ?? ''} onChange={(e) => set('intervaloDias', e.target.value.replace(/\D/g, ''))} /></div>
                <div className="fat-c3"><label>Quantidade (vezes)</label>
                  <input type="text" inputMode="numeric" placeholder="Ex: 3" disabled={f.cobranca !== 'S'} value={f.qtdParcelas ?? ''} onChange={(e) => set('qtdParcelas', e.target.value.replace(/\D/g, ''))} /></div>
                <div className="fat-c3" style={{ display: 'flex', alignItems: 'flex-end' }}>
                  {/* "Gerar cobrança" = NÃO bloqueia a geração de parcelas. */}
                  <button type="button" disabled={f.cobranca !== 'S'} title={f.cobranca !== 'S' ? 'Ative "Gerar cobrança" para gerar parcelas' : ''} className={`w-full h-[26px] text-[12px] rounded text-white ${f.cobranca !== 'S' ? 'bg-gray-400 opacity-60 cursor-not-allowed' : 'bg-blue-600'}`} onClick={act.gerarParcelas}>+ Gerar parcelas</button></div>
                {chk('habilitarValor', 'Habilitar valor de entrada', 'fat-c3')}
                {f.habilitarValor && (
                  <div className="fat-c3"><label>Valor de entrada (R$)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Ex: 400,00"
                      value={f.valorVista ?? ''}
                      onChange={(e) => {
                        // Máscara de moeda em centavos: dígitos preenchem da direita.
                        const digits = e.target.value.replace(/\D/g, '');
                        const masked = digits
                          ? (parseInt(digits, 10) / 100).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : '';
                        set('valorVista', masked);
                      }}
                    /></div>
                )}
                {chk('impostoNa1Parcela', 'Cobrar impostos na 1ª parcela', 'fat-c3')}
                {chk('freteNa1Parcela', 'Cobrar frete na 1ª parcela', 'fat-c3')}
                {chk('diferenciada', 'Comissão diferenciada', 'fat-c3')}
                {f.cobranca === 'S' &&
                  f.tipoFatura &&
                  !['BOLETO', 'BOLETO BANCARIO', 'BOLETO BANCÁRIO', 'CARTEIRA'].includes(
                    String(f.tipoFatura).toUpperCase(),
                  ) &&
                  chk('gerar30dias', 'Gerar cobrança 1 dia (valor total)', 'fat-c4')}
              </div>
              <div className="fat-sub">Parcelas</div>
              <div className="fat-tbl-wrap"><table className="fat-tbl">
                <thead><tr><th className="l">Parcela</th><th>Dias</th><th className="l">Vencimento</th><th>Valor</th><th style={{ width: 28 }}></th></tr></thead>
                <tbody>
                  {PARCELAS.map((p: any, i: number) => (
                    <tr key={i}>
                      <td className="l">{p.parcela}</td>
                      <td className="n">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={p.dias}
                          style={{ height: 20, width: 56, textAlign: 'right' }}
                          onChange={(e) => act.atualizarDias?.(p.idx ?? i, e.target.value.replace(/\D/g, ''))}
                        />
                      </td>
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
          )}
        </div>

        {/* RODAPÉ · agrupamento = resumo das faturas + total; senão espelho da fatura */}
        <div className="flex-shrink-0 border-t border-gray-200 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800" style={{ padding: '8px 12px' }}>
          {agr ? (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--fat-muted)', marginBottom: 6 }}>
                Resumo das faturas agrupadas ({agr.documentos.length})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '4px 20px', fontSize: 12 }}>
                {agr.documentos.map((d) => (
                  <div key={d.codfat} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ color: 'var(--fat-muted)' }}>NF {d.nf}</span>
                    <b>R$ {money(d.valor)}</b>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--fat-border-soft)', display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'baseline' }}>
                <span style={{ textTransform: 'uppercase', fontSize: 11, fontWeight: 700, color: 'var(--fat-muted)' }}>Total a Pagar</span>
                <b style={{ fontSize: 17, color: '#dc2626' }}>R$ {money(agr.total)}</b>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--fat-muted)', marginBottom: 6 }}>Espelho dos valores da fatura</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0,1fr))', gap: '8px 16px' }}>
                {rzt('Base cálc. do ICMS', esp.baseIcms)}
                {rzt('Valor do ICMS', esp.valorIcms)}
                {rzt('Base cálc. ICMS subst.', esp.baseSt)}
                {rzt('Valor do ICMS subst.', esp.valorSt)}
                {rzt('Valor total dos produtos', esp.totalProd)}
                {rzt('Total fatura', esp.totalFat)}
                {rzt('Valor do frete', esp.totalFrete)}
                {rzt('Valor do desconto', esp.valorDesconto)}
                {rzt('Outras despesas acessórias', esp.despesa)}
                {rzt('Valor total do IPI', esp.totalIpi)}
                {rzt('Valor total da NF', esp.totalNf, '#dc2626', true)}
                {rzt('Total produtos desc. ICMS', esp.totalProdSuframa)}
              </div>
              <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--fat-border-soft)', display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 11, color: 'var(--fat-muted)', alignItems: 'center' }}>
                <span>IBS <span className="fat-prov">provisório</span> · {n(resumo.ibs_aliq ?? 0.1).toFixed(2)}% · <b style={{ color: '#22d3ee' }}>R$ {money(resumo.ibs_valor)}</b></span>
                <span>CBS <span className="fat-prov">provisório</span> · {n(resumo.cbs_aliq ?? 0.9).toFixed(2)}% · <b style={{ color: '#a78bfa' }}>R$ {money(resumo.cbs_valor)}</b></span>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}

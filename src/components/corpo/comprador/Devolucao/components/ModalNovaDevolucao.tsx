/**
 * Nova devolução de compra (manual), na própria tela Faturamento › Devolução —
 * como a tela de devolução do Delphi: busca a nota de entrada (nº da NF, código da entrada ou
 * chave), lista os itens por armazém com a quantidade disponível, escolhe quanto devolver e o
 * motivo, confere o destinatário (cliente do fornecedor) e grava a devolução aberta com o
 * pré-pedido. O item fica reservado no próprio armazém. "Salvar e emitir" abre em seguida a
 * emissão da NF (ModalEmitirDevolucao).
 */
import React, { useMemo, useState } from 'react';
import { X, Loader2, AlertTriangle, Search } from 'lucide-react';
import { DefaultButton } from '@/components/common/Buttons';
import { useToast } from '@/hooks/use-toast';
import api from '@/components/services/api';

interface Entrada {
  codent: string;
  nroform: string;
  serie: string;
  dtent: string;
  totalnf: number;
  cfop: string;
  chave: string;
  codCredor: string;
  fornecedor: string;
  cpfcgc: string;
  iest: string;
  uf: string;
  bloqueio: string | null;
}

interface Item {
  codprod: string;
  codreq: string | null;
  armId: number;
  armazem: string;
  ref: string;
  descr: string;
  unidade: string;
  localizacao: string;
  prunit: number;
  qtdOriginal: number;
  qtdAlocada: number;
  qtdDevolvida: number;
  estoqueLivre: number;
  qtdDisponivel: number;
  pendenteEm: string | null;
}

interface Destinatario {
  codcli: string;
  nome: string;
  cpfcgc: string;
  iest: string;
  uf: string;
  codmunicipio: string;
}

interface Props {
  usuario: string;
  onClose: () => void;
  /** Gravou: devId e se deve abrir a emissão em seguida. */
  onSalva: (devId: string, emitir: boolean) => void;
}

export const MOTIVO_LABEL: Record<string, string> = {
  FALTA: 'Falta',
  DANIFICADO: 'Danificado',
  ERRADO: 'Errado',
  GARANTIA: 'Garantia',
  ACORDO: 'Acordo comercial',
  OUTROS: 'Outros',
};

const FILTROS = [
  { v: 'NF', l: 'Nº da NF' },
  { v: 'CODIGO', l: 'Código da entrada' },
  { v: 'CHAVE', l: 'Chave da NF' },
];

const moeda = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const qtdFmt = (v: number) => (Number(v) % 1 === 0 ? String(Number(v)) : Number(v).toFixed(2));
const data = (d: string) => {
  const m = String(d ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '-';
};
const doc = (v: string) => {
  const d = String(v ?? '').replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return v || '-';
};
const chaveItem = (i: { codprod: string; codreq: string | null; armId: number }) => `${i.codprod}|${i.codreq ?? ''}|${i.armId}`;

export const ModalNovaDevolucao: React.FC<Props> = ({ usuario, onClose, onSalva }) => {
  const { toast } = useToast();
  const [filtro, setFiltro] = useState('NF');
  const [valor, setValor] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [entradas, setEntradas] = useState<Entrada[] | null>(null);

  const [entrada, setEntrada] = useState<Entrada | null>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [motivos, setMotivos] = useState<string[]>([]);
  const [dest, setDest] = useState<Destinatario | null>(null);
  const [seraCriado, setSeraCriado] = useState(false);
  const [divergencia, setDivergencia] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const [qtds, setQtds] = useState<Record<string, string>>({});
  const [motivoItem, setMotivoItem] = useState<Record<string, string>>({});
  const [codcliOutro, setCodcliOutro] = useState('');
  const [pedido, setPedido] = useState('');
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);

  const erroApi = (e: any) => e?.response?.data?.message || e.message;

  const buscar = async () => {
    if (!valor.trim()) return;
    setBuscando(true);
    try {
      const r = await api.get('/api/devolucao/manual', { params: { etapa: 'entradas', filtro, valor: valor.trim() } });
      const lista: Entrada[] = r.data?.data || [];
      setEntradas(lista);
      if (lista.length === 1 && !lista[0].bloqueio) await abrirEntrada(lista[0].codent);
    } catch (e: any) {
      toast({ title: 'Não foi possível buscar', description: erroApi(e), variant: 'destructive' });
    } finally {
      setBuscando(false);
    }
  };

  const abrirEntrada = async (codent: string, codcli?: string) => {
    setCarregando(true);
    try {
      const r = await api.get('/api/devolucao/manual', { params: { etapa: 'itens', codent, codcli: codcli || undefined } });
      const d = r.data.data;
      setEntrada(d.entrada);
      setDest(d.destinatario);
      setSeraCriado(!!d.seraCriado);
      setDivergencia(d.divergencia);
      setMotivos(d.motivos || []);
      if (!codcli) {
        setItens(d.itens);
        setQtds({});
        setMotivoItem({});
        setObs(`DEV REF NF ${d.entrada.nroform || d.entrada.codent}`);
      }
    } catch (e: any) {
      toast({ title: 'Não foi possível abrir a entrada', description: erroApi(e), variant: 'destructive' });
    } finally {
      setCarregando(false);
    }
  };

  const trocarCliente = () => {
    if (!entrada) return;
    abrirEntrada(entrada.codent, codcliOutro.trim() || undefined);
  };

  const qtdDe = (i: Item) => Number(String(qtds[chaveItem(i)] ?? '').replace(',', '.')) || 0;

  const resumo = useMemo(() => {
    let total = 0;
    let qtd = 0;
    let original = 0;
    const erros: string[] = [];
    const armPorProduto = new Map<string, Set<number>>();
    for (const i of itens) {
      const q = qtdDe(i);
      original += i.qtdOriginal;
      if (!q) continue;
      qtd += q;
      total += q * i.prunit;
      if (q < 0 || !Number.isInteger(q)) erros.push(`${i.ref || i.codprod}: quantidade inválida.`);
      else if (q > i.qtdDisponivel) erros.push(`${i.ref || i.codprod}: disponível ${qtdFmt(i.qtdDisponivel)}.`);
      if (i.pendenteEm) erros.push(`${i.ref || i.codprod}: já está na devolução ${i.pendenteEm} (pendente).`);
      if (!motivoItem[chaveItem(i)]) erros.push(`${i.ref || i.codprod}: informe o motivo.`);
      const s = armPorProduto.get(i.codprod) || new Set<number>();
      s.add(i.armId);
      armPorProduto.set(i.codprod, s);
    }
    for (const [p, s] of armPorProduto) if (s.size > 1) erros.push(`Produto ${p}: devolva de um armazém por vez.`);
    return { total, qtd, perc: original ? (100 * qtd) / original : 0, erros };
  }, [itens, qtds, motivoItem]);

  const devolverTodos = () => {
    setQtds(Object.fromEntries(itens.filter((i) => i.qtdDisponivel > 0 && !i.pendenteEm).map((i) => [chaveItem(i), String(i.qtdDisponivel)])));
  };
  const motivoTodos = (m: string) => {
    if (!m) return;
    setMotivoItem(Object.fromEntries(itens.map((i) => [chaveItem(i), m])));
  };

  const pendentesNota = useMemo(
    () => [...new Set(itens.flatMap((i) => (i.pendenteEm ? i.pendenteEm.split(', ') : [])))],
    [itens],
  );

  const podeSalvar = !!entrada && resumo.qtd > 0 && resumo.erros.length === 0 && !divergencia && (!!dest || seraCriado) && !salvando;

  const salvar = async (emitir: boolean) => {
    if (!entrada || !podeSalvar) return;
    setSalvando(true);
    try {
      const r = await api.post('/api/devolucao/manual', {
        codent: entrada.codent,
        itens: itens
          .filter((i) => qtdDe(i) > 0)
          .map((i) => ({ codprod: i.codprod, codreq: i.codreq, armId: i.armId, qtd: qtdDe(i), motivo: motivoItem[chaveItem(i)] })),
        codcli: dest?.codcli || null,
        pedido: pedido.trim() || null,
        obs: obs.trim() || null,
        username: usuario,
      });
      toast({ title: 'Devolução gravada', description: r.data?.message });
      onSalva(r.data.data.devId, emitir);
    } catch (e: any) {
      toast({ title: 'Não foi possível gravar', description: erroApi(e), variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const inputCls = 'px-2 py-1 border rounded dark:bg-zinc-700 dark:border-zinc-600';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-2">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-7xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Nova devolução de compra</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 text-sm space-y-4">
          {/* 1. Documento */}
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">Buscar por</span>
              <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className={inputCls}>
                {FILTROS.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 flex-1 min-w-[240px]">
              <span className="text-xs text-gray-500">Nota de entrada</span>
              <input
                autoFocus
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') buscar(); }}
                placeholder={filtro === 'CHAVE' ? '44 dígitos' : filtro === 'CODIGO' ? 'Ex.: 179240' : 'Ex.: 66472'}
                className={inputCls}
              />
            </label>
            <DefaultButton text={buscando ? 'Buscando...' : 'Buscar'} size="sm" icon={<Search className="w-4 h-4" />} disabled={buscando} onClick={buscar} />
          </div>

          {entradas && !entrada && (
            entradas.length === 0 ? (
              <p className="text-gray-500">Nenhuma entrada encontrada.</p>
            ) : (
              <table className="w-full border border-gray-200 dark:border-zinc-700">
                <thead className="bg-gray-100 dark:bg-zinc-700">
                  <tr>
                    <th className="px-2 py-1 text-left">Entrada</th>
                    <th className="px-2 py-1 text-left">NF</th>
                    <th className="px-2 py-1 text-left">Data</th>
                    <th className="px-2 py-1 text-left">Fornecedor</th>
                    <th className="px-2 py-1 text-right">Total</th>
                    <th className="px-2 py-1 text-left">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {entradas.map((e) => (
                    <tr
                      key={e.codent}
                      onClick={() => !e.bloqueio && abrirEntrada(e.codent)}
                      className={`border-t border-gray-200 dark:border-zinc-700 ${e.bloqueio ? 'text-gray-400' : 'cursor-pointer hover:bg-blue-50 dark:hover:bg-zinc-700'}`}
                    >
                      <td className="px-2 py-1">{e.codent}</td>
                      <td className="px-2 py-1">{e.nroform}/{e.serie}</td>
                      <td className="px-2 py-1">{data(e.dtent)}</td>
                      <td className="px-2 py-1">{e.codCredor} · {e.fornecedor}</td>
                      <td className="px-2 py-1 text-right">{moeda(e.totalnf)}</td>
                      <td className="px-2 py-1">{e.bloqueio || 'Selecionar'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {carregando && <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>}

          {entrada && (
            <>
              {/* Cabeçalho da nota */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 rounded-md border border-gray-200 dark:border-zinc-700 p-3">
                <Info r="Entrada" v={`${entrada.codent} · ${data(entrada.dtent)}`} />
                <Info r="NF do fornecedor" v={`${entrada.nroform}/${entrada.serie} · CFOP ${entrada.cfop}`} />
                <Info r="Fornecedor" v={`${entrada.codCredor} · ${entrada.fornecedor}`} />
                <Info r="CNPJ / IE / UF" v={`${doc(entrada.cpfcgc)} · ${entrada.iest || 'ISENTO'} · ${entrada.uf}`} />
                <div className="col-span-2 md:col-span-4 text-xs text-gray-500 break-all">Chave {entrada.chave || '-'}</div>
                <div className="col-span-2 md:col-span-4">
                  <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => { setEntrada(null); setItens([]); }}>
                    Trocar nota
                  </button>
                </div>
              </div>

              {pendentesNota.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-700 p-3 text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  Esta nota tem devolução pendente de NF: <strong>{pendentesNota.join(', ')}</strong>. Os itens dela ficam
                  bloqueados aqui para não devolver em duplicidade — emita ou cancele essa devolução antes.
                </div>
              )}

              {/* 2. Itens */}
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="font-semibold">Itens</span>
                  <DefaultButton text="Devolver todos" size="sm" variant="secondary" onClick={devolverTodos} />
                  <DefaultButton text="Zerar" size="sm" variant="secondary" onClick={() => setQtds({})} />
                  <select defaultValue="" onChange={(e) => { motivoTodos(e.target.value); e.target.value = ''; }} className={inputCls}>
                    <option value="">Motivo para todos…</option>
                    {motivos.map((m) => <option key={m} value={m}>{MOTIVO_LABEL[m] || m}</option>)}
                  </select>
                </div>
                <div className="border border-gray-200 dark:border-zinc-700 rounded overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100 dark:bg-zinc-700">
                      <tr>
                        <th className="px-2 py-1 text-left">Produto</th>
                        <th className="px-2 py-1 text-left">Armazém / local</th>
                        <th className="px-2 py-1 text-right">Preço NF</th>
                        <th className="px-2 py-1 text-center">Nota</th>
                        <th className="px-2 py-1 text-center">Alocado</th>
                        <th className="px-2 py-1 text-center">Já devolvido</th>
                        <th className="px-2 py-1 text-center">Livre</th>
                        <th className="px-2 py-1 text-center">Disponível</th>
                        <th className="px-2 py-1 text-center">Devolver</th>
                        <th className="px-2 py-1 text-center">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.length === 0 && (
                        <tr><td colSpan={10} className="px-2 py-4 text-center text-gray-500">A entrada não tem itens para devolver.</td></tr>
                      )}
                      {itens.map((i) => {
                        const k = chaveItem(i);
                        const q = qtdDe(i);
                        const excede = q > i.qtdDisponivel;
                        return (
                          <tr key={k} className={`border-t border-gray-200 dark:border-zinc-700 ${q > 0 ? 'bg-amber-50 dark:bg-amber-900/20' : ''}`}>
                            <td className="px-2 py-1">
                              <div className="font-medium">{i.ref || i.codprod}</div>
                              <div className="text-gray-500 truncate max-w-[260px]">{i.codprod} · {i.descr}</div>
                              {i.pendenteEm && <div className="text-red-600">Na devolução {i.pendenteEm} (pendente)</div>}
                            </td>
                            <td className="px-2 py-1">{i.armazem}{i.localizacao ? ` · ${i.localizacao}` : ''}</td>
                            <td className="px-2 py-1 text-right">{moeda(i.prunit)}</td>
                            <td className="px-2 py-1 text-center">{qtdFmt(i.qtdOriginal)}</td>
                            <td className="px-2 py-1 text-center">{qtdFmt(i.qtdAlocada)}</td>
                            <td className="px-2 py-1 text-center">{qtdFmt(i.qtdDevolvida)}</td>
                            <td className="px-2 py-1 text-center">{qtdFmt(i.estoqueLivre)}</td>
                            <td className="px-2 py-1 text-center font-semibold">{qtdFmt(i.qtdDisponivel)}</td>
                            <td className="px-2 py-1 text-center">
                              <input
                                value={qtds[k] ?? ''}
                                disabled={i.qtdDisponivel <= 0 || !!i.pendenteEm}
                                onChange={(e) => setQtds((s) => ({ ...s, [k]: e.target.value.replace(/[^\d]/g, '') }))}
                                className={`w-16 text-center ${inputCls} ${excede ? 'border-red-500 text-red-600' : ''}`}
                              />
                            </td>
                            <td className="px-2 py-1 text-center">
                              <select
                                value={motivoItem[k] ?? ''}
                                onChange={(e) => setMotivoItem((s) => ({ ...s, [k]: e.target.value }))}
                                className={inputCls}
                              >
                                <option value="">—</option>
                                {motivos.map((m) => <option key={m} value={m}>{MOTIVO_LABEL[m] || m}</option>)}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2">
                  Total da devolução: <strong>{moeda(resumo.total)}</strong> · {qtdFmt(resumo.qtd)} peça(s) ({resumo.perc.toFixed(2)}% da nota)
                </p>
                {resumo.erros.length > 0 && resumo.qtd > 0 && (
                  <ul className="mt-1 text-red-600 list-disc pl-5">{resumo.erros.map((e) => <li key={e}>{e}</li>)}</ul>
                )}
              </div>

              {/* 3. Destinatário */}
              <div className="rounded-md border border-gray-200 dark:border-zinc-700 p-3">
                <div className="font-semibold mb-1">Destinatário (cliente do fornecedor)</div>
                {dest ? (
                  <p>{dest.codcli} · {dest.nome} · {doc(dest.cpfcgc)} · IE {dest.iest || 'ISENTO'} · {dest.uf}</p>
                ) : seraCriado ? (
                  <p className="text-amber-700 dark:text-amber-300">
                    O fornecedor não tem cadastro de cliente: ele será cadastrado automaticamente com os dados do fornecedor ao salvar.
                  </p>
                ) : (
                  <p className="text-red-600">O fornecedor não tem cliente nem CPF/CNPJ válido para o cadastro automático. Informe o cliente.</p>
                )}
                {divergencia && (
                  <p className="mt-1 text-red-600"><AlertTriangle className="w-4 h-4 inline mr-1" />{divergencia}</p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <input value={codcliOutro} onChange={(e) => setCodcliOutro(e.target.value)} placeholder="Outro cliente (código)" className={`w-48 ${inputCls}`} />
                  <DefaultButton text="Usar este cliente" size="sm" variant="secondary" onClick={trocarCliente} />
                </div>
              </div>

              {/* 4. Pedido e observação */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-gray-500">Pedido do fornecedor (opcional)</span>
                  <input value={pedido} maxLength={30} onChange={(e) => setPedido(e.target.value)} className={inputCls} />
                </label>
                <label className="flex flex-col gap-1 md:col-span-2">
                  <span className="text-xs text-gray-500">Observação</span>
                  <input value={obs} maxLength={100} onChange={(e) => setObs(e.target.value)} className={inputCls} />
                </label>
              </div>
              <p className="text-xs text-gray-500">
                Ao salvar, os itens ficam reservados no armazém de origem (saem do disponível para venda) e é gerado o pré-pedido
                para o fornecedor. A NF de devolução é emitida em seguida ou depois, pelo botão &ldquo;Emitir NF de devolução&rdquo;.
              </p>
            </>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-zinc-700 flex justify-end gap-2">
          {entrada && (
            <>
              <DefaultButton text={salvando ? 'Salvando...' : 'Salvar'} size="sm" variant="secondary" disabled={!podeSalvar} onClick={() => salvar(false)} />
              <DefaultButton text="Salvar e emitir NF" size="sm" disabled={!podeSalvar} onClick={() => salvar(true)} />
            </>
          )}
          <DefaultButton text="Fechar" size="sm" variant="secondary" onClick={onClose} />
        </div>
      </div>
    </div>
  );
};

const Info: React.FC<{ r: string; v: string }> = ({ r, v }) => (
  <div>
    <span className="text-xs text-gray-500 dark:text-gray-400">{r}</span>
    <p className="font-medium text-gray-900 dark:text-gray-100 break-words">{v || '-'}</p>
  </div>
);

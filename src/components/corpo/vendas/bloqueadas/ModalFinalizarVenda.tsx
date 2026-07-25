'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, Loader2, CheckCircle, Truck, CreditCard, FileText,
  User, DollarSign, AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import SelecionarTransporte from '../novaVenda/selectTransporte';
import ModalPrazoParcelas from '../novaVenda/prazo';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface ModalFinalizarVendaProps {
  isOpen: boolean;
  onClose: () => void;
  codvenda: string;
  onFinalizar: () => void;
  usuario?: string;
}

const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '-';

const ModalFinalizarVenda: React.FC<ModalFinalizarVendaProps> = ({
  isOpen, onClose, codvenda, onFinalizar, usuario,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<any>(null);

  // Campos editáveis
  const [transporteSel, setTransporteSel] = useState<{ CODTPTRANSP: string; DESCR: string }>({ CODTPTRANSP: '', DESCR: '' });
  const [vlrfrete, setVlrfrete] = useState('0');
  const [formaPagamento, setFormaPagamento] = useState('');
  const [prazosArray, setPrazosArray] = useState<{ id: number; dataVencimento: Date; dias: number }[]>([]);
  const [prazoTexto, setPrazoTexto] = useState('');
  const [obsFat, setObsFat] = useState('');
  const [obs, setObs] = useState('');
  const [pedido, setPedido] = useState('');
  const [showPrazoModal, setShowPrazoModal] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);

  // Carregar dados
  useEffect(() => {
    if (!isOpen || !codvenda) return;
    setLoading(true);
    fetch(`/api/vendas/dados-finalizacao?codvenda=${codvenda}`)
      .then((r) => r.json())
      .then((result) => {
        if (result.error) throw new Error(result.error);
        setData(result);
        const v = result.venda;
        // Transportadora
        const transp = result.transportadoras?.find((t: any) => t.codigo === v.codtptransp);
        if (transp) setTransporteSel({ CODTPTRANSP: transp.codigo, DESCR: transp.descricao });
        else if (v.transp) setTransporteSel({ CODTPTRANSP: v.codtptransp || '', DESCR: v.transp });
        setVlrfrete(Number(v.vlrfrete || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
        setFormaPagamento(v.formaPagamento || '');
        setPrazoTexto(v.prazo || '');
        setObsFat(v.obsfat || '');
        setObs(v.obs || '');
        setPedido(v.pedido || '');
        // Prazos existentes
        if (result.prazos?.length > 0) {
          setPrazosArray(result.prazos.map((p: any, i: number) => ({
            id: i + 1,
            dataVencimento: p.data ? new Date(p.data) : new Date(),
            dias: p.dia || 0,
          })));
        }
      })
      .catch((e) => toast({ title: 'Erro ao carregar', description: e.message, variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [isOpen, codvenda, toast]);

  // Validar
  const validar = useCallback(() => {
    if (!transporteSel.CODTPTRANSP) { toast({ title: 'Selecione a transportadora' }); return false; }
    if (!formaPagamento) { toast({ title: 'Selecione a forma de pagamento' }); return false; }
    return true;
  }, [transporteSel, formaPagamento, toast]);

  // Liberar
  const handleLiberar = useCallback(async () => {
    if (!validar()) return;
    setSaving(true);
    try {
      const resLib = await fetch(`/api/vendas/${codvenda}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'N',
          transportadora: transporteSel.DESCR,
          codtptransp: transporteSel.CODTPTRANSP,
          vlrfrete: Number(String(vlrfrete).replace(/[^0-9.,]/g, '').replace(',', '.')) || 0,
          prazo: prazoTexto,
          obsfat: obsFat,
          obs,
          pedido,
        }),
      });

      if (resLib.ok) {
        toast({ title: 'Venda liberada com sucesso!' });
        onFinalizar();
        onClose();
      } else {
        const err = await resLib.json();
        throw new Error(err.message || 'Erro ao liberar');
      }
    } catch (e: any) {
      toast({ title: 'Erro ao liberar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [codvenda, transporteSel, vlrfrete, formaPagamento, prazoTexto, obsFat, obs, pedido, validar, onFinalizar, onClose, toast]);

  // Atalhos
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (showPrazoModal) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation(); setTimeout(onClose, 0); }
      if (e.ctrlKey && e.key === 'l') { e.preventDefault(); e.stopImmediatePropagation(); handleLiberar(); }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [isOpen, showPrazoModal, onClose, handleLiberar]);

  // Confirmar prazos
  const handleConfirmPrazos = useCallback((parcelas: { id: number; dataVencimento: Date; dias: number }[]) => {
    setPrazosArray(parcelas);
    const texto = parcelas.map((p) => String(p.dias).padStart(3, '0')).join(' ');
    setPrazoTexto(texto);
    setShowPrazoModal(false);
  }, []);

  if (!isOpen) return null;

  const v = data?.venda;
  const c = data?.cliente;
  // Transportadoras no formato esperado pelo componente
  const dadosTransporte = data?.transportadoras?.map((t: any) => ({ CODTPTRANSP: t.codigo, DESCR: t.descricao })) || [];

  return (
    <div className="fixed inset-0 z-[60] bg-black/30 flex justify-center items-center p-6">
      <div ref={modalRef} className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-[96vw] h-[96vh] flex flex-col">
        {/* Cabeçalho */}
        <div className="flex justify-between items-center px-6 py-3 border-b border-slate-200 dark:border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle size={20} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-gray-100">Finalizar Venda</h3>
              <span className="text-xs text-slate-500">{codvenda} | {v ? formatDate(v.data) : ''} | {c ? c.nomefant || c.nome : ''}</span>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar"
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-600 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-400">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : !data ? (
          <div className="flex-1 flex items-center justify-center text-red-500">Erro ao carregar dados</div>
        ) : (
          <div className="flex-1 px-6 py-4 flex flex-col gap-4">
            {/* Resumo horizontal */}
            <div className="flex items-center gap-6 px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700">
              <div className="flex items-center gap-2">
                <DollarSign size={16} className="text-blue-600" />
                <div>
                  <span className="text-[10px] text-slate-400">Total</span>
                  <p className="text-lg font-bold text-blue-600">{formatCurrency(v.total)}</p>
                </div>
              </div>
              <div className="h-8 w-px bg-slate-200 dark:bg-zinc-700" />
              <div>
                <span className="text-[10px] text-slate-400">Cliente</span>
                <p className="text-sm font-semibold text-slate-700 dark:text-gray-300">{c.codcli} - {c.nomefant || c.nome}</p>
              </div>
              <div className="h-8 w-px bg-slate-200 dark:bg-zinc-700" />
              <div>
                <span className="text-[10px] text-slate-400">Limite Disp.</span>
                <p className={`text-sm font-bold ${c.limite_disponivel > 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(c.limite_disponivel)}</p>
              </div>
              <div className="h-8 w-px bg-slate-200 dark:bg-zinc-700" />
              <div>
                <span className="text-[10px] text-slate-400">Class. Pgto</span>
                <p className="text-sm font-bold text-slate-700 dark:text-gray-300">{c.claspgto || '-'}</p>
              </div>
              {v.total > c.limite_disponivel && c.limite_disponivel >= 0 ? (
                <>
                  <div className="h-8 w-px bg-slate-200 dark:bg-zinc-700" />
                  <div className="flex items-center gap-1.5 text-amber-600">
                    <AlertTriangle size={14} />
                    <span className="text-xs font-semibold">Excede limite</span>
                  </div>
                </>
              ) : null}
            </div>

            {/* Formulário — 2 colunas */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4" data-fin-form
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const target = e.target as HTMLElement;
                  if (target.tagName === 'TEXTAREA') return;
                  if (target.tagName === 'INPUT' || target.tagName === 'SELECT') {
                    e.preventDefault();
                    const form = target.closest('[data-fin-form]');
                    if (!form) return;
                    const focusables = Array.from(form.querySelectorAll<HTMLElement>(
                      'input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
                    )).filter((el) => el.offsetParent !== null);
                    const idx = focusables.indexOf(target);
                    if (idx >= 0 && idx < focusables.length - 1) {
                      focusables[idx + 1]?.focus();
                    }
                  }
                }
              }}>
              {/* Coluna esquerda — Transporte e Pagamento */}
              <div className="border border-slate-200 dark:border-zinc-700 rounded-xl overflow-hidden flex flex-col">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800">
                  <Truck size={14} className="text-blue-600" />
                  <span className="text-sm font-bold text-slate-700 dark:text-gray-200">Transporte e Pagamento</span>
                </div>
                <div className="p-4 space-y-3 flex-1">
                  {/* Transportadora — componente do projeto */}
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Transportadora *</label>
                    <SelecionarTransporte
                      dadosTransporte={dadosTransporte}
                      transporteSel={transporteSel}
                      obrigTransporte={!transporteSel.CODTPTRANSP}
                      handleTransporteSel={setTransporteSel}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Valor Frete</label>
                      <input type="text" value={vlrfrete}
                        onChange={(e) => {
                          const num = e.target.value.replace(/[^0-9.]/g, '');
                          setVlrfrete(num);
                        }}
                        onFocus={() => setVlrfrete('')}
                        onBlur={() => {
                          const formatted = Number(vlrfrete || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                          setVlrfrete(formatted);
                        }}
                        className="w-full h-10 px-3 text-sm border border-slate-200 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Forma Pagamento *</label>
                      <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                        <SelectTrigger className={`w-full ${!formaPagamento ? 'text-slate-400' : ''}`}>
                          <SelectValue placeholder="Forma de pagamento" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel>Opções de Pagamento:</SelectLabel>
                            {data.formasPagamento?.map((f: any) => (
                              <SelectItem key={f.id} value={f.id}>{f.descricao}</SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Prazo</label>
                    <div className="flex gap-2">
                      <input type="text" value={prazoTexto} readOnly placeholder="Clique para definir..."
                        onClick={() => setShowPrazoModal(true)}
                        className="flex-1 h-10 px-3 text-sm border border-slate-200 dark:border-zinc-600 rounded-lg bg-slate-50 dark:bg-zinc-800 dark:text-gray-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      <button onClick={() => setShowPrazoModal(true)}
                        className="h-10 px-3 text-xs font-medium border border-slate-200 dark:border-zinc-600 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-600 dark:text-gray-300">
                        Definir
                      </button>
                    </div>
                    {prazosArray.length > 0 ? (
                      <div className="mt-1 text-[10px] text-slate-400">
                        {prazosArray.map((p) => `${p.dias}d`).join(' / ')}
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Obs. Faturamento</label>
                    <input type="text" value={obsFat} onChange={(e) => setObsFat(e.target.value)}
                      className="w-full h-10 px-3 text-sm border border-slate-200 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                </div>
              </div>

              {/* Coluna direita — Informações adicionais */}
              <div className="border border-slate-200 dark:border-zinc-700 rounded-xl overflow-hidden flex flex-col">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800">
                  <FileText size={14} className="text-slate-500" />
                  <span className="text-sm font-bold text-slate-700 dark:text-gray-200">Informações Adicionais</span>
                </div>
                <div className="p-4 space-y-3 flex-1">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Pedido do Cliente</label>
                    <input type="text" value={pedido} onChange={(e) => setPedido(e.target.value)} placeholder="Nº pedido"
                      className="w-full h-10 px-3 text-sm border border-slate-200 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 mb-1 block">Observações</label>
                    <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={8} placeholder="Observações da venda..."
                      className="w-full min-h-[150px] px-3 py-2 text-sm border border-slate-200 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rodapé */}
        <div className="flex justify-between items-center px-6 py-3 border-t border-slate-200 dark:border-zinc-700">
          <span className="text-[10px] text-slate-400">Ctrl+L Liberar | Esc Fechar</span>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-zinc-600 text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-zinc-700">
              Cancelar
            </button>
            <button onClick={handleLiberar} disabled={saving || loading}
              className="px-6 py-2 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white flex items-center gap-2">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              Liberar Venda
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Prazos */}
      {showPrazoModal ? (
        <div className="fixed inset-0 z-[70] bg-black/40 flex justify-center items-center p-8">
          <ModalPrazoParcelas
            onClose={() => setShowPrazoModal(false)}
            onConfirm={handleConfirmPrazos}
            dadosIniciais={prazosArray.length > 0 ? prazosArray : undefined}
          />
        </div>
      ) : null}
    </div>
  );
};

export default ModalFinalizarVenda;

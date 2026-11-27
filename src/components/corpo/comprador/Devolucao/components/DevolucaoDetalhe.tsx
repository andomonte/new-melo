/**
 * Modal de detalhe de uma devolução de compra (fat_devolucao) — Faturamento › Devolução.
 * Devolução aberta do web: emitir a NF de devolução (ModalEmitirDevolucao), cancelar (fornecedor
 * completou / item aceito) ou gerar o pré-pedido quando o fornecedor não tinha cadastro de cliente.
 * Faturada sem NF autorizada: retransmitir. As devoluções do Delphi só são consultadas aqui.
 */

import React, { useState, useEffect, useContext, useCallback } from 'react';
import { X, Loader2, AlertTriangle, Printer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DefaultButton } from '@/components/common/Buttons';
import { AuthContext } from '@/contexts/authContexts';
import { useToast } from '@/hooks/use-toast';
import api from '@/components/services/api';
import { ModalEmitirDevolucao } from './ModalEmitirDevolucao';
import { MOTIVO_LABEL } from './ModalNovaDevolucao';

interface DevolucaoDetalheProps {
  isOpen: boolean;
  devolucaoId?: string;
  /** Abre a emissão da NF assim que a devolução carregar ("Salvar e emitir"). */
  abrirEmissao?: boolean;
  onClose: () => void;
}

interface DevolucaoItem {
  id: string;
  produto_cod: string;
  produto_nome: string;
  ref: string | null;
  qtd_esperada: number;
  qtd_devolucao: number;
  motivo: string | null;
  prunit: number | null;
  armazem: string | null;
  localizacao: string | null;
}

interface DevolucaoData {
  id: string;
  numero_entrada: string;
  fornecedor: string | null;
  cliente: string | null;
  codcli: string | null;
  nfe_numero: string | null;
  nfe_serie: string | null;
  status: 'ABERTA' | 'NF_PENDENTE' | 'FINALIZADA' | 'CANCELADA';
  origem: 'WEB' | 'ORACLE';
  programa: string | null;
  pedido: string | null;
  observacao: string | null;
  dev_codfat: string | null;
  dev_matricula: string | null;
  dev_nomeusr_cancel: string | null;
  dev_dt_cancel: string | null;
  created_at: string;
  itens: DevolucaoItem[];
  registros: { documento: string; codigo: string; nrovenda: string | null; venda_status: string | null }[];
  nf: { codfat: string; nroform: string; serie: string; totalnf: number; status: string | null; motivo: string | null; chave: string | null } | null;
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  ABERTA: { label: 'Aguardando emissão', variant: 'default' },
  NF_PENDENTE: { label: 'NF pendente (transmitir)', variant: 'destructive' },
  FINALIZADA: { label: 'NF emitida', variant: 'outline' },
  CANCELADA: { label: 'Cancelada', variant: 'destructive' },
};


const fmtDate = (d: string | null) => {
  if (!d) return '-';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};
const fmtQtd = (v: number) => {
  const num = parseFloat(String(v)) || 0;
  return num % 1 === 0 ? num.toString() : num.toFixed(2);
};
const fmtMoeda = (v: number | null) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const DevolucaoDetalhe: React.FC<DevolucaoDetalheProps> = ({ isOpen, devolucaoId, abrirEmissao, onClose }) => {
  const { user } = useContext(AuthContext);
  const { toast } = useToast();
  const [data, setData] = useState<DevolucaoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [executando, setExecutando] = useState(false);
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);
  const [confirmarEstorno, setConfirmarEstorno] = useState(false);
  const [codcli, setCodcli] = useState('');
  const [emitirAberto, setEmitirAberto] = useState(false);

  const usuarioLogado = (): string => {
    if (user?.usuario) return String(user.usuario);
    try {
      const perfil = JSON.parse(localStorage.getItem('perfilUserMelo') || 'null');
      if (perfil?.usuario) return String(perfil.usuario);
    } catch { /* ignora */ }
    return 'Sistema';
  };

  const carregar = useCallback(async () => {
    if (!devolucaoId) return;
    setLoading(true);
    try {
      const response = await api.get(`/api/devolucao/${devolucaoId}`);
      if (response.data?.success) setData(response.data.data);
    } catch (err) {
      console.error('Erro ao carregar devolução:', err);
    } finally {
      setLoading(false);
    }
  }, [devolucaoId]);

  useEffect(() => {
    setConfirmarCancelar(false);
    setCodcli('');
    if (!isOpen || !devolucaoId) {
      setData(null);
      return;
    }
    carregar();
  }, [isOpen, devolucaoId, carregar]);

  // "Salvar e emitir": abre a emissão uma vez, quando a devolução carregou aberta com pré-pedido
  const [emissaoAutoFeita, setEmissaoAutoFeita] = useState(false);
  useEffect(() => { setEmissaoAutoFeita(false); }, [devolucaoId]);
  useEffect(() => {
    if (!abrirEmissao || emissaoAutoFeita || !data || data.id !== devolucaoId) return;
    const pp = data.registros.find((r) => r.documento === 'VENDA');
    if (data.status === 'ABERTA' && data.origem === 'WEB' && pp?.venda_status === 'D') setEmitirAberto(true);
    setEmissaoAutoFeita(true);
  }, [abrirEmissao, emissaoAutoFeita, data, devolucaoId]);

  if (!isOpen) return null;

  const executar = async (acao: 'cancelar' | 'gerar-prepedido' | 'estornar-faturamento') => {
    if (!data) return;
    setExecutando(true);
    try {
      const r = await api.post('/api/devolucao/acao', {
        devId: data.id, acao, codcli: codcli.trim() || undefined, username: usuarioLogado(),
      });
      toast({ title: r.data?.message || 'Feito' });
      setConfirmarCancelar(false);
      setConfirmarEstorno(false);
      await carregar();
    } catch (err: any) {
      toast({ title: 'Não foi possível concluir', description: err?.response?.data?.message || err.message, variant: 'destructive' });
    } finally {
      setExecutando(false);
    }
  };

  const transmitir = async () => {
    if (!data) return;
    setExecutando(true);
    try {
      const r = await api.post('/api/devolucao/transmitir', { devId: data.id });
      toast({ title: r.data?.success ? 'NF autorizada' : 'NF não autorizada', description: r.data?.message, variant: r.data?.success ? 'default' : 'destructive' });
      await carregar();
    } catch (err: any) {
      toast({ title: 'Não foi possível transmitir', description: err?.response?.data?.message || err.message, variant: 'destructive' });
    } finally {
      setExecutando(false);
    }
  };

  const statusInfo = data ? STATUS_MAP[data.status] : null;
  const prePedido = data?.registros.find((r) => r.documento === 'VENDA');
  const abertaWeb = data?.status === 'ABERTA' && data.origem === 'WEB';
  const nfPendente = data?.status === 'NF_PENDENTE';
  const manual = data?.programa === 'WEB MANUAL';

  // Lista de separação (itens a retirar da prateleira para devolver ao fornecedor)
  const imprimirLista = () => {
    if (!data) return;
    const esc = (v: any) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
    const linhas = data.itens.map((i) => `<tr><td>${esc(i.ref || i.produto_cod)}</td><td>${esc(i.produto_cod)}</td><td>${esc(i.produto_nome)}</td>
      <td>${esc(i.armazem || '')}</td><td>${esc(i.localizacao || '')}</td><td class="n">${fmtQtd(i.qtd_devolucao)}</td>
      <td>${esc(MOTIVO_LABEL[i.motivo || ''] || i.motivo || '')}</td><td class="c">[&nbsp;&nbsp;]</td></tr>`).join('');
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Devolução ${esc(data.id)}</title>
      <style>body{font-family:Arial,sans-serif;font-size:12px;margin:16px}h1{font-size:16px;margin:0 0 4px}
      table{border-collapse:collapse;width:100%;margin-top:10px}th,td{border:1px solid #999;padding:4px}th{background:#eee}
      .n{text-align:right}.c{text-align:center}.ass{margin-top:40px;display:flex;gap:60px}.ass div{border-top:1px solid #000;padding-top:2px;width:240px}</style>
      </head><body><h1>Separação para devolução ao fornecedor · ${esc(data.id)}</h1>
      <div>Fornecedor: ${esc(data.fornecedor || '-')} · Entrada ${esc(data.numero_entrada)} · NF ${esc(data.nfe_numero || '-')}
      ${prePedido ? ` · Pré-pedido ${esc(prePedido.nrovenda || prePedido.codigo)}` : ''}</div>
      <div>Emitido em ${new Date().toLocaleString('pt-BR')}</div>
      <table><thead><tr><th>Ref.</th><th>Código</th><th>Descrição</th><th>Armazém</th><th>Localização</th><th>Qtd</th><th>Motivo</th><th>OK</th></tr></thead>
      <tbody>${linhas}</tbody></table>
      <div class="ass"><div>Separado por</div><div>Conferido por</div></div>
      <script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  };

  const total = data?.itens.reduce((s, i) => s + Number(i.qtd_devolucao) * Number(i.prunit || 0), 0) ?? 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-2">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-5xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-700">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Devolução {data?.id || devolucaoId}
            </h2>
            {statusInfo && <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>}
            {data && <Badge variant={data.origem === 'WEB' ? 'secondary' : 'outline'}>{data.origem === 'WEB' ? (manual ? 'Web · manual' : 'Web · alocação') : 'Delphi'}</Badge>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600 dark:text-gray-400">Carregando...</span>
            </div>
          ) : data ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <Info rotulo="Fornecedor" valor={data.fornecedor} />
                <Info rotulo="Cliente da devolução" valor={data.codcli ? `${data.codcli} · ${data.cliente || ''}` : null} />
                <Info rotulo="NF de entrada" valor={data.nfe_numero ? `${data.nfe_numero}${data.nfe_serie ? `/${data.nfe_serie}` : ''}` : null} />
                <Info rotulo="Nº Entrada" valor={data.numero_entrada} />
                <Info rotulo="Data" valor={fmtDate(data.created_at)} />
                <Info rotulo="Pré-pedido" valor={prePedido ? `${prePedido.nrovenda || prePedido.codigo}${prePedido.venda_status === 'C' ? ' (cancelado)' : ''}` : null} />
                <Info
                  rotulo="NF de devolução"
                  valor={data.nf
                    ? `${Number(data.nf.nroform)}/${data.nf.serie} · fatura ${data.nf.codfat} · ${data.nf.status === '100' ? 'autorizada' : data.nf.status ? `não autorizada (${data.nf.status})` : 'não transmitida'}`
                    : data.dev_codfat}
                />
                <Info rotulo="Observação" valor={`${data.observacao || ''}${data.pedido ? ` · pedido ${data.pedido}` : ''}`} />
              </div>

              {nfPendente && (
                <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/30 p-3 text-sm text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  A fatura foi gravada, mas a NF não foi autorizada{data.nf?.motivo ? `: ${data.nf.motivo}` : ''}.
                </div>
              )}
              {data.status === 'CANCELADA' && data.dev_dt_cancel && (
                <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                  Cancelada por {data.dev_nomeusr_cancel || '-'} em {fmtDate(data.dev_dt_cancel)}.
                </p>
              )}
              {abertaWeb && !prePedido && (
                <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-700 p-3 text-sm text-amber-900 dark:text-amber-200 flex flex-wrap items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>O fornecedor não tem cadastro de cliente: o pré-pedido não foi gerado. Informe o cliente (ou cadastre-o) e gere o pré-pedido.</span>
                  <input
                    value={codcli}
                    onChange={(e) => setCodcli(e.target.value)}
                    placeholder="Cód. cliente"
                    className="w-32 px-2 py-1 border rounded dark:bg-zinc-700 dark:border-zinc-600"
                  />
                  <DefaultButton text="Gerar pré-pedido" size="sm" disabled={executando} onClick={() => executar('gerar-prepedido')} />
                </div>
              )}

              <div className="border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-zinc-700">
                      <th className="px-3 py-2 text-left">Produto</th>
                      <th className="px-3 py-2 text-left">Armazém / local</th>
                      <th className="px-3 py-2 text-center">Qtd na nota</th>
                      <th className="px-3 py-2 text-center">Qtd devolução</th>
                      <th className="px-3 py-2 text-center">Motivo</th>
                      <th className="px-3 py-2 text-right">Preço NF</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.itens.map((item) => (
                      <tr key={item.id} className="border-t border-gray-200 dark:border-zinc-700">
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{item.produto_cod}{item.ref ? ` · ${item.ref}` : ''}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[320px]">{item.produto_nome}</div>
                        </td>
                        <td className="px-3 py-2 text-xs">{item.armazem || '-'}{item.localizacao ? ` · ${item.localizacao}` : ''}</td>
                        <td className="px-3 py-2 text-center">{fmtQtd(item.qtd_esperada)}</td>
                        <td className="px-3 py-2 text-center font-medium text-red-600 dark:text-red-400">{fmtQtd(item.qtd_devolucao)}</td>
                        <td className="px-3 py-2 text-center">
                          {item.motivo ? <Badge variant="secondary">{MOTIVO_LABEL[item.motivo] || item.motivo}</Badge> : '-'}
                        </td>
                        <td className="px-3 py-2 text-right">{item.prunit != null ? fmtMoeda(item.prunit) : '-'}</td>
                        <td className="px-3 py-2 text-right">{item.prunit != null ? fmtMoeda(Number(item.qtd_devolucao) * Number(item.prunit)) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  {total > 0 && (
                    <tfoot>
                      <tr className="border-t border-gray-300 dark:border-zinc-600 font-semibold">
                        <td className="px-3 py-2" colSpan={6}>Total da devolução</td>
                        <td className="px-3 py-2 text-right">{fmtMoeda(total)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {nfPendente && confirmarEstorno && (
                <div className="mt-4 rounded-md border border-red-300 bg-red-50 dark:bg-red-900/30 dark:border-red-700 p-3 text-sm text-red-900 dark:text-red-200">
                  Estornar o faturamento? A fatura {data.nf?.codfat} e o título a receber são cancelados, os itens voltam a ficar
                  reservados para a devolução e ela volta para <strong>aguardando emissão</strong> (dá para corrigir e emitir de novo,
                  com o mesmo número de NF, ou cancelar). Use só quando a NF foi <strong>rejeitada ou não transmitida</strong>; se houve
                  erro de comunicação com a SEFAZ, tente &ldquo;Transmitir NF&rdquo; antes.
                  <div className="mt-2 flex gap-2">
                    <DefaultButton text="Sim, estornar faturamento" size="sm" variant="destructive" disabled={executando} onClick={() => executar('estornar-faturamento')} />
                    <DefaultButton text="Voltar" size="sm" variant="secondary" disabled={executando} onClick={() => setConfirmarEstorno(false)} />
                  </div>
                </div>
              )}
              {abertaWeb && confirmarCancelar && (
                <div className="mt-4 rounded-md border border-red-300 bg-red-50 dark:bg-red-900/30 dark:border-red-700 p-3 text-sm text-red-900 dark:text-red-200">
                  {manual ? (
                    <>Cancelar a devolução? A reserva acaba e os itens voltam a ficar <strong>disponíveis para venda</strong> no
                    armazém de origem; o pré-pedido é cancelado.</>
                  ) : (
                    <>Cancelar a devolução? A quantidade sai do armazém DEVOLUCAO/FALTA, entra no GERAL e fica
                    <strong> disponível para venda</strong>; o pré-pedido é cancelado. Use quando o fornecedor completou a entrega ou o item foi aceito.</>
                  )}
                  <div className="mt-2 flex gap-2">
                    <DefaultButton text="Sim, cancelar devolução" size="sm" variant="destructive" disabled={executando} onClick={() => executar('cancelar')} />
                    <DefaultButton text="Voltar" size="sm" variant="secondary" disabled={executando} onClick={() => setConfirmarCancelar(false)} />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-10 text-gray-500">Devolução não encontrada.</div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-zinc-700 flex justify-end gap-2">
          {data && data.itens.length > 0 && data.status !== 'CANCELADA' && (
            <DefaultButton text="Lista de separação" size="sm" variant="secondary" icon={<Printer className="w-4 h-4" />} onClick={imprimirLista} />
          )}
          {abertaWeb && prePedido && prePedido.venda_status === 'D' && (
            <DefaultButton text="Emitir NF de devolução" size="sm" disabled={executando} onClick={() => setEmitirAberto(true)} />
          )}
          {nfPendente && (
            <DefaultButton text={executando ? 'Transmitindo...' : 'Transmitir NF'} size="sm" disabled={executando} onClick={transmitir} />
          )}
          {nfPendente && (
            <DefaultButton text="Estornar faturamento" size="sm" variant="destructive" disabled={executando} onClick={() => setConfirmarEstorno(true)} />
          )}
          {abertaWeb && (
            <DefaultButton text="Cancelar devolução" size="sm" variant="destructive" disabled={executando} onClick={() => setConfirmarCancelar(true)} />
          )}
          <DefaultButton text="Fechar" size="sm" variant="secondary" onClick={onClose} />
        </div>
      </div>
      {emitirAberto && data && (
        <ModalEmitirDevolucao
          devId={data.id}
          usuario={usuarioLogado()}
          onClose={() => setEmitirAberto(false)}
          onDone={() => { setEmitirAberto(false); carregar(); }}
        />
      )}
    </div>
  );
};

const Info: React.FC<{ rotulo: string; valor: string | null | undefined }> = ({ rotulo, valor }) => (
  <div>
    <span className="text-xs text-gray-500 dark:text-gray-400">{rotulo}</span>
    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 break-words">{valor || '-'}</p>
  </div>
);

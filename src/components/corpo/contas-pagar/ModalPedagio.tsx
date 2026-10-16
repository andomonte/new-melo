'use client';

/**
 * Modal dedicado "Lançar Pedágio" — fluxo rápido para os pedágios de um fornecedor
 * no dia (ex.: R$ 100,00 pagos em dinheiro divididos em 5 pedágios).
 *
 * - Pré-preenche (EDITÁVEL): Fornecedor 01558 (Pedágio), Conta Financeira 10
 *   (Pedágios/Transportadora), Conta 27 (Dinheiro).
 * - Parcelas por VALOR: ao informar a quantidade, divide o total (resto na 1ª);
 *   cada valor é editável, mas a SOMA precisa fechar com o total.
 * - TODAS as parcelas vencem na DATA DE EMISSÃO.
 * - Ao salvar, chama onCriado(codPgtos) — o pai abre o Pagamento em Lote com esses
 *   títulos selecionados, para o usuário decidir quais pagar.
 */

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Modal from '@/components/common/Modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Autocomplete } from '@/components/common/Autocomplete';
import { mascaraInputBRL, desmascarar, formatarDecimalBR } from '@/utils/monetario';

const DEFAULTS = {
  credor: { value: '01558', label: '01558 - PEDAGIO' },
  contaFin: { value: '10', label: '10 - PEDAGIOS (TRANSPORTADORA)' },
  conta: { value: '27', label: '27 - DINHEIRO' },
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const hojeIso = () => new Date().toISOString().split('T')[0];
const fmtBR = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** cod_pgtos dos títulos criados — o pai abre o Pagamento em Lote com eles. */
  onCriado: (codPgtos: string[]) => void;
}

export default function ModalPedagio({ isOpen, onClose, onCriado }: Props) {
  const [resetKey, setResetKey] = useState(0);
  const [credor, setCredor] = useState(DEFAULTS.credor.value);
  const [contaFin, setContaFin] = useState(DEFAULTS.contaFin.value);
  const [conta, setConta] = useState(DEFAULTS.conta.value);
  const [comprador, setComprador] = useState('');
  const [nroNf, setNroNf] = useState('');
  const [dtEmissao, setDtEmissao] = useState(hojeIso());
  const [valorTotal, setValorTotal] = useState('');
  const [qtd, setQtd] = useState('');
  const [nroDup, setNroDup] = useState('');
  const [obs, setObs] = useState('');
  const [parcelas, setParcelas] = useState<number[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setResetKey((k) => k + 1);
    setCredor(DEFAULTS.credor.value);
    setContaFin(DEFAULTS.contaFin.value);
    setConta(DEFAULTS.conta.value);
    setComprador('');
    setNroNf('');
    setDtEmissao(hojeIso());
    setValorTotal('');
    setQtd('');
    setNroDup('');
    setObs('');
    setParcelas([]);
  }, [isOpen]);

  const totalNum = r2(desmascarar(valorTotal) || 0);
  const soma = r2(parcelas.reduce((a, p) => a + (p || 0), 0));
  const restante = r2(totalNum - soma);
  const fecha = parcelas.length > 0 && Math.abs(restante) < 0.01;

  const gerarParcelas = () => {
    const n = parseInt(qtd, 10) || 0;
    if (n < 1) return toast.error('Informe a quantidade de parcelas.');
    if (totalNum <= 0) return toast.error('Informe o valor total.');
    const base = Math.floor((totalNum / n) * 100) / 100;
    const resto = r2(totalNum - base * n);
    setParcelas(Array.from({ length: n }, (_, i) => (i === 0 ? r2(base + resto) : base)));
  };

  const setValorParcela = (i: number, num: number) => {
    setParcelas((prev) => prev.map((p, idx) => (idx === i ? r2(num) : p)));
  };

  const salvar = async () => {
    if (!credor) return toast.error('Informe o fornecedor.');
    if (!conta) return toast.error('Informe a conta.');
    if (totalNum <= 0) return toast.error('Informe o valor total.');
    if (parcelas.length === 0) return toast.error('Informe a quantidade e clique em "Gerar Parcelas".');
    if (!fecha) return toast.error(`A soma das parcelas (R$ ${fmtBR(soma)}) deve fechar com o total (R$ ${fmtBR(totalNum)}).`);

    setSalvando(true);
    try {
      const resp = await fetch('/api/contas-pagar/criar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'F',
          cod_credor: credor,
          pag_cof_id: contaFin || null,
          cod_conta: conta || null,
          cod_comprador: comprador || null,
          dt_emissao: dtEmissao,
          dt_venc: dtEmissao,
          valor_pgto: totalNum,
          nro_nf: nroNf || undefined,
          tem_nota: !!nroNf, // boolean: 'N' string seria truthy no backend
          tem_cobr: false, // pedágio em dinheiro: sem cobrança/boleto
          nro_dup: nroDup || undefined,
          obs,
          parcelado: true, // cria N títulos (um por pedágio), todos na data de emissão
          parcelas: parcelas.map((v) => ({ valor: v, vencimento: dtEmissao })),
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.sucesso) throw new Error(data.erro || 'Erro ao lançar os pedágios');
      const codPgtos = (data.contas || []).map((c: any) => String(c.cod_pgto)).filter(Boolean);
      toast.success(`${codPgtos.length} pedágio(s) lançado(s).`);
      onCriado(codPgtos);
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao lançar os pedágios');
    } finally {
      setSalvando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Lançar Pedágio" width="w-[94%] max-w-4xl">
      <div className="space-y-4">
        {/* Identificação (pré-preenchida, editável) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="min-w-0">
            <Label>Fornecedor *</Label>
            <Autocomplete
              resetKey={resetKey}
              placeholder="Buscar fornecedor..."
              apiUrl="/api/contas-pagar/fornecedores"
              value={credor}
              initialLabel={DEFAULTS.credor.label}
              onChange={(v) => setCredor(v)}
              mapResponse={(data: any) => data.fornecedores || []}
            />
          </div>
          <div className="min-w-0">
            <Label>Conta Financeira *</Label>
            <Autocomplete
              resetKey={resetKey}
              placeholder="Buscar conta financeira..."
              apiUrl="/api/contas-pagar/contas"
              value={contaFin}
              initialLabel={DEFAULTS.contaFin.label}
              onChange={(v) => setContaFin(v)}
              mapResponse={(data: any) => data.contas || []}
            />
          </div>
          <div className="min-w-0">
            <Label>Conta *</Label>
            <Autocomplete
              resetKey={resetKey}
              placeholder="Buscar conta..."
              apiUrl="/api/contas-pagar/contas-dbconta"
              value={conta}
              initialLabel={DEFAULTS.conta.label}
              onChange={(v) => setConta(v)}
              mapResponse={(data: any) => data.contas || []}
            />
          </div>
          <div className="min-w-0">
            <Label>Comprador</Label>
            <Autocomplete
              resetKey={resetKey}
              placeholder="Buscar..."
              apiUrl="/api/contas-pagar/compradores"
              value={comprador}
              onChange={(v) => setComprador(v)}
              mapResponse={(data: any) => data.compradores || []}
            />
          </div>
        </div>

        {/* Valores, datas e documentos (5 colunas) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="min-w-0">
            <Label>Data de Emissão *</Label>
            <Input type="date" value={dtEmissao} onChange={(e) => setDtEmissao(e.target.value)} className="w-full mt-1" />
          </div>
          <div className="min-w-0">
            <Label>Valor Total *</Label>
            <Input
              inputMode="decimal"
              value={valorTotal}
              onChange={(e) => setValorTotal(mascaraInputBRL(e.target.value))}
              placeholder="0,00"
              className="w-full mt-1 text-right font-mono"
            />
          </div>
          <div className="min-w-0">
            <Label>Qtd. Pedágios *</Label>
            <Input
              inputMode="numeric"
              value={qtd}
              onChange={(e) => setQtd(e.target.value.replace(/\D/g, ''))}
              placeholder="ex: 5"
              className="w-full mt-1"
            />
          </div>
          <div className="min-w-0">
            <Label>Nº da Duplicata</Label>
            <Input value={nroDup} onChange={(e) => setNroDup(e.target.value)} placeholder="opcional" className="w-full mt-1" />
          </div>
          <div className="min-w-0">
            <Label>Nº da NF</Label>
            <Input value={nroNf} onChange={(e) => setNroNf(e.target.value)} placeholder="opcional" className="w-full mt-1" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={gerarParcelas}
            className="px-3 py-1.5 text-sm rounded bg-[#347AB6] hover:bg-[#2a5f8f] text-white"
          >
            Gerar Parcelas
          </button>
          <button
            type="button"
            onClick={() => setParcelas([])}
            className="px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-700"
          >
            Limpar
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Divide o total pela quantidade; todas vencem na data de emissão. Ajuste os valores se precisar.
          </span>
        </div>

        {/* Parcelas geradas */}
        {parcelas.length > 0 && (
          <div className="rounded-lg border border-gray-200 dark:border-zinc-700 p-3">
            <div className="flex items-center justify-between mb-2 text-xs">
              <span className="font-semibold text-gray-700 dark:text-gray-200">Pedágios ({parcelas.length})</span>
              <span className={fecha ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                Soma R$ {fmtBR(soma)} / Total R$ {fmtBR(totalNum)}
                {!fecha && ` · faltam R$ ${fmtBR(restante)}`}
                {fecha && ' ✓'}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {parcelas.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-16 shrink-0">Pedágio {i + 1}</span>
                  <Input
                    inputMode="decimal"
                    value={formatarDecimalBR(v)}
                    onChange={(e) => setValorParcela(i, desmascarar(mascaraInputBRL(e.target.value)))}
                    className="w-full h-8 font-mono text-right"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <Label>Observações</Label>
          <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Observações (opcional)..." className="mt-1" />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-zinc-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded border border-gray-300 dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || !fecha}
            className="px-4 py-2 text-sm rounded bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
          >
            {salvando ? 'Lançando...' : `Lançar ${parcelas.length || ''} pedágio(s) e pagar`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

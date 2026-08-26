import React, { useEffect, useState } from 'react';
import FormInput from '@/components/common/FormInput';
import SelectInput from '@/components/common/SelectPadrao';
import SecaoCollapse from '@/components/common/SecaoCollapse';
import { FaMoneyBill } from 'react-icons/fa6';
import { FileSymlink } from 'lucide-react';
import { TrashIcon } from '@radix-ui/react-icons';
import { toast } from 'sonner';
import { useConfirmarSalvar } from '@/hooks/useConfirmarSalvar';
import {
  carregarFeriados,
  getProximoDiaUtil,
} from '@/components/corpo/vendas/novaVenda/prazo';
import { mascaraInputBRL, desmascarar } from '@/utils/monetario';

interface Banco {
  banco: string;
  nome: string;
}

interface Parcela {
  dias: number;
  vencimento: string; // yyyy-MM-dd
  valor: number;
}

interface FormCobranca {
  banco: string;
  tipoFatura: string;
  prazoSelecionado: string;
  valorVista: string;
  habilitarValor: boolean;
  impostoNa1Parcela: boolean;
  freteNa1Parcela: boolean;
  diferenciada?: boolean;
}

interface Props {
  statusVenda: { cobranca: string };
  bancos: Banco[];
  formCobranca: FormCobranca;
  setFormCobranca: React.Dispatch<React.SetStateAction<FormCobranca>>;
  parcelas: Parcela[];
  setParcelas: React.Dispatch<React.SetStateAction<Parcela[]>>;
  opcoesTipoFatura: { value: string; label: string }[];
  /** Valor total da nota/fatura — base para dividir o valor das parcelas. */
  totalNota?: number;
  /** Soma dos impostos das faturas — usado quando "Cobrar impostos na 1ª parcela". */
  impostosTotal?: number;
  /** Soma do frete das faturas — usado quando "Cobrar frete na 1ª parcela". */
  freteTotal?: number;
  onGerarPreviewBoleto?: () => void;
  /** Botão(ões) renderizado(s) no rodapé do card (onde ficava o preview do boleto). */
  botaoRodape?: React.ReactNode;
  padraoAberto?: boolean;
}

const fmtLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;

const money = (n: number) =>
  Number(n || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function DadosCobranca({
  statusVenda,
  bancos,
  formCobranca,
  setFormCobranca,
  parcelas,
  setParcelas,
  opcoesTipoFatura,
  totalNota = 0,
  impostosTotal = 0,
  freteTotal = 0,
  onGerarPreviewBoleto,
  botaoRodape,
  padraoAberto = true,
}: Props) {
  // Intervalo + quantidade (mesmo mecanismo da tela de faturar V2).
  const [intervaloDias, setIntervaloDias] = useState<string>('30');
  const [qtdParcelas, setQtdParcelas] = useState<string>('');
  const { pedirConfirmacao, ConfirmacaoSalvarModal } = useConfirmarSalvar();

  // Carrega feriados (para o ajuste de dia útil de getProximoDiaUtil).
  useEffect(() => {
    const ano = new Date().getFullYear();
    carregarFeriados(ano);
    carregarFeriados(ano + 1);
  }, []);

  // Default do banco = 1º da lista (banco do cliente) quando o atual não é válido.
  useEffect(() => {
    if (!bancos || bancos.length === 0) return;
    if (!bancos.some((b) => b.banco === formCobranca.banco)) {
      setFormCobranca((prev) => ({ ...prev, banco: bancos[0].banco }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bancos]);

  const handleCobrancaChange = (field: keyof FormCobranca, value: any) => {
    setFormCobranca((prev) => ({ ...prev, [field]: value }));
  };

  // Parcelas são geradas para BOLETO (e variantes) e CARTEIRA — ambos parcelam o título.
  const permiteParcelas =
    formCobranca.tipoFatura === 'BOLETO' ||
    formCobranca.tipoFatura === 'BOLETO BANCARIO' ||
    formCobranca.tipoFatura === 'BOLETO BANCÁRIO' ||
    formCobranca.tipoFatura === 'CARTEIRA';

  // Gera N parcelas: intervalo acumulado, ajustando p/ dia útil, e divide o
  // total da nota igualmente (a última parcela absorve o arredondamento).
  const gerarParcelas = () => {
    const prazo = parseInt(intervaloDias) || 0;
    const qtd = parseInt(qtdParcelas) || 0;
    if (prazo <= 0 || qtd <= 0) {
      toast.error('Informe um intervalo e uma quantidade válidos.');
      return;
    }
    // Limita o parcelamento a no máximo 12 meses a contar de hoje. Valida ANTES de gerar
    // e informa o usuário (a última parcela não pode passar de hoje + 12 meses).
    const hoje = new Date();
    const limite12m = new Date(hoje);
    limite12m.setMonth(limite12m.getMonth() + 12);
    const ultimoVencRaw = new Date(hoje.getTime());
    ultimoVencRaw.setDate(ultimoVencRaw.getDate() + prazo * qtd);
    const ultimoVenc = getProximoDiaUtil(ultimoVencRaw);
    if (ultimoVenc.getTime() > limite12m.getTime()) {
      const br = (d: Date) => d.toLocaleDateString('pt-BR');
      pedirConfirmacao(() => {}, {
        title: 'Parcelamento acima de 12 meses',
        message: `Com ${qtd} parcela(s) a cada ${prazo} dia(s), a última venceria em ${br(
          ultimoVenc,
        )}, ultrapassando o limite de 12 meses (${br(
          limite12m,
        )}). Reduza a quantidade de parcelas ou o intervalo de dias.`,
        type: 'warning',
        confirmText: 'Entendi',
        somenteOk: true,
      });
      return;
    }
    // Valor de entrada (à vista) — subtrai do total ANTES de dividir nas parcelas.
    const entrada = formCobranca.habilitarValor
      ? desmascarar(String(formCobranca.valorVista ?? '')) || 0
      : 0;
    // Impostos/frete "na 1ª parcela": em vez de diluir, concentram na parcela 1.
    const extra1a =
      (formCobranca.impostoNa1Parcela ? Number(impostosTotal) || 0 : 0) +
      (formCobranca.freteNa1Parcela ? Number(freteTotal) || 0 : 0);
    // Base parcelável = total − entrada − (o que vai concentrado na 1ª).
    const total = Math.max(0, (Number(totalNota) || 0) - entrada);
    const parcelavel = Math.max(0, total - extra1a);
    const valorBase = Math.floor((parcelavel / qtd) * 100) / 100;
    const base = new Date();
    const novas: Parcela[] = [];
    let acum = 0;
    for (let i = 0; i < qtd; i++) {
      acum += prazo;
      const venc = new Date(base.getTime());
      venc.setDate(venc.getDate() + acum);
      const util = getProximoDiaUtil(venc);
      // Resto do arredondamento na ÚLTIMA parcela; extra (impostos/frete) na 1ª.
      const baseI =
        i === qtd - 1 ? parcelavel - valorBase * (qtd - 1) : valorBase;
      const valor = Number((baseI + (i === 0 ? extra1a : 0)).toFixed(2));
      novas.push({ dias: acum, vencimento: fmtLocal(util), valor });
    }
    setParcelas(novas);
  };

  const atualizarVencimento = (idx: number, isoDate: string) => {
    if (!isoDate) return;
    const d = new Date(isoDate + 'T00:00:00');
    if (isNaN(d.getTime())) return;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (d <= hoje) {
      toast.error('O vencimento deve ser maior que a data de hoje.');
      return;
    }
    const util = getProximoDiaUtil(d);
    const novosDias = Math.ceil(
      (util.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24),
    );
    setParcelas((prev) =>
      prev.map((p, i) =>
        i === idx ? { ...p, vencimento: fmtLocal(util), dias: novosDias } : p,
      ),
    );
  };

  // Editar pela quantidade de DIAS (recalcula o vencimento = hoje + dias, dia útil).
  const atualizarDias = (idx: number, diasStr: string) => {
    const dias = parseInt(diasStr, 10);
    if (isNaN(dias) || dias <= 0) {
      setParcelas((prev) => prev.map((p, i) => (i === idx ? { ...p, dias: 0 } : p)));
      return;
    }
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    base.setDate(base.getDate() + dias);
    const util = getProximoDiaUtil(base);
    setParcelas((prev) =>
      prev.map((p, i) =>
        i === idx ? { ...p, dias, vencimento: fmtLocal(util) } : p,
      ),
    );
  };

  const removerParcela = (idx: number) => {
    setParcelas((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalParcelas = parcelas.reduce((s, p) => s + Number(p.valor || 0), 0);

  if (statusVenda.cobranca !== 'S') return null;

  return (
    <>
    <SecaoCollapse
      titulo="DADOS DE COBRANÇA"
      icone={<FaMoneyBill />}
      padraoAberto={padraoAberto}
    >
      <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-4">
        <fieldset className="col-span-1 border-2 border-zinc-200 dark:border-zinc-700 rounded-lg p-3 space-y-2.5">
          <legend className="text-sm font-semibold px-2">
            Configurações da Cobrança
          </legend>
          <div>
            <label className="block text-sm font-medium mb-1">Banco</label>
            <SelectInput
              name="banco"
              value={formCobranca.banco}
              onValueChange={(v) => handleCobrancaChange('banco', v)}
              options={bancos.map((b) => ({
                value: b.banco,
                label: b.nome,
              }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Tipo de Fatura/Documento
            </label>
            <SelectInput
              name="tipoFatura"
              value={formCobranca.tipoFatura}
              onValueChange={(v) => handleCobrancaChange('tipoFatura', v)}
              options={opcoesTipoFatura}
              disabled={!formCobranca.banco}
            />
          </div>
          <div className="space-y-2 pt-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formCobranca.habilitarValor}
                onChange={(e) =>
                  handleCobrancaChange('habilitarValor', e.target.checked)
                }
              />{' '}
              Habilitar valor de entrada
            </label>
            {formCobranca.habilitarValor && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  Valor de Entrada (R$)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0,00"
                  value={formCobranca.valorVista}
                  onChange={(e) => {
                    const masked = mascaraInputBRL(e.target.value);
                    const valor = desmascarar(masked);
                    const total = Number(totalNota) || 0;
                    if (valor > total) {
                      toast.error(
                        'O valor de entrada não pode ser maior que o total a pagar.',
                      );
                      // Trava no total (não deixa passar).
                      handleCobrancaChange(
                        'valorVista',
                        mascaraInputBRL(String(Math.round(total * 100))),
                      );
                      return;
                    }
                    handleCobrancaChange('valorVista', masked);
                  }}
                  className="w-full h-9 px-3 text-sm text-right font-mono tabular-nums rounded border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white outline-none focus:border-blue-500"
                />
              </div>
            )}
          </div>
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700 space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!formCobranca.impostoNa1Parcela}
                onChange={(e) =>
                  handleCobrancaChange('impostoNa1Parcela', e.target.checked)
                }
              />
              Cobrar impostos na 1ª parcela
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!formCobranca.freteNa1Parcela}
                onChange={(e) =>
                  handleCobrancaChange('freteNa1Parcela', e.target.checked)
                }
              />
              Cobrar frete na 1ª parcela
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!formCobranca.diferenciada}
                onChange={(e) =>
                  handleCobrancaChange('diferenciada', e.target.checked)
                }
              />
              Comissão diferenciada
            </label>
          </div>
        </fieldset>

        <fieldset
          className={`col-span-1 border-2 rounded-lg p-3 flex flex-col ${
            !permiteParcelas
              ? 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 opacity-70'
              : 'border-zinc-200 dark:border-zinc-700'
          }`}
          disabled={!permiteParcelas}
        >
          <legend className="text-sm font-semibold px-2">
            Prazo e Parcelas
          </legend>

          <div>
            {/* Intervalo + Quantidade → Gerar parcelas (mecanismo do faturar) */}
            <div className="grid grid-cols-2 gap-2 items-end">
              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${
                    !permiteParcelas ? 'text-gray-500 dark:text-gray-400' : ''
                  }`}
                >
                  Intervalo de dias
                </label>
                <FormInput
                  name="intervaloDias"
                  type="number"
                  value={intervaloDias}
                  onChange={(e) => setIntervaloDias(e.target.value)}
                  placeholder="Ex: 30"
                  disabled={!permiteParcelas}
                />
              </div>
              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${
                    !permiteParcelas ? 'text-gray-500 dark:text-gray-400' : ''
                  }`}
                >
                  Quantidade (vezes)
                </label>
                <FormInput
                  name="qtdParcelas"
                  type="number"
                  value={qtdParcelas}
                  onChange={(e) => setQtdParcelas(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      gerarParcelas();
                    }
                  }}
                  placeholder="Ex: 3"
                  disabled={!permiteParcelas}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={gerarParcelas}
              className={`mt-2 h-9 w-full px-4 rounded text-sm font-medium ${
                !permiteParcelas
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
              disabled={!permiteParcelas}
            >
              + Gerar parcelas
            </button>

            <div className="mt-3 h-44 overflow-y-auto rounded bg-gray-100 dark:bg-zinc-800">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-200 dark:bg-zinc-700">
                  <tr>
                    <th className="px-2 py-1 text-left">Parcela</th>
                    <th className="px-2 py-1 text-center">Dias</th>
                    <th className="px-2 py-1 text-left">Vencimento</th>
                    <th className="px-2 py-1 text-right">Valor</th>
                    <th className="px-2 py-1 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {parcelas.map((p, i) => (
                    <tr
                      key={i}
                      className="border-b border-gray-200 dark:border-zinc-700"
                    >
                      <td className="px-2 py-1">{i + 1}</td>
                      <td className="px-2 py-1 text-center">
                        <input
                          type="number"
                          min={1}
                          value={p.dias}
                          onChange={(e) => atualizarDias(i, e.target.value)}
                          className={`w-14 text-xs text-center px-1 py-0.5 border rounded ${
                            !permiteParcelas
                              ? 'bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-600 text-gray-500 cursor-not-allowed'
                              : 'bg-white dark:bg-zinc-900 border-gray-300 dark:border-zinc-700 text-black dark:text-white'
                          }`}
                          disabled={!permiteParcelas}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="date"
                          value={p.vencimento}
                          onChange={(e) =>
                            atualizarVencimento(i, e.target.value)
                          }
                          className={`text-xs px-1 py-0.5 border rounded ${
                            !permiteParcelas
                              ? 'bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-600 text-gray-500 cursor-not-allowed'
                              : 'bg-white dark:bg-zinc-900 border-gray-300 dark:border-zinc-700 text-black dark:text-white'
                          }`}
                          disabled={!permiteParcelas}
                        />
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        R$ {money(p.valor)}
                      </td>
                      <td className="px-2 py-1 text-center">
                        <button
                          type="button"
                          onClick={() => removerParcela(i)}
                          className={`${
                            !permiteParcelas
                              ? 'text-gray-400 cursor-not-allowed'
                              : 'text-red-500 hover:text-red-700'
                          }`}
                          disabled={!permiteParcelas}
                        >
                          <TrashIcon />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {parcelas.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-2 py-4 text-center text-gray-500"
                      >
                        Sem parcelas. Informe intervalo + quantidade e clique em
                        "Gerar parcelas".
                      </td>
                    </tr>
                  )}
                </tbody>
                {parcelas.length > 0 && (
                  <tfoot>
                    <tr className="font-semibold bg-gray-200 dark:bg-zinc-700">
                      <td className="px-2 py-1 text-left" colSpan={3}>
                        Total
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        R$ {money(totalParcelas)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {onGerarPreviewBoleto && (
            <div className="mt-4">
              <button
                type="button"
                onClick={onGerarPreviewBoleto}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md ${
                  !permiteParcelas
                    ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
                disabled={!permiteParcelas}
              >
                <FileSymlink size={16} /> Gerar Preview do Boleto
              </button>
            </div>
          )}

          {botaoRodape && <div className="mt-4">{botaoRodape}</div>}
        </fieldset>
      </div>
    </SecaoCollapse>
    {ConfirmacaoSalvarModal}
    </>
  );
}

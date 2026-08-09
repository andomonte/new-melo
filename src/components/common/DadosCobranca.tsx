import React, { useEffect, useState } from 'react';
import FormInput from '@/components/common/FormInput';
import SelectInput from '@/components/common/SelectPadrao';
import SecaoCollapse from '@/components/common/SecaoCollapse';
import { FaMoneyBill } from 'react-icons/fa6';
import { FileSymlink } from 'lucide-react';
import { TrashIcon } from '@radix-ui/react-icons';
import { toast } from 'sonner';
import {
  carregarFeriados,
  getProximoDiaUtil,
} from '@/components/corpo/vendas/novaVenda/prazo';

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
  onGerarPreviewBoleto?: () => void;
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
  onGerarPreviewBoleto,
  padraoAberto = true,
}: Props) {
  // Intervalo + quantidade (mesmo mecanismo da tela de faturar V2).
  const [intervaloDias, setIntervaloDias] = useState<string>('30');
  const [qtdParcelas, setQtdParcelas] = useState<string>('');

  // Carrega feriados (para o ajuste de dia útil de getProximoDiaUtil).
  useEffect(() => {
    const ano = new Date().getFullYear();
    carregarFeriados(ano);
    carregarFeriados(ano + 1);
  }, []);

  const handleCobrancaChange = (field: keyof FormCobranca, value: any) => {
    setFormCobranca((prev) => ({ ...prev, [field]: value }));
  };

  const isBoleto =
    formCobranca.tipoFatura === 'BOLETO' ||
    formCobranca.tipoFatura === 'BOLETO BANCARIO';

  // Gera N parcelas: intervalo acumulado, ajustando p/ dia útil, e divide o
  // total da nota igualmente (a última parcela absorve o arredondamento).
  const gerarParcelas = () => {
    const prazo = parseInt(intervaloDias) || 0;
    const qtd = parseInt(qtdParcelas) || 0;
    if (prazo <= 0 || qtd <= 0) {
      toast.error('Informe um intervalo e uma quantidade válidos.');
      return;
    }
    const total = Number(totalNota) || 0;
    const valorBase = Math.floor((total / qtd) * 100) / 100;
    const base = new Date();
    const novas: Parcela[] = [];
    let acum = 0;
    for (let i = 0; i < qtd; i++) {
      acum += prazo;
      const venc = new Date(base.getTime());
      venc.setDate(venc.getDate() + acum);
      const util = getProximoDiaUtil(venc);
      const valor =
        i === qtd - 1
          ? Number((total - valorBase * (qtd - 1)).toFixed(2))
          : valorBase;
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

  const removerParcela = (idx: number) => {
    setParcelas((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalParcelas = parcelas.reduce((s, p) => s + Number(p.valor || 0), 0);

  if (statusVenda.cobranca !== 'S') return null;

  return (
    <SecaoCollapse
      titulo="DADOS DE COBRANÇA"
      icone={<FaMoneyBill />}
      padraoAberto={padraoAberto}
    >
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        <fieldset className="col-span-1 border-2 border-zinc-200 dark:border-zinc-700 rounded-lg p-4 space-y-4">
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
              <FormInput
                label="Valor de Entrada (R$)"
                name="valorVista"
                type="number"
                value={formCobranca.valorVista}
                onChange={(e) =>
                  handleCobrancaChange('valorVista', e.target.value)
                }
              />
            )}
          </div>
        </fieldset>

        <fieldset
          className={`col-span-1 border-2 rounded-lg p-4 flex flex-col justify-between ${
            !isBoleto
              ? 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 opacity-70'
              : 'border-zinc-200 dark:border-zinc-700'
          }`}
          disabled={!isBoleto}
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
                    !isBoleto ? 'text-gray-500 dark:text-gray-400' : ''
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
                  disabled={!isBoleto}
                />
              </div>
              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${
                    !isBoleto ? 'text-gray-500 dark:text-gray-400' : ''
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
                  disabled={!isBoleto}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={gerarParcelas}
              className={`mt-2 h-9 w-full px-4 rounded text-sm font-medium ${
                !isBoleto
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
              disabled={!isBoleto}
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
                      <td className="px-2 py-1 text-center">{p.dias}</td>
                      <td className="px-2 py-1">
                        <input
                          type="date"
                          value={p.vencimento}
                          onChange={(e) =>
                            atualizarVencimento(i, e.target.value)
                          }
                          className={`text-xs px-1 py-0.5 border rounded ${
                            !isBoleto
                              ? 'bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-600 text-gray-500 cursor-not-allowed'
                              : 'bg-white dark:bg-zinc-900 border-gray-300 dark:border-zinc-700 text-black dark:text-white'
                          }`}
                          disabled={!isBoleto}
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
                            !isBoleto
                              ? 'text-gray-400 cursor-not-allowed'
                              : 'text-red-500 hover:text-red-700'
                          }`}
                          disabled={!isBoleto}
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
                  !isBoleto
                    ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
                disabled={!isBoleto}
              >
                <FileSymlink size={16} /> Gerar Preview do Boleto
              </button>
            </div>
          )}
        </fieldset>
      </div>
    </SecaoCollapse>
  );
}

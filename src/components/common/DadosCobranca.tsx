import React, { useState, useEffect } from 'react';
import FormInput from '@/components/common/FormInput';
import SelectInput from '@/components/common/SelectInput2';
import SecaoCollapse from '@/components/common/SecaoCollapse';
import { FaMoneyBill } from 'react-icons/fa6';
import { FileSymlink } from 'lucide-react';
import { TrashIcon } from '@radix-ui/react-icons';
import { toast } from 'sonner';

interface Banco {
  banco: string;
  nome: string;
}

interface Parcela {
  dias: number;
  vencimento: string;
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
  onGerarPreviewBoleto?: () => void;
  padraoAberto?: boolean;
}

export default function DadosCobranca({
  statusVenda,
  bancos,
  formCobranca,
  setFormCobranca,
  parcelas,
  setParcelas,
  opcoesTipoFatura,
  onGerarPreviewBoleto,
  padraoAberto = true,
}: Props) {
  const handleCobrancaChange = (field: keyof FormCobranca, value: any) => {
    setFormCobranca((prev) => ({ ...prev, [field]: value }));
  };

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
              Habilitar valor de entrada(aaaa)
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
            formCobranca.tipoFatura !== 'BOLETO' &&
            formCobranca.tipoFatura !== 'BOLETO BANCARIO'
              ? 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 opacity-70'
              : 'border-zinc-200 dark:border-zinc-700'
          }`}
          disabled={
            formCobranca.tipoFatura !== 'BOLETO' &&
            formCobranca.tipoFatura !== 'BOLETO BANCARIO'
          }
        >
          <legend className="text-sm font-semibold px-2">
            Prazo e Parcelas
          </legend>

          <div>
            <div className="mt-2">
              <label
                className={`block text-sm font-medium mb-1 ${
                  formCobranca.tipoFatura !== 'BOLETO' &&
                  formCobranca.tipoFatura !== 'BOLETO BANCARIO'
                    ? 'text-gray-500 dark:text-gray-400'
                    : ''
                }`}
              >
                Prazo (em dias)
              </label>
              <div className="flex items-center gap-2">
                <FormInput
                  name="prazo"
                  type="number"
                  value={formCobranca.prazoSelecionado}
                  onChange={(e) =>
                    handleCobrancaChange('prazoSelecionado', e.target.value)
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const dias = parseInt(formCobranca.prazoSelecionado);
                      if (!dias || dias <= 0) {
                        toast.error('Insira um prazo válido.');
                        return;
                      }
                      const vencimento = new Date();
                      vencimento.setDate(vencimento.getDate() + dias);
                      setParcelas([
                        ...parcelas,
                        {
                          dias,
                          vencimento: vencimento.toISOString().split('T')[0],
                        },
                      ]);
                      handleCobrancaChange('prazoSelecionado', '');
                    }
                  }}
                  placeholder="Ex: 30"
                  disabled={
                    formCobranca.tipoFatura !== 'BOLETO' &&
                    formCobranca.tipoFatura !== 'BOLETO BANCARIO'
                  }
                />
                <button
                  type="button"
                  onClick={() => {
                    const dias = parseInt(formCobranca.prazoSelecionado);
                    if (!dias || dias <= 0)
                      return toast.error('Insira um prazo válido.');
                    const vencimento = new Date();
                    vencimento.setDate(vencimento.getDate() + dias);
                    setParcelas([
                      ...parcelas,
                      {
                        dias,
                        vencimento: vencimento.toISOString().split('T')[0],
                      },
                    ]);
                    handleCobrancaChange('prazoSelecionado', '');
                  }}
                  className={`h-10 px-4 rounded whitespace-nowrap ${
                    formCobranca.tipoFatura !== 'BOLETO' &&
                    formCobranca.tipoFatura !== 'BOLETO BANCARIO'
                      ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                  disabled={
                    formCobranca.tipoFatura !== 'BOLETO' &&
                    formCobranca.tipoFatura !== 'BOLETO BANCARIO'
                  }
                >
                  + Adicionar
                </button>
              </div>
            </div>

            <ul className="mt-3 text-sm space-y-2 h-40 overflow-y-auto p-1 rounded bg-gray-100 dark:bg-zinc-800">
              {parcelas.map((p, i) => (
                <li
                  key={i}
                  className={`flex flex-col gap-2 p-2 rounded shadow-sm ${
                    formCobranca.tipoFatura !== 'BOLETO' &&
                    formCobranca.tipoFatura !== 'BOLETO BANCARIO'
                      ? 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                      : 'bg-white dark:bg-zinc-700'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">
                      Parcela {i + 1} - {p.dias} dias
                    </span>
                    <button
                      onClick={() =>
                        setParcelas(parcelas.filter((_, idx) => idx !== i))
                      }
                      className={`${
                        formCobranca.tipoFatura !== 'BOLETO' &&
                        formCobranca.tipoFatura !== 'BOLETO BANCARIO'
                          ? 'text-gray-400 cursor-not-allowed'
                          : 'text-red-500 hover:text-red-700'
                      }`}
                      disabled={
                        formCobranca.tipoFatura !== 'BOLETO' &&
                        formCobranca.tipoFatura !== 'BOLETO BANCARIO'
                      }
                    >
                      <TrashIcon />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium">
                      Data de Vencimento:
                    </label>
                    <input
                      type="date"
                      value={p.vencimento}
                      onChange={(e) => {
                        const novasParcelas = [...parcelas];
                        novasParcelas[i] = { ...p, vencimento: e.target.value };
                        setParcelas(novasParcelas);
                      }}
                      className={`text-xs px-2 py-1 border rounded ${
                        formCobranca.tipoFatura !== 'BOLETO' &&
                        formCobranca.tipoFatura !== 'BOLETO BANCARIO'
                          ? 'bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-600 text-gray-500 cursor-not-allowed'
                          : 'bg-white dark:bg-zinc-900 border-gray-300 dark:border-zinc-700 text-black dark:text-white'
                      }`}
                      disabled={
                        formCobranca.tipoFatura !== 'BOLETO' &&
                        formCobranca.tipoFatura !== 'BOLETO BANCARIO'
                      }
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {onGerarPreviewBoleto && (
            <div className="mt-4">
              <button
                type="button"
                onClick={onGerarPreviewBoleto}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md ${
                  formCobranca.tipoFatura !== 'BOLETO' &&
                  formCobranca.tipoFatura !== 'BOLETO BANCARIO'
                    ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
                disabled={
                  formCobranca.tipoFatura !== 'BOLETO' &&
                  formCobranca.tipoFatura !== 'BOLETO BANCARIO'
                }
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

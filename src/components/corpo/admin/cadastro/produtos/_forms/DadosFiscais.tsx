import React, { useState, useEffect } from 'react';
import FormInput from '@/components/common/FormInput';
import CampoDecimal from './CampoDecimal';
import SelectInput from '@/components/common/SelectPadrao';
import ComboboxInput from '@/components/common/ComboboxInput';
import { Label } from '@/components/ui/label';
import { IsentoIPI, Produto } from '@/data/produtos/produtos';
import {
  ClassificacaoFiscal,
  getClassificacoesFiscais,
} from '@/data/classificacoesFiscais/classificacoesFiscais';
import { useDebouncedCallback } from 'use-debounce';
import { Cest, getCests } from '@/data/cests/cests';
import { toast } from 'sonner';

const tributadoOptions = [
  { value: 'S', label: 'SIM' },
  { value: 'N', label: 'NÃO' },
];

const firstSituacaoTributaria = [
  { value: '0', label: '0' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
  { value: '6', label: '6' },
  { value: '7', label: '7' },
  { value: '8', label: '8' },
];

const secondSituacaoTributaria = [
  { value: '00', label: '00' },
  { value: '10', label: '10' },
  { value: '20', label: '20' },
  { value: '30', label: '30' },
  { value: '40', label: '40' },
  { value: '41', label: '41' },
  { value: '50', label: '50' },
  { value: '51', label: '51' },
  { value: '60', label: '60' },
  { value: '70', label: '70' },
  { value: '90', label: '90' },
];

const isentoPisCofinsOptions = [
  { value: 'S', label: 'SIM' },
  { value: 'N', label: 'NÃO' },
];

const simNaoOptions = [
  { value: 'S', label: 'SIM' },
  { value: 'N', label: 'NÃO' },
];

const situacaoIpiOptions = [
  { value: 'S', label: 'Suspenso' },
  { value: 'C', label: 'Cobrar' },
  { value: 'P', label: 'Pago' },
  { value: 'Z', label: 'Zerado' },
  { value: 'I', label: 'Importação' },
  { value: 'T', label: 'Import ST' },
];

interface DadosFiscaisProps {
  produto: Produto;
  handleProdutoChange: (produto: Produto) => void;
  error?: { [p: string]: string };
}

// Helper function para lidar com valores numéricos opcionais
const handleOptionalNumberChange = (value: string): number | undefined => {
  if (value === '' || value === null || value === undefined) return undefined;
  const num = Number(value);
  return isNaN(num) ? undefined : num;
};

// Helper function para lidar com valores numéricos obrigatórios
const handleRequiredNumberChange = (
  value: string,
  defaultValue: number = 0,
): number => {
  if (value === '' || value === null || value === undefined)
    return defaultValue;
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
};

// Helper function para exibir valores numéricos
const displayNumberValue = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '';
  return value.toString();
};


const DadosFiscais: React.FC<DadosFiscaisProps> = ({
  produto,
  handleProdutoChange,
  error,
}) => {
  const [classificacoesFiscais, setClassificacoesFiscais] = useState<
    ClassificacaoFiscal[]
  >([]);
  const [cests, setCests] = useState<Cest[]>([]);
  const [classificacaoFiscalSearch, setClassificacaoFiscalSearch] =
    useState<string>('');
  const [cestSearch, setCestSearch] = useState<string>('');
  const [validatingCest, setValidatingCest] = useState<boolean>(false);
  const [loadingClassFiscal, setLoadingClassFiscal] = useState<boolean>(false);
  const [loadingCest, setLoadingCest] = useState<boolean>(false);

  // Valores fiscais (IPI/PIS/COFINS/MVA) da Classificação Fiscal escolhida
  type ValorNcm = {
    ipi: number | string;
    pis: number | string;
    cofins: number | string;
    agregado: number | string;
    descricao?: string | null;
  };
  const [ncmValores, setNcmValores] = useState<ValorNcm[]>([]);
  const [ncmSelIdx, setNcmSelIdx] = useState<number>(0);
  const [mostrarModalNcm, setMostrarModalNcm] = useState<boolean>(false);

  // Ao escolher a Classif. Fiscal (NCM), busca os valores fiscais associados e,
  // se houver, pergunta se o usuário quer aplicá-los (lista quando há vários).
  const handleClasfiscalChange = (ncm: string) => {
    handleProdutoChange({ ...produto, clasfiscal: ncm });
    if (!ncm || !ncm.trim()) return;
    fetch(`/api/produtos/classif-fiscal-valores?ncm=${encodeURIComponent(ncm.trim())}`)
      .then((r) => (r.ok ? r.json() : { valores: [] }))
      .then((d) => {
        const vals: ValorNcm[] = d.valores || [];
        if (vals.length > 0) {
          setNcmValores(vals);
          setNcmSelIdx(0);
          setMostrarModalNcm(true);
        }
      })
      .catch(() => {});
  };

  const aplicarValoresNcm = () => {
    const v = ncmValores[ncmSelIdx];
    if (v) {
      handleProdutoChange({
        ...produto,
        ipi: Number(v.ipi) || 0,
        pis: Number(v.pis) || 0,
        cofins: Number(v.cofins) || 0,
        percsubst: Number(v.agregado) || 0,
      });
    }
    setMostrarModalNcm(false);
  };

  // Carrega as opções assim que o componente montar
  useEffect(() => {
    const loadInitialOptions = async () => {
      try {
        // Carrega todas as opções em paralelo (perPage alto para pegar todos)
        const [classificacoesData, cestsData] = await Promise.all([
          getClassificacoesFiscais({ page: 1, perPage: 9999, search: '' }),
          getCests({ page: 1, perPage: 9999, search: '' }),
        ]);

        if (classificacoesData?.data) setClassificacoesFiscais(classificacoesData.data);
        if (cestsData?.data) setCests(cestsData.data);
      } catch (error) {
        console.error('Erro ao carregar opções fiscais iniciais:', error);
      }
    };

    loadInitialOptions();
  }, []); // Executa apenas uma vez ao montar

  const handleClassificacaoFiscalSearch = useDebouncedCallback(() => {
    handleClassificacoesFiscais();
  });

  const handleCestSearch = useDebouncedCallback(() => {
    handleCests();
  });

  const handleClassificacoesFiscais = async () => {
    setLoadingClassFiscal(true);
    try {
      const fetchedClassificacoesFiscais = await getClassificacoesFiscais({
        page: 1,
        perPage: 99,
        search: classificacaoFiscalSearch,
      });
      if (!fetchedClassificacoesFiscais) return;
      setClassificacoesFiscais(fetchedClassificacoesFiscais.data);
    } finally {
      setLoadingClassFiscal(false);
    }
  };

  const handleCests = async () => {
    setLoadingCest(true);
    try {
      const fetchedCests = await getCests({
        page: 1,
        perPage: 99,
        search: cestSearch,
      });
      if (!fetchedCests) return;
      setCests(fetchedCests.data);
    } finally {
      setLoadingCest(false);
    }
  };

  const handleValidateCest = async (cestValue?: string, ncmValue?: string) => {
    const cest = cestValue || produto.cest;
    const ncm = ncmValue || produto.clasfiscal;

    // Se não tem CEST, não precisa validar
    if (!cest || cest.trim() === '') return;

    // Se não tem NCM, mostra erro
    if (!ncm || ncm.trim() === '') {
      toast.warning('NCM não informado. CEST requer NCM válido.', {
        duration: 5000,
      });
      return;
    }

    setValidatingCest(true);
    try {
      const response = await fetch('/api/produtos/validar-cest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ncm: ncm,
          cest: cest,
        }),
      });

      const data = await response.json();

      if (data.resultado === 'NOK1') {
        toast.error(data.message, {
          duration: 5000,
        });
      } else if (data.resultado === 'NOK2') {
        toast.error(data.message, {
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Erro ao validar CEST:', error);
    } finally {
      setValidatingCest(false);
    }
  };

  const classificaoesFiscaisOptions = classificacoesFiscais.map(
    (classificacaoFiscal) => ({
      value: classificacaoFiscal.ncm,
      label: classificacaoFiscal.ncm,
    }),
  );

  const cestsOptions = cests.map((cest) => ({
    value: cest.cest,
    label: cest.cest,
  }));

  return (
    <>
      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-3 gap-4">
          <FormInput
            name="nrodi"
            type="text"
            label="Nº DI"
            value={produto.nrodi || ''}
            onChange={(e) =>
              handleProdutoChange({ ...produto, nrodi: e.target.value })
            }
            error={error?.nrodi}
          />
          <div className={error?.trib ? 'field-error' : ''}>
            <SelectInput
              name="trib"
              label="Tributado"
              required
              options={tributadoOptions}
              value={produto.trib || ''}
              onValueChange={(value) =>
                handleProdutoChange({ ...produto, trib: value as string })
              }
              error={error?.trib}
            />
          </div>
          <div className={error?.clasfiscal ? 'field-error' : ''}>
            <ComboboxInput
              name="clasfiscal"
              label="Classif. Fiscal"
              required
              loading={loadingClassFiscal}
              options={classificaoesFiscaisOptions}
              value={produto.clasfiscal || ''}
              onValueChange={(value) =>
                handleClasfiscalChange(value as string)
              }
              onInputChange={(value) => {
                setClassificacaoFiscalSearch(value);
                handleClassificacaoFiscalSearch();
              }}
              error={error?.clasfiscal}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FormInput
            name="dtdi"
            type="date"
            label="Data DI"
            value={produto.dtdi?.toDateString() || ''}
            onChange={(e) =>
              handleProdutoChange({
                ...produto,
                dtdi: new Date(e.target.value),
              })
            }
            error={error?.dtdi}
          />
          <div className={`text-gray-700 dark:text-gray-200 ${error?.strib ? 'field-error' : ''}`}>
            <Label htmlFor="strib">Situação Tributária <span className="text-red-500">*</span></Label>
            <div className="grid grid-cols-2 gap-4">
              <SelectInput
                name="strib_primeiro"
                options={firstSituacaoTributaria}
                value={produto.strib ? produto.strib.charAt(0) : '0'}
                onValueChange={(value) => {
                  const segundaParte = produto.strib?.slice(1) || '00';
                  handleProdutoChange({ ...produto, strib: value + segundaParte });
                }}
                error={error?.strib}
              />
              <SelectInput
                name="strib_segundo"
                options={secondSituacaoTributaria}
                value={produto.strib ? produto.strib.slice(1) : '00'}
                onValueChange={(value) => {
                  const primeiraParte = produto.strib?.charAt(0) || '0';
                  handleProdutoChange({ ...produto, strib: primeiraParte + value });
                }}
                error={error?.strib}
              />
            </div>
          </div>
          <CampoDecimal
            name="percsubst"
            label="% Agregado"
            intDigits={4}
            decDigits={2}
            value={produto.percsubst}
            onChangeValue={(v) =>
              handleProdutoChange({ ...produto, percsubst: v })
            }
            error={error?.percsubst}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className={error?.isentopiscofins ? 'field-error' : ''}>
            <SelectInput
              name="isentopiscofins"
              label="Isento PIS/COFINS?"
              required
              options={isentoPisCofinsOptions}
              value={produto.isentopiscofins || ''}
              onValueChange={(value) =>
                handleProdutoChange({
                  ...produto,
                  isentopiscofins: value as string,
                })
              }
              error={error?.isentopiscofins}
            />
          </div>
          <CampoDecimal
            name="pis"
            label="PIS"
            value={produto.pis}
            onChangeValue={(v) => handleProdutoChange({ ...produto, pis: v })}
            error={error?.pis}
          />
          <CampoDecimal
            name="cofins"
            label="COFINS"
            value={produto.cofins}
            onChangeValue={(v) => handleProdutoChange({ ...produto, cofins: v })}
            error={error?.cofins}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className={error?.isentoipi ? 'field-error' : ''}>
            <SelectInput
              name="isentoipi"
              label="Situação IPI?"
              required
              options={situacaoIpiOptions}
              value={produto.isentoipi || ''}
              onValueChange={(value) =>
                handleProdutoChange({ ...produto, isentoipi: value as IsentoIPI })
              }
              error={error?.isentoipi}
            />
          </div>
          <CampoDecimal
            name="ipi"
            label="IPI"
            value={produto.ipi}
            onChangeValue={(v) => handleProdutoChange({ ...produto, ipi: v })}
            error={error?.ipi}
          />
          <div></div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <SelectInput
            name="descontopiscofins"
            label="Desconto PIS/COFINS?"
            options={isentoPisCofinsOptions}
            value={produto.descontopiscofins || ''}
            onValueChange={(value) =>
              handleProdutoChange({
                ...produto,
                descontopiscofins: value as string,
              })
            }
            error={error?.descontopiscofins}
          />
          <CampoDecimal
            name="ii"
            label="Imp. Importação (II)"
            value={produto.ii}
            onChangeValue={(v) => handleProdutoChange({ ...produto, ii: v })}
            error={error?.ii}
          />
          <div className={error?.cest ? 'field-error' : ''}>
            <ComboboxInput
              name="cest"
              label="CEST"
              loading={loadingCest}
              options={cestsOptions}
              value={produto.cest || ''}
              onValueChange={(value) => {
                handleProdutoChange({ ...produto, cest: value as string });
                // Valida passando o valor diretamente
                handleValidateCest(value as string);
              }}
              onInputChange={(value) => {
                setCestSearch(value);
                handleCestSearch();
              }}
              error={error?.cest}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <SelectInput
            name="naotemst"
            label="Não tem Substituição Tributária?"
            options={simNaoOptions}
            value={produto.naotemst || 'N'}
            onValueChange={(value) =>
              handleProdutoChange({
                ...produto,
                naotemst: value as string,
              })
            }
            error={error?.naotemst}
          />
          <SelectInput
            name="prodepe"
            label="Produto Incentivado PRODEPE?"
            options={simNaoOptions}
            value={produto.prodepe || 'N'}
            onValueChange={(value) =>
              handleProdutoChange({
                ...produto,
                prodepe: value as string,
              })
            }
            error={error?.prodepe}
          />
          <SelectInput
            name="hanan"
            label="Produto SAP/HANAN?"
            options={simNaoOptions}
            value={produto.hanan || 'N'}
            onValueChange={(value) =>
              handleProdutoChange({
                ...produto,
                hanan: value as string,
              })
            }
            error={error?.hanan}
          />
        </div>
      </div>

      {/* Modal: valores fiscais da Classificação Fiscal (NCM) escolhida */}
      {mostrarModalNcm && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center px-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg w-full max-w-lg p-5">
            <h3 className="text-base font-semibold text-blue-600 dark:text-blue-300">
              Valores da Classificação Fiscal
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-4">
              NCM {produto.clasfiscal} —{' '}
              {ncmValores.length > 1
                ? 'foram encontrados vários conjuntos de valores. Escolha um para aplicar:'
                : 'valores encontrados. Deseja aplicar nos campos fiscais?'}
            </p>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {ncmValores.map((v, i) => (
                <label
                  key={i}
                  className={`flex items-center gap-3 border rounded-md p-3 cursor-pointer transition-colors ${
                    ncmSelIdx === i
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700/40'
                  }`}
                >
                  {ncmValores.length > 1 && (
                    <input
                      type="radio"
                      name="ncm-valor"
                      checked={ncmSelIdx === i}
                      onChange={() => setNcmSelIdx(i)}
                    />
                  )}
                  <div className="grid grid-cols-4 gap-3 text-sm flex-1">
                    <div>
                      <div className="text-[0.6875rem] text-gray-500 dark:text-gray-400">IPI</div>
                      <div className="font-medium">{Number(v.ipi).toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-[0.6875rem] text-gray-500 dark:text-gray-400">PIS</div>
                      <div className="font-medium">{Number(v.pis).toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-[0.6875rem] text-gray-500 dark:text-gray-400">COFINS</div>
                      <div className="font-medium">{Number(v.cofins).toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-[0.6875rem] text-gray-500 dark:text-gray-400">MVA</div>
                      <div className="font-medium">{Number(v.agregado).toFixed(2)}</div>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              {/* Desconsidera os valores do NCM: fecha sem aplicar, preservando
                  os valores fiscais atuais do produto. Em vermelho para deixar
                  claro que é o caminho de descarte. */}
              <button
                type="button"
                onClick={() => setMostrarModalNcm(false)}
                className="px-4 py-2 text-sm rounded bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                Desconsiderar
              </button>
              <button
                type="button"
                onClick={aplicarValoresNcm}
                className="px-4 py-2 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DadosFiscais;

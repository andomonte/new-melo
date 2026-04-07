import React, { useState, useEffect } from 'react';
import FormInput from '@/components/common/FormInput';
import SelectInput from '@/components/common/SelectInput';
import SearchSelectInput from '@/components/common/SearchSelectInput';
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
    const fetchedClassificacoesFiscais = await getClassificacoesFiscais({
      page: 1,
      perPage: 99,
      search: classificacaoFiscalSearch,
    });
    if (!fetchedClassificacoesFiscais) return;
    setClassificacoesFiscais(fetchedClassificacoesFiscais.data);
  };

  const handleCests = async () => {
    const fetchedCests = await getCests({
      page: 1,
      perPage: 99,
      search: cestSearch,
    });
    if (!fetchedCests) return;
    setCests(fetchedCests.data);
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
          <SelectInput
            name="trib"
            label="Tributado"
            options={tributadoOptions}
            value={produto.trib || ''}
            onValueChange={(value) =>
              handleProdutoChange({ ...produto, trib: value as string })
            }
            error={error?.trib}
          />
          <SearchSelectInput
            name="clasfiscal"
            label="Classif. Fiscal"
            options={classificaoesFiscaisOptions}
            value={produto.clasfiscal || ''}
            onValueChange={(value) =>
              handleProdutoChange({ ...produto, clasfiscal: value as string })
            }
            onInputChange={(value) => {
              setClassificacaoFiscalSearch(value);
              handleClassificacaoFiscalSearch();
            }}
            error={error?.clasfiscal}
          />
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
          <div className="text-gray-700 dark:text-gray-200">
            <Label htmlFor="strib">Situação Tributária</Label>
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
          <FormInput
            name="percsubst"
            type="number"
            label="% Agregado"
            value={displayNumberValue(produto.percsubst)}
            onChange={(e) =>
              handleProdutoChange({
                ...produto,
                percsubst: handleRequiredNumberChange(e.target.value, 0),
              })
            }
            error={error?.percsubst}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <SelectInput
            name="isentopiscofins"
            label="Isento PIS/COFINS?"
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
          <FormInput
            name="pis"
            type="number"
            label="PIS"
            value={displayNumberValue(produto.pis)}
            onChange={(e) =>
              handleProdutoChange({
                ...produto,
                pis: handleOptionalNumberChange(e.target.value),
              })
            }
            error={error?.pis}
          />
          <FormInput
            name="cofins"
            type="number"
            label="COFINS"
            value={displayNumberValue(produto.cofins)}
            onChange={(e) =>
              handleProdutoChange({
                ...produto,
                cofins: handleOptionalNumberChange(e.target.value),
              })
            }
            error={error?.cofins}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <SelectInput
            name="isentoipi"
            label="Situação IPI?"
            options={situacaoIpiOptions}
            value={produto.isentoipi || ''}
            onValueChange={(value) =>
              handleProdutoChange({ ...produto, isentoipi: value as IsentoIPI })
            }
            error={error?.isentoipi}
          />
          <FormInput
            name="ipi"
            type="number"
            label="IPI"
            value={displayNumberValue(produto.ipi)}
            onChange={(e) =>
              handleProdutoChange({
                ...produto,
                ipi: handleOptionalNumberChange(e.target.value),
              })
            }
            error={error?.ipi}
          />
          <div>
            <label className="block text-gray-700">Reservado CheckBox</label>
          </div>
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
          <FormInput
            name="ii"
            type="number"
            label="IPI"
            value={displayNumberValue(produto.ii)}
            onChange={(e) =>
              handleProdutoChange({
                ...produto,
                ii: handleOptionalNumberChange(e.target.value),
              })
            }
            error={error?.ii}
          />
          <SearchSelectInput
            name="cest"
            label="CEST"
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
    </>
  );
};

export default DadosFiscais;

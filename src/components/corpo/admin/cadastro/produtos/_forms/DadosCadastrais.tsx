import React, { useState, useEffect } from 'react';
import FormInput from '@/components/common/FormInput';
import SelectInput from '@/components/common/SelectInput';
import SearchSelectInput from '@/components/common/SearchSelectInput';
import {
  CompraDireta,
  Curva,
  Dolar,
  Informativo,
  Produto,
  TipoProduto,
  UnidadeMedida,
} from '@/data/produtos/produtos';
import { getMarcas, Marca, Marcas } from '@/data/marcas/marcas';
import { useDebouncedCallback } from 'use-debounce';
import {
  getGruposFuncao,
  GrupoFuncao,
  GruposFuncao,
} from '@/data/gruposFuncao/gruposFuncao';
import {
  getGruposProduto,
  GrupoProduto,
  GruposProduto,
} from '@/data/gruposProduto/gruposProduto';
import { toast } from 'sonner';

const curvaOptions = [
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
  { value: 'D', label: 'D' },
];

const informativoOptions = [
  { value: '*', label: '*' },
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
  { value: 'D', label: 'D' },
];

const unidadeMedidaOptions = [
  { value: 'PC', label: 'Peça' },
  { value: 'UN', label: 'Unidade' },
  { value: 'KT', label: 'Kit' },
  { value: 'CX', label: 'Caixa' },
  { value: 'CJ', label: 'Conjunto' },
  { value: 'JG', label: 'Jogo' },
  { value: 'LT', label: 'Litro' },
  { value: 'ML', label: 'Mililitro' },
  { value: 'MT', label: 'Metro' },
  { value: 'PT', label: 'Pacote' },
  { value: 'KG', label: 'Quilograma' },
  { value: 'CT', label: 'Cartela' },
  { value: 'PR', label: 'Par' },
  { value: 'RL', label: 'Rolo' },
];

const moedaCambialOptions = [
  { value: 'N', label: 'R$' },
  { value: 'S', label: 'US$' },
];

const compraDiretaOptions = [
  { value: 'S', label: 'SIM' },
  { value: 'N', label: 'NÃO' },
];

const tipoProdutoOptions = [
  { value: 'ME', label: 'ME - Mercadoria' },
  { value: 'MC', label: 'MC - Material de Consumo' },
];

const precoTabeladoOptions = [
  { value: 'S', label: 'SIM' },
  { value: 'N', label: 'NÃO' },
];

const consumoInternoOptions = [
  { value: 'true', label: 'SIM' },
  { value: 'false', label: 'NÃO' },
];

interface DadosCadastraisProps {
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

const DadosCadastrais: React.FC<DadosCadastraisProps> = ({
  produto,
  handleProdutoChange,
  error,
}) => {
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [gruposFuncao, setGruposFuncao] = useState<GrupoFuncao[]>([]);
  const [gruposProduto, setGruposProduto] = useState<GrupoProduto[]>([]);
  const [searchMarcas, setSearchMarcas] = useState<string>('');
  const [searchGruposFuncao, setSearchGruposFuncao] = useState<string>('');
  const [searchGruposProduto, setSearchGruposProduto] = useState<string>('');
  const [validatingRef, setValidatingRef] = useState<boolean>(false);

  // Carrega as opções assim que o componente montar
  useEffect(() => {
    const loadInitialOptions = async () => {
      try {
        // Carrega todas as opções em paralelo (perPage alto para pegar todos)
        const [marcasData, gruposFuncaoData, gruposProdutoData] = await Promise.all([
          getMarcas({ page: 1, perPage: 9999, search: '' }),
          getGruposFuncao({ page: 1, perPage: 9999, search: '' }),
          getGruposProduto({ page: 1, perPage: 9999, search: '' }),
        ]);

        if (marcasData?.data) setMarcas(marcasData.data);
        if (gruposFuncaoData?.data) setGruposFuncao(gruposFuncaoData.data);
        if (gruposProdutoData?.data) setGruposProduto(gruposProdutoData.data);
      } catch (error) {
        console.error('Erro ao carregar opções iniciais:', error);
      }
    };

    loadInitialOptions();
  }, []); // Executa apenas uma vez ao montar

  const handleMarcasSearch = useDebouncedCallback(() => {
    handleMarcas();
  });

  const handleGruposFuncaoSearch = useDebouncedCallback(() => {
    handleGruposFuncao();
  });

  const handleGruposProdutoSearch = useDebouncedCallback(() => {
    handleGruposProduto();
  });

  const handleMarcas = async () => {
    const fetchedMarcas: Marcas = await getMarcas({
      page: 1,
      perPage: 99,
      search: searchMarcas,
    });
    if (!fetchedMarcas) return;
    setMarcas(fetchedMarcas.data);
  };

  const handleGruposFuncao = async () => {
    const fetchedGruposFuncao: GruposFuncao = await getGruposFuncao({
      page: 1,
      perPage: 99,
      search: searchGruposFuncao,
    });
    if (!fetchedGruposFuncao) return;
    setGruposFuncao(fetchedGruposFuncao.data);
  };

  const handleGruposProduto = async () => {
    const fetchedGruposProduto: GruposProduto = await getGruposProduto({
      page: 1,
      perPage: 99,
      search: searchGruposProduto,
    });
    if (!fetchedGruposProduto) return;
    setGruposProduto(fetchedGruposProduto.data);
  };

  const handleValidateRef = async () => {
    if (!produto.ref || produto.ref.trim() === '') return;

    setValidatingRef(true);
    try {
      const response = await fetch('/api/produtos/validar-referencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref: produto.ref,
          codprod: produto.codprod, // Para edição, não validar contra si mesmo
        }),
      });

      const data = await response.json();

      if (data.resultado === 'NOK') {
        toast.error(data.message, {
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Erro ao validar referência:', error);
    } finally {
      setValidatingRef(false);
    }
  };

  const marcaOptions = marcas.map((marca) => ({
    value: marca.codmarca.toString(),
    label: marca.descr,
  }));

  const grupoFuncaoOptions = gruposFuncao.map((grupoFuncao) => ({
    value: grupoFuncao.codgpf.toString(),
    label: grupoFuncao.descr,
  }));

  const grupoProdutoOptions = gruposProduto.map((grupoProduto) => ({
    value: grupoProduto.codgpp.toString(),
    label: grupoProduto.descr,
  }));

  return (
    <>
      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            name="codbar"
            type="text"
            label="Código de Barra"
            value={produto.codbar || ''}
            onChange={(e) =>
              handleProdutoChange({ ...produto, codbar: e.target.value })
            }
            error={error?.codbar}
          />
          <SelectInput
            name="consumo_interno"
            label="Consumo Interno?"
            options={consumoInternoOptions}
            value={produto.consumo_interno ? 'true' : 'false'}
            onValueChange={(value) =>
              handleProdutoChange({
                ...produto,
                consumo_interno: value === 'true',
              })
            }
            error={error?.consumo_interno}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            name="ref"
            type="text"
            label="Referência"
            value={produto.ref || ''}
            onChange={(e) =>
              handleProdutoChange({ ...produto, ref: e.target.value })
            }
            onBlur={handleValidateRef}
            error={error?.ref}
            required
          />
          <FormInput
            name="reforiginal"
            type="text"
            label="Referência Original"
            value={produto.reforiginal || ''}
            onChange={(e) =>
              handleProdutoChange({ ...produto, reforiginal: e.target.value })
            }
            error={error?.reforiginal}
          />
        </div>
        <FormInput
          name="descr"
          type="text"
          label="Descrição"
          value={produto.descr || ''}
          onChange={(e) =>
            handleProdutoChange({ ...produto, descr: e.target.value })
          }
          error={error?.descr}
          required
        />
        <FormInput
          name="aplic_extendida"
          type="text"
          label="Aplicação Extendida"
          value={produto.aplic_extendida || ''}
          onChange={(e) =>
            handleProdutoChange({ ...produto, aplic_extendida: e.target.value })
          }
          error={error?.aplic_extendida}
        />
        <div className="grid grid-cols-2 gap-4">
          <SearchSelectInput
            name="codmarca"
            label="Marca"
            options={marcaOptions}
            value={produto.codmarca || ''}
            onValueChange={(value) =>
              handleProdutoChange({ ...produto, codmarca: value as string })
            }
            onInputChange={(value) => {
              setSearchMarcas(value);
              handleMarcasSearch();
            }}
            error={error?.codmarca}
          />
          <SearchSelectInput
            name="codgpf"
            label="Grupo de Função"
            options={grupoFuncaoOptions}
            value={produto.codgpf || ''}
            onValueChange={(value) =>
              handleProdutoChange({ ...produto, codgpf: value as string })
            }
            onInputChange={(value) => {
              setSearchGruposFuncao(value);
              handleGruposFuncaoSearch();
            }}
            error={error?.codgpf}
          />
        </div>
        <div className="grid grid-cols-4 gap-4">
          <SearchSelectInput
            name="codgpp"
            label="Grupo de Produto"
            options={grupoProdutoOptions}
            value={produto.codgpp || ''}
            onValueChange={(value) =>
              handleProdutoChange({ ...produto, codgpp: value as string })
            }
            onInputChange={(value) => {
              setSearchGruposProduto(value);
              handleGruposProdutoSearch();
            }}
            error={error?.codgpp}
          />
          <SelectInput
            name="curva"
            label="Class. Curva ABC"
            options={curvaOptions}
            value={produto.curva || 'D'}
            onValueChange={(value) =>
              handleProdutoChange({ ...produto, curva: value as Curva })
            }
            error={error?.curva}
          />
          <FormInput
            name="qtestmin"
            type="number"
            label="Qtd. Estoque Mínimo"
            value={displayNumberValue(produto.qtestmin)}
            onChange={(e) =>
              handleProdutoChange({
                ...produto,
                qtestmin: handleOptionalNumberChange(e.target.value),
              })
            }
            error={error?.qtestmin}
          />
          <FormInput
            name="qtestmax"
            type="number"
            label="Qtd. Estoque Máximo"
            value={displayNumberValue(produto.qtestmax)}
            onChange={(e) =>
              handleProdutoChange({
                ...produto,
                qtestmax: handleRequiredNumberChange(e.target.value, 0),
              })
            }
            error={error?.qtestmax}
          />
        </div>
        <FormInput
          name="obs"
          type="text"
          label="Observação"
          value={produto.obs || ''}
          onChange={(e) =>
            handleProdutoChange({ ...produto, obs: e.target.value })
          }
          error={error?.obs}
        />
        <div className="grid grid-cols-4 gap-4">
          <SelectInput
            name="inf"
            label="Informativo"
            options={informativoOptions}
            value={produto.inf || ''}
            onValueChange={(value) =>
              handleProdutoChange({ ...produto, inf: value as Informativo })
            }
            error={error?.inf}
            required
          />
          <FormInput
            name="pesoliq"
            type="number"
            label="Peso Líquido"
            value={displayNumberValue(produto.pesoliq)}
            onChange={(e) =>
              handleProdutoChange({
                ...produto,
                pesoliq: handleOptionalNumberChange(e.target.value),
              })
            }
            error={error?.pesoliq}
          />
          <FormInput
            name="qtembal"
            type="number"
            label="Qtd. Embalagem"
            value={displayNumberValue(produto.qtembal)}
            onChange={(e) =>
              handleProdutoChange({
                ...produto,
                qtembal: handleOptionalNumberChange(e.target.value),
              })
            }
            error={error?.qtembal}
          />
          <SelectInput
            name="unimed"
            label="Unidade de Medida"
            options={unidadeMedidaOptions}
            value={produto.unimed || ''}
            onValueChange={(value) =>
              handleProdutoChange({
                ...produto,
                unimed: value as UnidadeMedida,
              })
            }
            error={error?.unimed}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            name="multiplo"
            type="number"
            label="Múltiplo Venda"
            value={displayNumberValue(produto.multiplo)}
            onChange={(e) =>
              handleProdutoChange({
                ...produto,
                multiplo: handleRequiredNumberChange(e.target.value, 1),
              })
            }
            error={error?.multiplo}
          />
          <FormInput
            name="coddesc"
            type="number"
            label="Desconto de Fábrica"
            value={displayNumberValue(produto.coddesc)}
            onChange={(e) =>
              handleProdutoChange({
                ...produto,
                coddesc: handleRequiredNumberChange(e.target.value, 0),
              })
            }
            error={error?.coddesc}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <SelectInput
            name="tabelado"
            label="Preço Tabelado"
            options={precoTabeladoOptions}
            value={produto.tabelado?.toString() || ''}
            onValueChange={(value) =>
              handleProdutoChange({ ...produto, tabelado: value })
            }
            error={error?.tabelado}
          />
          <SelectInput
            name="compradireta"
            label="Compra Direta"
            options={compraDiretaOptions}
            value={produto.compradireta || ''}
            onValueChange={(value) =>
              handleProdutoChange({
                ...produto,
                compradireta: value as CompraDireta,
              })
            }
            error={error?.compradireta}
          />
          <SelectInput
            name="dolar"
            label="Moeda Cambial"
            options={moedaCambialOptions}
            value={produto.dolar || ''}
            onValueChange={(value) =>
              handleProdutoChange({ ...produto, dolar: value as Dolar })
            }
            error={error?.dolar}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            name="multiplocompra"
            type="number"
            label="Múltiplo Compra"
            value={displayNumberValue(produto.multiplocompra)}
            onChange={(e) =>
              handleProdutoChange({
                ...produto,
                multiplocompra: handleRequiredNumberChange(e.target.value, 1),
              })
            }
            error={error?.multiplocompra}
          />
          <SelectInput
            name="tipo"
            label="Tipo Produto"
            options={tipoProdutoOptions}
            value={produto.tipo || ''}
            onValueChange={(value) =>
              handleProdutoChange({ ...produto, tipo: value as TipoProduto })
            }
            error={error?.tipo}
          />
        </div>
        <FormInput
          name="descr_importacao"
          type="text"
          label="Descrição Importado"
          value={produto.descr_importacao || ''}
          onChange={(e) =>
            handleProdutoChange({
              ...produto,
              descr_importacao: e.target.value,
            })
          }
          error={error?.descr_importacao}
        />
      </div>
    </>
  );
};

export default DadosCadastrais;

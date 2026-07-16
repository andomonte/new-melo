import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import FormInput from '@/components/common/FormInput';
import CampoDecimal from './CampoDecimal';
import CadastroRapidoAux, { TipoAux } from './CadastroRapidoAux';
import SelectInput from '@/components/common/SelectPadrao';
import ComboboxInput from '@/components/common/ComboboxInput';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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

const curvaOptions = [
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
  { value: 'D', label: 'D' },
];

const informativoOptions = [
  { value: '*', label: '* - PAMB' },
  { value: '-', label: '- - SEM INFORMATIVO' },
  { value: 'D', label: 'D - DESATIVADO' },
  { value: 'E', label: 'E - EXCLUIDO' },
  { value: 'L', label: 'L - LOTE' },
  { value: 'N', label: 'N - LIQ.S/GIRO N.CO' },
  { value: 'S', label: 'S - NR.SUBSTITUIDO' },
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
  /** No cadastro (novo produto) o Múltiplo Venda vem bloqueado com 1 (Delphi) */
  multiploReadonly?: boolean;
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
  multiploReadonly,
}) => {
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [gruposFuncao, setGruposFuncao] = useState<GrupoFuncao[]>([]);
  const [gruposProduto, setGruposProduto] = useState<GrupoProduto[]>([]);

  // Cadastro rápido (Marca / Grupo de Função / Grupo de Produto) via botão "+"
  const [auxAberto, setAuxAberto] = useState<TipoAux | null>(null);
  const handleAuxCriado = (codigo: string, descr: string) => {
    if (auxAberto === 'marca') {
      setMarcas((prev) => [{ codmarca: codigo, descr } as Marca, ...prev]);
      handleProdutoChange({ ...produto, codmarca: codigo });
    } else if (auxAberto === 'grupoFuncao') {
      setGruposFuncao((prev) => [
        { codgpf: codigo, descr } as unknown as GrupoFuncao,
        ...prev,
      ]);
      handleProdutoChange({ ...produto, codgpf: codigo });
    } else if (auxAberto === 'grupoProduto') {
      setGruposProduto((prev) => [
        { codgpp: codigo, descr } as GrupoProduto,
        ...prev,
      ]);
      handleProdutoChange({ ...produto, codgpp: codigo });
    }
  };
  const [searchMarcas, setSearchMarcas] = useState<string>('');
  const [searchGruposFuncao, setSearchGruposFuncao] = useState<string>('');
  const [searchGruposProduto, setSearchGruposProduto] = useState<string>('');
  const [loadingMarcas, setLoadingMarcas] = useState<boolean>(false);
  const [loadingGruposFuncao, setLoadingGruposFuncao] = useState<boolean>(false);
  const [loadingGruposProduto, setLoadingGruposProduto] = useState<boolean>(false);
  const [comissaoHabilitada, setComissaoHabilitada] = useState<boolean>(
    !!(produto.comdifeext || produto.comdifeext_int || produto.comdifint),
  );

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
    setLoadingMarcas(true);
    try {
      const fetchedMarcas: Marcas = await getMarcas({ page: 1, perPage: 99, search: searchMarcas });
      if (!fetchedMarcas) return;
      setMarcas(fetchedMarcas.data);
    } finally { setLoadingMarcas(false); }
  };

  const handleGruposFuncao = async () => {
    setLoadingGruposFuncao(true);
    try {
      const fetchedGruposFuncao: GruposFuncao = await getGruposFuncao({ page: 1, perPage: 99, search: searchGruposFuncao });
      if (!fetchedGruposFuncao) return;
      setGruposFuncao(fetchedGruposFuncao.data);
    } finally { setLoadingGruposFuncao(false); }
  };

  const handleGruposProduto = async () => {
    setLoadingGruposProduto(true);
    try {
      const fetchedGruposProduto: GruposProduto = await getGruposProduto({ page: 1, perPage: 99, search: searchGruposProduto });
      if (!fetchedGruposProduto) return;
      setGruposProduto(fetchedGruposProduto.data);
    } finally { setLoadingGruposProduto(false); }
  };

  // Não há validação de referência ao sair do campo: a mesma referência existe
  // legitimamente em marcas diferentes, então avisar só com a ref digitada era
  // falso alarme. O duplicado real é Referência + Marca, verificado no
  // modalCadastrar (verificar-ref-marca), que oferece editar o existente.

  const marcaOptions = marcas.map((marca) => ({
    value: marca.codmarca.toString(),
    label: `${marca.codmarca} - ${marca.descr}`,
  }));

  const grupoFuncaoOptions = gruposFuncao.map((grupoFuncao) => ({
    value: grupoFuncao.codgpf.toString(),
    label: `${grupoFuncao.codgpf} - ${grupoFuncao.descr}`,
  }));

  const grupoProdutoOptions = gruposProduto.map((grupoProduto) => ({
    value: grupoProduto.codgpp.toString(),
    label: `${grupoProduto.codgpp} - ${grupoProduto.descr}`,
  }));

  return (
    <>
      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-4 gap-4">
          <FormInput
            name="codbar"
            type="text"
            label="Código de Barras"
            value={produto.codbar || ''}
            maxLength={15}
            onChange={(e) =>
              handleProdutoChange({
                ...produto,
                codbar: e.target.value.slice(0, 15),
              })
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
          <div className={error?.ref ? 'field-error' : ''}>
            <FormInput
              name="ref"
              type="text"
              label="Referência"
              value={produto.ref || ''}
              onChange={(e) =>
                handleProdutoChange({ ...produto, ref: e.target.value })
              }
              error={error?.ref}
              required
            />
          </div>
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
        <div className="grid grid-cols-2 gap-4">
          <div className={error?.descr ? 'field-error' : ''}>
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
          </div>
          <FormInput
            name="aplic_extendida"
            type="text"
            label="Aplicação Extendida"
            required
            value={produto.aplic_extendida || ''}
            onChange={(e) =>
              handleProdutoChange({ ...produto, aplic_extendida: e.target.value })
            }
            error={error?.aplic_extendida}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className={error?.codmarca ? 'field-error' : ''}>
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <ComboboxInput
                  name="codmarca"
                  label="Marca"
                  required
                  loading={loadingMarcas}
                  options={marcaOptions}
                  value={produto.codmarca || ''}
                  onValueChange={(value) =>
                    handleProdutoChange({ ...produto, codmarca: value as string })
                  }
                  error={error?.codmarca}
                />
              </div>
              <button
                type="button"
                onClick={() => setAuxAberto('marca')}
                title="Cadastrar nova marca"
                className="mt-6 h-10 w-10 shrink-0 flex items-center justify-center rounded bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
          <div className={error?.codgpf ? 'field-error' : ''}>
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <ComboboxInput
                  name="codgpf"
                  label="Grupo de Função"
                  required
                  loading={loadingGruposFuncao}
                  options={grupoFuncaoOptions}
                  value={produto.codgpf || ''}
                  onValueChange={(value) =>
                    handleProdutoChange({ ...produto, codgpf: value as string })
                  }
                  error={error?.codgpf}
                />
              </div>
              <button
                type="button"
                onClick={() => setAuxAberto('grupoFuncao')}
                title="Cadastrar novo grupo de função"
                className="mt-6 h-10 w-10 shrink-0 flex items-center justify-center rounded bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div className={error?.codgpp ? 'field-error' : ''}>
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <ComboboxInput
                  name="codgpp"
                  label="Grupo de Produto"
                  required
                  loading={loadingGruposProduto}
                  options={grupoProdutoOptions}
                  value={produto.codgpp || ''}
                  onValueChange={(value) =>
                    handleProdutoChange({ ...produto, codgpp: value as string })
                  }
                  error={error?.codgpp}
                />
              </div>
              <button
                type="button"
                onClick={() => setAuxAberto('grupoProduto')}
                title="Cadastrar novo grupo de produto"
                className="mt-6 h-10 w-10 shrink-0 flex items-center justify-center rounded bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
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
          <div className={error?.inf ? 'field-error' : ''}>
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
          </div>
          <CampoDecimal
            name="pesoliq"
            label="Peso Líquido"
            intDigits={5}
            decDigits={2}
            value={produto.pesoliq}
            onChangeValue={(v) =>
              handleProdutoChange({ ...produto, pesoliq: v })
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
          <div className={error?.unimed ? 'field-error' : ''}>
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
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div className={error?.multiplo ? 'field-error' : ''}>
            <FormInput
              name="multiplo"
              type="number"
              label="Múltiplo Venda"
              required
              disabled={multiploReadonly}
              value={displayNumberValue(produto.multiplo)}
              onChange={(e) =>
                handleProdutoChange({
                  ...produto,
                  multiplo: handleRequiredNumberChange(e.target.value, 1),
                })
              }
              error={error?.multiplo}
            />
          </div>
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
          <div className={error?.multiplocompra ? 'field-error' : ''}>
            <FormInput
              name="multiplocompra"
              type="number"
              label="Múltiplo Compra"
              required
              value={displayNumberValue(produto.multiplocompra)}
              onChange={(e) =>
                handleProdutoChange({
                  ...produto,
                  multiplocompra: handleRequiredNumberChange(e.target.value, 1),
                })
              }
              error={error?.multiplocompra}
            />
          </div>
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
        {/* Campos calculados automaticamente (somente leitura) — dbprod.qtestmin_sugerido / curva_sugerido */}
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            name="qtestmin_sugerido"
            type="text"
            label="Est. Mínimo Auto"
            value={String((produto as any).qtestmin_sugerido ?? '')}
            disabled
          />
          <FormInput
            name="curva_sugerido"
            type="text"
            label="Class. Curva ABC Auto"
            value={String((produto as any).curva_sugerido ?? '')}
            disabled
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

        {/* Comissões Diferenciadas (igual ao Delphi — fim dos Dados Cadastrais) */}
        <div className="border border-[#347AB6]/25 dark:border-blue-900/25 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Checkbox
              checked={comissaoHabilitada}
              onCheckedChange={(checked) => {
                setComissaoHabilitada(!!checked);
                if (!checked) {
                  handleProdutoChange({
                    ...produto,
                    comdifeext: undefined,
                    comdifeext_int: undefined,
                    comdifint: undefined,
                  });
                } else {
                  // Ao habilitar, inicializa os 3 (defined) — a validação ao
                  // salvar exige valor > 0 nas três comissões.
                  handleProdutoChange({
                    ...produto,
                    comdifeext: produto.comdifeext ?? 0,
                    comdifeext_int: produto.comdifeext_int ?? 0,
                    comdifint: produto.comdifint ?? 0,
                  });
                }
              }}
              id="chk-comissao"
            />
            <Label
              htmlFor="chk-comissao"
              className="font-bold text-gray-700 dark:text-gray-200 cursor-pointer"
            >
              Comissões Diferenciadas (%)
            </Label>
          </div>
          {comissaoHabilitada && (
            <div className="grid grid-cols-3 gap-4">
              <CampoDecimal
                name="comdifeext"
                label="Comissão Externa (%)"
                value={produto.comdifeext}
                onChangeValue={(v) =>
                  handleProdutoChange({ ...produto, comdifeext: v })
                }
                error={error?.comdifeext}
              />
              <CampoDecimal
                name="comdifeext_int"
                label="Comissão Externa/Interna (%)"
                value={produto.comdifeext_int}
                onChangeValue={(v) =>
                  handleProdutoChange({ ...produto, comdifeext_int: v })
                }
                error={error?.comdifeext_int}
              />
              <CampoDecimal
                name="comdifint"
                label="Comissão Interna (%)"
                value={produto.comdifint}
                onChangeValue={(v) =>
                  handleProdutoChange({ ...produto, comdifint: v })
                }
                error={error?.comdifint}
              />
            </div>
          )}
        </div>
      </div>

      {/* Cadastro rápido de Marca / Grupo de Função / Grupo de Produto */}
      <CadastroRapidoAux
        aberto={auxAberto !== null}
        tipo={auxAberto ?? 'marca'}
        onClose={() => setAuxAberto(null)}
        onCriado={handleAuxCriado}
        existentes={
          auxAberto === 'marca'
            ? marcas.map((m) => ({
                codigo: String(m.codmarca ?? '').trim(),
                descr: String(m.descr ?? '').trim(),
              }))
            : auxAberto === 'grupoFuncao'
              ? gruposFuncao.map((g) => ({
                  codigo: String(g.codgpf ?? '').trim(),
                  descr: String(g.descr ?? '').trim(),
                }))
              : auxAberto === 'grupoProduto'
                ? gruposProduto.map((g) => ({
                    codigo: String(g.codgpp ?? '').trim(),
                    descr: String(g.descr ?? '').trim(),
                  }))
                : []
        }
      />
    </>
  );
};

export default DadosCadastrais;

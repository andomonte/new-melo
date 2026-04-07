import FormInput from '@/components/common/FormInput';
import React, { useState } from 'react';
import {
  ClassesVendedor,
  DetalhadoVendedor,
  Vendedor,
  VendedorPst,
} from '@/data/vendedores/vendedores';
import SearchSelectInput from '@/components/common/SearchSelectInput';
import { Bairro, Bairros } from '@/data/bairros/bairros';
import SelectInput from '@/components/common/SelectInput';
import { GruposProduto } from '@/data/gruposProduto/gruposProduto';
import CheckInput from '@/components/common/CheckInput';
import { AuxButton } from '@/components/common/Buttons';
import { CadVendedorSearchOptions } from '@/components/corpo/admin/cadastro/vendedores/modalCadastrar';
import GruposProdutoTable from '@/components/corpo/admin/cadastro/vendedores/_components/GruposProdutoTable';

const tipoPessoaOptions = [
  { value: 'J', label: 'Jurídica' },
  { value: 'F', label: 'Física' },
  { value: 'X', label: 'X-Exterior' },
];

interface DadosCadastraisProps {
  vendedor: Vendedor;
  handleVendedorChange: (
    field:
      | keyof Vendedor
      | `detalhado_vendedor.${keyof DetalhadoVendedor}`
      | 'grupos_produto'
      | `pst.${keyof VendedorPst}`,
    value: any,
  ) => void;
  handleRemoveGrupoProduto: (codgpp: string) => void;
  error?: { [p: string]: string };
  options: {
    classesVendedor: ClassesVendedor;
    bairros: Bairros;
    gruposProduto: GruposProduto;
  };
  handleSearchOptionsChange: (
    option: CadVendedorSearchOptions,
    value: string,
  ) => void;
}

const DadosCadastrais: React.FC<DadosCadastraisProps> = ({
  vendedor,
  handleVendedorChange,
  handleRemoveGrupoProduto,
  error,
  options,
  handleSearchOptionsChange,
}) => {
  const [bairro, setBairro] = useState<Bairro>({} as Bairro);

  const [grupoProduto, setGrupoProduto] = useState<string>('');
  const [isExclusivo, setIsExclusivo] = useState<boolean>(false);

  const classesVendedorOptions =
    options.classesVendedor?.data?.map((classeVendedor) => ({
      value: classeVendedor.codcv,
      label: classeVendedor.descr,
    })) || [];

  const bairrosOptions =
    options.bairros?.data?.map((bairro) => ({
      value: bairro.codbairro,
      label: bairro.descr,
    })) || [];

  const gruposProdutoOptions =
    options.gruposProduto?.data?.map((grupoProduto) => ({
      value: grupoProduto.codgpp,
      label: grupoProduto.descr,
    })) || [];

  const gruposProdutoRows =
    vendedor.grupos_produto?.map((grupoProduto) => ({
      codgpp: grupoProduto.codgpp,
      descr: grupoProduto.grupo_produto?.descr,
      exclusivo: grupoProduto.exclusivo == 'S' ? 'Sim' : 'Não',
      acoes: (
        <AuxButton
          text="Remover"
          type="button"
          onClick={() =>
            handleRemoveGrupoProduto(grupoProduto.codgpp as string)
          }
        />
      ),
    })) || [];

  const handleAddGrupoProduto = () => {
    if (!grupoProduto) return;
    const findedGrupoProduto = options.gruposProduto?.data?.find(
      (gp) => gp.codgpp == grupoProduto,
    );
    if (!findedGrupoProduto) return;
    if (vendedor.grupos_produto?.some((gp) => gp.codgpp == grupoProduto))
      return;
    const newGrupoProduto = {
      codgpp: grupoProduto,
      grupoProduto: findedGrupoProduto,
      exclusivo: isExclusivo ? 'S' : 'N',
    };
    handleVendedorChange('grupos_produto', [
      ...(vendedor.grupos_produto || []),
      newGrupoProduto,
    ]);
  };

  return (
    <div className="grid grid-cols-1 gap-4">
      {/* ... (outros campos como Nome, Comissão, etc. continuam aqui) ... */}
      <FormInput
        name="nome"
        type="text"
        label="Nome"
        defaultValue={vendedor.nome || ''}
        onChange={(e) => handleVendedorChange('nome', e.target.value)}
        error={error?.nome}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-4">
          <FormInput
            name="comnormal"
            type="number"
            label="Comissão Normal %"
            value={vendedor.comnormal ?? ''}
            onChange={(e) => {
              const value = e.target.value;
              handleVendedorChange('comnormal', value === '' ? null : value);
            }}
            error={error?.comnormal}
          />
          <FormInput
            name="comtele"
            type="number"
            label="Comissão Telemarketing %"
            value={vendedor.comtele ?? ''}
            onChange={(e) => {
              const value = e.target.value;
              handleVendedorChange('comtele', value === '' ? null : value);
            }}
            error={error?.comtele}
          />
        </div>
        <div className="flex flex-col gap-4">
          <FormInput
            name="valobj"
            type="number"
            label="Valor Objetivo R$"
            value={vendedor.valobj ?? ''}
            onChange={(e) => {
              const value = e.target.value;
              handleVendedorChange('valobj', value === '' ? null : value);
            }}
            error={error?.valobj}
          />
          <FormInput
            name="limite"
            type="number"
            label="Limite de Débito R$"
            value={vendedor.limite ?? ''}
            onChange={(e) => {
              const value = e.target.value;
              handleVendedorChange('limite', value === '' ? null : value);
            }}
            error={error?.limite}
          />
        </div>
      </div>
      <SearchSelectInput
        name="codcv"
        label="Classe Vendedor"
        options={classesVendedorOptions}
        defaultValue={vendedor.codcv || ''}
        onValueChange={(value) => handleVendedorChange('codcv', value)}
        onInputChange={(value) =>
          handleSearchOptionsChange('classeVendedor', value)
        }
        error={error?.codcv}
        required
      />
      <p className="text-gray-700 font-bold">DETALHADO</p>
      <FormInput
        name="detalhadoVendedorNome"
        type="text"
        label="Nome Completo"
        defaultValue={vendedor.detalhado_vendedor?.nome || ''}
        onChange={(e) =>
          handleVendedorChange('detalhado_vendedor.nome', e.target.value)
        }
      />

      {/* ===== INÍCIO DA SEÇÃO DE ENDEREÇO REESTRUTURADA ===== */}

      {/* O FormInput de Endereço que ficava aqui foi movido para a grelha abaixo. */}

      {/* LINHA 1: CEP (1/4) e Endereço (3/4) */}
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-1">
          <FormInput
            name="detalhadoVendedorCep"
            type="text"
            label="CEP"
            defaultValue={vendedor.detalhado_vendedor?.cep || ''}
            onChange={(e) =>
              handleVendedorChange('detalhado_vendedor.cep', e.target.value)
            }
          />
        </div>
        <div className="col-span-3">
          <FormInput
            name="detalhadoVendedorEndereco"
            type="text"
            label="Endereço"
            defaultValue={vendedor.detalhado_vendedor?.logradouro || ''}
            onChange={(e) =>
              handleVendedorChange(
                'detalhado_vendedor.logradouro',
                e.target.value,
              )
            }
          />
        </div>
      </div>

      {/* LINHA 2: Bairro, Cidade e UF */}
      <div className="grid grid-cols-3 gap-4">
        <SearchSelectInput
          name="detalhadoVendedorBairro"
          label="Bairro"
          options={bairrosOptions}
          defaultValue={vendedor.detalhado_vendedor?.bairro || ''}
          onValueChange={(value) => {
            handleVendedorChange('detalhado_vendedor.bairro', value);
            const findedBairro = options.bairros?.data?.find(
              (bairro) => bairro.codbairro == value,
            );
            if (!findedBairro) return;
            setBairro(findedBairro);
            handleVendedorChange(
              'detalhado_vendedor.cidade',
              findedBairro.cidade,
            );
            handleVendedorChange('detalhado_vendedor.estado', findedBairro.uf);
          }}
          onInputChange={(value) => handleSearchOptionsChange('bairro', value)}
        />
        <FormInput
          name="detalhadoVendedorCidade"
          type="text"
          label="Cidade"
          defaultValue={
            bairro.cidade || vendedor.detalhado_vendedor?.cidade || ''
          }
          onChange={(e) =>
            handleVendedorChange(
              'detalhado_vendedor.cidade',
              bairro.cidade || e.target.value,
            )
          }
        />
        <FormInput
          name="detalhadoVendedorUf"
          type="text"
          label="UF"
          defaultValue={bairro.uf || vendedor.detalhado_vendedor?.estado || ''}
          onChange={(e) =>
            handleVendedorChange(
              'detalhado_vendedor.estado',
              bairro.uf || e.target.value,
            )
          }
        />
      </div>

      {/* ===== FIM DA SEÇÃO DE ENDEREÇO REESTRUTURADA ===== */}

      <div className="grid grid-cols-3 gap-4">
        <SelectInput
          name="detalhadoVendedorTipo"
          label="Tipo"
          options={tipoPessoaOptions}
          defaultValue={vendedor.detalhado_vendedor?.tipo || ''}
          onValueChange={(value) =>
            handleVendedorChange('detalhado_vendedor.tipo', value)
          }
        />
        <FormInput
          name="detalhadoVendedorDocumento"
          type="text"
          label="Documento"
          defaultValue={vendedor.detalhado_vendedor?.cpf_cnpj || ''}
          onChange={(e) =>
            handleVendedorChange('detalhado_vendedor.cpf_cnpj', e.target.value)
          }
        />
        <FormInput
          name="detalhadoVendedorCelular"
          type="text"
          label="Celular"
          defaultValue={vendedor.detalhado_vendedor?.celular || ''}
          onChange={(e) =>
            handleVendedorChange('detalhado_vendedor.celular', e.target.value)
          }
        />
      </div>

      {/* ... (resto do formulário como GRUPO DE PRODUTOS, etc.) ... */}
      <p className="text-gray-700 font-bold">GRUPO DE PRODUTOS</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid grid-cols-2 gap-4 justify-center items-center">
          <SearchSelectInput
            name="gruposProdutoVendedor"
            label="Grupos de Produto"
            options={gruposProdutoOptions}
            onValueChange={(value) => setGrupoProduto(value as string)}
            onInputChange={(value) =>
              handleSearchOptionsChange('grupoProduto', value)
            }
          />
          <CheckInput
            name="gruposProdutoExclusivo"
            label="Exclusivo"
            onChange={(e) => setIsExclusivo(e.target.checked)}
            checked={isExclusivo}
          />
        </div>
        <div className="flex flex-col gap-4">
          <FormInput
            name="codpst"
            type="text"
            label="Código PST"
            value={vendedor.pst?.codpst || ''}
            onChange={(e) => {
              const value = e.target.value;
              handleVendedorChange('pst.codpst', value);
            }}
            maxLength={4}
          />
          <FormInput
            name="ra_mat"
            type="text"
            label="Matrícula"
            defaultValue={vendedor.ra_mat || ''}
            onChange={(e) => handleVendedorChange('ra_mat', e.target.value)}
            maxLength={20}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid grid-cols-2 gap-4">
          <AuxButton
            text="Adicionar"
            onClick={handleAddGrupoProduto}
            type="button"
          />
        </div>
      </div>
      <GruposProdutoTable gruposProduto={gruposProdutoRows} />
    </div>
  );
};

export default DadosCadastrais;

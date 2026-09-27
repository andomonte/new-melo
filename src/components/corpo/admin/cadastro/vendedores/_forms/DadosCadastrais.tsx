import FormInput from '@/components/common/FormInput';
import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { mascaraInputBRL, desmascarar, formatarDecimalBR } from '@/utils/monetario';
import {
  ClassesVendedor,
  DetalhadoVendedor,
  Vendedor,
  VendedorPst,
} from '@/data/vendedores/vendedores';
import { Bairro, Bairros } from '@/data/bairros/bairros';
import SelectInput from '@/components/common/SelectPadrao';
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

// Bloco visual com título (nível de módulo p/ NÃO remontar os inputs a cada render).
const Bloco: React.FC<{ titulo: string; children: React.ReactNode }> = ({
  titulo,
  children,
}) => (
  <fieldset className="rounded-lg border border-gray-200 dark:border-zinc-700 p-3">
    <legend className="px-1 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-300">
      {titulo}
    </legend>
    <div className="grid grid-cols-1 gap-3">{children}</div>
  </fieldset>
);

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
  const [grupoDescr, setGrupoDescr] = useState<string>(''); // descr capturada no select
  const [isExclusivo, setIsExclusivo] = useState<boolean>(false);

  // Cadastro rápido de Classe de Vendedor (botão "+", como o Delphi).
  const [modalClasse, setModalClasse] = useState(false);
  const [descrNovaClasse, setDescrNovaClasse] = useState('');
  const [salvandoClasse, setSalvandoClasse] = useState(false);
  const [erroClasse, setErroClasse] = useState('');
  const [classesExtras, setClassesExtras] = useState<
    { codcv: string; descr: string }[]
  >([]);

  const classesVendedorOptions = [
    ...(options.classesVendedor?.data?.map((classeVendedor) => ({
      value: String(classeVendedor.codcv),
      label: `${classeVendedor.codcv} - ${classeVendedor.descr}`,
    })) || []),
    // Classes recém-criadas pelo "+": aparecem na hora, sem esperar recarregar.
    ...classesExtras.map((c) => ({
      value: String(c.codcv),
      label: `${c.codcv} - ${c.descr}`,
    })),
  ];

  const salvarNovaClasse = async () => {
    const descr = descrNovaClasse.trim();
    if (!descr) {
      setErroClasse('Informe a descrição da classe.');
      return;
    }
    setSalvandoClasse(true);
    setErroClasse('');
    try {
      const resp = await fetch('/api/vendedores/classes/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descr }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Erro ao cadastrar classe');
      setClassesExtras((prev) => [
        ...prev,
        { codcv: String(data.codcv), descr: String(data.descr) },
      ]);
      handleVendedorChange('codcv', String(data.codcv)); // já seleciona a nova
      setDescrNovaClasse('');
      setModalClasse(false);
    } catch (e: any) {
      setErroClasse(e.message || 'Erro ao cadastrar classe');
    } finally {
      setSalvandoClasse(false);
    }
  };

  const bairrosOptions =
    options.bairros?.data?.map((bairro) => ({
      value: bairro.codbairro,
      label: bairro.descr,
    })) || [];

  const gruposProdutoOptions =
    options.gruposProduto?.data?.map((grupoProduto) => ({
      value: String(grupoProduto.codgpp),
      label: `${grupoProduto.codgpp} - ${grupoProduto.descr}`,
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
    if (vendedor.grupos_produto?.some((gp) => gp.codgpp == grupoProduto))
      return;
    const newGrupoProduto = {
      codgpp: grupoProduto,
      // chave `grupo_produto` (a linha da tabela lê grupo_produto.descr);
      // usamos a descr capturada no select p/ não depender da página atual da busca.
      grupo_produto: { codgpp: grupoProduto, descr: grupoDescr },
      exclusivo: isExclusivo ? 'S' : 'N',
    };
    handleVendedorChange('grupos_produto', [
      ...(vendedor.grupos_produto || []),
      newGrupoProduto,
    ]);
    // Limpa o picker após adicionar (pronto para o próximo).
    setGrupoProduto('');
    setGrupoDescr('');
    setIsExclusivo(false);
  };

  // ── Máscaras (guardamos só dígitos; exibimos formatado) ──
  const soDigitos = (v?: string) => (v ?? '').replace(/\D/g, '');
  const mascaraCEP = (v?: string) => {
    const d = soDigitos(v).slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  };
  const mascaraCelular = (v?: string) => {
    const d = soDigitos(v).slice(0, 11);
    if (d.length <= 2) return d;
    const ddd = d.slice(0, 2);
    const r = d.slice(2);
    if (r.length <= 4) return `(${ddd}) ${r}`;
    if (r.length <= 8) return `(${ddd}) ${r.slice(0, 4)}-${r.slice(4)}`;
    return `(${ddd}) ${r.slice(0, 5)}-${r.slice(5)}`;
  };
  const mascaraCPF = (v?: string) => {
    const d = soDigitos(v).slice(0, 11);
    if (d.length > 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
    if (d.length > 6) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    if (d.length > 3) return `${d.slice(0, 3)}.${d.slice(3)}`;
    return d;
  };
  const mascaraCNPJ = (v?: string) => {
    const d = soDigitos(v).slice(0, 14);
    if (d.length > 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
    if (d.length > 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
    if (d.length > 5) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
    if (d.length > 2) return `${d.slice(0, 2)}.${d.slice(2)}`;
    return d;
  };

  // Tipo de pessoa → rótulo + máscara do Documento (Física=CPF, Jurídica=CNPJ), igual ao Delphi.
  const tipoPessoa = vendedor.detalhado_vendedor?.tipo || '';
  const docLabel = tipoPessoa === 'F' ? 'CPF' : tipoPessoa === 'J' ? 'CNPJ' : 'Documento';
  const mascararDoc = (v?: string) =>
    tipoPessoa === 'F' ? mascaraCPF(v) : tipoPessoa === 'J' ? mascaraCNPJ(v) : (v ?? '');

  return (
    <div className="grid grid-cols-1 gap-3">
      {/* ===================== BLOCO: DADOS PESSOAIS ===================== */}
      <Bloco titulo="Dados Pessoais">
        <div className="grid grid-cols-2 gap-3">
          <FormInput
            name="nome"
            type="text"
            label="Apelido"
            defaultValue={vendedor.nome || ''}
            onChange={(e) => handleVendedorChange('nome', e.target.value)}
            error={error?.nome}
            required
          />
          <FormInput
            name="detalhadoVendedorNome"
            type="text"
            label="Nome Completo"
            required
            defaultValue={vendedor.detalhado_vendedor?.nome || ''}
            onChange={(e) =>
              handleVendedorChange('detalhado_vendedor.nome', e.target.value)
            }
            error={error?.['detalhado_vendedor.nome']}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <SelectInput
            name="detalhadoVendedorTipo"
            label="Tipo"
            required
            options={tipoPessoaOptions}
            defaultValue={vendedor.detalhado_vendedor?.tipo || ''}
            onValueChange={(value) =>
              handleVendedorChange('detalhado_vendedor.tipo', value)
            }
            error={error?.['detalhado_vendedor.tipo']}
          />
          <FormInput
            name="detalhadoVendedorDocumento"
            type="text"
            label={docLabel}
            required
            value={mascararDoc(vendedor.detalhado_vendedor?.cpf_cnpj)}
            onChange={(e) =>
              handleVendedorChange(
                'detalhado_vendedor.cpf_cnpj',
                soDigitos(e.target.value),
              )
            }
            error={error?.['detalhado_vendedor.cpf_cnpj']}
          />
          <FormInput
            name="detalhadoVendedorCelular"
            type="text"
            label="Celular"
            value={mascaraCelular(vendedor.detalhado_vendedor?.celular)}
            onChange={(e) =>
              handleVendedorChange(
                'detalhado_vendedor.celular',
                soDigitos(e.target.value),
              )
            }
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormInput
            name="codpst"
            type="text"
            label="Código PST"
            value={vendedor.pst?.codpst || ''}
            onChange={(e) => handleVendedorChange('pst.codpst', e.target.value)}
            maxLength={4}
          />
          <FormInput
            name="ra_mat"
            type="text"
            label="Matrícula"
            defaultValue={vendedor.ra_mat || ''}
            onChange={(e) => handleVendedorChange('ra_mat', e.target.value)}
            maxLength={6}
            error={error?.ra_mat}
          />
        </div>
      </Bloco>

      {/* ===================== BLOCO: ENDEREÇO ===================== */}
      <Bloco titulo="Endereço">
        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-1">
            <FormInput
              name="detalhadoVendedorCep"
              type="text"
              label="CEP"
              required
              value={mascaraCEP(vendedor.detalhado_vendedor?.cep)}
              onChange={(e) =>
                handleVendedorChange(
                  'detalhado_vendedor.cep',
                  soDigitos(e.target.value),
                )
              }
              error={error?.['detalhado_vendedor.cep']}
            />
          </div>
          <div className="col-span-3">
            <FormInput
              name="detalhadoVendedorEndereco"
              type="text"
              label="Endereço"
              required
              defaultValue={vendedor.detalhado_vendedor?.logradouro || ''}
              onChange={(e) =>
                handleVendedorChange(
                  'detalhado_vendedor.logradouro',
                  e.target.value,
                )
              }
              error={error?.['detalhado_vendedor.logradouro']}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <SelectInput
            searchable
            name="detalhadoVendedorBairro"
            label="Bairro"
            required
            error={error?.['detalhado_vendedor.bairro']}
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
            /* Bairros (899) carregados por completo → filtro client-side. */
          />
          <FormInput
            name="detalhadoVendedorCidade"
            type="text"
            label="Cidade"
            required
            defaultValue={
              bairro.cidade || vendedor.detalhado_vendedor?.cidade || ''
            }
            onChange={(e) =>
              handleVendedorChange(
                'detalhado_vendedor.cidade',
                bairro.cidade || e.target.value,
              )
            }
            error={error?.['detalhado_vendedor.cidade']}
          />
          <FormInput
            name="detalhadoVendedorUf"
            type="text"
            label="UF"
            required
            defaultValue={
              bairro.uf || vendedor.detalhado_vendedor?.estado || ''
            }
            onChange={(e) =>
              handleVendedorChange(
                'detalhado_vendedor.estado',
                bairro.uf || e.target.value,
              )
            }
            maxLength={2}
            error={error?.['detalhado_vendedor.estado']}
          />
        </div>
      </Bloco>

      {/* ===================== BLOCO: DADOS COMERCIAIS ===================== */}
      <Bloco titulo="Dados Comerciais">
        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-end gap-1">
            <div className="flex-1">
              <SelectInput
                searchable
                name="codcv"
                label="Classe Vendedor"
                options={classesVendedorOptions}
                value={vendedor.codcv || ''}
                onValueChange={(value) => handleVendedorChange('codcv', value)}
                /* Sem busca remota: são poucas classes (o modal já carrega todas);
                   o filtro é client-side. */
                error={error?.codcv}
                required
              />
            </div>
            <button
              type="button"
              title="Cadastrar nova classe"
              onClick={() => {
                setErroClasse('');
                setModalClasse(true);
              }}
              className="mb-[1px] h-9 w-9 shrink-0 flex items-center justify-center rounded-md border border-gray-300 dark:border-zinc-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-zinc-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <FormInput
            name="comnormal"
            type="text"
            inputMode="decimal"
            label="Comissão Normal %"
            value={
              vendedor.comnormal != null
                ? formatarDecimalBR(vendedor.comnormal)
                : ''
            }
            onChange={(e) => {
              const mask = mascaraInputBRL(e.target.value);
              handleVendedorChange(
                'comnormal',
                mask ? Math.min(desmascarar(mask), 99.99) : null,
              );
            }}
            error={error?.comnormal}
          />
          <FormInput
            name="comtele"
            type="text"
            inputMode="decimal"
            label="Comissão Telemarketing %"
            value={
              vendedor.comtele != null
                ? formatarDecimalBR(vendedor.comtele)
                : ''
            }
            onChange={(e) => {
              const mask = mascaraInputBRL(e.target.value);
              handleVendedorChange(
                'comtele',
                mask ? Math.min(desmascarar(mask), 99.99) : null,
              );
            }}
            error={error?.comtele}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormInput
            name="valobj"
            type="text"
            inputMode="decimal"
            label="Valor Objetivo R$"
            value={
              vendedor.valobj != null ? formatarDecimalBR(vendedor.valobj) : ''
            }
            onChange={(e) => {
              const mask = mascaraInputBRL(e.target.value);
              handleVendedorChange('valobj', mask ? desmascarar(mask) : null);
            }}
            error={error?.valobj}
          />
          <FormInput
            name="limite"
            type="text"
            inputMode="decimal"
            label="Limite de Débito R$"
            value={
              vendedor.limite != null ? formatarDecimalBR(vendedor.limite) : ''
            }
            onChange={(e) => {
              const mask = mascaraInputBRL(e.target.value);
              handleVendedorChange('limite', mask ? desmascarar(mask) : null);
            }}
            error={error?.limite}
          />
        </div>

        {/* Grupo de Produtos */}
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-300 mt-1">
          GRUPO DE PRODUTOS
        </p>
        <div
          className="grid grid-cols-12 gap-3 items-end"
          onKeyDown={(e) => {
            // Grupo selecionado + Enter (fora do dropdown) → adiciona à lista.
            if (e.key === 'Enter' && grupoProduto) {
              e.preventDefault();
              handleAddGrupoProduto();
            }
          }}
        >
          <div className="col-span-6">
            <SelectInput
              searchable
              name="gruposProdutoVendedor"
              label="Grupos de Produto"
              options={gruposProdutoOptions}
              value={grupoProduto}
              onValueChange={(value) => {
                setGrupoProduto(value as string);
                // Captura a descr AGORA (a lista muda ao resetar a busca).
                const found = options.gruposProduto?.data?.find(
                  (gp) => String(gp.codgpp) === String(value),
                );
                setGrupoDescr(found?.descr || '');
                // Ao escolher, volta a lista à 1ª página (não fica presa no filtro remoto).
                if (value) handleSearchOptionsChange('grupoProduto', '');
              }}
              onInputChange={(value) =>
                handleSearchOptionsChange('grupoProduto', value)
              }
            />
          </div>
          <div className="col-span-3 pb-2">
            <CheckInput
              name="gruposProdutoExclusivo"
              label="Exclusivo"
              onChange={(e) => setIsExclusivo(e.target.checked)}
              checked={isExclusivo}
            />
          </div>
          <div className="col-span-3">
            <AuxButton
              text="Adicionar"
              onClick={handleAddGrupoProduto}
              type="button"
            />
          </div>
        </div>
        <GruposProdutoTable gruposProduto={gruposProdutoRows} />
      </Bloco>

      {/* Modal: cadastro rápido de Classe de Vendedor */}
      {modalClasse && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40"
          onClick={() => setModalClasse(false)}
        >
          <div
            className="w-[92%] max-w-sm rounded-lg bg-white dark:bg-zinc-900 p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold mb-2 text-gray-700 dark:text-gray-100">
              Nova Classe de Vendedor
            </h3>
            <label className="text-xs text-gray-500 dark:text-gray-300">
              Descrição
            </label>
            <input
              autoFocus
              type="text"
              value={descrNovaClasse}
              maxLength={20}
              onChange={(e) => setDescrNovaClasse(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') salvarNovaClasse();
                if (e.key === 'Escape') setModalClasse(false);
              }}
              placeholder="Ex.: REPRESENTANTE-AM"
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {erroClasse && (
              <p className="text-xs text-red-500 mt-1">{erroClasse}</p>
            )}
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={() => setModalClasse(false)}
                className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarNovaClasse}
                disabled={salvandoClasse}
                className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {salvandoClasse ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DadosCadastrais;

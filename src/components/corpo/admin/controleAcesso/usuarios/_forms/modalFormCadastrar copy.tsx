import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import FormFooter from '@/components/common/FormFooter2';
import { Trash2, Sun } from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';
import { criarUsuario } from '@/data/usuarios/usuarios';
import ModalFuncoes from './ModalFuncoes';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getTodosPerfis, TodosPerfisResponse } from '@/data/perfis/perfis';
import { getTodasFiliais } from '@/data/filiais/filiais';
import { getTodasFuncoes } from '@/data/funcoes/funcoes';
import { Vendedor } from '@/data/vendedores/vendedores';
import ModalArmazens from './ModalArmazens'; // novo
import { Armazem, getTodosArmazens } from '@/data/armazem/armazens'; // novo

interface Funcao {
  id_functions: number;
  descricao: string;
  usadoEm?: string | null;
  sigla?: string | null;
}

interface Props {
  onClose: () => void;
  onSuccess?: () => void;
  onError?: () => void;
  titulo: string;
  vendedores: Vendedor[];
  isLoadingVendedores: boolean;
  errorVendedores: string | null;
  onSaveInitiated?: () => void;
  isSaving?: boolean;
}

interface ItemAdicionado {
  login_user_login: string;
  login_user_name: string;
  perfis: {
    perfil_name: string;
    filial: {
      codigo_filial: string;
      nome_filial: string;
      codvend?: string | null;
      armazens?: Armazem[];
      funcoesDoUsuario: Funcao[]; // <-- mover para cá
    }[];
    funcoesPadraoPerfil: Funcao[];
  }[];
}

export default function FormCadastrarUsuario({
  onClose,
  onSuccess,
  onError,
  titulo,
  vendedores,
  isLoadingVendedores,
  errorVendedores,
  onSaveInitiated,
  isSaving = false,
}: Props) {
  const { toast } = useToast();

  const [itensAtivados, setItensAtivados] = useState<{
    [key: string]: boolean;
  }>({});
  const [loginUser, setLoginUser] = useState('');
  const [nomeUser, setNomeUser] = useState('');
  const [showModalArmazens, setShowModalArmazens] = useState(false);
  const [armazensOptions, setArmazensOptions] = useState<Armazem[]>([]);

  const [showModalFuncoes, setShowModalFuncoes] = useState(false);
  const [funcoesDisponiveis, setFuncoesDisponiveis] = useState<Funcao[]>([]);
  const [funcoesSelecionadas, setFuncoesSelecionadas] = useState<Funcao[]>([]);
  const [funcoesFiltradas, setFuncoesFiltradas] = useState<Funcao[]>([]);
  const [perfisOptions, setPerfisOptions] = useState<
    { label: string; value: string }[]
  >([]);

  const [perfilSelecionado, setPerfilSelecionado] = useState<string>('');
  const [filialSelecionada, setFilialSelecionada] = useState<string>('');
  const [codvendInput, setCodvendInput] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(true);
  const [filiaisOptions, setFiliaisOptions] = useState<
    { label: string; value: number }[]
  >([]);

  const [itensAdicionados, setItensAdicionados] = useState<ItemAdicionado>({
    login_user_login: '',
    login_user_name: '',
    perfis: [],
  });
  const [armazemSelecionado, setArmazemSelecionado] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const camposPrincipaisPreenchidos =
      loginUser.trim() !== '' && nomeUser.trim() !== '';

    const possuiPerfisValidos = itensAdicionados.perfis.length > 0;

    let perfisValidos = true;

    for (const perfil of itensAdicionados.perfis) {
      if (perfil.perfil_name === 'VENDAS') {
        for (const filial of perfil.filial) {
          if (!filial.codvend) {
            perfisValidos = false;
            break;
          }
        }
      }
    }

    setHasChanges(
      camposPrincipaisPreenchidos && possuiPerfisValidos && perfisValidos,
    );
  }, [loginUser, nomeUser, itensAdicionados]);

  const handleDeleteItem = (perfilName: string, filialName: string) => {
    setItensAdicionados((prevItens) => {
      const perfisAtualizados = prevItens.perfis
        .map((perfil) => {
          if (perfil.perfil_name === perfilName) {
            const filiaisAtualizadas = perfil.filial.filter(
              (filial) => filial.nome_filial !== filialName,
            );
            return {
              ...perfil,
              filial: filiaisAtualizadas,
              funcoesPadraoPerfil:
                filiaisAtualizadas.length === 0
                  ? []
                  : perfil.funcoesPadraoPerfil,
            };
          }
          return perfil;
        })
        .filter((perfil) => perfil.filial.length > 0);

      if (
        perfilName === perfilSelecionado &&
        filialName === filialSelecionada
      ) {
        setPerfilSelecionado('');
        setFilialSelecionada('');
        setFuncoesSelecionadas([]);
        setCodvendInput(null);
        setItensAtivados({});
      }
      return {
        ...prevItens,
        perfis: perfisAtualizados,
      };
    });
  };

  const handleAdicionarItem = () => {
    if (!perfilSelecionado || !filialSelecionada) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Selecione um perfil e uma filial antes de adicionar.',
        variant: 'destructive',
      });
      return;
    }

    if (perfilSelecionado === 'VENDAS' && !codvendInput) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Para o perfil Vendas, selecione um vendedor.',
        variant: 'destructive',
      });
      return;
    }

    setItensAdicionados((prev) => {
      const filialOption = filiaisOptions.find(
        (f) =>
          f.label.trim().toLowerCase() ===
          filialSelecionada.trim().toLowerCase(),
      );
      const codigoFilial = filialOption?.value?.toString() ?? '';

      const armazemObjSelecionado = armazensOptions.find(
        (a) => String(a.id_armazem) === armazemSelecionado,
      );

      const filialParaAdicionarOuAtualizar = {
        nome_filial: filialSelecionada,
        codigo_filial: codigoFilial,
        codvend: codvendInput ?? null,
        armazens: armazemObjSelecionado ? [armazemObjSelecionado] : [],
        funcoesDoUsuario: [...funcoesSelecionadas], // Agora direto na filial
      };

      let novaListaPerfis = [...prev.perfis];

      novaListaPerfis = novaListaPerfis
        .map((perfil) => {
          const filialEncontradaNoPerfil = perfil.filial.find(
            (f) =>
              f.nome_filial.trim().toLowerCase() ===
              filialParaAdicionarOuAtualizar.nome_filial.trim().toLowerCase(),
          );

          if (filialEncontradaNoPerfil) {
            return {
              ...perfil,
              filial: perfil.filial.filter(
                (f) =>
                  f.nome_filial.trim().toLowerCase() !==
                  filialParaAdicionarOuAtualizar.nome_filial
                    .trim()
                    .toLowerCase(),
              ),
            };
          }
          return perfil;
        })
        .filter((perfil) => perfil.filial.length > 0);

      const perfilTargetIndex = novaListaPerfis.findIndex(
        (p) =>
          p.perfil_name.trim().toLowerCase() ===
          perfilSelecionado.trim().toLowerCase(),
      );

      if (perfilTargetIndex !== -1) {
        novaListaPerfis[perfilTargetIndex].filial.push(
          filialParaAdicionarOuAtualizar,
        );
      } else {
        novaListaPerfis.push({
          perfil_name: perfilSelecionado,
          filial: [filialParaAdicionarOuAtualizar],
          funcoesPadraoPerfil: [],
        });
      }

      setPerfilSelecionado('');
      setFilialSelecionada('');
      setCodvendInput(null);
      setFuncoesSelecionadas([]);
      setItensAtivados({});
      setArmazemSelecionado(null);

      return {
        ...prev,
        perfis: novaListaPerfis,
      };
    });
  };

  useEffect(() => {
    const fetchFuncoes = async () => {
      try {
        const todasFuncoes = await getTodasFuncoes();
        setFuncoesFiltradas(todasFuncoes);
      } catch (error) {
        console.error('Erro ao buscar funções:', error);
      }
    };

    fetchFuncoes();

    async function fetchPerfis() {
      try {
        const response: TodosPerfisResponse = await getTodosPerfis();
        const options = response.data.map((perfil) => ({
          label: perfil.login_perfil_name,
          value: perfil.login_perfil_name,
        }));
        setPerfisOptions(options);
      } catch (error) {
        console.error('Erro ao buscar perfis:', error);
        toast({
          title: 'Erro ao buscar perfis',
          description: 'Não foi possível carregar os perfis.',
          variant: 'destructive',
        });
      }
    }

    fetchPerfis();

    async function fetchFiliais() {
      try {
        const response = await getTodasFiliais();
        const options = response.data.map((filial) => ({
          label: filial.nome_filial,
          value: filial.codigo_filial,
        }));
        setFiliaisOptions(options);
      } catch (error) {
        console.error('Erro ao buscar filiais:', error);
        toast({
          title: 'Erro ao buscar filiais',
          description: 'Não foi possível carregar as filiais.',
          variant: 'destructive',
        });
      }
    }

    fetchFiliais();
    async function fetchArmazens() {
      try {
        const response = await getTodosArmazens(loginUser);
        setArmazensOptions(response.data);
      } catch (_error) {
        toast({
          title: 'Erro ao buscar armazéns',
          description: 'Não foi possível carregar os armazéns.',
          variant: 'destructive',
        });
      }
    }
    fetchArmazens();
  }, [toast, loginUser]);

  const handlePerfilChange = (value: string) => {
    setPerfilSelecionado(value);
    setFilialSelecionada('');
    setFuncoesSelecionadas([]);
    setItensAtivados({});
  };

  const handleFilialChange = (label: string) => {
    setFilialSelecionada(label);
    setFuncoesSelecionadas([]);
    setItensAtivados({});

    let foundCodvend: string | null = null;
    for (const perfil of itensAdicionados.perfis) {
      const filial = perfil.filial.find((f) => f.nome_filial === label);
      if (filial?.codvend) {
        foundCodvend = filial.codvend;
        break;
      }
    }
    setCodvendInput(foundCodvend);
  };

  const handleOpenModalArmazens = () => {
    if (!filialSelecionada) return;
    setShowModalArmazens(true);
  };

  const armazensFiltradosDaFilialSelecionada = (): Armazem[] => {
    return armazensOptions.filter(
      (armazem) =>
        armazem.filial?.trim().toLowerCase() ===
        filialSelecionada.trim().toLowerCase(),
    );
  };

  const armazensSelecionadosDoItemAtual = (): Armazem[] => {
    const item = itensAdicionados.perfis.find(
      (p) =>
        p.perfil_name === perfilSelecionado &&
        p.filial.some((f) => f.nome_filial === filialSelecionada),
    );
    const filial = item?.filial.find(
      (f) => f.nome_filial === filialSelecionada,
    );
    return filial?.armazens ?? [];
  };

  const handleConfirmarArmazens = (selecionados: Armazem[]) => {
    setShowModalArmazens(false);
    setItensAdicionados((prev) => {
      const novos = { ...prev };
      const idx = novos.perfis.findIndex(
        (p) =>
          p.perfil_name === perfilSelecionado &&
          p.filial.some((f) => f.nome_filial === filialSelecionada),
      );
      if (idx !== -1) {
        const perfil = novos.perfis[idx];
        const filialIdx = perfil.filial.findIndex(
          (f) => f.nome_filial === filialSelecionada,
        );
        if (filialIdx !== -1) {
          novos.perfis[idx].filial[filialIdx].armazens = selecionados;
        }
      }
      return novos;
    });
  };

  const handleClear = () => {
    setLoginUser('');
    setNomeUser('');
    setItensAdicionados({
      login_user_login: '',
      login_user_name: '',
      perfis: [],
    });
    setPerfilSelecionado('');
    setFilialSelecionada('');
    setFuncoesSelecionadas([]);
    setCodvendInput(null);
    setItensAtivados({});
  };

  const handleSave = async () => {
    if (!loginUser.trim() || !nomeUser.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos antes de salvar.',
        variant: 'destructive',
      });
      return;
    }

    // Validação para cada item adicionado na tabela
    for (const perfilData of itensAdicionados.perfis) {
      if (perfilData.perfil_name === 'VENDAS') {
        // Encontra a filial associada a este perfil
        for (const filial of perfilData.filial) {
          if (perfilData.perfil_name === 'VENDAS' && !filial.codvend) {
            toast({
              title: 'Campos obrigatórios',
              description: `O perfil Vendas para a filial ${filial.nome_filial} requer um vendedor.`,
              variant: 'destructive',
            });
            return;
          }
        }
      }
    }

    try {
      onSaveInitiated?.();
      const payload = {
        ...itensAdicionados,
        login_user_login: loginUser,
        login_user_name: nomeUser,
      };
      await criarUsuario(payload);

      onSuccess?.();
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      onError?.();
    }
  };

  const handleOpenModalFuncoes = () => {
    const perfilAtivado = itensAdicionados.perfis.find(
      (p) => p.perfil_name === perfilSelecionado,
    );

    const filialAtivada = perfilAtivado?.filial.find(
      (f) => f.nome_filial === filialSelecionada,
    );

    const funcoesPadrao = perfilAtivado?.funcoesPadraoPerfil ?? [];

    const funcoesEditaveis = funcoesFiltradas.filter(
      (f) => !funcoesPadrao.some((fp) => fp.id_functions === f.id_functions),
    );

    setFuncoesDisponiveis(funcoesEditaveis);
    setFuncoesSelecionadas(filialAtivada?.funcoesDoUsuario ?? []);
    setShowModalFuncoes(true);
  };

  const handleConfirmarFuncoes = (selecionadas: Funcao[]) => {
    setFuncoesSelecionadas(selecionadas);
    setShowModalFuncoes(false);

    setItensAdicionados((prev) => {
      const novos = { ...prev };
      for (const perfil of novos.perfis) {
        const filial = perfil.filial.find(
          (f) => f.nome_filial === filialSelecionada,
        );
        if (filial) {
          filial.funcoesDoUsuario = selecionadas;
          break;
        }
      }
      return novos;
    });
  };

  const handleSunClick = (perfilName: string, filialName: string) => {
    const key = `${perfilName}-${filialName}`;
    const isAtivado = itensAtivados[key];

    if (isAtivado) {
      setItensAtivados({});
      setPerfilSelecionado('');
      setFilialSelecionada('');
      setFuncoesSelecionadas([]);
      if (
        perfilSelecionado === perfilName &&
        filialSelecionada === filialName
      ) {
        setCodvendInput(null);
      }
    } else {
      const perfilEncontrado = itensAdicionados.perfis.find(
        (p) => p.perfil_name === perfilName,
      );
      const filialEncontrada = perfilEncontrado?.filial.find(
        (f) =>
          f.nome_filial.trim().toLowerCase() ===
          filialName.trim().toLowerCase(),
      );

      const funcoesCombinadas = [
        ...(perfilEncontrado?.funcoesPadraoPerfil ?? []),
        ...(filialEncontrada?.funcoesDoUsuario ?? []),
      ];

      setItensAtivados({ [key]: true });
      setPerfilSelecionado(perfilName);
      setFilialSelecionada(filialName);
      setFuncoesSelecionadas(funcoesCombinadas);
      setCodvendInput(filialEncontrada?.codvend ?? null);
    }
  };

  const handleLoginChange = (value: string) => {
    setLoginUser(value);
  };

  const handleNomeChange = (value: string) => {
    setNomeUser(value);
  };

  const areFunctionsEqual = (arr1: Funcao[], arr2: Funcao[]): boolean => {
    if (arr1.length !== arr2.length) return false;
    const ids1 = arr1.map((f) => f.id_functions).sort();
    const ids2 = arr2.map((f) => f.id_functions).sort();
    return JSON.stringify(ids1) === JSON.stringify(ids2);
  };

  const isAdicionarHabilitado = (() => {
    if (!perfilSelecionado || !filialSelecionada) return false;
    if (perfilSelecionado === 'VENDAS' && !codvendInput) return false;

    // Verifica se existe ao menos um armazém selecionado
    const armazensSelecionados = armazensSelecionadosDoItemAtual();
    if (armazensSelecionados.length === 0) return false;

    const itemNaLista = itensAdicionados.perfis.find(
      (p) =>
        p.perfil_name === perfilSelecionado &&
        p.filial.some((f) => f.nome_filial === filialSelecionada),
    );

    if (!itemNaLista) return true;

    const filialNaLista = itemNaLista.filial.find(
      (f) => f.nome_filial === filialSelecionada,
    );

    const funcoesItemNaListaNormalizadas =
      filialNaLista?.funcoesDoUsuario.map((funcao) => ({
        id_functions: funcao.id_functions,
        descricao: funcao.descricao,
        sigla: funcao.sigla ?? '-',
        usadoEm: funcao.usadoEm ?? '-',
      })) ?? [];

    const funcoesMudaram = !areFunctionsEqual(
      funcoesSelecionadas,
      funcoesItemNaListaNormalizadas,
    );
    const codvendMudou = (codvendInput ?? null) !== filialNaLista?.codvend;
    const armazensMudaram =
      JSON.stringify(
        (filialNaLista?.armazens ?? []).map((a) => a.id_armazem).sort(),
      ) !==
      JSON.stringify(armazensSelecionados.map((a) => a.id_armazem).sort());

    return funcoesMudaram || codvendMudou || armazensMudaram;
  })();

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg shadow-lg w-full h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
          <h4 className="text-xl font-bold text-blue-600 dark:text-blue-300">
            {titulo}
          </h4>

          <div className="flex items-center space-x-6">
            <FormFooter
              onSubmit={handleSave}
              onClear={handleClear}
              hasChanges={hasChanges}
              isSaving={isSaving}
            />

            <button
              onClick={onClose}
              className="text-gray-500  dark:text-gray-100 hover:text-red-500"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="h-full flex-grow  px-6 py-6 text-gray-800 dark:text-gray-100">
          <div className="space-y-6">
            <div className="flex gap-4 text-xs">
              <div className="w-1/3">
                <label className="block mb-1 text-sm font-medium">Login</label>
                <input
                  autoComplete="off"
                  type="text"
                  value={loginUser}
                  onChange={(e) => handleLoginChange(e.target.value)}
                  className="w-full border rounded px-3 py-2 dark:border-slate-600 dark:bg-zinc-800"
                />
              </div>

              <div className="w-1/3">
                <label className="block mb-1 text-sm font-medium">
                  Nome do Usuário
                </label>
                <input
                  autoComplete="off"
                  type="text"
                  value={nomeUser}
                  onChange={(e) => handleNomeChange(e.target.value)}
                  className="w-full border rounded px-3 py-2 dark:border-slate-600 dark:bg-zinc-800"
                />
              </div>
              <div className="w-1/3">
                <label className="block mb-1 text-sm font-medium">
                  Vendedor<span className="text-red-500 ml-1">*</span>
                </label>
                <Select
                  value={codvendInput ?? ''}
                  onValueChange={(value) => setCodvendInput(value)}
                >
                  <SelectTrigger
                    disabled={!!errorVendedores}
                    className={`w-full border rounded px-3 py-2 dark:bg-zinc-800 ${
                      perfilSelecionado === 'VENDAS' && !codvendInput
                        ? 'border-red-500'
                        : ''
                    }`}
                  >
                    {isLoadingVendedores
                      ? 'Carregando...'
                      : codvendInput
                      ? vendedores.find(
                          (v) => String(v.codvend) === codvendInput,
                        )?.nome ?? 'Selecione'
                      : 'Selecione um vendedor'}
                  </SelectTrigger>
                  <SelectContent>
                    {vendedores.map((vendedor) => (
                      <SelectItem
                        key={String(vendedor.codvend)}
                        value={String(vendedor.codvend)}
                      >
                        {vendedor.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errorVendedores ? (
                  <span className="text-red-500 text-xs mt-1">
                    Erro ao carregar vendedores: {errorVendedores}
                  </span>
                ) : (
                  perfilSelecionado === 'VENDAS' &&
                  !codvendInput && (
                    <span className="text-red-500 text-xs mt-1">
                      Para o perfil Vendas, é obrigatório vendedor.
                    </span>
                  )
                )}
              </div>
            </div>

            <div className="flex gap-4 mt-4">
              <div className=" w-[25%]">
                <label className="block mb-1 text-sm font-medium">Perfis</label>
                <Select
                  value={perfilSelecionado}
                  onValueChange={handlePerfilChange}
                >
                  <SelectTrigger className="w-full border rounded px-3 py-2 dark:bg-zinc-800">
                    <SelectValue placeholder="Selecione um perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    {perfisOptions.map((perfil) => (
                      <SelectItem key={perfil.value} value={perfil.value}>
                        {perfil.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className=" w-[25%]">
                <label className="block mb-1 text-sm font-medium">
                  Filiais
                </label>
                <Select
                  value={filialSelecionada}
                  onValueChange={handleFilialChange}
                >
                  <SelectTrigger className="w-full border rounded px-3 py-2 dark:bg-zinc-800">
                    <SelectValue placeholder="Selecione uma filial" />
                  </SelectTrigger>
                  <SelectContent>
                    {filiaisOptions.map((filial) => (
                      <SelectItem key={filial.value} value={filial.label}>
                        {filial.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Ajuste para seleção ÚNICA de Armazéns - REMOVIDO 'multiple' */}
              <div className="w-[25%] flex justify-center items-end">
                <button
                  className={`w-full px-4 py-2 rounded text-white ${
                    filialSelecionada
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-gray-400 cursor-not-allowed'
                  }`}
                  onClick={handleOpenModalArmazens}
                  disabled={!filialSelecionada}
                >
                  Armazéns
                </button>
              </div>

              <div className=" w-[25%]  flex justify-center items-end ">
                <button
                  className="w-full  bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded"
                  onClick={handleOpenModalFuncoes}
                >
                  Funções
                </button>
              </div>
              <div className="w-[25%] flex justify-center items-end">
                <button
                  className={`w-full px-4 py-2 rounded ${
                    isAdicionarHabilitado
                      ? 'bg-orange-600 hover:bg-orange-700 text-white'
                      : 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  }`}
                  onClick={handleAdicionarItem}
                  disabled={!isAdicionarHabilitado}
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4  rounded-lg border border-gray-300 dark:border-gray-600 shadow h-[calc(100vh-330px)] flex flex-col">
            <div className="bg-gray-200 dark:bg-gray-700 p-2 grid grid-cols-6 gap-4 border-b border-gray-300 dark:border-gray-600">
              <div className="font-semibold text-sm text-gray-600 dark:text-gray-300 flex justify-center items-center">
                Perfil
              </div>
              <div className="font-semibold text-sm text-gray-600 dark:text-gray-300 flex justify-center items-center">
                Vendedor
              </div>
              <div className="font-semibold text-sm text-gray-600 dark:text-gray-300 flex justify-center items-center">
                Filial
              </div>
              <div className="font-semibold text-sm text-gray-600 dark:text-gray-300 flex justify-center items-center">
                Armazéns
              </div>

              <div className="font-semibold text-sm text-gray-600 dark:text-gray-300 flex justify-center items-center">
                Funções
              </div>
              <div className="font-semibold text-sm text-gray-600 dark:text-gray-300 flex justify-center items-center">
                Ação
              </div>
            </div>
            <div className=" overflow-y-auto flex-grow p-0">
              <div className="">
                {itensAdicionados.perfis.map((perfil, perfilIdx) =>
                  perfil.filial.map((filial, filialIdx) => (
                    <div
                      key={`${perfilIdx}-${filialIdx}`}
                      className="w-full grid grid-cols-6 gap-4 border-b border-gray-300 dark:border-gray-600"
                    >
                      <div className=" rounded-lg p-2 text-center text-sm flex justify-center items-center h-24">
                        {perfil.perfil_name}
                      </div>

                      <div className="rounded-lg p-2 text-center text-sm flex justify-center items-center h-24">
                        {(() => {
                          const vendedorCod = filial.codvend;
                          const vendedor = vendedores.find(
                            (v) => String(v.codvend) === String(vendedorCod),
                          );

                          return vendedor?.nome ?? '-';
                        })()}
                      </div>

                      <div className=" rounded-lg p-2 text-center text-sm flex justify-center items-center h-24">
                        {filial.nome_filial}
                      </div>
                      <div className="rounded-lg p-2 text-center text-sm flex justify-center items-center h-24">
                        {filial.armazens && filial.armazens.length > 0
                          ? filial.armazens
                              .map((a) => a.nome || 'N/A')
                              .join(', ')
                          : 'N/A'}
                      </div>
                      <div className="rounded-lg p-2 text-sm flex flex-col justify-center items-center h-24 overflow-y-auto space-y-1">
                        {[
                          ...(perfil.funcoesPadraoPerfil ?? []),
                          ...(filial.funcoesDoUsuario ?? []),
                        ].map((funcao, idx) => {
                          const isPadrao = perfil.funcoesPadraoPerfil?.some(
                            (f) => f.id_functions === funcao.id_functions,
                          );

                          return (
                            <div
                              key={`${funcao.id_functions}-${idx}`}
                              className={`w-full flex justify-center items-center p-1 ${
                                isPadrao ? 'text-red-500 font-semibold' : ''
                              }`}
                            >
                              <span>{funcao.sigla || '-'}</span>
                            </div>
                          );
                        })}
                      </div>

                      <div className=" rounded-lg p-2 text-center text-sm flex justify-center items-center space-x-4">
                        <Sun
                          className={`cursor-pointer hover:opacity-75 ${
                            itensAtivados[
                              `${perfil.perfil_name}-${filial.nome_filial}`
                            ]
                              ? 'text-yellow-500'
                              : 'text-gray-500'
                          }`}
                          onClick={() => {
                            handleSunClick(
                              perfil.perfil_name,
                              filial.nome_filial,
                            );
                          }}
                        />

                        <Trash2
                          size={16}
                          className="cursor-pointer text-red-500 hover:text-red-600"
                          onClick={() =>
                            handleDeleteItem(
                              perfil.perfil_name,
                              filial.nome_filial,
                            )
                          }
                        />
                      </div>
                    </div>
                  )),
                )}
              </div>
            </div>
          </div>
        </div>

        <ModalFuncoes
          isOpen={showModalFuncoes}
          onClose={() => setShowModalFuncoes(false)}
          funcoes={funcoesDisponiveis}
          selecionadas={funcoesSelecionadas}
          onConfirmar={(selecionadas: Funcao[]) =>
            handleConfirmarFuncoes(selecionadas)
          }
          funcoesFiltradas={funcoesFiltradas}
        />
        {showModalArmazens && (
          <ModalArmazens
            isOpen={showModalArmazens}
            onClose={() => setShowModalArmazens(false)}
            armazensSelecionadosAtuais={armazensSelecionadosDoItemAtual()}
            onConfirmar={handleConfirmarArmazens}
            armazensDisponiveisFilial={armazensFiltradosDaFilialSelecionada()}
          />
        )}

        <Toaster />
      </div>
    </div>
  );
}

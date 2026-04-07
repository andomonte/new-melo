// src/components/modals/usuarios/modalFormEditar.tsx

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { buscarArmazensPerfil } from '@/data/armazem/armazens';
import { buscarFuncoesPerfil } from '@/data/funcoes/funcoes';
import { useToast } from '@/hooks/use-toast';
import FormFooter from '@/components/common/FormFooter2';
import { Trash2, Sun } from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';
// Removida a declaração local da interface UsuarioEdit
import { criarUsuario } from '@/data/usuarios/usuarios'; // Importa UsuarioEdit daqui
import ModalFuncoes from './ModalFuncoes';
import ModalArmazens from './ModalArmazens';
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
import { Armazem, getTodosArmazens } from '@/data/armazem/armazens';
import { Comprador } from '@/data/compradores/compradores';
interface Funcao {
  id_functions: number;
  descricao: string;
  usadoEm?: string | null;
  sigla?: string | null;
}

// A interface UsuarioEdit local foi removida e agora confiamos na importada.

interface Props {
  onClose: () => void;
  onSuccess?: () => void;
  onError?: () => void;
  titulo: string;
  vendedores: Vendedor[];
  compradores: Comprador[];
  isLoadingCompradores: boolean; // ✅ novo
  errorCompradores: string | null; // ✅ novo
  isLoadingVendedores: boolean;
  errorVendedores: string | null;
  onSaveInitiated?: () => void;
  isSaving?: boolean;
}

// Interface ItemAdicionado permanece local pois sua estrutura pode ser diferente de UsuarioEdit para manipulação interna
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
      funcoesDoUsuario: Funcao[];
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
  compradores,
  isLoadingCompradores,
  errorCompradores,
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
  const [showModalFuncoes, setShowModalFuncoes] = useState(false);
  const [showModalArmazens, setShowModalArmazens] = useState(false);
  const [funcoesDisponiveis, setFuncoesDisponiveis] = useState<Funcao[]>([]);
  const [funcoesSelecionadas, setFuncoesSelecionadas] = useState<Funcao[]>([]);
  const [funcoesFiltradas, setFuncoesFiltradas] = useState<Funcao[]>([]);
  const [perfisOptions, setPerfisOptions] = useState<
    { label: string; value: string }[]
  >([]);
  const [funcoesPadraoPerfil, setFuncoesPadraoPerfil] = useState<Funcao[]>([]);
  const [armazensPadraoPerfil, setArmazensPadraoPerfil] = useState<Armazem[]>(
    [],
  );

  const [perfilSelecionado, setPerfilSelecionado] = useState<string>('');
  const [filialSelecionada, setFilialSelecionada] = useState<string>('');
  const [codvendInput, setCodvendInput] = useState<string | null>(null);

  const [hasChanges, setHasChanges] = useState(false);
  const [filiaisOptions, setFiliaisOptions] = useState<
    { label: string; value: number }[]
  >([]);
  const [armazensOptions, setArmazensOptions] = useState<Armazem[]>([]);
  // Para fins de demonstração, o armazém selecionado será apenas um,
  // pois o Select padrão da Shadcn UI não suporta 'multiple' nativamente.

  const [armazensSelecionados, setArmazensSelecionados] = useState<{
    [chave: string]: Armazem[];
  }>({});

  const handleOpenModalArmazens = () => {
    if (filialSelecionada) {
      const armazensEditaveis = armazensOptions.filter(
        (a) =>
          !armazensPadraoPerfil.some((ap) => ap.id_armazem === a.id_armazem),
      );

      setArmazensSelecionados((prev) => ({
        ...prev,
        [filialSelecionada]: armazensSelecionados[filialSelecionada] || [],
      }));

      setArmazensOptions(armazensEditaveis);
      setShowModalArmazens(true);
    }
  };

  const [itensAdicionados, setItensAdicionados] = useState<ItemAdicionado>({
    login_user_login: '',
    login_user_name: '',
    perfis: [],
  });

  useEffect(() => {
    const camposPrincipaisPreenchidos =
      loginUser.trim() !== '' && nomeUser.trim() !== '';

    const possuiPerfis = itensAdicionados.perfis.length > 0;

    let perfisValidos = true;
    for (const perfil of itensAdicionados.perfis) {
      for (const filial of perfil.filial) {
        if (perfil.perfil_name === 'VENDAS' && !filial.codvend) {
          perfisValidos = false;
          break;
        }
        if (!filial.armazens || filial.armazens.length === 0) {
          perfisValidos = false;
          break;
        }
      }
    }

    setHasChanges(camposPrincipaisPreenchidos && possuiPerfis && perfisValidos);
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
              // Funções no nível do perfil
              funcoesPadraoPerfil:
                filiaisAtualizadas.length === 0
                  ? []
                  : perfil.funcoesPadraoPerfil,
              // Funções no nível do perfil
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
        // Limpa armazém selecionado
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

    if (perfilSelecionado.trim().toUpperCase() === 'VENDAS' && !codvendInput) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Para o perfil Vendas, selecione um vendedor.',
        variant: 'destructive',
      });
      return;
    }

    const chave = filialSelecionada;
    const armazens = armazensSelecionados[chave] ?? [];

    if (armazens.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Armazém obrigatório',
        description: 'Selecione um armazém para o item.',
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

      const novaFilial = {
        nome_filial: filialSelecionada,
        codigo_filial: codigoFilial,
        codvend: codvendInput ?? null,
        armazens: armazensSelecionados[filialSelecionada] ?? [],
        funcoesDoUsuario: funcoesSelecionadas,
      };

      // Remove qualquer linha que contenha a mesma filial
      const idxLinhaExistente = prev.perfis.findIndex((p) =>
        p.filial.some(
          (f) =>
            f.nome_filial.trim().toLowerCase() ===
            filialSelecionada.trim().toLowerCase(),
        ),
      );

      const novaLista = [...prev.perfis];

      if (idxLinhaExistente !== -1) {
        novaLista.splice(idxLinhaExistente, 1, {
          perfil_name: perfilSelecionado,
          filial: [novaFilial],
          funcoesPadraoPerfil:
            prev.perfis[idxLinhaExistente]?.funcoesPadraoPerfil ?? [],
        });
      } else {
        const funcoesPadrao: Funcao[] = []; // No cadastro não temos funções pré-carregadas

        novaLista.push({
          perfil_name: perfilSelecionado,
          filial: [novaFilial],
          funcoesPadraoPerfil: funcoesPadrao,
        });
      }

      // Limpa campos
      setPerfilSelecionado('');
      setFilialSelecionada('');
      setCodvendInput(null);
      setFuncoesSelecionadas([]);
      setItensAtivados({});

      return { ...prev, perfis: novaLista };
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
        setArmazensOptions(response.data); //response.data já é um array de Armazem
      } catch (error) {
        console.error('Erro ao buscar armazéns:', error);
        toast({
          title: 'Erro ao buscar armazéns',
          description: 'Não foi possível carregar os armazéns.',
          variant: 'destructive',
        });
      }
    }

    fetchArmazens();
  }, [toast, loginUser]);

  const handlePerfilChange = async (value: string) => {
    setPerfilSelecionado(value);

    try {
      // 1. Buscar funções padrão do perfil
      const funcoes = await buscarFuncoesPerfil(value);
      setFuncoesPadraoPerfil(funcoes);
      setFuncoesSelecionadas([]);

      // 2. Buscar armazéns padrão do perfil
      const armazens = await buscarArmazensPerfil(value);
      setArmazensPadraoPerfil(armazens);

      // Se houver funções/armazéns associados ao perfil, podemos pré-carregar:

      setArmazensSelecionados((prev) => ({
        ...prev,
        [filialSelecionada]: [], // Nenhum armazém do usuário selecionado
      }));
    } catch (error) {
      console.error('Erro ao buscar funções/armazéns do perfil:', error);
      toast({
        title: 'Erro',
        description:
          'Não foi possível carregar as funções ou armazéns do perfil.',
        variant: 'destructive',
      });
    }

    // Continua com o comportamento existente
    const perfilComFilial = itensAdicionados.perfis.find((p) =>
      p.filial.some((f) => f.nome_filial === filialSelecionada),
    );
    const filial = perfilComFilial?.filial.find(
      (f) => f.nome_filial === filialSelecionada,
    );

    setCodvendInput(filial?.codvend ?? null);
    if (filialSelecionada) {
      setItensAtivados({ [filialSelecionada]: true });
    }
  };

  const handleFilialChange = (label: string) => {
    setFilialSelecionada(label);
    setItensAtivados({});
    setArmazensSelecionados((prev) => {
      const novo = { ...prev };
      delete novo[label]; // limpa armazém anterior se havia
      return novo;
    });

    const perfilComEssaFilial = itensAdicionados.perfis.find((perfil) =>
      perfil.filial.some((filial) => filial.nome_filial === label),
    );

    if (perfilComEssaFilial) {
      const filialExistente = perfilComEssaFilial.filial.find(
        (filial) => filial.nome_filial === label,
      );

      const key = label; // controle unicamente pela filial
      setItensAtivados({ [key]: true });

      setPerfilSelecionado(perfilComEssaFilial.perfil_name);

      setFuncoesSelecionadas(
        filialExistente?.funcoesDoUsuario?.map((funcao) => ({
          ...funcao,
          sigla: funcao.sigla ?? '-',
          usadoEm: funcao.usadoEm ?? '-',
        })) ?? [],
      );

      setCodvendInput(filialExistente?.codvend ?? null);

      if (filialExistente?.armazens) {
        setArmazensSelecionados((prev) => ({
          ...prev,
          [key]: filialExistente.armazens ?? [],
        }));
      }
    } else {
      // Filial nova: limpa os campos

      setPerfilSelecionado('');
      setFuncoesSelecionadas([]);
      setCodvendInput(null);
    }
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
    setHasChanges(false);
    // Limpa armazém selecionado
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

    // Validações obrigatórias de armazém e codvend
    for (const perfil of itensAdicionados.perfis) {
      for (const filial of perfil.filial) {
        const contexto = `${perfil.perfil_name} - ${filial.nome_filial}`;

        // Armazém é obrigatório para todos os perfis
        if (!filial.armazens || filial.armazens.length === 0) {
          toast({
            title: 'Armazém obrigatório',
            description: `Selecione pelo menos um armazém para ${contexto}.`,
            variant: 'destructive',
          });
          return;
        }

        // Vendedor é obrigatório apenas para perfil VENDAS
        if (
          perfil.perfil_name === 'VENDAS' &&
          (filial.codvend === null || filial.codvend === undefined)
        ) {
          toast({
            title: 'Vendedor obrigatório',
            description: `Selecione um vendedor para ${contexto}.`,
            variant: 'destructive',
          });
          return;
        }
      }
    }

    try {
      onSaveInitiated?.();

      // Normaliza os dados antes de enviar:
      // Cada filial que foi adicionada/editada deve ser um objeto separado no array de 'perfis'
      // no formato esperado pela API, que parece ser um array de perfis-filiais combinados.

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
    const funcoesEditaveis = funcoesFiltradas.filter(
      (f) =>
        !funcoesPadraoPerfil.some((fp) => fp.id_functions === f.id_functions),
    );

    setFuncoesDisponiveis(funcoesEditaveis);
    setFuncoesSelecionadas(funcoesSelecionadas); // mantém selecionadas atuais
    setShowModalFuncoes(true);
  };

  const handleConfirmarFuncoes = (selecionados: Funcao[]) => {
    setFuncoesSelecionadas(selecionados);
    setShowModalFuncoes(false);
  };

  const handleSunClick = (
    perfilName: string,
    filialName: string,
    funcoes: Funcao[],
  ) => {
    const key = filialName;
    const isAtivado = itensAtivados[key];

    if (isAtivado) {
      setItensAtivados({});
      setPerfilSelecionado('');
      setFilialSelecionada('');
      setFuncoesSelecionadas([]);
      setCodvendInput(null);
      // Limpa armazém selecionado
    } else {
      const funcoesNormalizadas: Funcao[] = funcoes.map((funcao) => ({
        id_functions: funcao.id_functions,
        descricao: funcao.descricao,
        sigla: funcao.sigla ?? '-',
        usadoEm: funcao.usadoEm ?? '-',
      }));

      let filialEncontrada = null;
      for (const perfil of itensAdicionados.perfis) {
        if (
          perfil.perfil_name.trim().toLowerCase() ===
          perfilName.trim().toLowerCase()
        ) {
          const foundFilial = perfil.filial.find(
            (f) =>
              f.nome_filial.trim().toLowerCase() ===
              filialName.trim().toLowerCase(),
          );
          if (foundFilial) {
            filialEncontrada = foundFilial;
            break;
          }
        }
      }

      const codvendDoItemAtivado = filialEncontrada?.codvend ?? null;
      // Obter ID do armazém do item ativado (para seleção única)
      const chave = filialName;
      if (filialEncontrada?.armazens) {
        setArmazensSelecionados((prev) => ({
          ...prev,
          [chave]: filialEncontrada.armazens ?? [],
        }));
      }

      setItensAtivados({ [key]: true });
      setPerfilSelecionado(perfilName);
      setFilialSelecionada(filialName);
      setFuncoesSelecionadas(funcoesNormalizadas);

      setCodvendInput(
        codvendDoItemAtivado !== null && codvendDoItemAtivado !== undefined
          ? String(codvendDoItemAtivado)
          : null,
      );
    }
  };

  const handleLoginChange = (value: string) => {
    setLoginUser(value);
    setHasChanges(true);
  };

  const handleNomeChange = (value: string) => {
    setNomeUser(value);
    setHasChanges(true);
  };

  const areFunctionsEqual = (arr1: Funcao[], arr2: Funcao[]): boolean => {
    if (arr1.length !== arr2.length) return false;
    const ids1 = arr1.map((f) => f.id_functions).sort();
    const ids2 = arr2.map((f) => f.id_functions).sort();
    return JSON.stringify(ids1) === JSON.stringify(ids2);
  };

  // Nova função para comparar arrays de armazéns pelo id_armazem (para o caso de seleção única, compara o primeiro)
  const areArmazensEqual = (arr1: Armazem[], arr2: Armazem[]): boolean => {
    if (arr1.length !== arr2.length) return false;
    // Se forem arrays vazios, são iguais
    if (arr1.length === 0 && arr2.length === 0) return true;
    // Para seleção única, compare o primeiro elemento
    return arr1[0]?.id_armazem === arr2[0]?.id_armazem;
  };

  const isAdicionarHabilitado = (() => {
    if (!perfilSelecionado || !filialSelecionada) return false;
    const chave = filialSelecionada;
    const armazens = armazensSelecionados[chave] ?? [];

    if (armazens.length === 0) return false;

    if (perfilSelecionado === 'VENDAS' && !codvendInput) return false;

    const itemNaLista = itensAdicionados.perfis.find(
      (p) =>
        p.perfil_name === perfilSelecionado &&
        p.filial.some((f) => f.nome_filial === filialSelecionada),
    );

    if (!itemNaLista) {
      return true; // Novo item → habilita
    }

    const filialNaLista = itemNaLista.filial.find(
      (f) => f.nome_filial === filialSelecionada,
    );

    const codvendItemNaLista = filialNaLista?.codvend ?? null;
    const armazensItemNaLista: Armazem[] = filialNaLista?.armazens ?? [];

    const funcoesAtuais = funcoesSelecionadas.map((funcao) => ({
      id_functions: funcao.id_functions,
      descricao: funcao.descricao,
      sigla: funcao.sigla ?? '-',
      usadoEm: funcao.usadoEm ?? '-',
    }));

    const funcoesNaLista = filialNaLista?.funcoesDoUsuario.map(
      (funcao: Funcao) => ({
        id_functions: funcao.id_functions,
        descricao: funcao.descricao,
        sigla: funcao.sigla ?? '-',
        usadoEm: funcao.usadoEm ?? '-',
      }),
    );

    const funcoesMudaram = !areFunctionsEqual(
      funcoesAtuais,
      funcoesNaLista ?? [],
    );
    const codvendMudou =
      String(codvendInput ?? '') !== String(codvendItemNaLista ?? '');

    const armazemAtual: Armazem[] = armazensSelecionados[chave] ?? [];

    const armazensMudaram = !areArmazensEqual(
      armazemAtual,
      armazensItemNaLista,
    );

    return funcoesMudaram || codvendMudou || armazensMudaram;
  })();

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
    const chave = filialSelecionada;
    setArmazensSelecionados((prev) => ({
      ...prev,
      [chave]: selecionados,
    }));
    setShowModalArmazens(false);
  };

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

              <div className="w-[25%]">
                <label className="block mb-1 text-sm font-medium">
                  {perfilSelecionado === 'VENDAS' ||
                  perfilSelecionado === 'COMPRAS' ? (
                    <div>
                      {perfilSelecionado === 'VENDAS' ? (
                        <span className="text-ms mt-1">Vendedor*</span>
                      ) : (
                        <span className=" text-ms mt-1">Comprador*</span>
                      )}
                    </div>
                  ) : (
                    'Vendas ou Compras'
                  )}
                </label>
                <Select
                  disabled={
                    perfilSelecionado === 'COMPRADOR ADMIN' ||
                    perfilSelecionado === 'OUTRO PERFIL'
                  }
                  value={codvendInput ?? ''}
                  onValueChange={(value) => setCodvendInput(value)}
                >
                  <SelectTrigger
                    disabled={
                      errorVendedores || errorCompradores ? true : false
                    }
                    className={`w-full border rounded px-3 py-2 dark:bg-zinc-800 ${
                      perfilSelecionado === 'VENDAS' && !codvendInput
                        ? 'border-red-500'
                        : ''
                    }`}
                  >
                    <SelectValue placeholder="Selecione um vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingVendedores || isLoadingCompradores ? (
                      <SelectItem value="loading" disabled>
                        Carregando...
                      </SelectItem>
                    ) : errorVendedores || errorCompradores ? (
                      <SelectItem
                        value="error"
                        disabled={
                          perfilSelecionado === 'VENDAS' ||
                          perfilSelecionado === 'COMPRAS'
                            ? true
                            : false
                        }
                      >{`Erro: ${
                        errorVendedores ? errorVendedores : errorCompradores
                      }`}</SelectItem>
                    ) : (
                      <div>
                        <div>
                          {vendedores.map((vendedor) => (
                            <SelectItem
                              key={String(vendedor.codvend)}
                              value={String(vendedor.codvend)}
                            >
                              {vendedor.nome}
                            </SelectItem>
                          ))}
                        </div>
                        <div>
                          {compradores.map((comprador) => (
                            <SelectItem
                              key={String(comprador.codcomprador)}
                              value={String(comprador.codcomprador)}
                            >
                              {comprador.nome}
                            </SelectItem>
                          ))}
                        </div>
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {errorVendedores || errorCompradores ? (
                  <span className="text-red-500 text-xs mt-1">
                    Erro ao carregar{' '}
                    {errorVendedores ? 'vendedores:' : 'carregadores:'}{' '}
                    {errorVendedores ? errorVendedores : errorCompradores}
                  </span>
                ) : null}
              </div>

              <div className="w-[25%]">
                <label className="block mb-1 text-sm font-medium">
                  {perfilSelecionado === 'VENDAS' ||
                  perfilSelecionado === 'COMPRAS' ? (
                    <div>
                      {perfilSelecionado === 'VENDAS' ? (
                        <span className="text-ms mt-1">Vendedor*</span>
                      ) : (
                        <span className=" text-ms mt-1">Comprador*</span>
                      )}
                    </div>
                  ) : (
                    'Vendas ou Compras'
                  )}
                </label>
                <Select
                  disabled={
                    perfilSelecionado === 'COMPRADOR ADMIN' ||
                    perfilSelecionado === 'OUTRO PERFIL'
                  }
                  value={codvendInput ?? ''}
                  onValueChange={(value) => setCodvendInput(value)}
                >
                  <SelectTrigger
                    disabled={
                      errorVendedores || errorCompradores ? true : false
                    }
                    className={`w-full border rounded px-3 py-2 dark:bg-zinc-800 ${
                      perfilSelecionado === 'VENDAS' && !codvendInput
                        ? 'border-red-500'
                        : ''
                    }`}
                  >
                    <SelectValue placeholder="Selecione um vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingVendedores || isLoadingCompradores ? (
                      <SelectItem value="loading" disabled>
                        Carregando...
                      </SelectItem>
                    ) : errorVendedores || errorCompradores ? (
                      <SelectItem
                        value="error"
                        disabled={
                          perfilSelecionado === 'VENDAS' ||
                          perfilSelecionado === 'COMPRAS'
                            ? true
                            : false
                        }
                      >{`Erro: ${
                        errorVendedores ? errorVendedores : errorCompradores
                      }`}</SelectItem>
                    ) : (
                      <div>
                        <div>
                          {vendedores.map((vendedor) => (
                            <SelectItem
                              key={String(vendedor.codvend)}
                              value={String(vendedor.codvend)}
                            >
                              {vendedor.nome}
                            </SelectItem>
                          ))}
                        </div>
                        <div>
                          {compradores.map((comprador) => (
                            <SelectItem
                              key={String(comprador.codcomprador)}
                              value={String(comprador.codcomprador)}
                            >
                              {comprador.nome}
                            </SelectItem>
                          ))}
                        </div>
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {errorVendedores || errorCompradores ? (
                  <span className="text-red-500 text-xs mt-1">
                    Erro ao carregar{' '}
                    {errorVendedores ? 'vendedores:' : 'carregadores:'}{' '}
                    {errorVendedores ? errorVendedores : errorCompradores}
                  </span>
                ) : null}
              </div>
              {/* Ajuste para seleção ÚNICA de Armazéns - REMOVIDO 'multiple' */}
              <div className="w-[25%] flex justify-center items-end">
                <button
                  className={`w-full px-4 py-2 rounded text-white flex items-center justify-center gap-2 ${
                    filialSelecionada
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-gray-400 cursor-not-allowed'
                  }`}
                  onClick={handleOpenModalArmazens}
                  disabled={!filialSelecionada}
                >
                  Armazéns
                  <div className="px-2">
                    ({armazensSelecionados[filialSelecionada]?.length ?? 0})
                  </div>
                </button>
              </div>

              <div className=" w-[25%]  flex justify-center items-end ">
                <button
                  className="flex w-full justify-center bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded"
                  onClick={handleOpenModalFuncoes}
                >
                  Funções
                  <div className="px-2">({funcoesSelecionadas.length})</div>
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
                Filial
              </div>
              <div className="font-semibold text-sm text-gray-600 dark:text-gray-300 flex justify-center items-center">
                Vendedor
              </div>
              <div className="font-semibold text-sm text-gray-600 dark:text-gray-300 flex justify-center items-center">
                Armazéns
              </div>
              <div className="font-semibold text-sm text-gray-600 dark:text-gray-300 flex justify-center items-center">
                Funções do Usuário
              </div>
              <div className="font-semibold text-sm text-gray-600 dark:text-gray-300 flex justify-center items-center">
                Ações
              </div>
            </div>

            <div className="flex-grow overflow-y-auto">
              {itensAdicionados.perfis.map((perfil) =>
                perfil.filial.map((filial, _indexFilial) => {
                  // 'indexFilial' renomeado para '_indexFilial' para silenciar o aviso
                  const key = filial.nome_filial;
                  const isAtivado = itensAtivados[key];

                  return (
                    <div
                      key={key}
                      className={`grid grid-cols-6 gap-4 p-2 border-b dark:border-gray-700 text-sm ${
                        isAtivado ? 'bg-blue-100 dark:bg-blue-900' : ''
                      }`}
                    >
                      <div className="flex items-center justify-center text-center">
                        {perfil.perfil_name}
                      </div>
                      <div className="flex items-center justify-center text-center">
                        {filial.nome_filial}
                      </div>
                      <div className="flex items-center justify-center text-center">
                        {filial.codvend
                          ? vendedores.find(
                              (v) => String(v.codvend) === filial.codvend,
                            )?.nome || filial.codvend
                          : 'N/A'}
                      </div>
                      <div className="flex items-center justify-center text-center">
                        {filial.armazens?.map((a) => {
                          const isPadrao = armazensPadraoPerfil.some(
                            (ap) => ap.id_armazem === a.id_armazem,
                          );
                          return (
                            <span
                              key={a.id_armazem}
                              className={`px-2 py-1 rounded text-xs ${
                                isPadrao
                                  ? 'text-blue-500 '
                                  : ' text-gray-800 dark:text-white'
                              }`}
                            >
                              {a.nome || 'N/A'}
                            </span>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap justify-center text-center gap-1">
                        {perfil.funcoesPadraoPerfil.map((f) => (
                          <span
                            key={`padrao-${f.id_functions}`}
                            className="text-blue-500 dark:text-blue-300 px-2 py-1 rounded text-xs"
                            title="Função herdada do perfil"
                          >
                            {f.descricao}
                          </span>
                        ))}

                        {filial.funcoesDoUsuario.map((f) => (
                          <span
                            key={`usuario-${f.id_functions}`}
                            className="text-gray-800 dark:text-white px-2 py-1 border rounded text-xs"
                            title="Função atribuída ao usuário"
                          >
                            {f.descricao}
                          </span>
                        ))}
                        {perfil.funcoesPadraoPerfil.length === 0 &&
                          filial.funcoesDoUsuario.length === 0 && (
                            <span className="text-gray-400">N/A</span>
                          )}
                      </div>

                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() =>
                            handleSunClick(
                              perfil.perfil_name,
                              filial.nome_filial,
                              filial.funcoesDoUsuario,
                            )
                          }
                          className={`p-1 rounded ${
                            isAtivado
                              ? 'bg-yellow-500 text-white'
                              : 'bg-gray-200 text-gray-600 hover:bg-yellow-200 dark:bg-zinc-700 dark:text-gray-300'
                          }`}
                          title={
                            isAtivado ? 'Desativar Seleção' : 'Ativar Seleção'
                          }
                        >
                          <Sun size={16} />
                        </button>
                        <button
                          onClick={() =>
                            handleDeleteItem(
                              perfil.perfil_name,
                              filial.nome_filial,
                            )
                          }
                          className="p-1 bg-red-500 text-white rounded hover:bg-red-600"
                          title="Remover"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                }),
              )}
            </div>
          </div>
        </div>
      </div>
      {showModalFuncoes && (
        <ModalFuncoes
          isOpen={showModalFuncoes}
          onClose={() => setShowModalFuncoes(false)}
          funcoes={funcoesDisponiveis}
          selecionadas={funcoesSelecionadas}
          onConfirmar={(selecionadas: Funcao[]) =>
            handleConfirmarFuncoes(selecionadas)
          }
          funcoesFiltradas={funcoesDisponiveis}
        />
      )}
      {showModalArmazens && (
        <ModalArmazens
          isOpen={showModalArmazens}
          onClose={() => setShowModalArmazens(false)}
          armazensSelecionadosAtuais={armazensSelecionadosDoItemAtual()}
          onConfirmar={handleConfirmarArmazens}
          armazensDisponiveisFilial={armazensFiltradosDaFilialSelecionada()} // << NOVA PROP
        />
      )}

      <Toaster />
    </div>
  );
}

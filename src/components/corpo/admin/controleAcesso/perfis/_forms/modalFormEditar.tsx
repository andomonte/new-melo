import React, { useEffect, useState, useCallback, useRef } from 'react';
import { X, Trash2, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getTodasTelas, Tela } from '@/data/telas/telas';
import { getTodasFuncoes, Funcao } from '@/data/funcoes/funcoes';
import { getPerfil, updatePerfil } from '@/data/perfis/perfis';
import FormFooter from '@/components/common/FormFooter2';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Toaster } from '@/components/ui/toaster';
import ModalSelecionarTelas from './ModalSelecionarTelas';
import ModalSelecionarFuncoes from './ModalSelecionarFuncoes';
import Carregamento from '@/utils/carregamento';

interface Props {
  login_perfil_name: string;
  onClose: () => void;
  onSuccess?: () => void;
  onError?: () => void; // Adicionando a prop onError
  titulo: string;
  onDataChange?: (hasChanged: boolean) => void;
  onSaveInitiated?: () => void;
  isSaving?: boolean; // Adicionei isSaving aqui também, caso esteja passando
  hasChanges?: boolean; // Adicionei hasChanges aqui também, caso esteja passando
}

type Option = { label: string; value: any };

export default function FormEditarPerfil({
  login_perfil_name,
  onClose,
  onSuccess,
  titulo,
  onError,
  onDataChange,
  onSaveInitiated,
}: Props) {
  const [nomePerfil, setNomePerfil] = useState('');
  const [telas, setTelas] = useState<Tela[]>([]);
  const [funcoes, setFuncoes] = useState<Funcao[]>([]);
  const [grupo, setGrupo] = useState<any[]>([]);
  const [initialGrupo, setInitialGrupo] = useState<any[]>([]); // Para comparar mudanças
  const [selectedTelas, setSelectedTelas] = useState<any[]>([]);
  const [selectedFuncoes, setSelectedFuncoes] = useState<any[]>([]);
  const [mostrarModalTelas, setMostrarModalTelas] = useState(false);
  const [mostrarModalFuncoes, setMostrarModalFuncoes] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const isInitialLoad = useRef(true); // Para evitar a verificação inicial desnecessária
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const verificarAlteracoes = useCallback(() => {
    const hasChanged = JSON.stringify(grupo) !== JSON.stringify(initialGrupo);
    setHasChanges(hasChanged); // Atualiza o estado hasChanges
    if (onDataChange) {
      onDataChange(hasChanged);
    }
  }, [grupo, initialGrupo, onDataChange, setHasChanges]); // Adicione setHasChanges às dependências

  useEffect(() => {
    const carregarDados = async () => {
      setCarregando(true);
      try {
        const [todasTelas, todasFuncoes, perfilData] = await Promise.all([
          getTodasTelas(),
          getTodasFuncoes(),
          getPerfil(login_perfil_name),
        ]);

        setTelas(todasTelas ?? []);
        setFuncoes(todasFuncoes ?? []);
        setNomePerfil(perfilData.login_perfil_name);

        const telasFormatadas = (perfilData.telasPermissoes ?? []).map(
          (tp: any) => ({
            tela: {
              value: tp.CODIGO_TELA,
              label:
                (todasTelas ?? []).find((t) => t.CODIGO_TELA === tp.CODIGO_TELA)
                  ?.NOME_TELA || 'Tela Desconhecida',
            },
            permissoes: {
              cadastrar: tp.cadastrar || false,
              editar: tp.editar || false,
              remover: tp.remover || false,
              exportar: tp.exportar || false,
            },
            ativa: true,
          }),
        );

        const funcoesSelecionadas = (todasFuncoes ?? [])
          .filter((func) => perfilData.funcoes.includes(func.id_functions))
          .map((func) => ({ label: func.descricao, value: func.id_functions }));

        setSelectedTelas(telasFormatadas);
        setSelectedFuncoes(funcoesSelecionadas);
        const grupoInicial = [
          {
            nomePerfil: perfilData.login_perfil_name,
            telas: telasFormatadas,
            funcoes: funcoesSelecionadas,
          },
        ];
        setGrupo(grupoInicial);
        setInitialGrupo(grupoInicial);
      } catch (error) {
        console.error(error);
        toast({
          title: 'Erro ao carregar dados do perfil',
          description: 'Verifique a conexão com o banco de dados.',
          variant: 'destructive',
        });
      } finally {
        setCarregando(false);
      }
    };

    carregarDados();
  }, [login_perfil_name, toast]);

  // Chama verificarAlteracoes sempre que o estado 'grupo' é atualizado
  useEffect(() => {
    if (!isInitialLoad.current) {
      verificarAlteracoes();
    }
    isInitialLoad.current = false;
  }, [grupo, verificarAlteracoes]);

  const handleRemoverTelaDoGrupo = (groupIdx: number, telaIdx: number) => {
    const grupoAtualizado = [...grupo];
    // Cria uma cópia profunda do objeto do grupo selecionado
    const grupoSelecionadoCopia = JSON.parse(
      JSON.stringify(grupoAtualizado[groupIdx]),
    );

    if (grupoSelecionadoCopia?.telas?.length > 0) {
      const telaRemovidaValue =
        grupoSelecionadoCopia.telas[telaIdx]?.tela?.value;
      const novasTelas = grupoSelecionadoCopia.telas.filter(
        (_tela: any, index: number) => index !== telaIdx,
      );
      grupoSelecionadoCopia.telas = novasTelas;

      // Atualiza o array 'grupoAtualizado' com a cópia modificada
      grupoAtualizado[groupIdx] = grupoSelecionadoCopia;
      setGrupo(grupoAtualizado);

      setSelectedTelas((prevSelectedTelas) =>
        prevSelectedTelas.filter(
          (selectedTela) =>
            Number(selectedTela.tela.value) !== Number(telaRemovidaValue),
        ),
      );
    } else if (grupoSelecionadoCopia?.telas?.length === 1) {
      setGrupo([]);
      setNomePerfil('');
      setSelectedTelas([]);
    }
  };

  const handleSalvar = async () => {
    setIsSaving(true); // Define isSaving como true quando o salvamento começa
    if (onSaveInitiated) {
      onSaveInitiated(); // Informa ao pai que o salvamento começou (se necessário)
    }
    try {
      await updatePerfil({ login_perfil_name: nomePerfil, grupos: grupo });
      onSuccess?.();
    } catch (error) {
      console.error(error);
      onError?.(); // Chama a função de erro passada pelo pai EM CASO DE FALHA
    } finally {
      setIsSaving(false); // Define isSaving como false quando o salvamento termina
    }
  };

  const handleClear = () => {
    setSelectedTelas([]);
    setSelectedFuncoes([]);
    setGrupo([]);
    // A verificação de alterações ocorrerá no useEffect após setGrupo
  };

  const handleRemoverFuncaoDoGrupo = (groupIdx: number, funcaoIdx: number) => {
    const grupoAtualizado = [...grupo];
    // Cria uma cópia profunda do objeto do grupo selecionado
    const grupoSelecionadoCopia = JSON.parse(
      JSON.stringify(grupoAtualizado[groupIdx]),
    );

    if (grupoSelecionadoCopia.funcoes.length > 0) {
      const funcaoRemovidaValue =
        grupoSelecionadoCopia.funcoes[funcaoIdx]?.value;
      const novasFuncoes = grupoSelecionadoCopia.funcoes.filter(
        (_funcao: any, index: number) => index !== funcaoIdx,
      );
      grupoSelecionadoCopia.funcoes = novasFuncoes;

      // Atualiza o array 'grupoAtualizado' com a cópia modificada
      grupoAtualizado[groupIdx] = grupoSelecionadoCopia;
      setGrupo(grupoAtualizado);

      setSelectedFuncoes((prevSelectedFuncoes) =>
        prevSelectedFuncoes.filter(
          (selectedFuncao: any) => selectedFuncao.value !== funcaoRemovidaValue,
        ),
      );
    }
  };

  const handleAddGrupo = useCallback(() => {
    if (
      !nomePerfil.trim() ||
      selectedTelas.filter((t: any) => t.ativa).length === 0
    ) {
      return;
    }

    const novoGrupo = {
      nomePerfil,
      telas: selectedTelas.filter((t: any) => t.ativa),
      funcoes: selectedFuncoes,
    };

    setGrupo([novoGrupo]);
  }, [nomePerfil, selectedTelas, selectedFuncoes]);

  useEffect(() => {
    // Só executa se houver telas selecionadas e um nome de perfil válido
    if (nomePerfil.trim() && selectedTelas.length > 0) {
      handleAddGrupo();
    }
  }, [selectedTelas, selectedFuncoes, nomePerfil, handleAddGrupo]);
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg shadow-lg w-full h-[90vh] flex flex-col overflow-hidden">
        <div className="flex justify-center items-center px-4 py-3 border-b dark:border-gray-700">
          <header className="mb-0 w-[60%]">
            <h4 className="text-xl font-bold text-[#347AB6] dark:text-gray-100">
              {titulo}
            </h4>
          </header>
          <div className="w-[35%] flex justify-end">
            <FormFooter
              onSubmit={handleSalvar}
              onClear={handleClear}
              hasChanges={hasChanges}
              isSaving={isSaving}
            />
          </div>
          <div className="w-[5%] flex justify-end">
            <button
              onClick={onClose}
              className="text-gray-500 dark:text-gray-100 hover:text-red-500"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {!carregando ? (
          <div className="h-full flex-grow overflow-y-auto px-6 py-6 text-gray-800 dark:text-gray-100">
            <div className="p-2 space-y-6 w-full h-full">
              <div>
                <label className="block mb-1 text-sm font-medium">
                  Nome do Perfil
                </label>
                <div className="flex items-center gap-4">
                  <div className="flex-grow">
                    <input
                      type="text"
                      value={nomePerfil}
                      readOnly
                      className="w-full border rounded px-3 py-2 dark:bg-zinc-800 dark:border-zinc-600 cursor-not-allowed"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!nomePerfil.trim()}
                    onClick={() => setMostrarModalTelas(true)}
                    className={`${
                      nomePerfil.length > 2
                        ? 'bg-orange-600 hover:bg-orange-800'
                        : 'bg-orange-300 cursor-not-allowed'
                    } text-white px-4 py-2 rounded `}
                  >
                    Escolher Telas
                  </button>
                  <button
                    type="button"
                    disabled={!nomePerfil.trim() || selectedTelas.length === 0}
                    onClick={() => setMostrarModalFuncoes(true)}
                    className={`${
                      nomePerfil.length > 2 && selectedTelas.length > 0
                        ? 'bg-purple-600 hover:bg-purple-800'
                        : 'bg-purple-300 cursor-not-allowed'
                    } text-white px-4 py-2 rounded `}
                  >
                    Escolher Funções
                  </button>
                </div>
              </div>

              <div className=" border border-gray-200 dark:border-zinc-600  dark:bg-zinc-700 rounded-lg p-1 shadow space-y-6 w-full h-[85%]">
                <div className="w-full h-full">
                  <div className="flex">
                    {grupo.length === 0 ? (
                      <p className="text-sm ml-2 text-gray-500">
                        Nenhum Perfil adicionado ainda.
                      </p>
                    ) : null}
                  </div>
                  {grupo.map((g, groupIdx) => (
                    <div
                      key={`grupo-${groupIdx}`}
                      className="w-full h-full border rounded p-2 dark:bg-zinc-800 flex flex-col overflow-hidden"
                    >
                      <div className="flex w-full h-full overflow-hidden">
                        {/* Banca das Telas */}
                        <div className="w-1/2 pr-4 border-r dark:border-gray-600 flex flex-col overflow-hidden">
                          <div className="flex w-full">
                            <div className="flex justify-center w-[40%] text-xs font-semibold text-blue-500 dark:text-blue-300 mb-1">
                              Nome da Tela
                            </div>
                            <div className="flex justify-center w-[60%] text-xs font-semibold text-blue-500 dark:text-blue-300 mb-1">
                              Permissões
                            </div>
                          </div>

                          {g.telas.length > 0 && (
                            <div className="w-full flex items-center text-gray-500 text-xs pl-0 gap-2">
                              <div className="flex justify-center w-[40%]"></div>
                              <div className="flex w-[60%]">
                                <div className="w-[20%] flex justify-center">
                                  Cad
                                </div>
                                <div className="w-[20%] flex justify-center">
                                  Edit
                                </div>
                                <div className="w-[20%] flex justify-center">
                                  Rem
                                </div>
                                <div className="w-[20%] flex justify-center">
                                  Exp
                                </div>
                                <div className="w-[20%]"></div>
                              </div>
                            </div>
                          )}

                          <div className="w-full overflow-y-auto flex-grow">
                            {g.telas.length > 0 ? (
                              <div className="w-full space-y-4 pl-1 mt-2">
                                {g.telas.map((t: any, telaIdx: number) => (
                                  <div
                                    key={telaIdx}
                                    className="w-full flex gap-x-2 items-center"
                                  >
                                    <span className="w-[40%] text-xs ">
                                      {t.tela.label}
                                    </span>

                                    <div className="flex w-[60%]">
                                      <div className="w-[20%] flex justify-center">
                                        {t.permissoes.cadastrar ? (
                                          <Check size={14} />
                                        ) : (
                                          <X
                                            className="text-red-600"
                                            size={14}
                                          />
                                        )}
                                      </div>
                                      <div className="w-[20%] flex justify-center">
                                        {t.permissoes.editar ? (
                                          <Check size={14} />
                                        ) : (
                                          <X
                                            className="text-red-600"
                                            size={14}
                                          />
                                        )}
                                      </div>
                                      <div className="w-[20%] flex justify-center">
                                        {t.permissoes.remover ? (
                                          <Check size={14} />
                                        ) : (
                                          <X
                                            className="text-red-600"
                                            size={14}
                                          />
                                        )}
                                      </div>
                                      <div className="w-[20%] flex justify-center">
                                        {t.permissoes.exportar ? (
                                          <Check size={14} />
                                        ) : (
                                          <X
                                            className="text-red-600"
                                            size={14}
                                          />
                                        )}
                                      </div>
                                      <div className="w-[20%] flex justify-center">
                                        <button
                                          onClick={() =>
                                            handleRemoverTelaDoGrupo(
                                              groupIdx,
                                              telaIdx,
                                            )
                                          }
                                          className="text-red-500 hover:text-red-700"
                                          title="Remover tela"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-500">
                                Nenhuma tela.
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Banca das Funções */}
                        <div className="w-1/2 pl-4 flex flex-col overflow-hidden">
                          <h5 className="text-sm font-semibold text-purple-500 dark:text-purple-300 mb-1">
                            Funções
                          </h5>

                          <div className="w-full overflow-y-auto flex-grow">
                            {g.funcoes.length > 0 ? (
                              <ul className="space-y-1">
                                {g.funcoes.map(
                                  (f: Option, funcaoIdx: number) => (
                                    <li
                                      key={funcaoIdx}
                                      className="text-xs flex justify-between items-center"
                                    >
                                      <span>{f.label}</span>
                                      <button
                                        onClick={() =>
                                          handleRemoverFuncaoDoGrupo(
                                            groupIdx,
                                            funcaoIdx,
                                          )
                                        }
                                        className="text-red-500 hover:text-red-700"
                                        title="Remover função"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </li>
                                  ),
                                )}
                              </ul>
                            ) : (
                              <p className="text-xs text-gray-500">
                                Nenhuma função.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <Carregamento />
        )}

        {/* Modais */}
        <Dialog open={mostrarModalTelas} onOpenChange={setMostrarModalTelas}>
          <DialogContent className="text-zinc-700 dark:text-zinc-100 max-w-[90vw] w-[90vw] h-[90vh] p-6 bg-white dark:bg-zinc-900">
            <DialogTitle>Escolher Telas</DialogTitle>
            <DialogDescription>
              Marque as telas e permissões desejadas para o perfil.
            </DialogDescription>
            <ModalSelecionarTelas
              telas={telas.map((t) => ({
                label: t.NOME_TELA,
                value: t.CODIGO_TELA,
              }))}
              selecionadas={selectedTelas}
              onConfirmar={(selecionadas) => {
                setSelectedTelas(selecionadas);
                setMostrarModalTelas(false);
              }}
            />
          </DialogContent>
        </Dialog>

        <Dialog
          open={mostrarModalFuncoes}
          onOpenChange={setMostrarModalFuncoes}
        >
          <DialogContent className="max-w-[90vw] w-[90vw] h-[90vh] p-6v text-zinc-800 dark:text-zinc-100 bg-white dark:bg-zinc-900">
            <DialogHeader className="p-0 mb-2">
              <DialogTitle className="text-base leading-tight">
                Escolher Funções
              </DialogTitle>
              <DialogDescription className="text-sm  leading-snug">
                Selecione as funções que deseja atribuir ao perfil.
              </DialogDescription>
            </DialogHeader>
            <ModalSelecionarFuncoes
              funcoes={funcoes.map((f) => ({
                label: f.descricao,
                value: f.id_functions,
                sigla: f.sigla ?? '',
                usadoEm: f.usadoEm ?? undefined,
              }))}
              selecionadas={selectedFuncoes}
              onConfirmar={(selecionadas) => {
                setSelectedFuncoes(selecionadas);
                setMostrarModalFuncoes(false);
              }}
            />
          </DialogContent>
        </Dialog>

        <Toaster />
      </div>
    </div>
  );
}

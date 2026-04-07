import React, { useEffect, useState } from 'react';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { getTodasTelas, Tela } from '@/data/telas/telas';
import { getTodasFuncoes, Funcao } from '@/data/funcoes/funcoes';
import { insertPerfil } from '@/data/perfis/perfis';
import { X, Trash2, Check } from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';
import FormFooter from '@/components/common/FormFooter2';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import ModalSelecionarTelas from './ModalSelecionarTelas';
import ModalSelecionarFuncoes from './ModalSelecionarFuncoes';

const schema = z.object({
  nomePerfil: z.string().min(1, 'Nome do perfil é obrigatório'),
  grupos: z
    .array(
      z.object({
        telas: z
          .array(
            z.object({
              tela: z.object({ value: z.any(), label: z.string() }),
              permissoes: z.object({
                cadastrar: z.boolean(),
                editar: z.boolean(),
                remover: z.boolean(),
                exportar: z.boolean(),
              }),
            }),
          )
          .min(1, 'Selecione pelo menos uma tela para o grupo'),
        funcoes: z.array(z.object({ value: z.any(), label: z.string() })),
      }),
    )
    .min(1, 'Adicione pelo menos um grupo antes de salvar'),
});

interface Props {
  titulo: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function FormPerfilContainer({
  titulo,
  onClose,
  onSuccess,
}: Props) {
  const [nomePerfil, setNomePerfil] = useState('');
  const [telas, setTelas] = useState<Tela[]>([]);
  const [funcoes, setFuncoes] = useState<Funcao[]>([]);
  const [grupo, setGrupo] = useState<any[]>([]);
  const [selectedTelas, setSelectedTelas] = useState<any[]>([]);
  const [selectedFuncoes, setSelectedFuncoes] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [mostrarModalTelas, setMostrarModalTelas] = useState(false);
  const [mostrarModalFuncoes, setMostrarModalFuncoes] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const carregarDados = async () => {
      const [t, f] = await Promise.all([getTodasTelas(), getTodasFuncoes()]);

      setTelas(t ?? []);
      setFuncoes(f ?? []);

      if (!t) {
        toast({
          title: 'Erro ao carregar Telas',
          description: 'Não foi possível acessar o banco de dados.',
          variant: 'destructive',
        });
      }
      if (!f) {
        toast({
          title: 'Erro ao carregar Funções',
          description: 'Não foi possível acessar o banco de dados.',
          variant: 'destructive',
        });
      }
    };
    carregarDados();
  }, [toast]);

  const handleAddGrupo = () => {
    if (!nomePerfil.trim() || selectedTelas.length === 0) {
      toast({
        description:
          'Preencha o nome do perfil e selecione pelo menos uma tela.',
        variant: 'destructive',
      });
      return;
    }

    const telasAtivas = selectedTelas
      .filter((t: any) => t.ativa)
      .map(({ ...resto }) => resto);

    const novoGrupo = {
      nomePerfil,
      telas: telasAtivas,
      funcoes: selectedFuncoes,
    };

    if (grupo.length > 0) {
      const grupoAtualizado = [...grupo];
      grupoAtualizado[0] = novoGrupo;
      setGrupo(grupoAtualizado);
    } else {
      setGrupo([novoGrupo]);
    }
  };

  const handleRemoverTelaDoGrupo = (groupIdx: number, telaIdx: number) => {
    const grupoAtualizado = [...grupo];
    const grupoSelecionado = grupoAtualizado[groupIdx];

    if (grupoSelecionado?.telas?.length > 0) {
      const telaRemovidaValue = grupoSelecionado.telas[telaIdx]?.tela?.value;
      const telasAtualizadas = grupoSelecionado.telas.filter(
        (_tela: any, index: number) => index !== telaIdx,
      );
      grupoSelecionado.telas = telasAtualizadas;
      grupoAtualizado[groupIdx] = grupoSelecionado;
      setGrupo(grupoAtualizado);

      // Atualizar selectedTelas removendo o item correspondente (acessando o value CORRETAMENTE)
      setSelectedTelas((prevSelectedTelas) => {
        const novoSelectedTelas = prevSelectedTelas.filter(
          (selectedTela) =>
            Number(selectedTela.tela.value) !== Number(telaRemovidaValue),
        );

        return novoSelectedTelas;
      });
    } else if (grupoSelecionado?.telas?.length === 1) {
      setGrupo([]);
      setNomePerfil('');
      setSelectedTelas([]);
    }
  };

  const handleSalvar = async () => {
    setIsSaving(true);
    try {
      schema.parse({ nomePerfil, grupos: grupo });
      await insertPerfil({ login_perfil_name: nomePerfil, grupos: grupo });
      onSuccess?.();
    } catch (e) {
      if (e instanceof z.ZodError) {
        toast({
          description:
            'Erro ao salvar perfil. Verifique os campos obrigatórios: ' +
            e.errors.map((err) => err.message).join(', '),
          variant: 'destructive',
        });
      } else {
        toast({
          description: 'Erro ao salvar perfil.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsSaving(false); // Define isSaving como false quando o salvamento termina
    }
  };

  const handleClear = () => {
    setNomePerfil('');
    setGrupo([]);
    setSelectedTelas([]);
    setSelectedFuncoes([]);
  };
  const handleRemoverFuncaoDoGrupo = (groupIdx: number, funcaoIdx: number) => {
    const grupoAtualizado = [...grupo];
    const grupoSelecionado = grupoAtualizado[groupIdx];

    if (grupoSelecionado.funcoes.length > 0) {
      const funcoesAtualizadas = grupoSelecionado.funcoes.filter(
        (_funcao: any, index: number) => index !== funcaoIdx,
      );
      grupoSelecionado.funcoes = funcoesAtualizadas;
      grupoAtualizado[groupIdx] = grupoSelecionado;
      setGrupo(grupoAtualizado);

      // Atualizar selectedFuncoes removendo o item correspondente
      setSelectedFuncoes((prevSelectedFuncoes) =>
        prevSelectedFuncoes.filter(
          (selectedFuncao: any) =>
            selectedFuncao.value !== grupoSelecionado.funcoes[funcaoIdx]?.value, // Use encadeamento opcional para segurança
        ),
      );
    }
  };
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
              isSaving={isSaving}
              hasChanges={grupo.length ? true : false}
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
                    onChange={(e) => setNomePerfil(e.target.value)}
                    className="w-full uppercase border rounded px-3 py-2 dark:bg-zinc-800 dark:border-zinc-600 cursor-not-allowed"
                    readOnly={grupo.length > 0}
                  />
                </div>
                <button
                  type="button"
                  disabled={!nomePerfil.trim()}
                  onClick={() => {
                    if (nomePerfil.length > 2) setMostrarModalTelas(true);
                  }}
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

                <button
                  onClick={handleAddGrupo}
                  disabled={!nomePerfil.trim() || selectedTelas.length === 0}
                  className={`px-4 py-2 rounded text-white transition-colors duration-200 ${
                    !nomePerfil.trim() || selectedTelas.length === 0
                      ? 'bg-green-300 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-800'
                  }`}
                >
                  {grupo.length > 0 ? 'Atualizar Perfil' : 'Adicionar Perfil'}
                </button>
              </div>
            </div>
            <div className="h-[1px] bg-gray-300 dark:bg-zinc-600 my-4" />
            <div className="bg-white border border-gray-200 dark:bg-zinc-700 rounded-lg p-6 shadow space-y-6 w-full h-[75%]">
              <div>
                <div className="flex">
                  {grupo.length === 0 ? (
                    <p className="text-sm ml-2 text-gray-500">
                      Nenhum Perfil adicionado ainda.
                    </p>
                  ) : (
                    <strong className="text-blue-700 dark:text-blue-300">
                      {grupo[0]?.nomePerfil}
                    </strong>
                  )}
                </div>
                {grupo.map((g, groupIdx) => (
                  <li
                    key={`grupo-${groupIdx}`}
                    className="border rounded p-3 dark:bg-zinc-800 flex flex-col"
                  >
                    <div className="flex w-full">
                      {/* Banca das Telas */}
                      <div className="w-full flex-1 pr-4 border-r dark:border-gray-600 flex flex-col">
                        <div className="flex w-full">
                          <div className="flex justify-center w-[40%] text-xs font-semibold text-blue-500 dark:text-blue-300 mb-1">
                            Nome da Tela
                          </div>
                          <div className="flex justify-center w-[60%] text-xs font-semibold text-blue-500 dark:text-blue-300 mb-1">
                            Permissões
                          </div>
                        </div>
                        {g.telas.length > 0 && (
                          <div className="  flex items-center text-gray-500 text-xs pl-0 gap-2">
                            <div className="flex justify-center  w-[40%]"></div>{' '}
                            {/* Nova legenda "Telas" */}
                            <div className="flex w-[60%]">
                              <div className=" w-[20%]  flex justify-center">
                                Cad
                              </div>
                              <div className="w-[20%]   flex justify-center">
                                Edit
                              </div>
                              <div className="w-[20%]  flex justify-center">
                                Rem
                              </div>
                              <div className="w-[20%]  flex justify-center">
                                Exp
                              </div>
                              <div className="w-[20%]"></div>{' '}
                              {/* Espaço para o botão de remover */}
                            </div>
                          </div>
                        )}
                        <div className="w-full overflow-y-auto max-h-[235px]">
                          {g.telas.length > 0 ? (
                            <div className="w-full space-y-2 pl-1">
                              {g.telas.map((t: any, telaIdx: number) => (
                                <div
                                  key={telaIdx}
                                  className="w-full flex gap-x-2 items-center"
                                >
                                  <span className="w-[40%] text-xs ">
                                    {t.tela.label}
                                  </span>{' '}
                                  {/* Nova legenda "Telas" */}
                                  <div className="flex w-[60%]">
                                    <div className=" w-[20%]  flex justify-center">
                                      {t.permissoes.cadastrar ? (
                                        <Check size={14} />
                                      ) : (
                                        <X className="text-red-600" size={14} />
                                      )}
                                    </div>
                                    <div className="w-[20%]   flex justify-center">
                                      {t.permissoes.editar ? (
                                        <Check size={14} />
                                      ) : (
                                        <X className="text-red-600" size={14} />
                                      )}
                                    </div>
                                    <div className="w-[20%]  flex justify-center">
                                      {t.permissoes.remover ? (
                                        <Check size={14} />
                                      ) : (
                                        <X className="text-red-600" size={14} />
                                      )}
                                    </div>
                                    <div className="w-[20%]  flex justify-center">
                                      {t.permissoes.exportar ? (
                                        <Check size={14} />
                                      ) : (
                                        <X className="text-red-600" size={14} />
                                      )}
                                    </div>
                                    <div className="w-[20%]  flex justify-center">
                                      {' '}
                                      {/* Mantém o botão à direita */}
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

                      {/* Banca das Funções (sem alterações nesta parte) */}
                      <div className="flex-1 pl-4 flex flex-col">
                        <h5 className="text-xs font-semibold text-purple-500 dark:text-purple-300 mb-1">
                          Funções:
                        </h5>
                        <div className="overflow-y-auto max-h-[235px] text-[12px]">
                          {g.funcoes.length > 0 ? (
                            <ul className="space-y-2 pl-4">
                              {g.funcoes.map((f: any, funcaoIdx: number) => (
                                <li
                                  key={f.value}
                                  className="flex justify-between items-center"
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
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-gray-500">
                              Nenhuma função.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </div>
            </div>
          </div>
        </div>

        <Dialog open={mostrarModalTelas} onOpenChange={setMostrarModalTelas}>
          <DialogContent className="text-zinc-700 dark:text-zinc-100 max-w-[90vw] w-[90vw] h-[90vh] p-6 bg-white dark:bg-zinc-900">
            <DialogHeader>
              <DialogTitle>Escolher Telas</DialogTitle>
              <DialogDescription>
                Marque as telas e permissões desejadas para o perfil.
              </DialogDescription>
            </DialogHeader>
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
          <DialogContent className="max-w-[90vw] w-[90vw] h-[90vh] p-6 dark:text-gray-50 bg-white dark:bg-zinc-900">
            <DialogHeader>
              <DialogTitle>Escolher Funções</DialogTitle>
              <DialogDescription>
                Selecione as funções que deseja atribuir a este grupo.
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

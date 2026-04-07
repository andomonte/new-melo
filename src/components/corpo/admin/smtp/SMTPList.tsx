import React, { useState, useEffect } from 'react';
import { DefaultButton, AuxButton } from '@/components/common/Buttons';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Edit, Trash2, Plus, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import axios from 'axios';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Modal from '@/components/common/Modal';
import SMTPPageContent from './index';

interface SMTPConfig {
  id: number;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  from_email: string;
  from_name: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export default function SMTPList() {
  const [configs, setConfigs] = useState<SMTPConfig[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [modalExcluirAberto, setModalExcluirAberto] = useState(false);
  const [configSelecionada, setConfigSelecionada] = useState<SMTPConfig | null>(null);
  const [processando, setProcessando] = useState(false);

  // Carregar configurações ao montar o componente
  useEffect(() => {
    carregarConfiguracoes();
  }, []);

  const carregarConfiguracoes = async () => {
    setCarregando(true);
    try {
      const response = await axios.get('/api/smtp/config?all=true');
      if (response.data.configs) {
        setConfigs(response.data.configs);
      } else if (response.data.config) {
        // Se retornar apenas uma config, colocar em array
        setConfigs([response.data.config]);
      } else {
        setConfigs([]);
      }
    } catch (error: any) {
      console.error('Erro ao carregar configurações:', error);
      if (error.response?.status !== 404) {
        toast.error('Erro ao carregar configurações SMTP');
      } else {
        setConfigs([]);
      }
    } finally {
      setCarregando(false);
    }
  };

  const handleEditar = (config: SMTPConfig) => {
    setConfigSelecionada(config);
    setModalEditarAberto(true);
  };

  const handleExcluir = (config: SMTPConfig) => {
    setConfigSelecionada(config);
    setModalExcluirAberto(true);
  };

  const confirmarExclusao = async () => {
    if (!configSelecionada) return;

    setProcessando(true);
    try {
      await axios.delete(`/api/smtp/config?id=${configSelecionada.id}`);
      toast.success('Configuração excluída com sucesso');
      setModalExcluirAberto(false);
      carregarConfiguracoes();
    } catch (error) {
      console.error('Erro ao excluir configuração:', error);
      toast.error('Erro ao excluir configuração');
    } finally {
      setProcessando(false);
    }
  };

  const handleAtivarDesativar = async (config: SMTPConfig) => {
    setProcessando(true);
    try {
      await axios.put('/api/smtp/config', {
        id: config.id,
        ativo: !config.ativo,
      });
      toast.success(config.ativo ? 'Configuração desativada' : 'Configuração ativada');
      carregarConfiguracoes();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status da configuração');
    } finally {
      setProcessando(false);
    }
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleString('pt-BR');
  };

  const mascararSenha = (senha: string) => {
    if (!senha) return '***';
    return '••••••••';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Configurações SMTP</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Gerencie as configurações de email do sistema
          </p>
        </div>
        <div className="flex gap-3">
          <AuxButton
            text="Atualizar"
            onClick={carregarConfiguracoes}
            disabled={carregando}
            className="flex items-center gap-2"
            icon={<RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />}
          />
          <DefaultButton
            text="Nova Configuração"
            onClick={() => {
              setConfigSelecionada(null);
              setModalEditarAberto(true);
            }}
            className="flex items-center gap-2"
            icon={<Plus className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-zinc-400">
              Total de Configurações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{configs.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-zinc-400">
              Configuração Ativa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {configs.filter((c) => c.ativo).length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-zinc-400">
              Configurações Inativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-500">
              {configs.filter((c) => !c.ativo).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-0">
          {carregando ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : configs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
              <XCircle className="w-12 h-12 mb-4 text-zinc-600" />
              <p className="text-lg font-medium">Nenhuma configuração encontrada</p>
              <p className="text-sm mt-2">
                Clique em "Nova Configuração" para adicionar
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-zinc-800 hover:bg-zinc-800 border-b border-zinc-700">
                    <TableHead className="text-white font-semibold">Status</TableHead>
                    <TableHead className="text-white font-semibold">Servidor</TableHead>
                    <TableHead className="text-white font-semibold">Porta</TableHead>
                    <TableHead className="text-white font-semibold">Usuário</TableHead>
                    <TableHead className="text-white font-semibold">Email Remetente</TableHead>
                    <TableHead className="text-white font-semibold">Nome Remetente</TableHead>
                    <TableHead className="text-white font-semibold">Criado em</TableHead>
                    <TableHead className="text-white font-semibold text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.map((config) => (
                    <TableRow
                      key={config.id}
                      className="border-b border-zinc-800 hover:bg-zinc-800/50"
                    >
                      <TableCell>
                        {config.ativo ? (
                          <Badge className="bg-green-600/20 text-green-400 border-green-600/30">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Ativo
                          </Badge>
                        ) : (
                          <Badge className="bg-zinc-600/20 text-zinc-400 border-zinc-600/30">
                            <XCircle className="w-3 h-3 mr-1" />
                            Inativo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-white font-medium">
                        {config.host}
                      </TableCell>
                      <TableCell className="text-zinc-300">
                        {config.port}
                        {config.secure && (
                          <span className="ml-2 text-xs text-green-400">(SSL)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-zinc-300">{config.username}</TableCell>
                      <TableCell className="text-zinc-300">{config.from_email}</TableCell>
                      <TableCell className="text-zinc-300">{config.from_name}</TableCell>
                      <TableCell className="text-zinc-400 text-sm">
                        {formatarData(config.created_at)}
                      </TableCell>
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-sm font-medium transition-colors">
                              Ações
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="bg-zinc-900 border-zinc-700 text-white"
                          >
                            <DropdownMenuItem
                              onClick={() => handleEditar(config)}
                              className="cursor-pointer hover:bg-zinc-800"
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleAtivarDesativar(config)}
                              className="cursor-pointer hover:bg-zinc-800"
                              disabled={processando}
                            >
                              {config.ativo ? (
                                <>
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Desativar
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Ativar
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleExcluir(config)}
                              className="cursor-pointer hover:bg-red-900/50 text-red-400"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Edição/Nova Configuração */}
      {modalEditarAberto && (
        <Modal
          isOpen={modalEditarAberto}
          onClose={() => {
            setModalEditarAberto(false);
            setConfigSelecionada(null);
          }}
          title={configSelecionada ? 'Editar Configuração SMTP' : 'Nova Configuração SMTP'}
          width="w-11/12 md:w-3/4 lg:w-2/3 xl:w-1/2"
        >
          <SMTPPageContent
            configId={configSelecionada?.id}
            onSalvar={() => {
              setModalEditarAberto(false);
              setConfigSelecionada(null);
              carregarConfiguracoes();
            }}
          />
        </Modal>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <Modal
        isOpen={modalExcluirAberto}
        onClose={() => {
          setModalExcluirAberto(false);
          setConfigSelecionada(null);
        }}
        title="Confirmar Exclusão"
        width="w-11/12 md:w-1/2 lg:w-1/3"
      >
        <div className="space-y-4">
          {/* Informações sobre a configuração */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="space-y-2">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Você está prestes a excluir a configuração SMTP:
              </p>
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Servidor:</span>
                  <strong className="text-gray-900 dark:text-white">{configSelecionada?.host}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Porta:</span>
                  <strong className="text-gray-900 dark:text-white">{configSelecionada?.port}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Email:</span>
                  <strong className="text-gray-900 dark:text-white">{configSelecionada?.from_email}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Aviso */}
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
              <span className="text-lg">⚠️</span>
              <span>Esta ação não pode ser desfeita. Todos os dados da configuração serão permanentemente removidos.</span>
            </p>
          </div>

          {/* Botões de Ação */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <DefaultButton
              variant="secondary"
              size="default"
              text="Cancelar"
              onClick={() => {
                setModalExcluirAberto(false);
                setConfigSelecionada(null);
              }}
              disabled={processando}
            />
            <DefaultButton
              variant="destructive"
              size="default"
              text={processando ? 'Excluindo...' : 'Confirmar Exclusão'}
              onClick={confirmarExclusao}
              disabled={processando}
              icon={processando ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

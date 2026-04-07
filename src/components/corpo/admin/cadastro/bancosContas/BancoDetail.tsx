import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { DefaultButton } from '@/components/common/Buttons';
import { Banco, updateBanco, insertBanco } from '@/data/bancos/bancos';
import {
  ContasResponse,
  getContas,
  deletarConta,
  Conta,
} from '@/data/contas/contas';
import DataTable from '@/components/common/DataTable';
import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import useDebounce from '@/hooks/useDebounce';
import CadastrarContaModal from './modalCadastrarConta';
import { useToast } from '@/hooks/use-toast';

const bancoSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  banco: z.string().min(1, 'Código é obrigatório'),
});

type BancoFormData = z.infer<typeof bancoSchema>;

interface BancoDetailProps {
  banco: Banco | null;
  onClose: () => void;
  onSaveAndContinue: (banco: Banco) => void;
  onRecordFound: (banco: Banco | null) => void;
}

const BancoDetail: React.FC<BancoDetailProps> = ({
  banco,
  onClose,
  onSaveAndContinue,
  onRecordFound,
}) => {
  const { toast } = useToast();
  const isNew = banco === null;
  const [contas, setContas] = useState<ContasResponse>({} as ContasResponse);
  const [pageConta, setPageConta] = useState(1);
  const [perPageConta, setPerPageConta] = useState(10);
  const [searchConta, setSearchConta] = useState('');
  const [isContaModalOpen, setIsContaModalOpen] = useState(false);
  const [selectedConta, setSelectedConta] = useState<Conta | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<BancoFormData>({
    resolver: zodResolver(bancoSchema),
    defaultValues: isNew ? { nome: '', banco: '' } : banco,
  });

  const watchedCodigo = watch('banco');
  const debouncedCodigo = useDebounce(watchedCodigo, 2000);

  useEffect(() => {
    // Simplified smart search: only runs when in create mode.
    if (isNew && debouncedCodigo) {
      const checkBancoExists = async () => {
        try {
          const response = await fetch(
            `/api/bancos/check-exists?codigo=${debouncedCodigo}`,
          );
          if (response.ok) {
            const { data } = await response.json();
            toast({
              title: 'Registro encontrado',
              description: `Carregando dados do banco ${data.nome}.`,
            });
            // This call updates the parent, which passes a new 'banco' prop,
            // making isNew false and locking the input.
            onRecordFound(data);
          }
        } catch (error) {
          console.error('Erro ao verificar banco:', error);
        }
      };
      checkBancoExists();
    }
  }, [debouncedCodigo, isNew, onRecordFound, toast]);

  useEffect(() => {
    // This effect simply syncs the form with the 'banco' prop from the parent.
    // If parent sends a bank object, form populates. If parent sends null, form clears.
    reset(banco || { nome: '', banco: '' });
  }, [banco, reset]);

  const handleContas = async () => {
    if (banco?.banco) {
      try {
        const data = await getContas({
          page: pageConta,
          perPage: perPageConta,
          search: searchConta,
          banco: banco.banco,
        });
        setContas(data);
      } catch (error) {
        console.error('Erro ao buscar contas:', error);
      }
    } else {
      setContas({} as ContasResponse); // Clear accounts if no bank is selected
    }
  };

  useEffect(() => {
    handleContas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageConta, perPageConta, searchConta, banco]);

  const onSubmit = async (data: BancoFormData) => {
    try {
      if (isNew) {
        const newBank = await insertBanco(data);
        toast({
          title: 'Sucesso!',
          description: `Banco "${newBank.nome}" cadastrado. Agora adicione as contas.`,
        });
        onSaveAndContinue(newBank);
      } else {
        // We can safely assume 'banco' is not null here due to the isNew check.
        await updateBanco({ ...banco, ...data });
        toast({
          title: 'Sucesso',
          description: `Banco atualizado com sucesso.`,
        });
        onClose();
      }
    } catch (error) {
      console.error('Erro ao salvar banco', error);
      toast({
        title: 'Erro',
        description: `Erro ao salvar banco.`,
        variant: 'destructive',
      });
    }
  };

  const handleOpenContaModal = (conta: Conta | null) => {
    setSelectedConta(conta);
    setIsContaModalOpen(true);
  };

  const handleCloseContaModal = () => {
    setIsContaModalOpen(false);
    setSelectedConta(null);
    handleContas();
  };

  const handleDeleteConta = async (contaId: string) => {
    try {
      await deletarConta(contaId);
      toast({ title: 'Sucesso!', description: 'Conta deletada com sucesso.' });
      handleContas();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description:
          error?.response?.data?.error || 'Ocorreu um erro ao deletar a conta.',
        variant: 'destructive',
      });
    }
  };

  const rowsConta = contas.data?.map((conta) => ({
    action: (
      <div className="flex gap-2">
        <button
          onClick={() => handleOpenContaModal(conta)}
          className="p-1 text-gray-500 hover:text-gray-700"
        >
          <Pencil size={16} />
        </button>
        <button
          onClick={() => handleDeleteConta(String(conta.id))}
          className="p-1 text-red-500 hover:text-red-700"
        >
          <Trash2 size={16} />
        </button>
      </div>
    ),
    status: (
      <Badge variant={conta.status === 'Ativo' ? 'default' : 'destructive'}>
        {conta.status}
      </Badge>
    ),
    agencia: conta.agencia,
    conta: conta.nroconta,
    carteira: conta.carteira,
    tipo: conta.tipo,
    filial: conta.melo,
  }));

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      <div className="flex-none">
        <form onSubmit={handleSubmit(onSubmit)}>
          <header className="mb-4 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-200">
              {isNew ? 'Novo Banco' : `Editar Banco: ${banco.nome}`}
            </h2>
            <div className="flex gap-2">
              <DefaultButton
                text="Voltar"
                onClick={onClose}
                variant="cancel"
              />
              <DefaultButton
                text={isNew ? 'Salvar e Adicionar Contas' : 'Salvar Alterações'}
                type="submit"
              />
            </div>
          </header>

          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 md:col-span-2">
                <label htmlFor="banco">Código Febraban</label>
                <Controller
                  name="banco"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="banco"
                      readOnly={!isNew}
                      autoComplete="off"
                    />
                  )}
                />
                {errors.banco && (
                  <p className="text-sm text-red-500">
                    {errors.banco.message}
                  </p>
                )}
              </div>
              <div className="col-span-12 md:col-span-10">
                <label htmlFor="nome">Nome do Banco</label>
                <Controller
                  name="nome"
                  control={control}
                  render={({ field }) => <Input {...field} id="nome" />}
                />
                {errors.nome && (
                  <p className="text-sm text-red-500">{errors.nome.message}</p>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>

      {!isNew && (
        <div className="flex-1 min-h-0 flex flex-col rounded-lg border border-slate-700 bg-slate-800/50">
          <header className="flex-none p-4 border-b border-slate-700 flex justify-between items-center">
            <h3 className="text-md font-bold text-gray-200">
              Contas e Carteiras Configuradas
            </h3>
            <DefaultButton
              text="+ Adicionar Conta"
              onClick={() => handleOpenContaModal(null)}
            />
          </header>
          <div className="flex-1 overflow-y-auto">
            <DataTable
              headers={[
                'Ações',
                'Status',
                'Agência',
                'Conta',
                'Carteira',
                'Tipo',
                'Filial',
              ]}
              rows={rowsConta || []}
              meta={contas.meta}
              onPageChange={setPageConta}
              onPerPageChange={setPerPageConta}
              onSearch={(e) => setSearchConta(e.target.value)}
              searchInputPlaceholder="Pesquisar conta..."
              noDataMessage="Nenhuma conta encontrada para este banco."
            />
          </div>
        </div>
      )}

      {isContaModalOpen && (
        <CadastrarContaModal
          isOpen={isContaModalOpen}
          onClose={handleCloseContaModal}
          conta={selectedConta}
          bancoId={banco?.banco}
        />
      )}
    </div>
  );
};

export default BancoDetail;
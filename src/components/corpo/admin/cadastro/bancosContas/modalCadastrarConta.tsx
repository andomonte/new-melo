import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { getFiliais, Filial } from '@/data/filiais/filiais';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DefaultButton } from '@/components/common/Buttons';
import Carregamento from '@/utils/carregamento';
import { useToast } from '@/hooks/use-toast';
import { insertConta, updateConta, Conta } from '@/data/contas/contas';
import useDebounce from '@/hooks/useDebounce';

const contaSchema = z.object({
  agencia: z
    .string()
    .min(1, 'Agência é obrigatória')
    .regex(/^[0-9]+$/, 'Apenas números'),
  nroconta: z
    .string()
    .min(1, 'Conta é obrigatória')
    .regex(/^[0-9-]+$/, 'Apenas números e hífen'),
  convenio: z.string().optional(),
  carteira: z
    .string()
    .min(1, 'Carteira é obrigatória')
    .max(3, 'Máximo 3 caracteres')
    .transform((val) => val.toUpperCase()),
  variacao: z.string().optional(),
  tipo: z.enum(['NF', 'FAG']),
  melo: z.string().min(1, 'Filial é obrigatória'),
  status: z.enum(['ATIVO', 'INATIVO']),
});

type ContaFormData = z.infer<typeof contaSchema>;

interface CadastrarContaModalProps {
  isOpen: boolean;
  onClose: () => void;
  conta: Conta | null;
  bancoId: string | undefined;
}

const CadastrarContaModal: React.FC<CadastrarContaModalProps> = ({
  isOpen,
  onClose,
  conta,
  bancoId,
}) => {
  const { toast } = useToast();
  const [effectiveConta, setEffectiveConta] = useState<Conta | null>(conta);
  const isNew = effectiveConta === null;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filiais, setFiliais] = useState<Filial[]>([]);

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<ContaFormData>({
    resolver: zodResolver(contaSchema),
  });

  const watchedAgencia = watch('agencia');
  const watchedNroConta = watch('nroconta');
  const debouncedAgencia = useDebounce(watchedAgencia, 2000);
  const debouncedNroConta = useDebounce(watchedNroConta, 2000);

  useEffect(() => {
    // Simplified smart search: only runs when creating a new record.
    // The 'conta' prop will be non-null when editing, so this won't run.
    if (conta === null && debouncedAgencia && debouncedNroConta && bancoId) {
      const checkContaExists = async () => {
        try {
          const response = await fetch(
            `/api/contas/check-exists?bancoId=${bancoId}&agencia=${debouncedAgencia}&nroconta=${debouncedNroConta}`,
          );
          if (response.ok) {
            const { data } = await response.json();
            toast({
              title: 'Registro encontrado',
              description: `Carregando dados da conta ${data.agencia}/${data.nroconta}.`,
            });
            setEffectiveConta(data); // This switches the form to edit mode
          }
        } catch (error) {
          console.error('Erro ao verificar conta:', error);
        }
      };
      checkContaExists();
    }
  }, [debouncedAgencia, debouncedNroConta, bancoId, conta, toast]);

  useEffect(() => {
    // This effect syncs the form with the effectiveConta state
    if (effectiveConta) {
      reset(effectiveConta);
    } else {
      reset({
        agencia: '',
        nroconta: '',
        convenio: '',
        carteira: '',
        variacao: '',
        tipo: 'NF',
        melo: '',
        status: 'ATIVO',
      });
    }
  }, [effectiveConta, reset]);

  useEffect(() => {
    const fetchFiliais = async () => {
      try {
        const data = await getFiliais({ page: 1, perPage: 100 });
        setFiliais(data.data);
      } catch (error) {
        console.error('Erro ao buscar filiais:', error);
      }
    };
    if (isOpen) {
      fetchFiliais();
      setEffectiveConta(conta); // Set initial state when modal opens
    }
  }, [isOpen, conta]);

  const onSubmit = async (data: ContaFormData) => {
    if (!bancoId) {
      toast({
        title: 'Erro',
        description: 'ID do banco não encontrado.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (isNew) {
        const payload = { ...data, banco: bancoId };
        await insertConta(payload);
      } else {
        const payload = { ...data, id: effectiveConta.id, banco: bancoId };
        await updateConta(payload);
      }
      toast({
        title: 'Sucesso!',
        description: `Conta ${
          isNew ? 'cadastrada' : 'atualizada'
        } com sucesso.`,
      });
      onClose();
    } catch (error: any) {
      console.error('Erro ao salvar conta:', error);
      toast({
        title: 'Erro ao salvar conta',
        description:
          error.response?.data?.error || 'Ocorreu um erro. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="relative w-full max-w-2xl rounded-lg bg-white p-6 dark:bg-slate-800">
        <h2 className="mb-4 text-lg font-semibold">
          {isNew ? 'Adicionar Conta' : 'Editar Conta'}
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="agencia">Agência</label>
              <Controller
                name="agencia"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="agencia"
                    readOnly={!isNew}
                    autoComplete="off"
                  />
                )}
              />
              {errors.agencia && (
                <p className="text-sm text-red-500">{errors.agencia.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="nroconta">Conta Corrente</label>
              <Controller
                name="nroconta"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="nroconta"
                    readOnly={!isNew}
                    autoComplete="off"
                  />
                )}
              />
              {errors.nroconta && (
                <p className="text-sm text-red-500">
                  {errors.nroconta.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="convenio">Convênio / Cód. Cedente</label>
            <Controller
              name="convenio"
              control={control}
              render={({ field }) => <Input {...field} id="convenio" />}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="carteira">Carteira</label>
              <Controller
                name="carteira"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="carteira"
                    maxLength={3}
                    onChange={(e) =>
                      field.onChange(e.target.value.toUpperCase())
                    }
                  />
                )}
              />
              {errors.carteira && (
                <p className="text-sm text-red-500">
                  {errors.carteira.message}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="variacao">Variação</label>
              <Controller
                name="variacao"
                control={control}
                render={({ field }) => <Input {...field} id="variacao" />}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="tipo">Tipo de Emissão</label>
              <Controller
                name="tipo"
                control={control}
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NF">NF (Nota Fiscal)</SelectItem>
                      <SelectItem value="FAG">
                        FAG (Faturamento Agrupado)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div>
              <label htmlFor="melo">Filial (Melo)</label>
              <Controller
                name="melo"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a filial" />
                    </SelectTrigger>
                    <SelectContent>
                      {filiais.map((f) => (
                        <SelectItem
                          key={f.codigo_filial}
                          value={String(f.codigo_filial)}
                        >
                          {f.codigo_filial} - {f.nome_filial}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.melo && (
                <p className="text-sm text-red-500">{errors.melo.message}</p>
              )}
            </div>
          </div>
          <div>
            <label htmlFor="status">Status</label>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ATIVO">ATIVO</SelectItem>
                    <SelectItem value="INATIVO">INATIVO</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <DefaultButton
              type="button"
              onClick={onClose}
              variant="cancel"
              text="Cancelar"
              disabled={isSubmitting}
            />
            {isSubmitting ? (
              <Carregamento />
            ) : (
              <DefaultButton
                type="submit"
                variant="confirm"
                text={isNew ? 'Salvar' : 'Salvar Alterações'}
              />
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default CadastrarContaModal;
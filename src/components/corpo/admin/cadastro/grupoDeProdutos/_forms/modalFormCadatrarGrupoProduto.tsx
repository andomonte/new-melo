// src/components/gruposDeProdutos/_forms/modalFormCadastrarGrupoProduto.tsx
import React, { useEffect, useState } from 'react';
import {
  UseFormRegister,
  FieldErrors,
  UseFormSetValue,
  UseFormWatch,
} from 'react-hook-form';
import { useDebouncedCallback } from 'use-debounce';
import { CreateGrupoProdutoFormInput } from '@/data/gruposDeProdutos/gruposProdutoSchema';
import { X } from 'lucide-react';
import FormInput from '@/components/common/FormInput';
import SelectInput from '@/components/common/SelectPadrao';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import FormFooter from '@/components/common/FormFooter2';
import Carregamento from '@/utils/carregamento';

interface ModalFormCadastrarGrupoProdutoProps {
  titulo: string;
  onClose: () => void;
  loading?: boolean;
  handleSubmit: () => void;
  handleClear: () => void;
  register: UseFormRegister<CreateGrupoProdutoFormInput>;
  errors: FieldErrors<CreateGrupoProdutoFormInput>;
  isDirty: boolean;
  setValue: UseFormSetValue<CreateGrupoProdutoFormInput>;
  watch: UseFormWatch<CreateGrupoProdutoFormInput>;
}

interface Opcao {
  value: string;
  label: string;
}

const negocioOptions: Opcao[] = [
  { value: 'S', label: 'SIM' },
  { value: 'N', label: 'NÃO' },
];

const ModalFormCadastrarGrupoProduto: React.FC<
  ModalFormCadastrarGrupoProdutoProps
> = ({
  titulo,
  handleSubmit,
  handleClear,
  onClose,
  register,
  errors,
  loading = false,
  isDirty,
  setValue,
  watch,
}) => {
  const [segmentos, setSegmentos] = useState<Opcao[]>([]);
  const [compradores, setCompradores] = useState<Opcao[]>([]);
  const [contabeis, setContabeis] = useState<Opcao[]>([]);

  const buscar = async (
    url: string,
    codeField: string,
    labelField: string,
    setter: (o: Opcao[]) => void,
    search = '',
  ) => {
    try {
      const res = await fetch(
        `${url}?perPage=50&search=${encodeURIComponent(search)}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      const rows = data.data || data.rows || data || [];
      setter(
        rows.map((r: any) => ({
          value: String(r[codeField] ?? '').trim(),
          label: `${String(r[codeField] ?? '').trim()} - ${r[labelField] ?? ''}`,
        })),
      );
    } catch {
      /* silencioso */
    }
  };

  // Carrega as opções iniciais
  useEffect(() => {
    buscar('/api/segmentos/get', 'codsegmento', 'descricao', setSegmentos);
    buscar('/api/compradores/get', 'codcomprador', 'nome', setCompradores);
    buscar('/api/gruposContabil/get', 'codgpc', 'descr', setContabeis);
  }, []);

  const buscarSegmentos = useDebouncedCallback(
    (s: string) => buscar('/api/segmentos/get', 'codsegmento', 'descricao', setSegmentos, s),
    300,
  );
  const buscarCompradores = useDebouncedCallback(
    (s: string) => buscar('/api/compradores/get', 'codcomprador', 'nome', setCompradores, s),
    300,
  );
  const buscarContabeis = useDebouncedCallback(
    (s: string) => buscar('/api/gruposContabil/get', 'codgpc', 'descr', setContabeis, s),
    300,
  );

  return (
    <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg shadow-lg w-full max-w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
      {/* Cabeçalho fixo */}
      <div className="flex justify-center items-center px-4 py-3 border-b dark:border-gray-700">
        <header className="mb-0 w-[60%]">
          <h4 className="text-xl font-bold text-[#347AB6]">{titulo}</h4>
        </header>
        <div className="w-[35%] flex justify-end">
          <FormFooter
            onSubmit={handleSubmit}
            onClear={handleClear}
            isSaving={loading}
            hasChanges={isDirty}
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

      {/* Conteúdo com scroll */}
      <div className="flex-grow overflow-y-auto px-6 py-6 text-gray-800 dark:text-gray-100">
        {loading ? (
          <Carregamento />
        ) : (
          <div className="bg-white dark:bg-zinc-700 rounded-lg p-6 shadow space-y-4 w-full">
            <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 border-b pb-2">
              Grupo de Produto
            </h3>

            {/* Descrição (Código é gerado automaticamente no banco) */}
            <FormInput
              label="Descrição"
              type="text"
              id="descr"
              {...register('descr')}
              error={errors.descr?.message}
              required
              maxLength={30}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Segmento */}
              <SelectInput
                searchable
                name="codseg"
                label="Segmento"
                options={segmentos}
                value={watch('codseg') || ''}
                onValueChange={(v) =>
                  setValue('codseg', v as string, { shouldDirty: true })
                }
                onInputChange={(v) => buscarSegmentos(v)}
                error={errors.codseg?.message}
              />

              {/* Comprador */}
              <SelectInput
                searchable
                name="codcomprador"
                label="Comprador"
                options={compradores}
                value={watch('codcomprador') || ''}
                onValueChange={(v) =>
                  setValue('codcomprador', v as string, { shouldDirty: true })
                }
                onInputChange={(v) => buscarCompradores(v)}
                error={errors.codcomprador?.message}
              />

              {/* Gp. Contábil */}
              <SelectInput
                searchable
                name="codgpc"
                label="Gp. Contábil"
                options={contabeis}
                value={watch('codgpc') || ''}
                onValueChange={(v) =>
                  setValue('codgpc', v as string, { shouldDirty: true })
                }
                onInputChange={(v) => buscarContabeis(v)}
                error={errors.codgpc?.message}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Dias para Reposição */}
              <FormInput
                label="Dias para Reposição"
                type="number"
                id="diasreposicao"
                {...register('diasreposicao', { valueAsNumber: true })}
                error={errors.diasreposicao?.message}
              />

              {/* É do Negócio? */}
              <SelectInput
                name="ramonegocio"
                label="É do Negócio?"
                options={negocioOptions}
                value={watch('ramonegocio') || ''}
                onValueChange={(v) =>
                  setValue('ramonegocio', v as string, { shouldDirty: true })
                }
                error={errors.ramonegocio?.message}
              />

              {/* Prazo Comercial */}
              <FormInput
                label="Prazo Comercial"
                type="number"
                id="p_comercial"
                {...register('p_comercial', { valueAsNumber: true })}
                error={errors.p_comercial?.message}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              {/* Verba Marketing — máscara automática (ex.: 1000 -> 10.00) */}
              <FormInput
                label="Verba Marketing"
                type="text"
                id="v_marketing"
                name="v_marketing"
                value={Number(watch('v_marketing') ?? 0).toFixed(2)}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '');
                  const num = digits ? parseInt(digits, 10) / 100 : 0;
                  setValue('v_marketing', num, { shouldDirty: true });
                }}
                error={errors.v_marketing?.message}
              />

              {/* Bloquear Preço de Venda */}
              <div className="flex items-center gap-2 h-10">
                <Checkbox
                  id="chk-bloquear-preco-gpp"
                  checked={watch('bloquear_preco') === 'S'}
                  onCheckedChange={(c) =>
                    setValue('bloquear_preco', c ? 'S' : 'N', {
                      shouldDirty: true,
                    })
                  }
                />
                <Label
                  htmlFor="chk-bloquear-preco-gpp"
                  className="font-normal cursor-pointer"
                >
                  Bloquear Preço de Venda
                </Label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModalFormCadastrarGrupoProduto;

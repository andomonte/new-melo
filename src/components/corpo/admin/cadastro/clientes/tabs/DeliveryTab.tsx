import React, { useState } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SelectPadrao from '@/components/common/SelectPadrao';
import InputMask from 'react-input-mask';
import { buscaCep } from '@/data/cep';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export function DeliveryTab() {
  const { register, control, setValue, getValues } = useFormContext();
  const [loadingCep, setLoadingCep] = useState(false);

  const handleCepEntregaBlur = async () => {
    const cep = getValues('cepEntrega');
    if (!cep) return;
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) return;

    setLoadingCep(true);
    try {
      const data = await buscaCep(clean);
      if (data) {
        setValue('enderecoEntrega', data.logradouro);
        setValue('bairroEntrega', data.bairro);
        setValue('cidadeEntrega', data.localidade);
        setValue('ufEntrega', data.uf);
      }
    } catch {
      toast.error('Erro ao buscar CEP');
    } finally {
      setLoadingCep(false);
    }
  };

  const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

  return (
    <div className="form-compact space-y-3">
      <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2 border-b pb-2">
        Contato de Entrega
      </h3>

      <div className="grid grid-cols-4 gap-3">
        <div>
          <Label>Tipo Pessoa</Label>
          <Controller
            control={control}
            name="tipoPessoaEntrega"
            render={({ field }) => (
              <SelectPadrao
                value={field.value || 'F'}
                onValueChange={field.onChange}
                placeholder="Selecione"
                options={[
                  { value: 'F', label: 'Pessoa Física' },
                  { value: 'J', label: 'Pessoa Jurídica' },
                ]}
              />
            )}
          />
        </div>
        <div className="col-span-2">
          <Label>Nome / Contato</Label>
          <Input {...register('nomeEntrega')} placeholder="Nome do responsável pela entrega" />
        </div>
        <div>
          <Label>Email</Label>
          <Input {...register('emailEntrega')} type="email" placeholder="email@exemplo.com" />
        </div>
      </div>

      <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mt-4 mb-2 border-b pb-2">
        Endereço de Entrega
      </h3>

      <div className="grid grid-cols-4 gap-3">
        <div className="relative">
          <Label>CEP</Label>
          <div className="relative">
            <Controller
              control={control}
              name="cepEntrega"
              render={({ field: { ref, onBlur, ...fieldProps } }) => (
                <InputMask
                  {...fieldProps}
                  onBlur={() => { onBlur(); handleCepEntregaBlur(); }}
                  mask="99999-999"
                >
                  {(inputProps: any) => (
                    <Input {...inputProps} ref={ref} placeholder="00000-000" />
                  )}
                </InputMask>
              )}
            />
            {loadingCep && (
              <div className="absolute right-2 top-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              </div>
            )}
          </div>
        </div>
        <div className="col-span-2">
          <Label>Logradouro</Label>
          <Input {...register('enderecoEntrega')} />
        </div>
        <div>
          <Label>Número</Label>
          <Input {...register('numeroEntrega')} />
        </div>
        <div>
          <Label>Complemento</Label>
          <Input {...register('complementoEntrega')} />
        </div>
        <div>
          <Label>Referência</Label>
          <Input {...register('referenciaEntrega')} placeholder="Ponto de referência" />
        </div>
        <div>
          <Label>Bairro</Label>
          <Input {...register('bairroEntrega')} />
        </div>
        <div>
          <Label>Cidade</Label>
          <Input {...register('cidadeEntrega')} />
        </div>
        <div>
          <Label>UF</Label>
          <Controller
            control={control}
            name="ufEntrega"
            render={({ field }) => (
              <SelectPadrao
                value={field.value || ''}
                onValueChange={field.onChange}
                placeholder="UF"
                options={UFS.map((uf) => ({ value: uf, label: uf }))}
              />
            )}
          />
        </div>
        <div>
          <Label>País</Label>
          <Input {...register('paisEntrega')} placeholder="Brasil" />
        </div>
      </div>

      <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mt-4 mb-2 border-b pb-2">
        Inscrições Fiscais (Entrega)
      </h3>

      <div className="grid grid-cols-4 gap-3">
        <div>
          <Label>Inscrição Estadual</Label>
          <Input {...register('iestEntrega')} />
        </div>
        <div>
          <Label>Inscrição Municipal</Label>
          <Input {...register('imunEntrega')} />
        </div>
        <div>
          <Label>SUFRAMA</Label>
          <Input {...register('suframaEntrega')} />
        </div>
      </div>
    </div>
  );
}

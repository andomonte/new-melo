import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { RequisitionDTO } from '@/data/requisicoesCompra/types/requisition';
import * as service from '@/data/requisicoesCompra/requisicoesCompra';

export function useRequisitionForm(onSaved: () => void) {
  const { toast } = useToast();
  const [form, setForm] = useState<Partial<RequisitionDTO>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open(initial?: RequisitionDTO) {
    setForm(initial ? { ...initial } : {});
    setError(null);
  }

  function onChange<K extends keyof RequisitionDTO>(
    field: K,
    value: RequisitionDTO[K],
  ) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit() {
    setSaving(true);
    try {
      await service.saveRequisition(form as RequisitionDTO);
      toast({ title: 'Requisição salva com sucesso' });
      onSaved();
      return true;
    } catch (err: any) {
      const msg = err?.message ?? 'Erro ao salvar requisição';
      setError(msg);
      toast({ title: msg, variant: 'destructive' });
      return false;
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setForm({});
    setError(null);
    setSaving(false);
  }

  return {
    form,
    open,
    onChange,
    submit,
    reset,
    saving,
    error,
  };
}

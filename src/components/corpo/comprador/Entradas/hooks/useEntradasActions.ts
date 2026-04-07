import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { entradasService } from '../services/entradasService';
import { EntradaDTO, NovaEntradaData, EditEntradaData } from '../types';

interface UseEntradasActionsReturn {
  loading: boolean;
  createEntrada: (data: NovaEntradaData) => Promise<EntradaDTO | null>;
  updateEntrada: (id: string, data: EditEntradaData) => Promise<EntradaDTO | null>;
  deleteEntrada: (id: string) => Promise<boolean>;
}

export const useEntradasActions = (): UseEntradasActionsReturn => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const createEntrada = async (data: NovaEntradaData): Promise<EntradaDTO | null> => {
    setLoading(true);
    try {
      const entrada = await entradasService.create(data);

      toast({
        title: 'Sucesso',
        description: 'Entrada criada com sucesso',
      });

      return entrada;
    } catch (error) {
      console.error('Erro ao criar entrada:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao criar entrada',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateEntrada = async (id: string, data: EditEntradaData): Promise<EntradaDTO | null> => {
    setLoading(true);
    try {
      const entrada = await entradasService.update(id, data);

      toast({
        title: 'Sucesso',
        description: 'Entrada atualizada com sucesso',
      });

      return entrada;
    } catch (error) {
      console.error('Erro ao atualizar entrada:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar entrada',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const deleteEntrada = async (id: string): Promise<boolean> => {
    setLoading(true);
    try {
      await entradasService.delete(id);

      toast({
        title: 'Sucesso',
        description: 'Entrada excluida com sucesso',
      });

      return true;
    } catch (error) {
      console.error('Erro ao excluir entrada:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao excluir entrada',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    createEntrada,
    updateEntrada,
    deleteEntrada,
  };
};
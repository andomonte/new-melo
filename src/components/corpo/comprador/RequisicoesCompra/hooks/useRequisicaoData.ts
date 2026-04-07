import { useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useRequisicaoStore } from '../stores/useRequisicaoStore';
import api from '@/components/services/api';

export const useRequisicaoData = () => {
  const { toast } = useToast();
  const {
    tipos,
    filiais,
    compradores,
    loadingDados,
    setTipos,
    setFiliais,
    setCompradores,
    setLoadingDados,
  } = useRequisicaoStore();

  const carregarDados = useCallback(async () => {
    // Se já temos dados, não recarregar
    if (tipos.length > 0 && filiais.length > 0 && compradores.length > 0) {
      return;
    }

    setLoadingDados(true);
    try {
      const [tiposRes, filiaisRes, compradoresRes] = await Promise.all([
        api.get('/api/compras/tipos-requisicao'),
        api.get('/api/compras/filiais'),
        api.get('/api/compras/compradores')
      ]);

      setTipos(tiposRes.data || []);
      setFiliais(filiaisRes.data || []);
      setCompradores(compradoresRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar dados do formulário',
        variant: 'destructive'
      });
    } finally {
      setLoadingDados(false);
    }
  }, [tipos.length, filiais.length, compradores.length, setTipos, setFiliais, setCompradores, setLoadingDados, toast]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  return {
    tipos,
    filiais,
    compradores,
    loadingDados,
    recarregarDados: carregarDados,
  };
};
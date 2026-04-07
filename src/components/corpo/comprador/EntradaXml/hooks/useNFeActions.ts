import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { nfeService } from '../services/nfeService';
import { UploadXmlData, ProcessNFeData } from '../types';

interface UseNFeActionsReturn {
  loading: boolean;
  uploadXml: (data: UploadXmlData) => Promise<boolean>;
  processNFe: (id: string, data: ProcessNFeData) => Promise<boolean>;
  deleteNFe: (id: string) => Promise<boolean>;
}

export const useNFeActions = (): UseNFeActionsReturn => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const uploadXml = async (data: UploadXmlData): Promise<boolean> => {
    setLoading(true);
    try {
      await nfeService.uploadXml(data);
      
      toast({
        title: 'Sucesso',
        description: 'XML(s) enviado(s) com sucesso',
      });
      
      return true;
    } catch (error) {
      console.error('Erro ao enviar XML:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao enviar XML(s)',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const processNFe = async (id: string, data: ProcessNFeData): Promise<boolean> => {
    setLoading(true);
    try {
      await nfeService.processNFe(id, data);
      
      toast({
        title: 'Sucesso',
        description: 'NFe processada com sucesso',
      });
      
      return true;
    } catch (error) {
      console.error('Erro ao processar NFe:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao processar NFe',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteNFe = async (id: string): Promise<boolean> => {
    setLoading(true);
    try {
      await nfeService.deleteNFe(id);
      
      toast({
        title: 'Sucesso',
        description: 'NFe excluída com sucesso',
      });
      
      return true;
    } catch (error) {
      console.error('Erro ao excluir NFe:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao excluir NFe',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    uploadXml,
    processNFe,
    deleteNFe
  };
};
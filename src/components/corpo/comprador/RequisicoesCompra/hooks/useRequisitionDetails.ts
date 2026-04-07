import { useState, useEffect } from 'react';
import api from '@/components/services/api';

interface RequisitionDetails {
  req_id: number;
  req_versao: number;
  req_id_composto: string;
  req_status: string;
  fornecedor_nome?: string;
  comprador_nome?: string;
}

export function useRequisitionDetails(reqId: number, reqVersion: number) {
  const [details, setDetails] = useState<RequisitionDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reqId || !reqVersion) return;

    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Use the existing GET API with search by ID to get full details
        const response = await api.get('/api/requisicoesCompra/get', {
          params: { 
            search: reqId.toString(),
            page: 1,
            perPage: 1 
          }
        });

        const requisition = response.data.data.find((r: any) => 
          r.req_id === reqId && r.req_versao === reqVersion
        );

        if (requisition) {
          setDetails({
            req_id: requisition.req_id,
            req_versao: requisition.req_versao,
            req_id_composto: requisition.req_id_composto,
            req_status: requisition.req_status,
            fornecedor_nome: requisition.fornecedor_nome,
            comprador_nome: requisition.comprador_nome,
          });
        } else {
          setError('Requisição não encontrada');
        }
      } catch (err) {
        console.error('Error fetching requisition details:', err);
        setError('Erro ao carregar detalhes da requisição');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [reqId, reqVersion]);

  return { details, loading, error };
}
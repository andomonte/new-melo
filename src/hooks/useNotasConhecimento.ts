// Hook customizado para gerenciar Notas de Conhecimento
import { useState } from 'react';
import { toast } from 'sonner';

export interface NotaConhecimento {
  codtransp: string;
  nrocon: string;
  serie: string;
  totalcon: number;
  totaltransp: number;
  dtcon: string;
  dtemissao: string;
  pago: string;
  cancel: string;
  cfop: string;
  icms: number;
  baseicms: number;
  tipocon: string;
  chave: string;
  protocolo: string;
  nome_transp?: string;
  cod_pgto?: string;
  dt_pgto?: string;
  valor_pago?: number;
  status?: 'pendente' | 'pago' | 'cancelado';
}

export interface FiltrosNotasConhecimento {
  status?: 'pendente' | 'pago' | 'cancelado' | 'todos';
  data_inicio?: string;
  data_fim?: string;
  codtransp?: string;
  nrocon?: string;
  search?: string;
}

export function useNotasConhecimento() {
  const [notas, setNotas] = useState<NotaConhecimento[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [total, setTotal] = useState(0);
  const [limite, setLimite] = useState(20);

  const consultarNotas = async (
    pagina: number = 1,
    limiteParam: number = 20,
    filtros: FiltrosNotasConhecimento = {}
  ) => {
    setCarregando(true);
    try {
      const params = new URLSearchParams({
        page: pagina.toString(),
        limit: limiteParam.toString(),
      });

      if (filtros.status && filtros.status !== 'todos') {
        params.append('status', filtros.status);
      }
      if (filtros.data_inicio) {
        params.append('data_inicio', filtros.data_inicio);
      }
      if (filtros.data_fim) {
        params.append('data_fim', filtros.data_fim);
      }
      if (filtros.codtransp) {
        params.append('codtransp', filtros.codtransp);
      }
      if (filtros.nrocon) {
        params.append('nrocon', filtros.nrocon);
      }
      if (filtros.search) {
        params.append('search', filtros.search);
      }

      const response = await fetch(`/api/notas-conhecimento?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Erro ao buscar notas de conhecimento');
      }

      const data = await response.json();
      
      setNotas(data.notas_conhecimento || []);
      setPaginaAtual(data.paginacao.pagina);
      setTotalPaginas(data.paginacao.totalPaginas);
      setTotal(data.paginacao.total);
      setLimite(data.paginacao.limite);
      
    } catch (error: any) {
      console.error('Erro ao consultar notas:', error);
      toast.error('Erro ao carregar notas de conhecimento');
      setNotas([]);
    } finally {
      setCarregando(false);
    }
  };

  return {
    notas,
    carregando,
    paginaAtual,
    totalPaginas,
    total,
    limite,
    consultarNotas,
    setPaginaAtual,
    setLimite,
  };
}

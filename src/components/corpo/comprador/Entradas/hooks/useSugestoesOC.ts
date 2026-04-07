import { useState } from 'react';
import api from '@/components/services/api';
import { toast } from 'sonner';

export interface ItemNFe {
  codigo_produto: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
}

export interface ItemMatch {
  codprod: string;
  descricao: string;
  quantidade_oc: number;
  quantidade_nfe: number;
  quantidade_disponivel: number;
  valor_unitario_oc: number;
  valor_unitario_nfe: number;
  diferenca_preco_percentual: number;
  diferenca_quantidade_percentual: number;
}

export interface SugestaoOC {
  orc_id: number;
  req_id_composto: string;
  fornecedor_nome: string;
  fornecedor_cnpj: string;
  data_ordem: string;
  data_requisicao: string;
  valor_total: number;
  status: string;

  // Métricas de matching
  score_total: number;
  score_fornecedor: number;
  score_produtos: number;
  score_quantidade: number;
  score_data: number;

  // Detalhes do match
  produtos_comum: number;
  produtos_total_nfe: number;
  percentual_match_produtos: number;
  similaridade_quantidade: number;
  dias_diferenca: number;

  // Alertas e divergências
  alertas: string[];

  // Itens da OC que fazem match
  itens_match: ItemMatch[];
}

export interface SugestoesResponse {
  success: boolean;
  data?: {
    sugestoes: SugestaoOC[];
    total_ocs_analisadas: number;
    criterios_utilizados: string[];
  };
  message?: string;
}

export function useSugestoesOC() {
  const [sugestoes, setSugestoes] = useState<SugestaoOC[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalOCsAnalisadas, setTotalOCsAnalisadas] = useState(0);
  const [criteriosUtilizados, setCriteriosUtilizados] = useState<string[]>([]);

  const buscarSugestoes = async (
    fornecedor_cnpj: string,
    itens_nfe: ItemNFe[],
    data_nfe?: string
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Buscando sugestões inteligentes de OCs...');
      console.log('Fornecedor CNPJ:', fornecedor_cnpj);
      console.log('Itens NFe:', itens_nfe.length);

      const response = await api.post<SugestoesResponse>('/api/entrada-xml/sugestoes-oc', {
        fornecedor_cnpj,
        itens_nfe,
        data_nfe: data_nfe || new Date().toISOString()
      });

      if (response.data.success && response.data.data) {
        const { sugestoes: sugestoesData, total_ocs_analisadas, criterios_utilizados } = response.data.data;

        setSugestoes(sugestoesData);
        setTotalOCsAnalisadas(total_ocs_analisadas);
        setCriteriosUtilizados(criterios_utilizados);

        console.log(`✅ ${sugestoesData.length} sugestões encontradas de ${total_ocs_analisadas} OCs analisadas`);

        if (sugestoesData.length === 0) {
          toast.info('Nenhuma sugestão encontrada para esta NFe');
        } else {
          const melhorScore = sugestoesData[0]?.score_total || 0;
          toast.success(`${sugestoesData.length} sugestões encontradas! Melhor match: ${melhorScore} pontos`);
        }

        return true;
      } else {
        setError(response.data.message || 'Erro ao buscar sugestões');
        toast.error(response.data.message || 'Erro ao buscar sugestões');
        return false;
      }
    } catch (err: any) {
      console.error('Erro ao buscar sugestões:', err);
      const errorMsg = err.response?.data?.message || 'Erro ao buscar sugestões de OCs';
      setError(errorMsg);
      toast.error(errorMsg);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const limparSugestoes = () => {
    setSugestoes([]);
    setTotalOCsAnalisadas(0);
    setCriteriosUtilizados([]);
    setError(null);
  };

  const getSugestaoPorId = (orc_id: number): SugestaoOC | undefined => {
    return sugestoes.find(s => s.orc_id === orc_id);
  };

  const filtrarSugestoesPorScore = (scoreMinimo: number): SugestaoOC[] => {
    return sugestoes.filter(s => s.score_total >= scoreMinimo);
  };

  const getSugestaoComMaisAlertas = (): SugestaoOC | undefined => {
    return sugestoes.reduce((prev, current) =>
      (current.alertas.length > prev.alertas.length) ? current : prev,
      sugestoes[0]
    );
  };

  const getEstatisticas = () => {
    if (sugestoes.length === 0) {
      return {
        media_score: 0,
        melhor_score: 0,
        pior_score: 0,
        media_match_produtos: 0,
        total_com_alertas: 0
      };
    }

    const scores = sugestoes.map(s => s.score_total);
    const matchProdutos = sugestoes.map(s => s.percentual_match_produtos);

    return {
      media_score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      melhor_score: Math.max(...scores),
      pior_score: Math.min(...scores),
      media_match_produtos: Math.round(matchProdutos.reduce((a, b) => a + b, 0) / matchProdutos.length),
      total_com_alertas: sugestoes.filter(s => s.alertas.length > 0).length
    };
  };

  return {
    sugestoes,
    loading,
    error,
    totalOCsAnalisadas,
    criteriosUtilizados,
    buscarSugestoes,
    limparSugestoes,
    getSugestaoPorId,
    filtrarSugestoesPorScore,
    getSugestaoComMaisAlertas,
    getEstatisticas
  };
}

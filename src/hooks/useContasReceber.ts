import { useState } from 'react';

export interface ContaReceber {
  id: number;
  cod_receb: string; // Código único do recebimento (chave primária)
  rec_cof_id: number | null; // ID da conta financeira (FK para cad_conta_financeira)
  descricao_conta: string | null; // Descrição da conta financeira
  codcli: number;
  nome_cliente: string;
  dt_venc: string | null; // Data de vencimento
  dt_pgto: string | null; // Data do pagamento (quando foi recebido)
  dt_emissao: string | null;
  valor_original: number; // Valor a receber (campo do banco: valor_pgto)
  valor_recebido: number; // Valor já recebido (campo do banco: valor_rec)
  nro_doc: string | null; // Número do documento
  obs: string | null;
  tipo: string; // Tipo de recebimento
  rec: string; // 'S' ou 'N' (indica se foi recebido)
  cancel: string; // 'S' ou 'N' (indica se foi cancelado)
  codvend: number | null;
  nome_vendedor: string | null;
  banco: string | null; // Código do banco
  nome_banco?: string | null; // Nome do banco
  nro_banco: string | null; // Nosso número do banco
  nro_docbanco: string | null; // Número do documento no banco
  bradesco: string | null; // Código específico Bradesco
  forma_fat: string | null; // Forma de faturamento
  status: 'pendente' | 'pendente_parcial' | 'recebido_parcial' | 'recebido' | 'cancelado' | 'vencido';
  dias_atraso?: number; // Calculado se vencido
  
  // Campos de operadora de cartão (quando aplicável - tabela FIN_CARTAO)
  codopera?: string | null; // Código da operadora
  nome_operadora?: string | null;
  tx_operadora?: number | null; // Taxa da operadora
  pz_operadora?: number | null; // Prazo de repasse
  
  // Campos de parcelamento/agrupamento
  eh_parcelada?: boolean;
  qtd_parcelas?: number;
  parcela_atual?: string;
  valor_rec_total?: number;
  parcelas?: ContaReceber[];
  grupo_pagamento_id?: number | null; // Novo campo do PostgreSQL
  
  // Campos de fatura (quando vinculado)
  cod_fat?: string | null; // Código da fatura
  cod_venda?: string | null; // Código da venda
  
  // Campos de cartão (quando vinculado a FIN_CARTAO via FIN_CARTAO_RECEB)
  tem_cartao?: boolean;
  car_nrodocumento?: string | null;
  car_nroautorizacao?: string | null;
  car_nroparcela?: string | null;
  car_valor?: number | null;
  car_vlrliq?: number | null; // Valor líquido após taxas
}

export interface FiltrosContasReceber {
  status?: 'pendente' | 'pendente_parcial' | 'recebido_parcial' | 'recebido' | 'cancelado' | 'vencido';
  data_inicio?: string;
  data_fim?: string;
  cliente?: string;
  vendedor?: string;
  operadora?: string;
  conta?: string;
  tipo?: string;
  com_atraso?: boolean;
  // Campos adicionais suportados pelos filtros avançados / UI
  cod_receb?: string;
  nro_doc?: string;
  cod_fat?: string;
  cod_venda?: string;
  banco?: string;
}

export interface Paginacao {
  pagina: number;
  limite: number;
  total: number;
  totalPaginas: number;
}

export interface RespostaContasReceber {
  contas_receber: ContaReceber[];
  paginacao: Paginacao;
  resumo?: {
    total_a_receber: number;
    total_recebido: number;
    total_vencido: number;
    total_pendente: number;
    qtd_pendente: number;
    qtd_vencida: number;
  };
}

export interface MarcarRecebidoData {
  dt_receb?: string;
  dt_venc?: string;
  dt_emissao?: string;
  valor_recebido?: number;
  obs?: string;
  banco?: string | null;
  forma_pgto?: string | null; // Código forma de pagamento
  tp_pgto?: string | null; // 'D'=Dinheiro, 'C'=Cartão, 'P'=PIX, 'T'=Transferência, 'B'=Boleto
  comprovante?: string | null;
  cod_ccusto?: string | null;
  valor_juros?: number;
  valor_desconto?: number;
  cod_conta?: string | null;
  codopera?: string | null; // Código operadora (se cartão)
  cod_operadora?: string | null;
  tx_cartao?: string | null;
  dt_cartao?: string | null;
  nro_cheque?: string | null;
  parcela?: string | null;
  num_parcela?: number; // Número desta parcela (1, 2, 3...)
  total_parcelas?: number; // Total de parcelas (3, 6, 12...)
  cod_documento?: string | null;
  cod_autorizacao?: string | null;
  cmc7?: string | null;
  id_autenticacao?: string | null;
  cof_id?: string | null;
  nome?: string | null;
  cod_bc?: string | null;
  caixa?: string | null;
  ctrl?: string | null;
  tipo?: string | null;
  sf?: string | null;
}

export interface EditarContaReceberData {
  dt_venc?: string;
  dt_emissao?: string;
  valor_pgto?: number; // Valor do título
  obs?: string;
  nro_doc?: string; // Número do documento
  codcli?: number; // Código do cliente
  rec_cof_id?: number; // Conta financeira (dbconta)
}

export interface NovaContaReceberData {
  tipo: string;
  codcli: number;
  cod_conta?: number | null;
  cod_ccusto?: number | null;
  codvend?: number | null;
  dt_venc: string;
  dt_emissao?: string;
  valor_rec: number; // Corrigido de valor_receb para valor_rec
  nro_nf?: string;
  nro_dup?: string;
  obs?: string;
  parcelado?: boolean;
  num_parcelas?: number;
  intervalo_dias?: number;
}

export function useContasReceber() {
  const [contasReceber, setContasReceber] = useState<ContaReceber[]>([]);
  const [paginacao, setPaginacao] = useState<Paginacao | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const consultarContasReceber = async (
    pagina: number = 1,
    limite: number = 20,
    filtros: FiltrosContasReceber = {}
  ) => {
    setCarregando(true);
    setErro(null);

    try {
      const params = new URLSearchParams({
        page: pagina.toString(),
        limit: limite.toString(),
        ...Object.fromEntries(
          Object.entries(filtros).filter(([_, v]) => v !== undefined && v !== '')
        )
      });

      const response = await fetch(`/api/contas-receber?${params}`);

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const data: RespostaContasReceber = await response.json();

      setContasReceber(data.contas_receber);
      setPaginacao(data.paginacao);

    } catch (error: any) {
      console.error('❌ Erro ao consultar contas a receber:', error);
      setErro(error.message || 'Erro ao consultar contas a receber');
    } finally {
      setCarregando(false);
    }
  };

  const darBaixa = async (cod_receb: string, data: MarcarRecebidoData) => {
    setErro(null);

    try {
      const response = await fetch(`/api/contas-receber/dar-baixa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cod_receb, ...data }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.erro || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();

      // Atualizar a conta na lista local
      setContasReceber(prev =>
        prev.map(conta =>
          conta.cod_receb === cod_receb
            ? { ...conta, status: 'recebido', rec: 'S', dt_pgto: data.dt_receb || new Date().toISOString(), valor_recebido: data.valor_recebido || conta.valor_original }
            : conta
        )
      );

      return result;

    } catch (error: any) {
      console.error('❌ Erro ao dar baixa:', error);
      setErro(error.message || 'Erro ao dar baixa');
      throw error;
    }
  };

  const retirarBaixa = async (cod_receb: string, motivo?: string) => {
    setErro(null);

    try {
      const response = await fetch(`/api/contas-receber/retirar-baixa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cod_receb, motivo }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.erro || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();

      // Atualizar a conta na lista local
      setContasReceber(prev =>
        prev.map(conta =>
          conta.cod_receb === cod_receb
            ? { ...conta, status: 'pendente' as const, rec: 'N', dt_pgto: null, valor_recebido: 0 }
            : conta
        )
      );

      return result;

    } catch (error: any) {
      console.error('❌ Erro ao retirar baixa:', error);
      setErro(error.message || 'Erro ao retirar baixa');
      throw error;
    }
  };

  const marcarComoRecebido = darBaixa; // Alias para compatibilidade

  const editarConta = async (cod_receb: string, data: EditarContaReceberData) => {
    setErro(null);

    try {
      const response = await fetch(`/api/contas-receber/${cod_receb}/editar`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.erro || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();

      // Atualizar a conta na lista local
      setContasReceber(prev =>
        prev.map(conta =>
          conta.cod_receb === cod_receb
            ? { ...conta, ...result.titulo }
            : conta
        )
      );

      return result;

    } catch (error: any) {
      console.error('❌ Erro ao editar conta:', error);
      setErro(error.message || 'Erro ao editar conta');
      throw error;
    }
  };

  const cancelarConta = async (cod_receb: string, motivo?: string) => {
    setErro(null);

    try {
      const response = await fetch(`/api/contas-receber/cancelar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cod_receb, motivo }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.erro || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();

      // Atualizar a conta na lista local
      setContasReceber(prev =>
        prev.map(conta =>
          conta.cod_receb === cod_receb
            ? { ...conta, status: 'cancelado', cancel: 'S' }
            : conta
        )
      );

      return result;

    } catch (error: any) {
      console.error('❌ Erro ao cancelar conta:', error);
      setErro(error.message || 'Erro ao cancelar conta');
      throw error;
    }
  };

  const criarConta = async (data: NovaContaReceberData) => {
    setErro(null);

    try {
      const response = await fetch('/api/contas-receber', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.erro || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();

      return result;

    } catch (error: any) {
      console.error('❌ Erro ao criar conta:', error);
      setErro(error.message || 'Erro ao criar conta');
      throw error;
    }
  };

  return {
    contasReceber,
    paginacao,
    carregando,
    erro,
    consultarContasReceber,
    darBaixa,
    retirarBaixa,
    marcarComoRecebido,
    editarConta,
    cancelarConta,
    criarConta,
  };
}

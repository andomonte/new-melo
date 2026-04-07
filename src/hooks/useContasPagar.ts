import { useState, useEffect } from 'react';

export interface ContaPagar {
  id: number;
  cod_pgto?: string; // Alias para id (para compatibilidade)
  cod_conta: number;
  cod_credor: number;
  cod_transp?: string; // Código da transportadora (quando tipo = 'T')
  nome_credor: string;
  nome_exibicao?: string; // Nome a ser exibido (transportadora ou credor)
  cod_ccusto: number;
  descricao_ccusto: string;
  dt_venc: string | null;
  dt_pgto: string | null;
  dt_emissao: string | null;
  valor_pgto: number;
  valor_pago: number;
  nro_nf: string;
  obs: string;
  tem_nota: string;
  tem_cobr: string;
  tipo: string;
  paga: string;
  cancel: string;
  nro_dup: string;
  codcomprador: number;
  nome_comprador?: string; // Nome do comprador
  valor_juros: number;
  banco: string;
  nome_banco?: string; // Nome do banco
  ordem_compra?: string; // Número da ordem de compra
  descricao_conta: string;
  status: 'pendente' | 'pago_parcial' | 'pago' | 'cancelado';
  forma_pgto?: string; // Código da forma de pagamento (da tabela dbfpgto)
  total_pago_historico?: number; // Soma de todos os pagamentos do histórico
  qtd_pagamentos?: number; // Quantidade de pagamentos realizados
  
  // Campos de agrupamento de parcelas
  eh_parcelada?: boolean; // Indica se esta conta possui parcelas
  qtd_parcelas?: number; // Quantidade total de parcelas
  parcela_atual?: string; // Número da parcela atual (ex: "01", "02")
  nro_dup_base?: string; // Prefixo base do nro_dup (parte antes da "/")
  valor_pgto_total?: number; // Valor total somando todas as parcelas
  parcelas?: ContaPagar[]; // Array com todas as parcelas (quando agrupado)

  // Campos internacionais
  eh_internacional?: string; // 'S' ou 'N'
  moeda?: string; // Código da moeda (ex: 'USD', 'EUR')
  taxa_conversao?: number; // Taxa de conversão para BRL
  valor_moeda?: number; // Valor original na moeda estrangeira
  nro_invoice?: string; // Número da invoice internacional
  nro_contrato?: string; // Número do contrato internacional
  xml_nf?: string; // XML da nota fiscal
  titulo_importado?: boolean; // Indica se o título foi gerado automaticamente a partir de CT-e
  // possui_entrada?: boolean; // Indica se possui entrada aduaneira
}

export interface FiltrosContasPagar {
  status?: 'pendente' | 'pago_parcial' | 'pago' | 'cancelado' | 'pendente_parcial';
  data_inicio?: string;
  data_fim?: string;
  credor?: string; // Aceita código ou nome
  conta?: string;
  tipo?: 'F' | 'T'; // Fornecedor ou Transporte
  cod_pgto?: string; // ID da conta
  nro_nf?: string;
  nro_dup?: string;
  banco?: string;
  ordem_compra?: string; // Filtro por ordem de compra
  cod_ccusto?: string;
  codcomprador?: string;
  valor_min?: number;
  valor_max?: number;
  eh_internacional?: string; // 'S' ou 'N'
  moeda?: string;
  nro_invoice?: string;
  nro_contrato?: string;
  search?: string; // Busca geral
}

export interface Paginacao {
  pagina: number;
  limite: number;
  total: number;
  totalPaginas: number;
}

export interface RespostaContasPagar {
  contas_pagar: ContaPagar[];
  paginacao: Paginacao;
}

export interface MarcarPagoData {
  dt_pgto?: string;
  valor_pago?: number;
  obs?: string;
  banco?: string | null;
  forma_pgto?: string | null; // cod_fpgto - será registrado na DBFPGTO
  tp_pgto?: string | null; // Tipo: 'C'=Cheque, 'D'=Dinheiro, 'P'=PIX, 'T'=Transferência
  nro_cheque?: string | null; // Número do cheque (se tp_pgto = 'C')
  comprovante?: string | null;
  cod_ccusto?: string | null;
  valor_juros?: number;
  desconto?: number;
  multa?: number;
  cod_conta?: string | null;
  username?: string; // Nome do usuário (capturado automaticamente do cookie se não informado)
}

export interface EditarContaData {
  dt_venc?: string;
  dt_emissao?: string;
  valor_pgto?: number;
  obs?: string;
  nro_nf?: string;
  nro_dup?: string;
  cod_credor?: number;
  cod_conta?: number;
  cod_ccusto?: number;
}

export function useContasPagar() {
  const [contasPagar, setContasPagar] = useState<ContaPagar[]>([]);
  const [paginacao, setPaginacao] = useState<Paginacao | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const consultarContasPagar = async (
    pagina: number = 1,
    limite: number = 20,
    filtros: FiltrosContasPagar = {}
  ) => {
    setCarregando(true);
    setErro(null);

    try {
      const params = new URLSearchParams({
        page: pagina.toString(),
        limit: limite.toString(),
        ...filtros
      });

      const response = await fetch(`/api/contas-pagar?${params}`);

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const data: RespostaContasPagar = await response.json();

      setContasPagar(data.contas_pagar);
      setPaginacao(data.paginacao);

    } catch (error: any) {
      console.error('❌ Erro ao consultar contas a pagar:', error);
      setErro(error.message || 'Erro ao consultar contas a pagar');
    } finally {
      setCarregando(false);
    }
  };

  const marcarComoPago = async (id: number, data: MarcarPagoData) => {
    setErro(null);

    try {
      const response = await fetch(`/api/contas-pagar/${id}/marcar-pago`, {
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
      setContasPagar(prev =>
        prev.map(conta =>
          conta.id === id
            ? { ...conta, status: 'pago', dt_pgto: data.dt_pgto || null, valor_pago: data.valor_pago || conta.valor_pago }
            : conta
        )
      );

      return result;
    } catch (error: any) {
      console.error('❌ Erro ao marcar conta como paga:', error);
      setErro(error.message || 'Erro ao marcar conta como paga');
      throw error;
    }
  };

  const editarConta = async (id: number, data: EditarContaData) => {
    setErro(null);

    try {
      const response = await fetch(`/api/contas-pagar/${id}/editar`, {
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
      setContasPagar(prev =>
        prev.map(conta =>
          conta.id === id
            ? { ...conta, ...data }
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

  const cancelarConta = async (id: number, motivo?: string) => {
    setErro(null);

    try {
      const response = await fetch(`/api/contas-pagar/${id}/cancelar`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ motivo_cancelamento: motivo }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.erro || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();

      // Atualizar a conta na lista local
      setContasPagar(prev =>
        prev.map(conta =>
          conta.id === id
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

  return {
    contasPagar,
    paginacao,
    carregando,
    erro,
    consultarContasPagar,
    marcarComoPago,
    editarConta,
    cancelarConta
  };
}
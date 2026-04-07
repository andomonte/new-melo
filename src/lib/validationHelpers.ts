// src/lib/validationHelpers.ts

/**
 * Helpers para validação de estados e transições de pedidos
 * Implementa as regras de negócio de separação e conferência
 */

export interface StatusInfo {
  codigo: string;
  descricao: string;
  proximoStatus?: string;
  acaoDisponivel?: string;
}

export const STATUS_PEDIDO: Record<string, StatusInfo> = {
  '1': {
    codigo: '1',
    descricao: 'Aguardando Separação',
    proximoStatus: '2',
    acaoDisponivel: 'Iniciar Separação',
  },
  '2': {
    codigo: '2',
    descricao: 'Em Separação',
    proximoStatus: '3',
    acaoDisponivel: 'Finalizar Separação',
  },
  '3': {
    codigo: '3',
    descricao: 'Separado',
    proximoStatus: '4',
    acaoDisponivel: 'Iniciar Conferência',
  },
  '4': {
    codigo: '4',
    descricao: 'Em Conferência',
    proximoStatus: '5',
    acaoDisponivel: 'Finalizar Conferência',
  },
  '5': {
    codigo: '5',
    descricao: 'Conferido',
    proximoStatus: 'F',
    acaoDisponivel: 'Faturar',
  },
  F: {
    codigo: 'F',
    descricao: 'Faturado',
    acaoDisponivel: 'Finalizado',
  },
};

export interface ValidationResult {
  valido: boolean;
  erro?: string;
  statusAtual?: StatusInfo;
  acao?: string;
}

/**
 * Valida se um pedido pode ser iniciado para separação
 */
export function validarInicioSeparacao(statuspedido: string): ValidationResult {
  const statusAtual = STATUS_PEDIDO[statuspedido];

  if (!statusAtual) {
    return {
      valido: false,
      erro: `Status '${statuspedido}' não reconhecido`,
    };
  }

  if (statuspedido !== '1') {
    let acao = '';
    switch (statuspedido) {
      case '2':
        acao = 'Esta venda já está em separação';
        break;
      case '3':
        acao = 'Esta venda já foi separada';
        break;
      case '4':
        acao = 'Esta venda está em conferência';
        break;
      case '5':
        acao = 'Esta venda já foi conferida';
        break;
      case 'F':
        acao = 'Esta venda já foi faturada';
        break;
      default:
        acao = 'Não é possível iniciar separação';
    }

    return {
      valido: false,
      erro: `${acao}. Status atual: ${statusAtual.descricao}`,
      statusAtual,
      acao,
    };
  }

  return { valido: true };
}

/**
 * Valida se um pedido pode ser finalizado na separação
 */
export function validarFimSeparacao(statuspedido: string): ValidationResult {
  const statusAtual = STATUS_PEDIDO[statuspedido];

  if (!statusAtual) {
    return {
      valido: false,
      erro: `Status '${statuspedido}' não reconhecido`,
    };
  }

  if (statuspedido !== '2') {
    let acao = '';
    switch (statuspedido) {
      case '1':
        acao = 'Inicie a separação primeiro';
        break;
      case '3':
        acao = 'Esta venda já foi separada';
        break;
      case '4':
        acao = 'Esta venda está sendo conferida';
        break;
      case '5':
        acao = 'Esta venda já foi conferida e finalizada';
        break;
      case 'F':
        acao = 'Esta venda já foi faturada';
        break;
      default:
        acao = 'Não é possível finalizar a separação';
    }

    return {
      valido: false,
      erro: `${acao}. Status atual: ${statusAtual.descricao}`,
      statusAtual,
      acao,
    };
  }

  return { valido: true };
}

/**
 * Valida se um pedido pode ser iniciado para conferência
 */
export function validarInicioConferencia(
  statuspedido: string,
): ValidationResult {
  const statusAtual = STATUS_PEDIDO[statuspedido];

  if (!statusAtual) {
    return {
      valido: false,
      erro: `Status '${statuspedido}' não reconhecido`,
    };
  }

  if (statuspedido !== '3') {
    let acao = '';
    switch (statuspedido) {
      case '1':
        acao = 'Esta venda ainda não foi separada';
        break;
      case '2':
        acao = 'Esta venda ainda está sendo separada';
        break;
      case '4':
        acao = 'Esta venda já está sendo conferida';
        break;
      case '5':
        acao = 'Esta venda já foi conferida e finalizada';
        break;
      case 'F':
        acao = 'Esta venda já foi faturada';
        break;
      default:
        acao = 'Não é possível iniciar conferência';
    }

    return {
      valido: false,
      erro: `${acao}. Status atual: ${statusAtual.descricao}`,
      statusAtual,
      acao,
    };
  }

  return { valido: true };
}

/**
 * Valida se um pedido pode ser finalizado na conferência
 */
export function validarFimConferencia(statuspedido: string): ValidationResult {
  const statusAtual = STATUS_PEDIDO[statuspedido];

  if (!statusAtual) {
    return {
      valido: false,
      erro: `Status '${statuspedido}' não reconhecido`,
    };
  }

  if (statuspedido !== '4') {
    let acao = '';
    switch (statuspedido) {
      case '1':
        acao = 'Esta venda ainda não foi separada';
        break;
      case '2':
        acao = 'Esta venda ainda está sendo separada';
        break;
      case '3':
        acao = 'Esta venda precisa ter a conferência iniciada primeiro';
        break;
      case '5':
        acao = 'Esta venda já foi conferida e finalizada';
        break;
      case 'F':
        acao = 'Esta venda já foi faturada';
        break;
      default:
        acao = 'Não é possível finalizar conferência';
    }

    return {
      valido: false,
      erro: `${acao}. Status atual: ${statusAtual.descricao}`,
      statusAtual,
      acao,
    };
  }

  return { valido: true };
}

/**
 * Valida se um funcionário pode assumir uma separação/conferência
 */
export function validarPermissaoFuncionario(
  funcionarioAtual: string | null,
  funcionarioSolicitante: string,
  tipoOperacao: 'separacao' | 'conferencia',
): ValidationResult {
  // Se não há funcionário definido, qualquer um pode assumir
  if (!funcionarioAtual || funcionarioAtual.trim() === '') {
    return { valido: true };
  }

  // Se é o mesmo funcionário, ok
  if (funcionarioAtual === funcionarioSolicitante) {
    return { valido: true };
  }

  // Funcionário diferente não pode assumir
  const tipoTexto = tipoOperacao === 'separacao' ? 'separação' : 'conferência';
  return {
    valido: false,
    erro: `Apenas o funcionário que iniciou a ${tipoTexto} pode finalizá-la`,
    acao: `Esta ${tipoTexto} pertence a outro funcionário`,
  };
}

/**
 * Valida entrada de dados básicos
 */
export function validarDadosEntrada(dados: {
  codVenda?: string;
  matricula?: string;
  nome?: string;
}): ValidationResult {
  if (
    !dados.codVenda ||
    typeof dados.codVenda !== 'string' ||
    dados.codVenda.trim() === ''
  ) {
    return {
      valido: false,
      erro: 'Código da venda é obrigatório e deve ser uma string válida',
    };
  }

  if (
    !dados.matricula ||
    typeof dados.matricula !== 'string' ||
    dados.matricula.trim() === ''
  ) {
    return {
      valido: false,
      erro: 'Matrícula é obrigatória e deve ser uma string válida',
    };
  }

  if (
    !dados.nome ||
    typeof dados.nome !== 'string' ||
    dados.nome.trim() === ''
  ) {
    return {
      valido: false,
      erro: 'Nome é obrigatório e deve ser uma string válida',
    };
  }

  return { valido: true };
}

/**
 * Formata uma resposta de erro padronizada
 */
export function formatarErroValidacao(
  validation: ValidationResult,
  statusAtual?: string,
): {
  error: string;
  currentStatus?: string;
  statusDescricao?: string;
  acao?: string;
} {
  return {
    error: validation.erro || 'Erro de validação',
    currentStatus: statusAtual,
    statusDescricao: validation.statusAtual?.descricao,
    acao: validation.acao,
  };
}

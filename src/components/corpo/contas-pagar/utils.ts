export const formatarMoeda = (valor: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
};

export const formatarData = (data: string | null | undefined): string => {
  if (!data) return '-';
  try {
    const [ano, mes, dia] = data.split('T')[0].split('-');
    return `${dia}/${mes}/${ano}`;
  } catch {
    return '-';
  }
};

export const formatarDataHora = (data: string | null | undefined): string => {
  if (!data) return '-';
  try {
    const dataObj = new Date(data);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(dataObj);
  } catch {
    return '-';
  }
};

export const calcularDiasAtraso = (dataVencimento: string | null | undefined): number => {
  if (!dataVencimento) return 0;
  
  try {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const vencimento = new Date(dataVencimento);
    vencimento.setHours(0, 0, 0, 0);
    
    const diff = hoje.getTime() - vencimento.getTime();
    const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    return dias > 0 ? dias : 0;
  } catch {
    return 0;
  }
};

export const obterCorStatus = (status: string): string => {
  switch (status) {
    case 'pago':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case 'pendente':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    case 'pago_parcial':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'cancelado':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  }
};

export const obterTextoStatus = (status: string): string => {
  switch (status) {
    case 'pago':
      return 'Pago';
    case 'pendente':
      return 'Pendente';
    case 'pago_parcial':
      return 'Pago Parcial';
    case 'cancelado':
      return 'Cancelado';
    default:
      return status;
  }
};

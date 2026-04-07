export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('pt-BR');
};

export const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleString('pt-BR');
};

export const getNFeStatusLabel = (status: string): string => {
  const statusMap: Record<string, string> = {
    'RECEBIDA': 'Recebida',
    'PROCESSADA': 'Processada',
    'ERRO': 'Erro'
  };
  return statusMap[status] || status;
};

export const getNFeStatusColor = (status: string): string => {
  const colorMap: Record<string, string> = {
    'RECEBIDA': 'text-blue-600 bg-blue-50',
    'PROCESSADA': 'text-green-600 bg-green-50',
    'ERRO': 'text-red-600 bg-red-50'
  };
  return colorMap[status] || 'text-gray-600 bg-gray-50';
};

export const formatCNPJ = (cnpj: string): string => {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

export const formatChaveNFe = (chave: string): string => {
  if (chave.length <= 10) return chave;
  return `${chave.substring(0, 10)}...`;
};

export const isNFeProcessable = (status: string): boolean => {
  return status === 'RECEBIDA';
};

export const validateXmlFile = (file: File): { valid: boolean; error?: string } => {
  // Validação básica do arquivo XML
  if (!file.name.toLowerCase().endsWith('.xml')) {
    return { valid: false, error: 'Arquivo deve ter extensão .xml' };
  }

  if (file.size > 5 * 1024 * 1024) { // 5MB
    return { valid: false, error: 'Arquivo deve ter no máximo 5MB' };
  }

  return { valid: true };
};

export const getFileIcon = (fileName: string): string => {
  if (fileName.toLowerCase().endsWith('.xml')) {
    return '📄';
  }
  return '📁';
};
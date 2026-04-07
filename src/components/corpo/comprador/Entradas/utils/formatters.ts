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

export const getStatusLabel = (status: string): string => {
  const statusMap: Record<string, string> = {
    'P': 'Pendente',
    'C': 'Confirmada',
    'F': 'Finalizada'
  };
  return statusMap[status] || status;
};

export const getStatusColor = (status: string): string => {
  const colorMap: Record<string, string> = {
    'P': 'text-yellow-600 bg-yellow-50',
    'C': 'text-green-600 bg-green-50',
    'F': 'text-blue-600 bg-blue-50'
  };
  return colorMap[status] || 'text-gray-600 bg-gray-50';
};

export const getTipoEntradaLabel = (tipo: string): string => {
  const tipoMap: Record<string, string> = {
    'MANUAL': 'Manual',
    'XML': 'XML/NFe'
  };
  return tipoMap[tipo] || tipo;
};

export const formatNFNumber = (numero: string, serie: string): string => {
  return `${numero}/${serie}`;
};

export const formatCNPJ = (cnpj: string): string => {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};
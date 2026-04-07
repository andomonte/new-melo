import type { SelectOption, TipoRequisicao, Filial, Comprador, Fornecedor } from '../types';

// Conversores para options de select
export const tiposToOptions = (tipos: TipoRequisicao[]): SelectOption[] =>
  tipos.map(t => ({
    value: t.ret_id,
    label: t.ret_descricao
  }));

export const filiaisToOptions = (filiais: Filial[]): SelectOption[] =>
  filiais.map(f => ({
    value: f.unm_id,
    label: f.unm_nome
  }));

export const compradoresOptions = (compradores: Comprador[]): SelectOption[] =>
  compradores.map(c => ({
    value: c.codcomprador,
    label: c.nome
  }));

export const fornecedoresOptions = (fornecedores: Fornecedor[]): SelectOption[] =>
  fornecedores.map(f => ({
    value: f.cod_credor,
    label: `${f.cod_credor} - ${f.nome}`
  }));

// Formatação de CNPJ
export const formatCNPJ = (cnpj: string): string => {
  if (!cnpj) return '';
  const numbers = cnpj.replace(/\D/g, '');
  return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

// Formatação de data
export const formatDateToBR = (date: string | Date): string => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR');
};

// Busca de fornecedor por diferentes critérios
export const searchSuppliers = (suppliers: Fornecedor[], term: string): Fornecedor[] => {
  if (!term || term.length < 2) return [];
  
  const searchTerm = term.toLowerCase().trim();
  
  return suppliers.filter(supplier => 
    supplier.cod_credor.toLowerCase().includes(searchTerm) ||
    supplier.nome.toLowerCase().includes(searchTerm) ||
    supplier.nome_fant?.toLowerCase().includes(searchTerm) ||
    supplier.cpf_cgc?.replace(/\D/g, '').includes(searchTerm.replace(/\D/g, ''))
  );
};

// Destaque do termo buscado
export const highlightSearchTerm = (text: string, term: string): string => {
  if (!term) return text;
  
  const regex = new RegExp(`(${term})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
};
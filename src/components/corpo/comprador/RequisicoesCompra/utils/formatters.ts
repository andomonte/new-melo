import type { SelectOption, TipoRequisicao, Filial, Comprador, Fornecedor } from '../types';
import { mascaraCnpjAlfa, limparDocumentoAlfa } from '@/utils/cnpjAlfanumerico';

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
  return mascaraCnpjAlfa(cnpj); // CNPJ alfanumérico (mantém letras)
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
    (!!supplier.cpf_cgc && limparDocumentoAlfa(supplier.cpf_cgc).includes(limparDocumentoAlfa(term)))
  );
};

// Destaque do termo buscado
export const highlightSearchTerm = (text: string, term: string): string => {
  if (!term) return text;
  
  const regex = new RegExp(`(${term})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
};
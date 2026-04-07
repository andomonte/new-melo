// Interface do Pai (O Banco em si)
export interface IBanco {
  id: number;
  codigo_febraban: string; // Ex: "237"
  nome: string;            // Ex: "BRADESCO"
  // Opcional: Lista de contas já carregada
  contas?: IContaBancaria[]; 
}

// Interface do Filho (As configurações que você viu na tela legada)
export interface IContaBancaria {
  id?: number;          // Opcional na criação
  banco_id: number;     // Link com o Pai
  
  // Dados Básicos
  agencia: string;
  conta: string;
  digito_conta?: string; 
  
  // Regras de Negócio Legadas
  carteira: string;     // Limitar a 3 chars no Zod/Yup
  variacao?: string;
  convenio?: string;    // Código do Cedente
  
  // Enums e Relacionamentos
  tipo: 'NF' | 'FAG';   // O dropdown fixo
  filial_id: number;    // O ID selecionado no dropdown "Melo"
}

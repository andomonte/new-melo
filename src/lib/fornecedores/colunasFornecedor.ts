// src/lib/fornecedores/colunasFornecedor.ts
//
// O formulário de fornecedor manda num objeto só os dados do fornecedor (tabela
// dbcredor) e as regras de faturamento (tabela cad_credor_regra_faturamento).
// Cadastrar e editar precisam separar os dois: gravar uma regra em dbcredor dá
// "coluna não existe" (erro 42703) — era o "Erro interno do servidor ao cadastrar
// fornecedor" de quem marcava algo na aba Regras Faturamento.

/** Colunas da tabela dbcredor que o formulário pode gravar. */
export const COLUNAS_DBCREDOR = [
  'nome',
  'nome_fant',
  'cpf_cgc',
  'tipo',
  'data_cad',
  'endereco',
  'bairro',
  'cidade',
  'uf',
  'isuframa',
  'iest',
  'imun',
  'cc',
  'n_agencia',
  'banco',
  'cod_ident',
  'contatos',
  'tipoemp',
  'cep',
  'codcf',
  'fabricante',
  'regime_tributacao',
  'codbairro',
  'codmunicipio',
  'numero',
  'referencia',
  'codpais',
  'complemento',
  'tipofornecedor',
  'codunico',
  'codccontabil',
] as const;

/** Colunas da tabela cad_credor_regra_faturamento (chave: crf_id = cod_credor). */
export const COLUNAS_REGRA_FATURAMENTO = [
  'desc_icms_sufra',
  'desc_icms_sufra_piscofins',
  'piscofins_365',
  'piscofins_925',
  'piscofins_1150',
  'piscofins_1310',
  'desc_icms_sufra_st',
  'desc_piscofins_st',
  'acres_piscofins_st',
  'desc_icms_sufra_importado',
  'cobrar_ipi_importado',
  'frete',
  'basereduzida_st',
  'basereduzida_icms',
  'desc_icms_sufra_base',
  'desc_icms_sufra_importado_base',
] as const;

/**
 * Separa o que veio do formulário em dados do fornecedor e regras de faturamento.
 * O que não for de nenhuma das duas tabelas é ignorado (e listado em `ignorados`).
 */
export function separarDadosFornecedor(dados: Record<string, any>) {
  const fornecedor: Record<string, any> = {};
  const regra: Record<string, any> = {};
  const ignorados: string[] = [];
  for (const key of Object.keys(dados || {})) {
    if ((COLUNAS_DBCREDOR as readonly string[]).includes(key)) fornecedor[key] = dados[key];
    else if ((COLUNAS_REGRA_FATURAMENTO as readonly string[]).includes(key)) regra[key] = dados[key];
    else if (key !== 'cod_credor' && key !== 'crf_id') ignorados.push(key);
  }
  return { fornecedor, regra, ignorados };
}

/** Regra completa para gravar: crf_id + todas as colunas, nulas viram 0 (NOT NULL no banco). */
export function regraComPadrao(codCredor: string, regra: Record<string, any>) {
  const linha: Record<string, any> = { crf_id: codCredor };
  for (const col of COLUNAS_REGRA_FATURAMENTO) linha[col] = regra[col] ?? 0;
  return linha;
}

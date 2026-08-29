// src/lib/faturamento/bancoCobranca.ts
//
// Conversão do BANCO da cobrança, fiel ao Delphi/Oracle.
//
// O dropdown de banco do faturamento lê a tabela `dbbanco_cobranca` (colunas
// banco+nome apenas): 1=Bradesco, 2=BB, 3=Itaú, 4=Rural, 5=MELO, 6=Santander,
// 7=Safra, 8=Citibank, 9=Caixa. ESSE código é só a posição na lista — NÃO é o
// que se grava no título.
//
// O Delphi (PRETCOBRANCA.INFORMACAO_FINANCEIRA) converte o NOME do banco para o
// código INTERNO do Oracle antes de gravar:
//   - dbreceb.banco  (1 dígito): Bradesco=0, BB=1, Itaú=2, Rural=3, Santander=5,
//     Safra=6, Citibank=7, Caixa=8, MELO=9
//   - dbfatura.cod_banco (4 díg.): Bradesco=0060, BB=0066, Itaú=0067, Rural=0071,
//     MELO=0062, Santander=0081, Safra=0075, Citibank=0077, Caixa=0078
//
// O web gravava o código do dropdown direto (MELO=5 → '0005'), mas nesse esquema
// '5' é Santander. Este módulo faz a conversão certa. Fonte única.

interface BancoInfo {
  /** código interno do Oracle gravado em dbreceb.banco (1 dígito) */
  interno: string;
  /** código de 4 dígitos gravado em dbfatura.cod_banco */
  codBanco: string;
  nome: string;
}

// Chave = código do dropdown (dbbanco_cobranca.banco).
const MAPA_BANCO: Record<string, BancoInfo> = {
  '1': { interno: '0', codBanco: '0060', nome: 'BRADESCO' },
  '2': { interno: '1', codBanco: '0066', nome: 'BANCO DO BRASIL' },
  '3': { interno: '2', codBanco: '0067', nome: 'ITAU' },
  '4': { interno: '3', codBanco: '0071', nome: 'RURAL' },
  '5': { interno: '9', codBanco: '0062', nome: 'MELO' },
  '6': { interno: '5', codBanco: '0081', nome: 'SANTANDER' },
  '7': { interno: '6', codBanco: '0075', nome: 'SAFRA' },
  '8': { interno: '7', codBanco: '0077', nome: 'CITIBANK' },
  '9': { interno: '8', codBanco: '0078', nome: 'CAIXA ECONOMICA' },
};

/** Normaliza a entrada (código do dropdown, aceita '5' ou '0005') para 1 dígito. */
function normalizarDropdown(entrada: string | number | null | undefined): string | null {
  if (entrada === null || entrada === undefined || String(entrada).trim() === '') return null;
  const n = parseInt(String(entrada), 10);
  if (isNaN(n) || n < 1 || n > 9) return null;
  return String(n);
}

/** Código interno do Oracle para gravar em dbreceb.banco (ex.: MELO(5) → '9'). */
export function bancoInternoDbreceb(codDropdown: string | number | null | undefined): string | null {
  const k = normalizarDropdown(codDropdown);
  return k ? MAPA_BANCO[k].interno : null;
}

/** Código de 4 dígitos para gravar em dbfatura.cod_banco (ex.: MELO(5) → '0062'). */
export function codBancoDbfatura(codDropdown: string | number | null | undefined): string | null {
  const k = normalizarDropdown(codDropdown);
  return k ? MAPA_BANCO[k].codBanco : null;
}

/**
 * Reverso: código INTERNO do dbreceb.banco → código do dropdown (dbbanco_cobranca).
 * Usado ao RECRIAR a cobrança de um GP (alterar prazo / remover fatura), quando só temos
 * o interno gravado nos títulos e precisamos alimentar o inserirCobrancaGP (que espera o
 * dropdown). Ex.: interno '9' (MELO) → '5'.
 */
export function dropdownDeBancoInterno(interno: string | number | null | undefined): string | null {
  if (interno === null || interno === undefined || String(interno).trim() === '') return null;
  const alvo = String(interno).trim();
  const entrada = Object.entries(MAPA_BANCO).find(([, v]) => v.interno === alvo);
  return entrada ? entrada[0] : null;
}

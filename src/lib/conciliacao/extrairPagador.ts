/**
 * Extração do pagador a partir do histórico do extrato (spec de conciliação).
 * Retorna documento (CPF/CNPJ só dígitos, validado por DV) e nome normalizado quando houver.
 * Puro/testável — sem banco.
 */

export interface Pagador {
  documento: string | null;      // só dígitos, validado (11=CPF, 14=CNPJ)
  docTipo: 'cpf' | 'cnpj' | null;
  nome: string | null;           // normalizado (maiúsculas, sem acento, sem LTDA/ME/EIRELI/SA)
  nomeBruto: string | null;      // como veio no histórico
}

/** Remove acentos. */
function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Normaliza nome: maiúsculas, sem acento, sem sufixos societários e ruído. */
export function normalizarNome(nome: string): string {
  let n = semAcento(String(nome || '')).toUpperCase();
  n = n.replace(/[^A-Z0-9 &.-]/g, ' ');
  // remove sufixos/qualificadores societários
  n = n.replace(/\b(LTDA|ME|EIRELI|EPP|S\.?A\.?|S\/A|CIA|COMPANHIA|IMP|EXP|COM|COMERCIO|INDUSTRIA|DISTRIBUIDORA)\b/g, ' ');
  n = n.replace(/\s+/g, ' ').trim();
  return n;
}

/** Valida CPF (11 dígitos) por DV. */
export function cpfValido(cpf: string): boolean {
  const c = cpf.replace(/\D/g, '');
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (base: string, pesoIni: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += parseInt(base[i], 10) * (pesoIni - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(c.slice(0, 9), 10) === +c[9] && dv(c.slice(0, 10), 11) === +c[10];
}

/** Valida CNPJ (14 dígitos) por DV. */
export function cnpjValido(cnpj: string): boolean {
  const c = cnpj.replace(/\D/g, '');
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += parseInt(base[i], 10) * pesos[i];
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(c.slice(0, 12)) === +c[12] && calc(c.slice(0, 13)) === +c[13];
}

export function extrairPagador(historico: string, documento?: string): Pagador {
  const h = String(historico || '');
  const result: Pagador = { documento: null, docTipo: null, nome: null, nomeBruto: null };

  // 1) Documento: procura sequências de 14 (CNPJ) ou 11 (CPF) dígitos, validando o DV.
  const candidatos = ((h.match(/\d{11,14}/g) as string[] | null) || []).concat(documento ? [String(documento)] : []);
  for (const cand of candidatos) {
    const d = cand.replace(/\D/g, '');
    if (d.length === 14 && cnpjValido(d)) { result.documento = d; result.docTipo = 'cnpj'; break; }
    if (d.length === 11 && cpfValido(d)) { result.documento = d; result.docTipo = 'cpf'; break; }
  }

  // 2) Nome: aparece em "PIX ENVIADO <NOME>", "TED ... <NOME>", "PIX RECEBIDO DE <NOME>".
  //    (PIX recebido em geral traz só o documento; o nome é opcional.)
  let nomeBruto: string | null = null;
  let m =
    h.match(/PIX\s+(?:RECEBIDO|ENVIADO)\s+(?:DE\s+)?([A-Za-zÀ-ú][A-Za-zÀ-ú .&'-]{3,})/i) ||
    h.match(/\b(?:TED|DOC)\b\s+\d*\s*([A-Za-zÀ-ú][A-Za-zÀ-ú .&'-]{3,})/i);
  if (m && m[1] && !/^\d/.test(m[1].trim())) nomeBruto = m[1].trim();

  if (nomeBruto) {
    result.nomeBruto = nomeBruto;
    const norm = normalizarNome(nomeBruto);
    result.nome = norm.length >= 3 ? norm : null;
  }

  return result;
}

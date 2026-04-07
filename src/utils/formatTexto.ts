/**
 * Utilitário para formatação de texto em remessa, replicando lógica Delphi
 * Baseado em UniRemessaEquifax.pas
 */

/**
 * Remove sinais de pontuação e caracteres especiais de string numérica
 */
function tiraSinais(str: string): string {
  return str.replace(/[^\d]/g, '');
}

/**
 * Remove espaços em branco do início e fim
 */
function allTrim(str: string): string {
  return str.trim();
}

/**
 * Formata texto para remessa conforme tipo
 * @param str - String original
 * @param tamanho - Tamanho desejado do campo
 * @param tipo - Tipo de formatação: 'N' (numérico), 'X'/'A' (alfanumérico), 'D' (data)
 */
export function formatTexto(str: string, tamanho: number, tipo: string): string {
  let tam = 0;
  let aux = '';

  // Tipo sinais de campo tipo N, se existir
  if (tipo === 'N') {
    str = tiraSinais(str);
  }

  if (tipo === 'N' || tipo === 'X' || tipo === 'D') {
    aux = allTrim(str);
    tam = aux.length;
  }

  // Tipo válido para campos que a existência de espaços é necessária
  // Exemplo: MELO DISTRUIDORA DE PECAS LTDA
  if (tipo === 'A') {
    aux = str.trimStart().trimEnd();
    tam = aux.length;
  }

  str = '';

  // Tipo Numérico
  if (tipo === 'N') {
    for (let i = 0; i < tamanho - tam; i++) {
      str += '0';
    }
    return str + aux;
  }

  // Tipo Alfanumérico
  if (tipo === 'X' || tipo === 'A') {
    for (let i = 0; i < tamanho - tam; i++) {
      str += ' ';
    }
    return aux + str;
  }

  // Tipo Data
  if (tipo === 'D') {
    // Assume formato DD/MM/YYYY
    const dia = aux.substring(0, 2);
    const mes = aux.substring(3, 5);
    const ano = aux.substring(6, 10);
    return dia + mes + ano;
  }

  return aux;
}

/**
 * Formata data para DDMMYYYY
 */
export function formatDateDDMMYYYY(date: Date): string {
  const dia = date.getDate().toString().padStart(2, '0');
  const mes = (date.getMonth() + 1).toString().padStart(2, '0');
  const ano = date.getFullYear().toString();
  return dia + mes + ano;
}

/**
 * Remove caracteres não numéricos
 */
export function notChar(str: string): string {
  return str.replace(/\D/g, '');
}
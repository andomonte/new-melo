/**
 * Helpers compartilhados para associação de itens de importação a produtos internos
 * Extraídos de auto-associar.ts para reuso em associar-e-vincular.ts
 */

// Stopwords para filtro de similaridade
export const STOPWORDS_SIMILARIDADE = ['PARA', 'COM', 'SEM', 'MARCA', 'MOTOCICLETA', 'MOTOR', 'MOTORES'];
export const STOPWORDS_GERAL = ['DE', 'DA', 'DO', 'COM', 'SEM', 'PARA', 'POR', 'EM', 'NA', 'NO', 'AS', 'OS', 'UM', 'UMA'];

export const THRESHOLD_SIMILARIDADE = 40;

/**
 * Extrai a marca da descrição XML
 * Padrões: "MARCA BHD REF.", "MARCA MBC PARTS REF.", "MARCA DEMAG PN#", "Marca MBC Parts Modelo ..."
 */
export function extrairMarca(descricao: string): string | null {
  const match = descricao.match(/MARCA\s+([A-Z][A-Z0-9\s]*?)(?:\s+(?:REF|PN#|MOD|MODELO|REGISTRO|PARA)\b)/i);
  if (match) {
    return match[1].trim().toUpperCase();
  }
  return null;
}

/**
 * Extrai referências do texto da descrição
 * Padrões: REF.700286, REF:700286, REF 700286, REF.BHD-700286, PN# 94740549912, MOD. ALPHA
 */
export function extrairRefs(descricao: string): string[] {
  const refs: string[] = [];

  // Padrão principal: REF.XXXXXX ou REF:XXXXXX ou REF XXXXXX
  const refMatch = descricao.match(/REF[.:\s-]*([A-Z0-9][\w\-]*\d[\w\-]*)/gi);
  if (refMatch) {
    for (const m of refMatch) {
      const ref = m.replace(/^REF[.:\s-]*/i, '').trim();
      if (ref.length >= 3) refs.push(ref);
    }
  }

  // Padrão PN#: captura part numbers (DEMAG, TERBERG)
  const pnMatch = descricao.match(/PN#\s*([A-Z0-9\-]+)/gi);
  if (pnMatch) {
    for (const m of pnMatch) {
      const ref = m.replace(/^PN#\s*/i, '').trim();
      if (ref.length >= 3 && !refs.includes(ref)) refs.push(ref);
    }
  }

  // Padrão MOD/MODELO: captura modelo (MAXLANDER)
  const modMatch = descricao.match(/MOD(?:ELO)?\.?\s+(\S+)/gi);
  if (modMatch) {
    for (const m of modMatch) {
      const ref = m.replace(/^MOD(?:ELO)?\.?\s+/i, '').trim();
      if (ref.length >= 3 && !refs.includes(ref)) refs.push(ref);
    }
  }

  // Padrão secundário: código numérico de 6+ dígitos no final (ex: "MARCA BHD 700286")
  const numMatch = descricao.match(/\b(\d{6,})\b/g);
  if (numMatch) {
    for (const n of numMatch) {
      if (!refs.includes(n)) refs.push(n);
    }
  }

  return refs;
}

/**
 * Calcula similaridade entre duas descrições (0-100)
 */
export function calcularSimilaridade(descricao1: string, descricao2: string): number {
  if (!descricao1 || !descricao2) return 0;

  const normalizar = (str: string) => {
    return str
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const texto1 = normalizar(descricao1);
  const texto2 = normalizar(descricao2);

  const extrairPalavras = (texto: string) => {
    return texto.split(' ')
      .filter(p => p.length >= 2)
      .filter(p => !/^\d{1,2}$/.test(p))
      .filter(p => !STOPWORDS_GERAL.includes(p));
  };

  const palavras1 = extrairPalavras(texto1);
  const palavras2 = extrairPalavras(texto2);

  if (palavras1.length === 0 || palavras2.length === 0) return 0;

  let matches = 0;
  let matchesParciais = 0;

  for (const p1 of palavras1) {
    for (const p2 of palavras2) {
      if (p1 === p2) {
        matches++;
        break;
      } else if (p1.includes(p2) || p2.includes(p1)) {
        matchesParciais += 0.5;
        break;
      }
    }
  }

  const totalMatches = matches + matchesParciais;
  const menorArray = Math.min(palavras1.length, palavras2.length);
  const score = (totalMatches / menorArray) * 100;

  return Math.min(100, Math.round(score));
}

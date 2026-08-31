import crypto from 'crypto';

/**
 * Parser do extrato bancário (CSV Santander e similares).
 *
 * Regras (spec de conciliação):
 *  - Valores SEMPRE em centavos (inteiro com sinal) — nunca float. Débito = negativo.
 *  - Formato numérico BR: "1.234,56" (ponto = milhar, vírgula = decimal); "-34,10".
 *  - Datas dd/mm/aaaa → 'YYYY-MM-DD'.
 *  - Idempotência: hash do arquivo inteiro + hash de cada linha.
 *
 * Recebe o TEXTO já decodificado (o chamador detecta ISO-8859-1/UTF-8).
 */

export interface LinhaExtrato {
  idx: number;            // ordem no arquivo (1-based)
  data: string;           // 'YYYY-MM-DD'
  historico: string;
  documento: string;
  valorCentavos: number;  // inteiro, com sinal (negativo = débito/saída)
  saldoCentavos: number | null;
  hashLinha: string;      // hash da linha original (idempotência por linha)
  raw: string;            // linha original
}

export interface ExtratoParsed {
  agencia: string | null;
  conta: string | null;
  hashArquivo: string;
  linhas: LinhaExtrato[];
  ignoradas: number;      // linhas não-dado (cabeçalho/rodapé/vazias)
}

/** Converte valor BR ("1.234,56", "-34,10", "1,00") em centavos (inteiro com sinal). */
export function brlParaCentavos(valor: string): number {
  const s = String(valor ?? '').trim().replace(/\s+/g, '');
  if (!s) return 0;
  const neg = s.startsWith('-') || /-/.test(s);
  const limpo = s.replace(/[^\d,.-]/g, '').replace(/-/g, '');
  // separa parte inteira (sem milhar) e decimal (após a ÚLTIMA vírgula)
  const virg = limpo.lastIndexOf(',');
  let inteiro = limpo;
  let dec = '00';
  if (virg >= 0) {
    inteiro = limpo.slice(0, virg);
    dec = (limpo.slice(virg + 1) + '00').slice(0, 2);
  }
  inteiro = inteiro.replace(/[.,]/g, ''); // remove milhares
  const cent = (parseInt(inteiro || '0', 10) * 100) + parseInt(dec || '0', 10);
  return neg ? -cent : cent;
}

/** dd/mm/aaaa → 'YYYY-MM-DD' (retorna '' se não reconhecer). */
export function dataBrParaIso(data: string): string {
  const m = String(data ?? '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Divide uma linha CSV respeitando aspas. Detecta ';' ou ',' como separador. */
function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === sep && !inQuotes) {
      out.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/** Detecta o separador dominante (';' ou ',') pela 1ª linha com muitos campos. */
function detectarSeparador(linhas: string[]): string {
  const cont = (sep: string) => linhas.slice(0, 10).reduce((m, l) => Math.max(m, splitCsvLine(l, sep).length), 0);
  return cont(';') >= cont(',') ? ';' : ',';
}

export function parseExtratoCsv(texto: string): ExtratoParsed {
  const hashArquivo = crypto.createHash('sha256').update(texto).digest('hex');
  const linhasBrutas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const sep = detectarSeparador(linhasBrutas);

  let agencia: string | null = null;
  let conta: string | null = null;
  const linhas: LinhaExtrato[] = [];
  let ignoradas = 0;
  let idx = 0;

  for (const raw of linhasBrutas) {
    const campos = splitCsvLine(raw, sep);
    const up = raw.toUpperCase();

    // Cabeçalho da conta (AGENCIA;"2305";CONTA;"130002826")
    if (up.includes('AGENCIA') && up.includes('CONTA')) {
      for (let i = 0; i < campos.length - 1; i++) {
        if (campos[i].toUpperCase() === 'AGENCIA') agencia = campos[i + 1] || agencia;
        if (campos[i].toUpperCase() === 'CONTA') conta = campos[i + 1] || conta;
      }
      ignoradas++;
      continue;
    }
    // Cabeçalho das colunas (Data;Histórico;...)
    if (up.startsWith('DATA') && (up.includes('HIST') || up.includes('VALOR'))) {
      ignoradas++;
      continue;
    }

    // Linha de dados: Data ; Histórico ; Documento ; Valor ; Saldo
    const dataIso = dataBrParaIso(campos[0] || '');
    if (!dataIso) { ignoradas++; continue; }

    idx++;
    linhas.push({
      idx,
      data: dataIso,
      historico: campos[1] || '',
      documento: campos[2] || '',
      valorCentavos: brlParaCentavos(campos[3] || '0'),
      saldoCentavos: campos[4] ? brlParaCentavos(campos[4]) : null,
      hashLinha: crypto.createHash('sha256').update(`${dataIso}|${campos[1]}|${campos[2]}|${campos[3]}`).digest('hex'),
      raw,
    });
  }

  return { agencia, conta, hashArquivo, linhas, ignoradas };
}

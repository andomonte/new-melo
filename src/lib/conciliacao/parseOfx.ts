import crypto from 'crypto';
import type { ExtratoParsed, LinhaExtrato } from './parseCsv';

/**
 * Parser de extrato bancário OFX (Open Financial Exchange) — Santander e Bradesco.
 *
 * OFX 1.x é SGML (tags de folha SEM fechamento): `<TRNAMT>-34.10` até o próximo `<`.
 * OFX 2.x é XML (com fechamento) — o mesmo regex funciona nos dois.
 * Estrutura padrão da transação:
 *   <STMTTRN><TRNTYPE>..<DTPOSTED>YYYYMMDD..<TRNAMT>-34.10<FITID>..<MEMO>..<NAME>..</STMTTRN>
 * Conta/agência: <BANKACCTFROM><BANKID>033<BRANCHID>2305<ACCTID>13000282-6</BANKACCTFROM>
 * Valores no OFX usam PONTO decimal (ex.: -34.10) — nada de vírgula/milhar BR.
 *
 * Devolve o MESMO formato do parseExtratoCsv (valores em centavos, com sinal).
 */

const BANCO_POR_ID: Record<string, string> = {
  '033': 'SANTANDER',
  '237': 'BRADESCO',
  '341': 'ITAU',
  '001': 'BANCO DO BRASIL',
  '104': 'CAIXA',
};

/** Lê o valor de uma tag de folha OFX (SGML/XML): `<TAG>valor` até o próximo `<` ou quebra de linha. */
function tag(bloco: string, nome: string): string {
  const m = bloco.match(new RegExp(`<${nome}>([^<\\r\\n]*)`, 'i'));
  return m ? m[1].trim() : '';
}

/** OFX DTPOSTED (YYYYMMDD[HHMMSS][.mmm][+/-tz]) → 'YYYY-MM-DD'. */
function dtOfxParaIso(v: string): string {
  const m = String(v || '').trim().match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

/** TRNAMT (ponto decimal, com sinal) → centavos inteiro. Ex.: "-34.10" → -3410. */
function ofxValorParaCentavos(v: string): number {
  const s = String(v || '').trim().replace(/\s+/g, '').replace(',', '.'); // tolera vírgula
  const f = parseFloat(s);
  return Number.isFinite(f) ? Math.round(f * 100) : 0;
}

/** Detecta se o texto é um arquivo OFX. */
export function ehOfx(texto: string): boolean {
  const up = texto.slice(0, 4000).toUpperCase();
  return up.includes('OFXHEADER') || up.includes('<OFX>') || up.includes('<STMTTRN>');
}

export function parseExtratoOfx(texto: string): ExtratoParsed {
  const hashArquivo = crypto.createHash('sha256').update(texto).digest('hex');

  // Conta / agência / banco
  const acct = (texto.match(/<BANKACCTFROM>([\s\S]*?)<\/BANKACCTFROM>/i) || texto.match(/<BANKACCTFROM>([\s\S]*?)<BANKTRANLIST>/i))?.[1] || texto;
  const bankId = tag(acct, 'BANKID');
  const agencia = tag(acct, 'BRANCHID') || null;
  const conta = tag(acct, 'ACCTID') || null;

  // Transações
  const blocos = texto.split(/<STMTTRN>/i).slice(1);
  const linhas: LinhaExtrato[] = [];
  let ignoradas = 0;
  let idx = 0;

  for (const bruto of blocos) {
    const bloco = bruto.split(/<\/STMTTRN>/i)[0];
    const dataIso = dtOfxParaIso(tag(bloco, 'DTPOSTED'));
    if (!dataIso) { ignoradas++; continue; }

    const memo = tag(bloco, 'MEMO');
    const nome = tag(bloco, 'NAME');
    const fitid = tag(bloco, 'FITID');
    const checknum = tag(bloco, 'CHECKNUM');
    const trnamt = tag(bloco, 'TRNAMT');
    // Histórico: junta MEMO + NAME (sem duplicar) — é onde o classificador procura Pix/pagador.
    const historico = [memo, nome && !memo.toUpperCase().includes(nome.toUpperCase()) ? nome : '']
      .filter((s) => s && s.trim())
      .join(' ')
      .trim();
    const documento = checknum || fitid || '';

    idx++;
    linhas.push({
      idx,
      data: dataIso,
      historico,
      documento,
      valorCentavos: ofxValorParaCentavos(trnamt),
      saldoCentavos: null, // OFX não traz saldo por transação (só LEDGERBAL do arquivo)
      hashLinha: crypto.createHash('sha256').update(`${dataIso}|${historico}|${documento}|${trnamt}`).digest('hex'),
      raw: bloco.replace(/\s+/g, ' ').trim().slice(0, 500),
    });
  }

  // Anexa o banco ao "conta" só como referência? Não — mantém a assinatura; o banco fica no lote.
  void BANCO_POR_ID[bankId];

  return { agencia, conta, hashArquivo, linhas, ignoradas };
}

/** Nome do banco a partir do BANKID do OFX (para o lote). '' se não reconhecer. */
export function bancoDoOfx(texto: string): string {
  const acct = (texto.match(/<BANKACCTFROM>([\s\S]*?)<\/BANKACCTFROM>/i) || texto.match(/<BANKACCTFROM>([\s\S]*?)<BANKTRANLIST>/i))?.[1] || texto;
  return BANCO_POR_ID[tag(acct, 'BANKID')] || '';
}

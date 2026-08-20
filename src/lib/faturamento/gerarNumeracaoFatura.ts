// src/lib/faturamento/gerarNumeracaoFatura.ts
//
// Espelha a numeração da NF do MELO Delphi/Oracle: procedure
// GERAL.FATURAMENTOS.FATURA_INCLUIR (chamada por GERAR_FATURA), linhas 1254-1277.
//
// Regra de SÉRIE (Oracle, 1254-1264) — só para Nota Fiscal (tipofat='1'):
//   • insc07='S' E 12º dígito do CNPJ da empresa = '1'  → série '2'  (Inscrição Estadual 07)
//   • tipoNf='C' (cupom / NFC-e mod 65)                 → série '3'
//   • senão (NF-e mod 55 normal)                        → série '1'
//   Não-NF (FAG etc.) → null.
//   Confirmado pelo dev MELO: 1 = mod 55, 3 = mod 65, 2 = quando muda a IE (Insc. 07).
//
// Regra do NÚMERO (Oracle, 1265-1277): MAX(NRO_FORMULARIO)+1 de DBFATURA (TODAS as
// faturas, autorizadas ou não), ESCOPADO por (insc07, tiponf, serie). O número é
// "queimado" na criação da fatura → o contador sempre avança e não precisa de retry
// de duplicidade (539). Aqui escopamos por (serie, insc07): a própria série já separa
// cupom (3) de NF-e (1/2), e o web trata NFC-e em endpoint próprio.

export function determinarSerieFatura(opts: {
  tipofat?: string | null; // '1' = Nota Fiscal
  insc07?: string | null; // 'S' | 'N'
  cgcEmpresa?: string | null; // CNPJ da empresa emitente
  tipoNf?: string | null; // 'C' = cupom (NFC-e mod 65)
}): string | null {
  const tipofat = String(opts.tipofat ?? '1');
  if (tipofat !== '1') return null; // FAG / sem NF
  const insc07 = String(opts.insc07 ?? 'N').toUpperCase();
  const cgc = String(opts.cgcEmpresa ?? '').replace(/\D/g, '');
  const tipoNf = String(opts.tipoNf ?? '').toUpperCase();
  if (insc07 === 'S' && cgc.charAt(11) === '1') return '2';
  if (tipoNf === 'C') return '3';
  return '1';
}

// Próximo NRO_FORMULARIO = 1 + o MAIOR entre:
//   (a) MAX(nroform) em dbfatura escopado por (serie, insc07), e
//   (b) MAX(nNF) das NF-e já USADAS na SEFAZ NAQUELA SÉRIE (lido da chave), opcionalmente
//       escopado pelo CNPJ emitente.
// O (b) fecha a FRAGMENTAÇÃO: notas antigas emitidas via override (dbfatura.serie='2'
// mas chave série='1') não entram no (a), então sem o (b) o contador da série 1 ficaria
// atrás do que a SEFAZ já autorizou → risco de 539. O CHAMADOR deve segurar o LOCK em
// dbfatura na MESMA transação (atômico, como o FATURA_INCLUIR do Oracle).
export async function proximoNroForm(
  client: { query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> },
  opts: { serie: string; insc07?: string | null; cgc?: string | null; schema?: string },
): Promise<string> {
  const schema = opts.schema ?? 'db_manaus';
  const insc07 = String(opts.insc07 ?? 'N').toUpperCase();
  const serieChave = String(opts.serie).replace(/\D/g, '').padStart(3, '0'); // série na chave = 3 díg
  const cgc = opts.cgc ? String(opts.cgc).replace(/\D/g, '') : null;
  const r = await client.query(
    `SELECT GREATEST(
       COALESCE((SELECT MAX(CAST(nroform AS INTEGER))
                   FROM ${schema}.dbfatura
                  WHERE nroform ~ '^[0-9]+$' AND serie = $1 AND COALESCE(insc07,'N') = $2), 0),
       COALESCE((SELECT MAX(CAST(substring(chave,26,9) AS INTEGER))
                   FROM ${schema}.dbfat_nfe
                  WHERE length(chave) = 44
                    AND substring(chave,23,3) = $3
                    AND ($4::text IS NULL OR substring(chave,7,14) = $4)
                    AND status IN ('100','150','301','302','303')), 0)
     ) + 1 AS n`,
    [opts.serie, insc07, serieChave, cgc],
  );
  return String(r.rows[0].n).padStart(9, '0');
}

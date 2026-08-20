// src/lib/faturamento/fiscalPorArmazem.ts
//
// Resolve a identidade fiscal do EMITENTE a partir do ARMAZÉM da venda — o modelo do
// web (confirmado): produto → armazém → IE → CNPJ. Uma venda sai por UM armazém, logo
// por UMA IE (e um CNPJ). Substitui a lógica insc07 + dadosempresa.inscricaoestadual
// global, que causava o descasamento série↔IE (rejeição SEFAZ 615).
//
// Cadeia: cad_armazem.arm_iest → db_ie → { IE, CNPJ (cgc), tipo }.
//   tipo '04' = IE principal → NF-e mod 55 série 1 ; NFC-e mod 65 série 3
//   tipo '07' = Inscrição 07 → NF-e mod 55 série 2 ; NÃO emite NFC-e

export interface FiscalArmazem {
  arm_id: number;
  ie: string; // inscrição estadual (só dígitos)
  cgc: string; // CNPJ do emitente
  tipo: string; // '04' | '07'
  nome: string; // nomecontribuinte
}

// arm_iest guarda a IE formatada ("04.164.781-5"); db_ie.inscricaoestadual é só dígitos.
// O join normaliza os dois para casar.
export async function resolverFiscalArmazem(
  client: { query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> },
  armId: number | string,
  schema = 'db_manaus',
): Promise<FiscalArmazem | null> {
  const r = await client.query(
    `SELECT a.arm_id, ie.inscricaoestadual AS ie, ie.cgc, ie.tipo,
            ie.nomecontribuinte AS nome
       FROM ${schema}.cad_armazem a
       JOIN ${schema}.db_ie ie
         ON regexp_replace(COALESCE(a.arm_iest, ''), '[^0-9]', '', 'g') = ie.inscricaoestadual
      WHERE a.arm_id = $1
      LIMIT 1`,
    [armId],
  );
  if (!r.rows.length) return null;
  const x = r.rows[0];
  return { arm_id: Number(x.arm_id), ie: x.ie, cgc: x.cgc, tipo: x.tipo, nome: x.nome };
}

// Deriva a série pela regra MELO (tipo da IE + modelo). bloqueado=true quando a
// combinação é proibida (IE 07 não emite NFC-e mod 65) — a TRAVA.
export function determinarSeriePorIE(
  tipo: string,
  modelo: '55' | '65',
): { serie: string | null; bloqueado: boolean; motivo?: string } {
  const t = String(tipo || '04');
  if (modelo === '65') {
    if (t === '07') {
      return {
        serie: null,
        bloqueado: true,
        motivo:
          'A Inscrição Estadual 07 não emite NFC-e (modelo 65). Use um armazém ligado à IE principal (04) para vender a consumidor final (CPF).',
      };
    }
    return { serie: '3', bloqueado: false };
  }
  // modelo 55 (NF-e)
  return { serie: t === '07' ? '2' : '1', bloqueado: false };
}

// Deriva a IE do EMITENTE a partir da série + CNPJ: série '2' → IE tipo '07';
// série '1'/'3' → IE tipo '04'. Mantém série↔IE consistentes (evita a rejeição 615).
// Retorna a IE (só dígitos) daquele CNPJ com o tipo correspondente, ou null.
export async function ieEmitentePorSerie(
  client: { query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> },
  cgc: string,
  serie: string | number,
  schema = 'db_manaus',
): Promise<string | null> {
  const tipo = String(serie) === '2' ? '07' : '04';
  const cnpj = String(cgc || '').replace(/\D/g, '');
  if (!cnpj) return null;
  const r = await client.query(
    `SELECT inscricaoestadual
       FROM ${schema}.db_ie
      WHERE regexp_replace(COALESCE(cgc, ''), '[^0-9]', '', 'g') = $1
        AND tipo = $2
      LIMIT 1`,
    [cnpj, tipo],
  );
  return r.rows[0]?.inscricaoestadual || null;
}

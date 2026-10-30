// src/lib/fiscal/pagamentoNota.ts
//
// Grupo <pag><detPag> da NF-e/NFC-e — fiel ao Delphi:
//   FATURAMENTOS_NF_ELETRONICA_2.CARREGA_FATURA (formapagto / descrPagamento)
//   + DataSnap/UniXmlNfe.pas MontaNivelYA (layout 4.00):
//     tPag = 90 (sem pagamento) em estorno, devolução, entrada (CFOP 1/2/3) e
//            transferência/remessa (5152, 5409, 6152, 6409) → vPag = 0,00
//     tPag = 15 (boleto) quando frmfat = '2'
//     tPag = 99 (outros) no resto, com xPag = descrição da forma da fatura
//            (1 Recibo, 2 Boleto Bancario, 3 Promissoria, 4 Carteira, senão Outros).

export interface PagamentoNota {
  tPag: string;
  /** Só quando tPag = '99' (obrigatório nesse caso). */
  xPag?: string;
  /** tPag = '90' → vPag = 0,00 (o Delphi zera). */
  vPagZero: boolean;
}

export interface FaturaPagamento {
  frmfat?: string | number | null;
  cfop1?: string | number | null;
  estorno?: string | number | null;
  dev_id?: string | number | null;
}

const CFOP_SEM_PAGAMENTO = ['5152', '5409', '6152', '6409'];

function descricaoForma(frmfat: string): string {
  switch (frmfat) {
    case '1':
      return 'Recibo';
    case '2':
      return 'Boleto Bancario';
    case '3':
      return 'Promissoria';
    case '4':
      return 'Carteira';
    default:
      return 'Outros';
  }
}

const vazio = (v: unknown) => v == null || String(v).trim() === '';

export function regraPagamentoNota(f: FaturaPagamento | null | undefined): PagamentoNota {
  const frmfat = String(f?.frmfat ?? '').trim();
  const cfop1 = String(f?.cfop1 ?? '').replace(/\D/g, '');
  const semPagamento: PagamentoNota = { tPag: '90', vPagZero: true };

  if (!vazio(f?.estorno)) return semPagamento;
  // Delphi exige também fat_devolucao.dev_procedente = 'S'; essa tabela não existe no
  // Postgres, então toda fatura vinculada a uma devolução entra como sem pagamento.
  if (!vazio(f?.dev_id)) return semPagamento;
  if (['1', '2', '3'].includes(cfop1.charAt(0))) return semPagamento;
  if (CFOP_SEM_PAGAMENTO.includes(cfop1)) return semPagamento;
  if (frmfat === '2') return { tPag: '15', vPagZero: false };
  return { tPag: '99', xPag: descricaoForma(frmfat), vPagZero: false };
}

/** Lê a fatura no banco e aplica a regra. Fatura não encontrada → regra com dados vazios (99/Outros). */
export async function pagamentoNotaDaFatura(
  db: { query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> },
  codfat: string | null | undefined,
): Promise<PagamentoNota> {
  if (!codfat) return regraPagamentoNota(null);
  const r = await db.query(
    'SELECT frmfat, cfop1, estorno, dev_id FROM dbfatura WHERE codfat = $1 LIMIT 1',
    [codfat],
  );
  return regraPagamentoNota(r.rows[0] ?? null);
}

// Monta o texto do campo "FATURA / DUPLICATA" do DANFE conforme a forma de
// pagamento do faturamento (dbfatura.frmfat):
//   B (Boleto) / D (Duplicata/Carteira) → lista as parcelas: "Parc 1. Venc DD/MM/AAAA . Parc 2. ..."
//   P → PIX | C → CARTÃO CRÉDITO | V → CARTÃO DÉBITO | $ → DINHEIRO
//   demais → "A VISTA"

export interface ParcelaDup {
  vencimento: string | Date | null | undefined;
}

const FORMA_AVISTA: Record<string, string> = {
  P: 'PIX',
  C: 'CARTÃO CRÉDITO',
  V: 'CARTÃO DÉBITO',
  $: 'DINHEIRO',
};

/** Formata data para DD/MM/AAAA sem sofrer com fuso (aceita 'YYYY-MM-DD...'). */
export function formatarDataDup(v: string | Date | null | undefined): string {
  if (!v) return '';
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return '';
    return `${String(v.getDate()).padStart(2, '0')}/${String(v.getMonth() + 1).padStart(2, '0')}/${v.getFullYear()}`;
  }
  const s = String(v);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const d = new Date(s);
  if (!isNaN(d.getTime()))
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  return s;
}

/** Texto do campo FATURA / DUPLICATA a partir da forma (frmfat) e das parcelas. */
export function montarTextoDuplicata(
  frmfat: any,
  parcelas: ParcelaDup[] = [],
): string {
  const f = String(frmfat ?? '').trim().toUpperCase();
  const lista = () =>
    parcelas
      .map((p, i) => `Parc ${i + 1}. Venc ${formatarDataDup(p.vencimento)}`)
      .join(' . ');

  // Boleto / Duplicata (Carteira) → parcelas
  if ((f === 'B' || f === 'D') && parcelas.length > 0) return lista();

  // Formas à vista nomeadas
  if (FORMA_AVISTA[f]) return FORMA_AVISTA[f];

  // Legado/desconhecido: se há mais de uma parcela com vencimento, ainda lista
  if (parcelas.length > 1) return lista();

  return 'A VISTA';
}

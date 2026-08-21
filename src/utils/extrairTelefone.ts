/**
 * Extrai um telefone "limpo" de fontes heterogêneas usadas no cadastro de cliente.
 *
 * O cadastro novo grava um OBJETO em `dbclien.contato`
 *   { telefones:[...], pessoas:[...], vendedores:[...], formasPagamento:[...], entrega:{...} }
 * — se esse objeto for jogado direto no campo FONE do DANFE/XML, sai o JSON cru.
 * Esta função devolve APENAS um número de telefone (ou string vazia), nunca o objeto.
 *
 * Aceita: string já pronta ("9299..."), JSON string, ou objeto. Procura em
 * `telefones[]`/`contatos[]` (itens string ou {value|numero|telefone|fone, type})
 * e, por último, em `pessoas[].telefone`. Ignora entradas de e-mail.
 */
export function extrairTelefone(fonte: any): string {
  if (fonte == null) return '';
  if (typeof fonte === 'number') return String(fonte);

  let val: any = fonte;
  if (typeof fonte === 'string') {
    const s = fonte.trim();
    if (s === '') return '';
    // Não parece JSON → assume que já é o telefone pronto.
    if (s[0] !== '{' && s[0] !== '[') return s;
    try {
      val = JSON.parse(s);
    } catch {
      return '';
    }
  }
  if (typeof val !== 'object' || val === null) return '';

  const ehEmail = (t: any, num: any) =>
    String(t?.type ?? t?.tipo ?? '').toLowerCase() === 'email' ||
    String(num ?? '').includes('@');

  const listas = [val.telefones, val.contatos].filter(Array.isArray);
  for (const lista of listas) {
    for (const t of lista) {
      if (typeof t === 'string' && t.trim()) return t.trim();
      const num = t?.value ?? t?.numero ?? t?.telefone ?? t?.fone;
      if (num && !ehEmail(t, num)) return String(num).trim();
    }
  }

  if (Array.isArray(val.pessoas)) {
    for (const p of val.pessoas) {
      const num = p?.telefone ?? p?.fone;
      if (num && !String(num).includes('@')) return String(num).trim();
    }
  }

  return '';
}

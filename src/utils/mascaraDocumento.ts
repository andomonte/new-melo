/**
 * Formata CPF/CNPJ conforme o tipo de pessoa selecionado (mesmo padrão do cadastro de cliente).
 * - tipo 'J' -> CNPJ: 00.000.000/0000-00
 * - tipo 'F' -> CPF:  000.000.000-00
 * - tipo 'X' (Exterior) -> sem máscara (texto livre)
 * - sem tipo -> decide pela quantidade de dígitos (fallback)
 */
import { mascaraCnpjAlfa, limparDocumentoAlfa } from '@/utils/cnpjAlfanumerico';

export function formatarDocumento(value: string, tipo?: string): string {
  if (tipo === 'X') return String(value ?? '');

  const rawNum = String(value ?? '').replace(/\D/g, '');

  const mascaraCpf = (v: string) =>
    v
      .slice(0, 11)
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2');

  if (tipo === 'F') return mascaraCpf(rawNum);
  // CNPJ agora é ALFANUMÉRICO (AA.AAA.AAA/AAAA-DV) — mantém letras.
  if (tipo === 'J') return mascaraCnpjAlfa(value);

  // Fallback (sem tipo): tem letra ou > 11 caracteres → CNPJ; senão CPF.
  const rawAlfa = limparDocumentoAlfa(value);
  if (/[A-Z]/.test(rawAlfa) || rawAlfa.length > 11) return mascaraCnpjAlfa(value);
  return mascaraCpf(rawNum);
}

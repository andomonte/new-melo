/**
 * Formata CPF/CNPJ conforme o tipo de pessoa selecionado (mesmo padrão do cadastro de cliente).
 * - tipo 'J' -> CNPJ: 00.000.000/0000-00
 * - tipo 'F' -> CPF:  000.000.000-00
 * - tipo 'X' (Exterior) -> sem máscara (texto livre)
 * - sem tipo -> decide pela quantidade de dígitos (fallback)
 */
export function formatarDocumento(value: string, tipo?: string): string {
  if (tipo === 'X') return String(value ?? '');

  const raw = String(value ?? '').replace(/\D/g, '');

  const mascaraCpf = (v: string) =>
    v
      .slice(0, 11)
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2');

  const mascaraCnpj = (v: string) =>
    v
      .slice(0, 14)
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');

  if (tipo === 'F') return mascaraCpf(raw);
  if (tipo === 'J') return mascaraCnpj(raw);
  // fallback por tamanho
  return raw.length <= 11 ? mascaraCpf(raw) : mascaraCnpj(raw);
}

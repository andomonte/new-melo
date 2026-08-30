// Máscara de percentual das telas de Financeiro > Arquivos.
//
// Reproduz o MaskEdit '99.99' do Delphi (UF: alíquotas de ICMS; Serviços:
// alíquota de ISSQN): dois dígitos, ponto fixo, dois decimais — ou seja, de
// 00.00 a 99.99. Os dígitos entram da esquerda para a direita, como na
// máscara posicional do Delphi: digitar "1900" resulta em 19.00.
//
// No OnExit o Delphi chama Formatv(), que troca por zero as posições que o
// usuário deixou em branco — é o que `completarPercentual` faz.

const digitos = (texto: unknown) =>
  String(texto ?? '')
    .replace(/\D/g, '')
    .slice(0, 4);

/** Aplica a máscara enquanto o usuário digita. */
export function mascararPercentual(texto: unknown): string {
  const d = digitos(texto);
  return d.length <= 2 ? d : `${d.slice(0, 2)}.${d.slice(2)}`;
}

/**
 * Formatv(): completa com zero as posições vazias ao sair do campo.
 *
 * Repare que os dois lados do ponto se comportam de forma diferente, como no
 * Util.pas: a parte inteira é alinhada à DIREITA (o Formatv empurra os brancos
 * para a esquerda, então digitar "7" vira " 7.00" = 7,00, não 70,00) e a parte
 * decimal à ESQUERDA ("195" vira 19.50).
 */
export function completarPercentual(texto: unknown): string {
  const d = digitos(texto);
  return `${d.slice(0, 2).padStart(2, '0')}.${d.slice(2).padEnd(2, '0')}`;
}

/**
 * Normaliza o valor vindo do banco para o formato posicional NN.NN.
 * O Postgres devolve numeric(5,2) como "5.00"; a máscara precisa de "05.00"
 * para os dígitos casarem posição a posição (o Delphi exibe " 5.00", com
 * espaço à esquerda, pelo mesmo motivo).
 */
export function normalizarPercentual(valor: unknown): string {
  const n = Number(String(valor ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return '00.00';
  return Math.min(Math.max(n, 0), 99.99).toFixed(2).padStart(5, '0');
}

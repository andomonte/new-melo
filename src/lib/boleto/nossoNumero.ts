// src/lib/boleto/nossoNumero.ts
//
// Nosso Número de boleto — espelho fiel do Delphi/Oracle.
//
// No Delphi, o TCOBRANCA (no faturamento) lê/incrementa a tabela DBBANCO_NUMERO
// (contador por banco, com FOR UPDATE atômico) e grava o resultado em dbreceb.nro_banco.
// O dígito verificador (DV) sai da função DIGITO_DOCUMENTO (Oracle), por banco.
//
// Códigos de banco = internos do Oracle (iguais a dbreceb.banco):
//   0=Bradesco, 1=BB, 2=Itaú, 3=Rural, 5=Santander, 6=Safra, 7=Citibank, 8=Caixa.

/** Tamanho (StrZero) do nro_banco por banco — do TCOBRANCA. */
export const LEN_NRO_BANCO: Record<string, number> = {
  '0': 11, // Bradesco
  '1': 10, // Banco do Brasil
  '2': 8, // Itaú
  '3': 7, // Rural
  '5': 7, // Santander
  '6': 8, // Safra
  '7': 11, // Citibank
  '8': 10, // Caixa
};

/**
 * Dígito verificador do Nosso Número, por banco (port de DIGITO_DOCUMENTO).
 * Validado contra os modelos reais: Bradesco 00000773464→'9', Santander 0306667→'3'.
 */
export function digitoNossoNumero(banco: string, nroBanco: string): string {
  const nn = String(nroBanco);
  if (banco === '0') {
    // Bradesco: módulo 11, pesos 2..7 ciclando (da direita p/ esquerda), + 63.
    let soma = 0;
    let peso = 2;
    for (let x = nn.length; x >= 1; x--) {
      soma += Number(nn.charAt(x - 1)) * peso;
      peso = peso + 1 > 7 ? 2 : peso + 1;
    }
    soma += 63;
    const resto = soma % 11;
    if (resto === 0) return '0';
    if (resto === 1) return 'P';
    return String(11 - resto);
  }
  if (banco === '5') {
    // Santander: módulo 11, pesos 8..2 ciclando (esquerda p/ direita), 7 dígitos.
    let soma = 0;
    let peso = 8;
    for (let x = 1; x <= nn.length; x++) {
      soma += Number(nn.charAt(x - 1)) * peso;
      peso = peso - 1 === 1 ? 8 : peso - 1;
    }
    const resto = soma % 11;
    if (resto === 0 || resto === 1) return '0';
    return String(11 - resto);
  }
  if (banco === '6') {
    // Safra: módulo 11, pesos 9..2 ciclando, 8 dígitos.
    let soma = 0;
    let peso = 9;
    for (let x = 1; x <= nn.length; x++) {
      soma += Number(nn.charAt(x - 1)) * peso;
      peso = peso - 1 === 1 ? 9 : peso - 1;
    }
    const resto = soma % 11;
    if (resto === 1) return '0';
    if (resto === 0) return '1';
    return String(11 - resto);
  }
  // Outros bancos: DV ainda não portado (retorna vazio — o boleto não deve ser
  // emitido sem DV; o chamador valida).
  return '';
}

/**
 * Gera o PRÓXIMO nro_banco (nosso número base) do banco, incrementando o contador
 * DBBANCO_NUMERO de forma ATÔMICA (SELECT ... FOR UPDATE). Deve rodar DENTRO da
 * transação do faturamento (o chamador passa o `client`). Reinicia em 1 ao atingir
 * o limite (regra AM/Manaus: xSequencia = null). Retorna já com StrZero do banco.
 */
export async function proximoNroBanco(client: any, banco: string): Promise<string> {
  const len = LEN_NRO_BANCO[banco];
  if (!len) throw new Error(`Banco '${banco}' sem configuração de Nosso Número.`);
  const sel = await client.query(
    `SELECT nro_sequencia, limite FROM dbbanco_numero WHERE banco = $1 FOR UPDATE`,
    [banco],
  );
  if (sel.rows.length === 0) {
    throw new Error(`dbbanco_numero não tem o banco '${banco}'.`);
  }
  // Valores cabem em Number (limite máx. ~10 dígitos << MAX_SAFE_INTEGER).
  const atual = Number(sel.rows[0].nro_sequencia);
  const limite = Number(sel.rows[0].limite);
  let novo: number;
  if (atual >= limite) {
    novo = 1;
    await client.query(
      `UPDATE dbbanco_numero SET nro_sequencia = 1, ordem = ordem + 1 WHERE banco = $1`,
      [banco],
    );
  } else {
    novo = atual + 1;
    await client.query(
      `UPDATE dbbanco_numero SET nro_sequencia = nro_sequencia + 1 WHERE banco = $1`,
      [banco],
    );
  }
  return String(novo).padStart(len, '0');
}

/** Nosso Número completo (base + DV) sem formatação. */
export function nossoNumeroComDV(banco: string, nroBanco: string): string {
  return `${nroBanco}${digitoNossoNumero(banco, nroBanco)}`;
}

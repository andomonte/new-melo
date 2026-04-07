// utils/serializeBigInt.ts

/**
 * Converte todos os valores BigInt de um objeto para string, permitindo serialização JSON.
 * @param obj Objeto que pode conter valores BigInt
 * @returns Objeto pronto para JSON.stringify
 */
export function serializeBigInt(obj: any): any {
  return JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );
}

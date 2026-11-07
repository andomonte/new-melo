/** Hoje no fuso local, como AAAA-MM-DD (toISOString daria amanhã no fim do dia). */
export function hojeLocal(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Delphi: com "Tem Conhecimento" marcado, exige o conhecimento informado. */
export function validarConhecimento(
  temConhecimento: boolean,
  dados: { nrocon?: string } | null | undefined,
): string | null {
  if (!temConhecimento) return null;
  return dados?.nrocon?.trim() ? null : 'Cadastre o conhecimento (CTe) ou desmarque "Tem Conhecimento".';
}

/** Devolve a mensagem de erro do selo, ou null se puder seguir. Selo vazio não é validado. */
export function validarSelo(numeroSelo: string, dataSelo: string): string | null {
  if (!numeroSelo.trim()) return null;
  if (!dataSelo) return 'Informe a data do selo';
  if (dataSelo > hojeLocal()) return 'A data do selo não pode ser maior que a data atual';
  return null;
}

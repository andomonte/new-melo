// src/lib/financeiro/operadorCaixa.ts
//
// Apoio da tela Financeiro > Arquivos > Operador Caixa.
// A chave de tb_user_perfil é composta (user_login_id, perfil_name,
// codigo_filial); o CRUD genérico da UI trabalha com um id único, então
// serializamos os três campos num só valor.

const SEP = '|';

export interface ChaveOperador {
  user_login_id: string;
  perfil_name: string;
  codigo_filial: number | string;
}

export function montarIdOperador(linha: ChaveOperador): string {
  return [linha.user_login_id, linha.perfil_name, linha.codigo_filial].join(SEP);
}

export function lerIdOperador(id: string): ChaveOperador | null {
  const partes = String(id ?? '').split(SEP);
  if (partes.length !== 3) return null;

  const codigo_filial = Number(partes[2]);
  if (!partes[0] || !partes[1] || !Number.isFinite(codigo_filial)) return null;

  return { user_login_id: partes[0], perfil_name: partes[1], codigo_filial };
}

/** Colunas devolvidas pela listagem e pelo GET por id. */
export const SELECT_OPERADOR = `
  p.user_login_id || '${SEP}' || p.perfil_name || '${SEP}' || p.codigo_filial AS id,
  p.user_login_id  AS usuario,
  p.perfil_name    AS perfil,
  p.codigo_filial  AS codigo_filial,
  p.nome_filial    AS filial,
  p.cod_conta      AS cod_conta,
  c.nro_conta      AS nro_conta,
  c.digito         AS digito
`;

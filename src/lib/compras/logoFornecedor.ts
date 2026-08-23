import type { PoolClient } from 'pg';

export interface LogoFornecedor {
  /** Conteúdo PNG em base64 (sem o prefixo data:). */
  base64: string;
  mime: string;
  largura: number | null;
  altura: number | null;
}

/**
 * Busca a logo do fornecedor (tabela web-only `cad_credor_logo`) e devolve
 * pronta para embutir em relatório (base64) ou `null` se não houver.
 * Tolera a tabela ainda não existir (retorna null) para não quebrar relatórios.
 */
export async function getLogoFornecedorBase64(
  client: PoolClient,
  codCredor: string | null | undefined,
): Promise<LogoFornecedor | null> {
  if (!codCredor) return null;
  try {
    const r = await client.query(
      `SELECT imagem, mime, largura, altura
         FROM cad_credor_logo
        WHERE cod_credor = $1`,
      [String(codCredor).trim()],
    );
    if (!r.rows.length) return null;
    const row = r.rows[0];
    const buf: Buffer = row.imagem; // node-pg devolve bytea como Buffer
    if (!buf || !buf.length) return null;
    return {
      base64: buf.toString('base64'),
      mime: row.mime || 'image/png',
      largura: row.largura ?? null,
      altura: row.altura ?? null,
    };
  } catch {
    // Tabela inexistente / erro de leitura: relatório segue sem a logo.
    return null;
  }
}

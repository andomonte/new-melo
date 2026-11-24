/**
 * Vendedor e operador da venda/orçamento da Venda Externa — MESMA regra da Nova Venda V2:
 *   vendedor = vendedor do cliente (dbclien.codvend); sem vendedor no cliente → quem vendeu
 *   operador = quem está fazendo a venda (codvend do passe), sempre, com tele = 'S'
 * O finalizarVenda grava os dois em dbvvend (operador 'N' / 'S') e em cada item
 * (codvend / codoperador). Aplicado no servidor: não confia no que veio do aparelho
 * (pedido feito sem internet pode ter dados antigos do cliente). Só servidor.
 */
import type { Pool } from 'pg';
import type { PasseExterno } from './token';

export async function aplicarVendedorOperador(pool: Pool, payload: any, passe: PasseExterno) {
  const r = await pool.query(`SELECT btrim(COALESCE(codvend,'')) AS codvend FROM dbclien WHERE codcli = $1`, [
    String(payload.header?.codcli || ''),
  ]);
  const operador = String(passe.v || '').trim();
  const vendedor = String(r.rows[0]?.codvend || '').trim() || operador;
  payload.header.vendedor = vendedor;
  payload.header.operador = operador || null;
  payload.header.tele = operador ? 'S' : 'N';
  payload.header.codusr = Number(operador) || operador;
  payload.header.uName = passe.u;
  payload.itens = (payload.itens || []).map((i: any) => ({ ...i, codvend: vendedor, codoperador: operador || null }));
}

import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * Notas que o título atendeu (dbpgto_nota, migration 089). Usado pelo modal da coluna NF do
 * Contas a Pagar: lista as notas, o valor de cada uma e quanto o título cobriu em cada.
 * Roteiro: docs/saldo-fornecedor/roteiro-adiantamento-nfe-credito.md (etapa 3).
 */
const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
  }
  const id = typeof req.query.id === 'string' ? req.query.id.trim() : '';
  if (!id) return res.status(400).json({ erro: 'ID do título é obrigatório' });

  try {
    const t = await pool.query(
      `SELECT p.cod_pgto, p.nro_nf, p.nro_dup, COALESCE(p.valor_pgto,0) AS valor_pgto,
              COALESCE(p.valor_pago,0) AS valor_pago, p.paga, p.cancel, p.pag_cof_id, c.nome AS nome_credor
         FROM dbpgto p LEFT JOIN dbcredor c ON c.cod_credor = p.cod_credor
        WHERE p.cod_pgto = $1`, [id]);
    if (t.rows.length === 0) return res.status(404).json({ erro: 'Título não encontrado' });

    const n = await pool.query(
      `SELECT t.codnfe_ent, t.nnf, t.serie, t.chave, t.tipo,
              COALESCE(t.valor_nf,0) AS valor_nf, COALESCE(t.valor_atendido,0) AS valor_atendido,
              t.criado_em, t.usuario, n.demi AS dt_emissao_nf
         FROM dbpgto_nota t LEFT JOIN dbnfe_ent n ON n.codnfe_ent = t.codnfe_ent
        WHERE t.cod_pgto = $1
        ORDER BY t.criado_em, t.id`, [id]);

    const titulo = t.rows[0];
    const notas = n.rows.map((r) => ({
      ...r,
      valor_nf: Number(r.valor_nf),
      valor_atendido: Number(r.valor_atendido),
    }));
    const totalAtendido = Math.round(notas.reduce((s, r) => s + r.valor_atendido, 0) * 100) / 100;
    const valorTitulo = Number(titulo.valor_pgto);
    return res.status(200).json({
      titulo: { ...titulo, valor_pgto: valorTitulo, valor_pago: Number(titulo.valor_pago) },
      notas,
      total_atendido: totalAtendido,
      // saldo do título ainda não usado em nota (adiantamento)
      saldo: Math.max(0, Math.round((valorTitulo - totalAtendido) * 100) / 100),
    });
  } catch (e: any) {
    // banco sem a migration 089: sem notas vinculadas
    if (e?.code === '42P01') return res.status(200).json({ titulo: null, notas: [], total_atendido: 0, saldo: 0 });
    console.error('Erro ao buscar notas do título:', e);
    return res.status(500).json({ erro: 'Erro ao buscar notas do título' });
  }
}

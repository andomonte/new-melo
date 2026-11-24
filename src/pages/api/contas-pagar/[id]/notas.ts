import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { sqlSituacaoEntrada, sqlSituacaoNota } from '@/lib/contasPagar/situacaoRecebimento';

// etapa da entrada da nota, quem conferiu e quando (para o modal)
const sqlDetalheRecebimento = (chave: string) => `
              (SELECT r2.status FROM dbent e2 LEFT JOIN dbent_recebimento r2 ON r2.codent = e2.codent
                WHERE e2.chave = ${chave} ORDER BY (COALESCE(e2.status,'') = 'C'), e2.codent DESC LIMIT 1) AS etapa,
              (SELECT o2.recebedor_nome FROM dbent e2 JOIN entrada_operacoes o2 ON o2.codent = e2.codent
                WHERE e2.chave = ${chave} ORDER BY (COALESCE(e2.status,'') = 'C'), e2.codent DESC LIMIT 1) AS recebedor_nome,
              (SELECT o2.fim_recebimento::text FROM dbent e2 JOIN entrada_operacoes o2 ON o2.codent = e2.codent
                WHERE e2.chave = ${chave} ORDER BY (COALESCE(e2.status,'') = 'C'), e2.codent DESC LIMIT 1) AS fim_recebimento,
              (SELECT e2.codent FROM dbent e2
                WHERE e2.chave = ${chave} ORDER BY (COALESCE(e2.status,'') = 'C'), e2.codent DESC LIMIT 1) AS codent`;

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

    // recebimento físico de cada nota (mesma regra da listagem — situacaoRecebimento.ts)
    let n = await pool.query(
      `SELECT t.codnfe_ent, t.nnf, t.serie, t.chave, t.tipo,
              COALESCE(t.valor_nf,0) AS valor_nf, COALESCE(t.valor_atendido,0) AS valor_atendido,
              t.criado_em, t.usuario, n.demi AS dt_emissao_nf,
              ${sqlSituacaoNota('n')} AS recebimento,
              ${sqlDetalheRecebimento('n.chave')}
         FROM dbpgto_nota t LEFT JOIN dbnfe_ent n ON n.codnfe_ent = t.codnfe_ent
        WHERE t.cod_pgto = $1
        ORDER BY t.criado_em, t.id`, [id]);

    // Título avulso/antigo sem vínculo: a entrada do mesmo fornecedor com o nº da NF
    if (n.rows.length === 0 && String(t.rows[0].nro_nf || '').trim()) {
      n = await pool.query(
        `SELECT e.codent AS codnfe_ent, ltrim(substring(e.chave FROM 26 FOR 9), '0') AS nnf, NULL AS serie,
                e.chave, 'NF DO TÍTULO' AS tipo, COALESCE(e.totalnf,0) AS valor_nf, COALESCE(p.valor_pgto,0) AS valor_atendido,
                e.dtent::text AS criado_em, NULL AS usuario, e.dtent AS dt_emissao_nf,
                ${sqlSituacaoEntrada('e', 'r', 'op')} AS recebimento,
                r.status AS etapa, op.recebedor_nome, op.fim_recebimento::text AS fim_recebimento, e.codent AS codent
           FROM dbpgto p
           JOIN dbent e ON e.cod_credor = p.cod_credor
                       AND ltrim(substring(e.chave FROM 26 FOR 9), '0') = ltrim(p.nro_nf, '0')
           LEFT JOIN dbent_recebimento r ON r.codent = e.codent
           LEFT JOIN entrada_operacoes op ON op.codent = e.codent
          WHERE p.cod_pgto = $1
          ORDER BY (COALESCE(e.status,'') = 'C'), e.codent DESC
          LIMIT 1`, [id]);
    }

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

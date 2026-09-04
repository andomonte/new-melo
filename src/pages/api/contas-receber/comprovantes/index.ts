import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * Comprovantes de Pagamento (aba "Comprovante Pgto" do Delphi).
 * Fonte: fin_autenticacao (cabeçalho) + fin_item_autenticacao (itens = títulos).
 *
 * GET ?aut_id=X                → detalhe (cabeçalho + itens do comprovante).
 * GET ?search=&status=&data_inicio=&data_fim=  → lista.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido. Use GET.' });

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const autId = String(req.query.aut_id || '').trim();

    // ---- Detalhe de um comprovante ----
    if (autId) {
      const cab = await client.query(
        `SELECT a.aut_id, a.aut_data, a.aut_codusr, a.aut_codconta, a.aut_autenticacao, a.aut_cancel,
                u.nomeusr
           FROM fin_autenticacao a
           LEFT JOIN dbusuario u ON CAST(u.codusr AS TEXT) = CAST(a.aut_codusr AS TEXT)
          WHERE a.aut_id = $1::numeric`,
        [autId],
      );
      if (cab.rows.length === 0) return res.status(404).json({ erro: 'Comprovante não encontrado.' });
      const itens = await client.query(
        `SELECT it.ita_cod_receb, it.ita_nro_doc, it.ita_valor, it.ita_valo_areceber,
                it.ita_valor_juros, it.ita_valor_total,
                r.codcli, c.nome AS nome_cliente,
                r.valor_pgto AS valor_original,
                -- Taxa Admin. = taxa da operadora de cartão (dbfreceb.tx_cartao); 0 p/ dinheiro/depósito.
                COALESCE((
                  SELECT SUM(fr.valor * COALESCE(fr.tx_cartao,0) / 100)
                    FROM dbfreceb fr
                   WHERE fr.id_autenticacao = $1::bigint
                     AND fr.cod_receb = it.ita_cod_receb
                     AND fr.tx_cartao IS NOT NULL
                ), 0) AS taxa_admin
           FROM fin_item_autenticacao it
           LEFT JOIN dbreceb r ON r.cod_receb = it.ita_cod_receb
           LEFT JOIN dbclien c ON c.codcli = r.codcli
          WHERE it.ita_id = $1::numeric
          ORDER BY it.ita_cod_receb`,
        [autId],
      );
      // FORMAS DE PAGAMENTO: movimentos de dbfreceb ligados ao comprovante (id_autenticacao).
      // O nome da forma vem do CÓDIGO (dbfreceb.tipo → dbforma_pagto.descricao), não do campo
      // 'nome' (que no Oracle guarda o sacado do cheque, quase sempre nulo).
      const formas = await client.query(
        `SELECT COALESCE(fp.descricao, 'FORMA ' || fr.tipo) AS nome,
                SUM(fr.valor) AS valor,
                MIN(fr.coddocumento) AS coddocumento, MIN(fr.codautorizacao) AS codautorizacao
           FROM dbfreceb fr
           LEFT JOIN dbforma_pagto fp ON fp.codfpgt = fr.tipo
          WHERE fr.id_autenticacao = $1::bigint
          GROUP BY COALESCE(fp.descricao, 'FORMA ' || fr.tipo)
          ORDER BY 1`,
        [autId],
      );
      // Fallback p/ comprovantes sem id_autenticacao gravado: usa os movimentos dos títulos
      // do comprovante (aproximado — pode somar recebimentos de outros eventos).
      let formasRows = formas.rows;
      if (formasRows.length === 0) {
        const codRecebs = itens.rows.map((r: any) => String(r.ita_cod_receb));
        if (codRecebs.length) {
          const fb = await client.query(
            `SELECT COALESCE(fp.descricao, 'FORMA ' || fr.tipo) AS nome,
                    SUM(fr.valor) AS valor,
                    MIN(fr.coddocumento) AS coddocumento, MIN(fr.codautorizacao) AS codautorizacao
               FROM dbfreceb fr
               LEFT JOIN dbforma_pagto fp ON fp.codfpgt = fr.tipo
              WHERE fr.cod_receb = ANY($1) AND (fr.tipo IS DISTINCT FROM 'E') AND COALESCE(fr.valor,0) > 0
              GROUP BY COALESCE(fp.descricao, 'FORMA ' || fr.tipo) ORDER BY 1`,
            [codRecebs],
          );
          formasRows = fb.rows;
        }
      }
      return res.status(200).json({ comprovante: cab.rows[0], itens: itens.rows, formas: formasRows });
    }

    // ---- Listagem ----
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || 'todos'); // ativo | cancelado | todos
    const dataInicio = String(req.query.data_inicio || '').trim();
    const dataFim = String(req.query.data_fim || '').trim();
    const params: any[] = [];
    let where = 'WHERE 1=1';

    if (status === 'ativo') where += ' AND COALESCE(a.aut_cancel,0) = 0';
    else if (status === 'cancelado') where += ' AND COALESCE(a.aut_cancel,0) = 1';
    // Padrão (igual ao Delphi): sem busca e sem período → só os comprovantes de HOJE.
    if (!search && !dataInicio && !dataFim) {
      where += ' AND a.aut_data >= CURRENT_DATE';
    }
    if (dataInicio) {
      params.push(dataInicio);
      where += ` AND a.aut_data >= $${params.length}`;
    }
    if (dataFim) {
      params.push(dataFim + ' 23:59:59');
      where += ` AND a.aut_data <= $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (CAST(a.aut_id AS TEXT) LIKE $${params.length}
                 OR EXISTS (SELECT 1 FROM fin_item_autenticacao it2
                              LEFT JOIN dbreceb r2 ON r2.cod_receb = it2.ita_cod_receb
                              LEFT JOIN dbclien c2 ON c2.codcli = r2.codcli
                             WHERE it2.ita_id = a.aut_id
                               AND (it2.ita_nro_doc LIKE $${params.length}
                                    OR UPPER(c2.nome) LIKE UPPER($${params.length})
                                    OR CAST(r2.codcli AS TEXT) LIKE $${params.length})))`;
    }

    // DISTINCT ON (aut_id): o dado antigo (2012) tem aut_id repetido em fin_autenticacao;
    // sem isso o mesmo comprovante aparecia várias vezes na lista.
    const r = await client.query(
      `SELECT * FROM (
        SELECT DISTINCT ON (a.aut_id)
              a.aut_id, a.aut_data, a.aut_codusr, a.aut_codconta, a.aut_autenticacao,
              COALESCE(a.aut_cancel,0) AS aut_cancel,
              u.nomeusr,
              (SELECT COALESCE(SUM(ita_valor_total),0) FROM fin_item_autenticacao WHERE ita_id = a.aut_id) AS valor_total,
              (SELECT COUNT(*) FROM fin_item_autenticacao WHERE ita_id = a.aut_id) AS qtd_titulos,
              (SELECT ita_nro_doc FROM fin_item_autenticacao WHERE ita_id = a.aut_id ORDER BY ita_cod_receb LIMIT 1) AS primeiro_doc,
              cli.codcli, cli.nome AS nome_cliente
         FROM fin_autenticacao a
         LEFT JOIN dbusuario u ON CAST(u.codusr AS TEXT) = CAST(a.aut_codusr AS TEXT)
         LEFT JOIN LATERAL (
           SELECT r.codcli, c.nome
             FROM fin_item_autenticacao it
             JOIN dbreceb r ON r.cod_receb = it.ita_cod_receb
             LEFT JOIN dbclien c ON c.codcli = r.codcli
            WHERE it.ita_id = a.aut_id
            LIMIT 1
         ) cli ON true
         ${where}
        ORDER BY a.aut_id, a.aut_data DESC
      ) t
      ORDER BY t.aut_data DESC, t.aut_id DESC
      LIMIT 300`,
      params,
    );
    return res.status(200).json({ comprovantes: r.rows });
  } catch (error: any) {
    console.error('Erro ao listar comprovantes:', error);
    return res.status(500).json({ erro: 'Erro interno', detalhes: error.message });
  } finally {
    client.release();
  }
}

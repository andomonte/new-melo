/**
 * GET /api/importacao/[id]/previa-entradas
 *
 * Prévia (somente leitura) das entradas que o "Gerar Entrada" vai criar: UMA POR
 * FATURA da DI (fiel ao Oracle ENTRADA_IMPORTACAO.GERAR_ENTRADAS). Para cada fatura:
 * o fornecedor que será gravado na entrada (mesma busca da geração), itens, itens com
 * produto/ordem de compra, totais e a entrada já gerada, se houver.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPoolPorNomeFilial } from '@/lib/pg';
import { resolverCredorPorNome } from '@/lib/importacao/resolverCredor';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Método não permitido' });
  const id = parseInt(String(req.query.id), 10);
  if (!id) return res.status(400).json({ message: 'ID inválido' });

  const cookies = parseCookies({ req });
  const pool = await getPgPoolPorNomeFilial(cookies.filial_melo || 'MANAUS');
  const client = await pool.connect();
  try {
    const faturas = (
      await client.query(
        `SELECT f.id, f.cod_credor, f.fornecedor_nome, f.codent,
                count(y.*)::int                                  AS itens,
                count(y.codprod)::int                            AS com_produto,
                count(y.*) FILTER (WHERE y.codprod IS NOT NULL AND y.id_orc IS NOT NULL)::int AS com_oc,
                count(y.*) FILTER (WHERE y.codprod IS NOT NULL AND COALESCE(y.custo_unit_dolar,0) = 0)::int AS sem_custo,
                COALESCE(sum(y.qtd), 0)                          AS qtd,
                COALESCE(sum(y.invoice_total), 0)                AS total_usd,
                COALESCE(sum(y.custo_total_real), 0)             AS custo_real
           FROM dbent_importacao_entrada f
           LEFT JOIN dbent_importacao_it_ent y ON y.id_fatura = f.id AND y.id_importacao = f.id_importacao
          WHERE f.id_importacao = $1
          GROUP BY f.id
          ORDER BY f.id`,
        [id],
      )
    ).rows;

    const out = [];
    for (const [i, f] of faturas.entries()) {
      const codCredor = f.cod_credor || (await resolverCredorPorNome(client, f.fornecedor_nome));
      const credorNome = codCredor
        ? (await client.query(`SELECT nome FROM dbcredor WHERE cod_credor = $1`, [codCredor])).rows[0]?.nome ?? null
        : null;
      // codent da fatura: antes da entrada real guarda o nº da pré-entrada (dbnfe_ent);
      // só conta como gerada se existir em dbent.
      const ent = f.codent
        ? (await client.query(
            `SELECT e.codent, e.status, rec.status AS rec_status
               FROM dbent e LEFT JOIN dbent_recebimento rec ON rec.codent = e.codent
              WHERE e.codent = $1`, [f.codent])).rows[0] ?? null
        : null;

      const pendencias: string[] = [];
      if (!codCredor) pendencias.push('fornecedor não encontrado no cadastro');
      if (f.com_produto < f.itens) pendencias.push(`${f.itens - f.com_produto} item(ns) sem produto`);
      if (f.sem_custo > 0) pendencias.push(`${f.sem_custo} item(ns) sem custo`);

      out.push({
        fatura: i + 1,
        id: f.id,
        fornecedorDi: f.fornecedor_nome,
        codCredor,
        credorNome,
        itens: f.itens,
        comProduto: f.com_produto,
        comOc: f.com_oc,
        qtd: Number(f.qtd),
        totalUsd: Number(f.total_usd),
        custoReal: Number(f.custo_real),
        entrada: ent ? { codent: ent.codent, status: ent.status, recebimento: ent.rec_status } : null,
        pendencias,
      });
    }

    return res.status(200).json({ success: true, faturas: out });
  } catch (e: any) {
    console.error('[previa-entradas] erro:', e);
    return res.status(500).json({ message: e.message || 'Erro ao montar a prévia das entradas' });
  } finally {
    client.release();
  }
}

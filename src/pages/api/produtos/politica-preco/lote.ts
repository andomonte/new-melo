import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPoolPorNomeFilial } from '@/lib/pg';
import { atualizarFaixaPreco, FaixaInexistenteError } from '@/lib/produtos/politicaPreco';

/**
 * POST /api/produtos/politica-preco/lote
 * Body: { codprods: string[], tipoPreco: number | 'TODOS', margem: number }
 *
 * "Alterar Margem do produto em lote" do Delphi (uniMargemPrecoVendasNovo.btnConfirmarClick):
 * aplica a mesma margem líquida à faixa escolhida (ou a todas) de todos os produtos em análise,
 * recalculando o preço. Tudo numa transação: se uma gravação falhar, nada é salvo.
 * Produto sem a faixa é pulado e informado (o Delphi criava a faixa; aqui a política
 * é criada pelo cadastro/entrada).
 */
const MAX_PRODUTOS = 5000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const codprods: string[] = Array.isArray(req.body?.codprods)
    ? Array.from(new Set(req.body.codprods.map((c: any) => String(c).trim()).filter(Boolean)))
    : [];
  const margem = Number(req.body?.margem);
  const todos = req.body?.tipoPreco === 'TODOS';
  const tp = Number(req.body?.tipoPreco);
  if (codprods.length === 0) return res.status(400).json({ error: 'Não há produtos para atualizar.' });
  if (codprods.length > MAX_PRODUTOS) {
    return res.status(400).json({ error: `Máximo de ${MAX_PRODUTOS} produtos por vez.` });
  }
  if (Number.isNaN(margem)) return res.status(400).json({ error: 'Informe a margem.' });
  if (!todos && (Number.isNaN(tp) || tp < 0 || tp > 7)) {
    return res.status(400).json({ error: 'Informe a TABELA que deseja atualizar.' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || cookies.filial || 'MANAUS';
  const faixas = todos ? [0, 1, 2, 3, 4, 5, 6, 7] : [tp];

  let client;
  try {
    const pool = await getPgPoolPorNomeFilial(filial);
    client = await pool.connect();
    await client.query('BEGIN');

    // Só as faixas que existem (evita uma consulta por faixa ausente).
    const ex = await client.query(
      `SELECT "CODPROD" AS codprod, "TIPOPRECO"::int AS tp FROM dbformacaoprvenda
        WHERE "CODPROD" = ANY($1) AND "TIPOPRECO" = ANY($2)`,
      [codprods, faixas],
    );
    const existentes = new Set(ex.rows.map((r: any) => `${r.codprod}|${r.tp}`));

    let atualizadas = 0;
    const semFaixa = new Set<string>();
    for (const cod of codprods) {
      for (const f of faixas) {
        if (!existentes.has(`${cod}|${f}`)) {
          if (!todos) semFaixa.add(cod);
          continue;
        }
        try {
          await atualizarFaixaPreco(client, cod, f, 'MARGEM', margem);
          atualizadas++;
        } catch (e) {
          if (e instanceof FaixaInexistenteError) { semFaixa.add(cod); continue; }
          throw new Error(`Produto ${cod}: ${e instanceof Error ? e.message : e}`);
        }
      }
    }
    await client.query('COMMIT');
    return res.status(200).json({
      success: true,
      produtos: codprods.length,
      faixasAtualizadas: atualizadas,
      semFaixa: Array.from(semFaixa),
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    console.error('Erro ao alterar margem em lote:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'NÃO FOI POSSÍVEL ATUALIZAR O PREÇO DE VENDA.',
    });
  } finally {
    if (client) client.release();
  }
}

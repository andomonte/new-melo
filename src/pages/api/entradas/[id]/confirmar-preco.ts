import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { confirmarPrecoEntrada } from '@/lib/compras/gerarEntradaDbent';

interface ItemEditado {
  id?: string;
  produto_cod: string;
  preco_unitario: number;
  preco_total?: number;
  unidade_venda?: string; // UN, CX, KT, etc
}

interface ConfirmarPrecoRequest {
  observacao?: string;
  atualizarPrecoVenda?: boolean;
  itensEditados?: ItemEditado[];
  /** "Confirmar sem Custo" (Delphi): confirma sem recalcular média/preço do produto. */
  semCusto?: boolean;
}

interface ConfirmarPrecoResponse {
  success: boolean;
  message: string;
}

/**
 * Confirmar Preço — modelo Delphi (dbent/dbitent).
 * Aplica eventuais preços editados aos itens (dbitent), roda o motor de custo
 * (confirmarPrecoEntrada: custo por item + média ponderada + reprecificação de venda),
 * fecha a entrada (dbent.status='F') e avança o workflow (dbent_recebimento='PRECO_CONFIRMADO').
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ConfirmarPrecoResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { id } = req.query;
  const { observacao, itensEditados, semCusto }: ConfirmarPrecoRequest = req.body || {};

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID (codent) da entrada é obrigatório' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || cookies.filial || 'MANAUS';

  let client;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('SET LOCAL search_path TO db_manaus, public');

    // Entrada + estado do workflow
    const entResult = await client.query(
      `SELECT e.codent, e.status, rec.status AS rec_status
         FROM db_manaus.dbent e
         LEFT JOIN db_manaus.dbent_recebimento rec ON rec.codent = e.codent
        WHERE e.codent = $1`,
      [id]
    );
    if (entResult.rows.length === 0) {
      throw new Error('Entrada não encontrada');
    }
    const ent = entResult.rows[0];
    if (ent.rec_status && ent.rec_status !== 'PENDENTE') {
      throw new Error(`Não é possível confirmar preço. Status atual: ${ent.rec_status}. Esperado: PENDENTE`);
    }

    // Aplica preços/unidades editados na tela aos itens da entrada (dbitent por produto)
    if (Array.isArray(itensEditados)) {
      for (const item of itensEditados) {
        if (!item.produto_cod || item.preco_unitario == null) continue;
        await client.query(
          `UPDATE db_manaus.dbitent SET prunit = $3, prunitnf = $3
             WHERE codent = $1 AND codprod = $2`,
          [id, item.produto_cod, Number(item.preco_unitario)]
        );
        if (item.unidade_venda) {
          await client.query(`UPDATE db_manaus.dbprod SET unimed = $2 WHERE codprod = $1`, [item.produto_cod, item.unidade_venda]);
        }
      }
    }

    // Empresa / zona fiscal
    const empRow = await client.query(`SELECT uf FROM db_manaus.dadosempresa LIMIT 1`);
    const uf = empRow.rows[0]?.uf || 'AM';
    const zonaRow = await client.query(`SELECT "ZONA_ISENTIVADA" AS zona FROM db_manaus.dbuf_n WHERE "UF" = $1`, [uf]);
    const empresa = { uf, zona_isentivada: zonaRow.rows[0]?.zona || 'S' };

    // "Sem Custo" (Delphi): registra temcusto='N' e NÃO atualiza média/preço do produto.
    if (semCusto) {
      await client.query(`UPDATE db_manaus.dbent SET temcusto = 'N' WHERE codent = $1`, [id]);
    }

    // Motor de custo: custo por item (+ média/reprecificação, exceto quando "sem custo")
    const r = await confirmarPrecoEntrada(client, id, empresa, 0, {
      atualizarProdutoOverride: semCusto ? false : undefined,
    });

    // Fecha a entrada (custo feito) e avança o workflow físico
    await client.query(`UPDATE db_manaus.dbent SET status = 'F' WHERE codent = $1`, [id]);
    await client.query(
      `INSERT INTO db_manaus.dbent_recebimento (codent, status, data_confirmacao_preco, observacao_preco, updated_at)
       VALUES ($1, 'PRECO_CONFIRMADO', now(), $2, now())
       ON CONFLICT (codent) DO UPDATE SET
         status = 'PRECO_CONFIRMADO', data_confirmacao_preco = now(),
         observacao_preco = EXCLUDED.observacao_preco, updated_at = now()`,
      [id, observacao || null]
    );

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: `Preço confirmado. ${r.produtosAtualizados} produto(s) com custo/preço atualizados.`,
    });
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Erro ao confirmar preço:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Falha ao confirmar preço.',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

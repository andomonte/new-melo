import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * POST /api/faturamento/fechar-vendas  { codvendas: string[], usuario }
 *
 * Fecha (status='F') vendas NÃO FATURADAS — espelha VENDAS_OPERACOES.Fechar_Venda
 * do Delphi (dbVenda.Status='F' + registro/log). Fechamento administrativo: NÃO
 * emite NF-e nem gera fatura, só tira a venda da lista de pendentes.
 * Só fecha vendas que estão de fato não faturadas e não canceladas.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido. Use POST.' });
  }
  const { codvendas, usuario } = req.body || {};
  const lista: string[] = Array.isArray(codvendas)
    ? codvendas.map((x) => String(x)).filter(Boolean)
    : [];
  if (lista.length === 0) {
    return res.status(400).json({ erro: 'Informe ao menos uma venda.' });
  }
  const usuarioTxt = String(usuario ?? '').trim() || 'DESCONHECIDO';

  const client = await getPgPool().connect();
  try {
    await client.query('BEGIN');
    try {
      // Só fecha as que ainda estão não faturadas e não canceladas.
      const upd = await client.query(
        `UPDATE db_manaus.dbvenda
            SET status = 'F'
          WHERE codvenda = ANY($1)
            AND status IN ('0','N','I','S','1','D','2','L')
            AND (cancel IS NULL OR cancel <> 'S')
          RETURNING codvenda`,
        [lista],
      );
      const fechadas: string[] = upd.rows.map((r) => r.codvenda);

      // Log por venda (espelha inc_acao_usr 'FECHAR VENDA' / 'DBVENDA').
      for (const cv of fechadas) {
        await client.query(
          `INSERT INTO db_manaus.dbacao (codusr, acao, tabela, obs, data)
           VALUES ($1, 'FECHAR VENDA', 'DBVENDA', $2, now())`,
          [usuarioTxt.substring(0, 60), `COD:${cv}`.substring(0, 255)],
        );
      }

      await client.query('COMMIT');
      return res.status(200).json({
        sucesso: true,
        fechadas: fechadas.length,
        ignoradas: lista.length - fechadas.length,
        vendas: fechadas,
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  } catch (error: any) {
    console.error('Erro ao fechar vendas:', error);
    return res
      .status(500)
      .json({ erro: 'Erro ao fechar vendas.', detalhes: error?.message });
  } finally {
    client.release();
  }
}

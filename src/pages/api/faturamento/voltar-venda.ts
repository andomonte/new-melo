import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * POST /api/faturamento/voltar-venda  { codvendas: string[], usuario }
 *
 * Desfaz o FECHAMENTO ADMINISTRATIVO de vendas — espelha VENDAS_OPERACOES.Voltar_Venda:
 *   - só reverte quem foi fechada via "Fechar Venda" (existe registro em dbfecharvendas
 *     com codfat NULL); uma venda realmente faturada (status='F' sem esse registro) NÃO volta;
 *   - deleta o registro de dbfecharvendas e volta dbvenda.status para 'I' (IMPRESSO);
 *   - loga a ação 'VOLTAR VENDA'.
 * Bloqueios (fiéis ao Delphi): "Venda Faturada" (F sem registro), "Venda Cancelada"
 * (cancel='S'), "Venda Bloqueada" (status='B').
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
      const revertidas: string[] = [];
      const ignoradas: Array<{ codvenda: string; motivo: string }> = [];

      for (const codvenda of lista) {
        const v = await client.query(
          `SELECT status, cancel FROM dbvenda WHERE codvenda = $1 FOR UPDATE`,
          [codvenda],
        );
        if (v.rows.length === 0) {
          ignoradas.push({ codvenda, motivo: 'Venda não encontrada' });
          continue;
        }
        const status = String(v.rows[0].status ?? '');
        const cancel = String(v.rows[0].cancel ?? '');

        const fv = await client.query(
          `SELECT COUNT(*)::int AS n FROM dbfecharvendas
            WHERE codvenda = $1 AND codfat IS NULL`,
          [codvenda],
        );
        const temRegistroReversivel = (fv.rows[0]?.n ?? 0) > 0;

        // Fiel ao Voltar_Venda: bloqueios primeiro.
        if (status === 'F' && !temRegistroReversivel) {
          ignoradas.push({ codvenda, motivo: 'Venda Faturada' });
          continue;
        }
        if (cancel === 'S') {
          ignoradas.push({ codvenda, motivo: 'Venda Cancelada' });
          continue;
        }
        if (status === 'B') {
          ignoradas.push({ codvenda, motivo: 'Venda Bloqueada' });
          continue;
        }

        // Reverte: apaga o registro de fechamento e volta o status para 'I' (IMPRESSO).
        await client.query(
          `DELETE FROM dbfecharvendas WHERE codvenda = $1 AND codfat IS NULL`,
          [codvenda],
        );
        await client.query(
          `UPDATE dbvenda SET status = 'I' WHERE codvenda = $1`,
          [codvenda],
        );
        await client.query(
          `INSERT INTO dbacao (codusr, acao, tabela, obs, data)
           VALUES ($1, 'VOLTAR VENDA', 'DBFECHARVENDAS', $2, now())`,
          [usuarioTxt.substring(0, 60), `COD:${codvenda}`.substring(0, 255)],
        );
        revertidas.push(codvenda);
      }

      await client.query('COMMIT');
      return res.status(200).json({
        sucesso: true,
        revertidas: revertidas.length,
        ignoradas: ignoradas.length,
        vendas: revertidas,
        detalhes: ignoradas,
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  } catch (error: any) {
    console.error('Erro ao voltar vendas:', error);
    return res
      .status(500)
      .json({ erro: 'Erro ao voltar vendas.', detalhes: error?.message });
  } finally {
    client.release();
  }
}

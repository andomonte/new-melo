import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pg';
import { AjusteParcelamentoError, ajustarParcelamento, grupoDoTitulo } from '@/lib/contasPagar/ajusteParcelamento';

/**
 * Ajustar parcelamento do título (regras em src/lib/contasPagar/ajusteParcelamento.ts).
 *   GET  → { base, formato, parcelas[], total, bloqueios[] }  (bloqueios = motivos que impedem o ajuste)
 *   POST { parcelas: [{ cod_pgto?, dt_venc, valor }], usuario? } → novo parcelamento (soma = total atual)
 */
const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const bruto = String(req.query.id || '').trim();
  if (!bruto) return res.status(400).json({ erro: 'Título não informado.' });
  // a tela manda o código como número (27893); cod_pgto tem 9 dígitos
  const id = /^\d{1,8}$/.test(bruto) ? bruto.padStart(9, '0') : bruto;

  if (req.method === 'GET') {
    const db = await pool.connect();
    try {
      const { modelo, ...g } = await grupoDoTitulo(db, id);
      return res.status(200).json({ ...g, eh_internacional: modelo.eh_internacional === 'S', moeda: modelo.moeda || null });
    } catch (e: any) {
      if (e instanceof AjusteParcelamentoError) return res.status(400).json({ erro: e.message });
      console.error('Erro ao carregar parcelamento:', e);
      return res.status(500).json({ erro: 'Erro ao carregar o parcelamento.' });
    } finally {
      db.release();
    }
  }

  if (req.method === 'POST') {
    const { parcelas, usuario } = req.body || {};
    const quem = usuario || parseCookies({ req }).userName || 'Sistema';
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      const r = await ajustarParcelamento(db, id, parcelas, quem);
      await db.query('COMMIT');
      return res.status(200).json({ sucesso: true, ...r });
    } catch (e: any) {
      await db.query('ROLLBACK').catch(() => undefined);
      if (e instanceof AjusteParcelamentoError) return res.status(400).json({ erro: e.message });
      console.error('Erro ao ajustar parcelamento:', e);
      return res.status(500).json({ erro: 'Erro ao ajustar o parcelamento.', detalhes: e?.message });
    } finally {
      db.release();
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ erro: 'Método não permitido' });
}

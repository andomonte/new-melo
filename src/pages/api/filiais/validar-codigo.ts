import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';

/**
 * Valida o CÓDIGO DE ACESSO de uma filial (segredo compartilhado do setor),
 * usado para destravar as telas soltas (Separação/Conferência/TV) ao abrir e
 * ao trocar de filial. Não é login pessoal.
 *
 * tb_filial é central (db_manaus). Se a filial não tiver código configurado
 * (NULL/vazio), retorna { ok:true, exigeCodigo:false } — abre sem pedir.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const filial = String(req.body?.filial ?? '').trim();
  const codigo = String(req.body?.codigo ?? '').trim();
  if (!filial) return res.status(400).json({ ok: false, error: 'Filial não informada.' });

  const pool = getPgPool('MANAUS');
  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    const r = await client.query(
      `SELECT codigo_acesso FROM tb_filial WHERE nome_filial = $1 LIMIT 1`,
      [filial],
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Filial não encontrada.' });
    }

    const codigoFilial = String(r.rows[0].codigo_acesso ?? '').trim();
    if (!codigoFilial) {
      // Filial sem código configurado → abre sem gate
      return res.status(200).json({ ok: true, exigeCodigo: false });
    }

    if (codigo === codigoFilial) {
      return res.status(200).json({ ok: true, exigeCodigo: true });
    }
    return res.status(401).json({ ok: false, exigeCodigo: true, error: 'Código da filial incorreto.' });
  } catch (error) {
    console.error('Erro em filiais/validar-codigo:', error);
    return res.status(500).json({ ok: false, error: 'Erro interno do servidor' });
  } finally {
    if (client) try { client.release(); } catch {}
  }
}

import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * Desativa / Ativa produtos (individual ou em massa).
 *
 * Regra validada no Delphi: produto não é excluído, é DESATIVADO gravando
 * inf='D' (status reconhecido por Ordem de Compra, Entrada, etc.). Ativar volta
 * inf='-' (SEM INFORMATIVO) — a classificação original do inf se perde ao
 * desativar, é limitação aceita. Ver memória produto-status-ativo-inativo.
 *
 * POST /api/produtos/status
 * Body: { codprods: string[], acao: 'desativar' | 'ativar' }
 */
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { codprods, acao } = req.body as {
    codprods?: unknown;
    acao?: unknown;
  };

  const lista = Array.isArray(codprods)
    ? codprods.map((c) => String(c).trim()).filter(Boolean)
    : [];

  if (lista.length === 0) {
    return res.status(400).json({ error: 'Nenhum produto informado.' });
  }
  if (acao !== 'desativar' && acao !== 'ativar') {
    return res.status(400).json({ error: 'Ação inválida (use desativar/ativar).' });
  }

  // desativar => inf='D'; ativar => inf='-' (SEM INFORMATIVO)
  const novoInf = acao === 'desativar' ? 'D' : '-';

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `UPDATE dbprod
          SET inf = $1
        WHERE codprod = ANY($2::text[])`,
      [novoInf, lista],
    );
    await client.query('COMMIT');

    return res.status(200).json({
      ok: true,
      acao,
      afetados: r.rowCount ?? 0,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Erro ao alterar status de produto:', error);
    return res.status(500).json({ error: error.message || 'Erro ao alterar status' });
  } finally {
    client.release();
  }
}

/**
 * POST /api/importacao/[id]/gerar-fatura-nacionalizacao
 *
 * Cria (ou reaproveita) a FATURA da nota de nacionalização pela VIA NACIONAL
 * (dbvenda+dbitvenda+dbfatura+dbprodfat+fatura_venda), marcada com importacao_id.
 * NÃO transmite — a emissão em si é feita pelo `/api/faturamento/emitir-faturado`
 * com o { codfat } devolvido aqui (que, pelo desvio de importacao_id, monta o XML
 * pelo builder de importação). Assim 1ª emissão e reemissão usam o mesmo caminho.
 *
 * Resposta: { success, codfat, serie, nroform, jaExistia }
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import type { PoolClient } from 'pg';
import { gerarFaturaNacionalizacao } from '@/lib/importacao/gerarFaturaNacionalizacao';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

  const importacaoId = parseInt(String(req.query.id), 10);
  if (!importacaoId) return res.status(400).json({ message: 'ID de importação inválido' });

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS';
  const pool = getPgPool(filial);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const fat = await gerarFaturaNacionalizacao(client, importacaoId, {
      codusr: (req.body?.codusr ? String(req.body.codusr) : undefined),
    });
    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      codfat: fat.codfat,
      serie: fat.serie,
      nroform: fat.nroform,
      jaExistia: fat.jaExistia,
    });
  } catch (e: any) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('[gerar-fatura-nacionalizacao] erro:', e);
    return res.status(500).json({ message: e.message || 'Erro ao gerar a fatura de nacionalização' });
  } finally {
    if (client) client.release();
  }
}

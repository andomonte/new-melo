// pages/api/tipoOperacaoFiscal/movimentacoes.ts
// Lista as movimentações fiscais (catálogo de referência) — para o dropdown do form.
import { NextApiRequest, NextApiResponse } from 'next';
import { queryWithRelease } from '@/lib/pg';

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
  try {
    const result = await queryWithRelease(
      `SELECT codigo, descricao FROM "cad_tipo_movimentacao" WHERE ativo = true ORDER BY ordem ASC`,
    );
    res.status(200).json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro interno do servidor', message: error.message });
  }
}

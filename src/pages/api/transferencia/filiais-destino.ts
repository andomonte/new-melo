import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * GET /api/transferencia/filiais-destino
 * Lista as filiais destino (cada uma é um cliente em dbclien_filial). Usado no seletor
 * de destino da tela de transferência. Ver docs/transferencia/spec-transferencia-filial.md.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido.' });
  const client = await getPgPool().connect();
  try {
    const r = await client.query(
      `SELECT codcli, sigla, nome, nomefant, cpfcgc, cidade, uf, status
         FROM dbclien_filial
        ORDER BY sigla`,
    );
    return res.status(200).json({
      filiais: r.rows.map((x) => ({
        codcli: x.codcli,
        sigla: x.sigla,
        nome: x.nomefant || x.nome,
        cpfcgc: x.cpfcgc,
        cidade: x.cidade,
        uf: x.uf,
        ativo: x.status === '1',
      })),
    });
  } catch (error: any) {
    console.error('Erro ao listar filiais destino:', error);
    return res.status(500).json({ erro: 'Erro ao listar filiais destino', detalhes: error.message });
  } finally {
    client.release();
  }
}

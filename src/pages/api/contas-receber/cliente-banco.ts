import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();

/**
 * GET /api/contas-receber/cliente-banco?codcli=X
 *
 * Retorna o banco de cobrança padrão do cliente para pré-preencher o Novo Título.
 * Fiel ao fluxo do faturamento: dbbanco_cobranca.banco = dbclien.banco + 1
 * (dbclien.banco guarda o índice 0-based do radio do Delphi; o dropdown é 1-based).
 * Ex.: dbclien.banco='4' (MELO) → dropdown '5'.
 *
 * Responde { banco: '1'..'9' | null }.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
  }
  const codcli = String(req.query.codcli || '').trim();
  if (!codcli) return res.status(400).json({ erro: 'Informe o codcli.' });

  try {
    const r = await pool.query(
      `SELECT banco FROM dbclien WHERE CAST(codcli AS TEXT) = $1 LIMIT 1`,
      [codcli],
    );
    const bruto = r.rows[0]?.banco;
    let banco: string | null = null;
    if (bruto !== null && bruto !== undefined && String(bruto).trim() !== '') {
      const n = parseInt(String(bruto), 10);
      if (!isNaN(n)) {
        const dropdown = n + 1; // offset do cadastro → dropdown de cobrança
        if (dropdown >= 1 && dropdown <= 9) banco = String(dropdown);
      }
    }
    return res.status(200).json({ codcli, banco });
  } catch (error) {
    console.error('Erro ao buscar banco do cliente:', error);
    return res
      .status(500)
      .json({ erro: 'Erro ao buscar banco do cliente', mensagem: error instanceof Error ? error.message : 'Erro' });
  }
}

import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPoolFilial } from '@/lib/pg';
import { enfileirarImpressaoComprovante } from '@/lib/impressao/filaImpressao';

/**
 * POST /api/caixa/imprimir-comprovante  { aut_id, fila? }
 * Enfileira o comprovante de pagamento (fin_autenticacao.aut_id) para o Robô de
 * Impressão imprimir (imp_tipo='COMPROVANTE'). Chamado quando o operador confirma
 * "Deseja imprimir o comprovante?" ao fim do recebimento (fiel ao Delphi).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });
  const autId = String(req.body?.aut_id || '').trim();
  const fila = Number(req.body?.fila) || 1;
  if (!autId) return res.status(400).json({ erro: 'Informe aut_id.' });

  const pool = await getPgPoolFilial(req);
  const client = await pool.connect();
  try {
    const enfileirado = await enfileirarImpressaoComprovante(client, autId, { fila });
    // A fila nunca lança: `false` pode ser "já pendente" ou falha. Confere qual dos dois.
    if (!enfileirado) {
      const pendente = await client.query(
        `SELECT 1 FROM fin_impressao
          WHERE imp_aut_id = $1 AND imp_tipo = 'COMPROVANTE' AND imp_impresso = 'N' LIMIT 1`,
        [autId],
      );
      if (pendente.rows.length === 0) {
        return res.status(500).json({ erro: 'Não foi possível enviar o comprovante para a fila de impressão.' });
      }
      return res.status(200).json({ sucesso: true, enfileirado: false, jaNaFila: true });
    }
    return res.status(200).json({ sucesso: true, enfileirado: true });
  } catch (error: any) {
    console.error('Erro ao enfileirar comprovante:', error);
    return res.status(500).json({ erro: 'Erro ao enfileirar comprovante', detalhes: error.message });
  } finally {
    client.release();
  }
}

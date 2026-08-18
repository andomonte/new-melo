import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { inserirCobranca } from '@/lib/faturamento/inserirCobranca';

// Endpoint standalone para gravar/atualizar a cobrança de uma fatura JÁ existente
// (edição de cobrança na Consulta de Faturas). O fluxo de emissão normal NÃO usa
// mais este endpoint — lá a cobrança vai junto com a fatura em salvar.ts (transação
// única). Aqui abrimos a própria transação para manter atomicidade (dbreceb+dbprazo).
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { codfat, codcli, banco, tipofat, parcelas, codvenda } = req.body;

  if (!codfat || !codcli) {
    return res.status(400).json({ error: 'codfat e codcli são obrigatórios.' });
  }

  let client;
  try {
    client = await getPgPool().connect();
    await client.query('BEGIN');

    await inserirCobranca(client, {
      codfat,
      codcli,
      banco,
      tipofat,
      codvenda,
      parcelas: Array.isArray(parcelas) ? parcelas : [],
    });

    await client.query('COMMIT');
    return res.status(200).json({ message: 'Cobrança salva com sucesso.' });
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {}
    }
    console.error('Erro ao salvar cobrança:', error);
    return res.status(500).json({
      error: `Erro ao salvar cobrança: ${(error as Error)?.message || 'erro desconhecido'}`,
    });
  } finally {
    if (client) client.release();
  }
}

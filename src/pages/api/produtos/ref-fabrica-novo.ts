import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

/**
 * Cria uma nova Referência de Fábrica (tabela dbref_fabrica) — equivalente ao
 * botão "NOVO" do Delphi. Se já existir uma referência igual (mesma
 * referencia + marca + credor), retorna a existente em vez de duplicar.
 * Não vincula ao produto aqui; o vínculo é gravado ao salvar o produto
 * (update.ts sincroniza dbprod_ref_fabrica).
 */
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const referencia = String(req.body?.referencia ?? '').trim().toUpperCase();
  const codmarca = String(req.body?.codmarca ?? '').trim();
  // credor é opcional; mantemos string vazia (não null) para casar com o
  // match do update.ts (WHERE codcredor = $3).
  const codcredor = String(req.body?.codcredor ?? '').trim();

  if (!referencia) {
    return res.status(400).json({ error: 'Referência é obrigatória.' });
  }
  if (!codmarca) {
    return res.status(400).json({ error: 'Marca é obrigatória.' });
  }

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    // Já existe? devolve sem duplicar
    const existente = await client.query(
      `SELECT rf.cod_id, rf.referencia, rf.codmarca, rf.codcredor, m.descr AS marca_nome
         FROM dbref_fabrica rf
         LEFT JOIN dbmarcas m ON m.codmarca = rf.codmarca
        WHERE rf.referencia = $1 AND rf.codmarca = $2 AND COALESCE(rf.codcredor,'') = $3
        LIMIT 1`,
      [referencia, codmarca, codcredor],
    );

    if (existente.rowCount && existente.rowCount > 0) {
      return res.status(200).json({
        referencia: serializeBigInt(existente.rows[0]),
        criada: false,
      });
    }

    // Novo cod_id = MAX + 1
    const maxId = await client.query(
      'SELECT COALESCE(MAX(cod_id), 0) + 1 AS next_id FROM dbref_fabrica',
    );
    const codId = maxId.rows[0].next_id;

    await client.query(
      `INSERT INTO dbref_fabrica (cod_id, codmarca, referencia, codcredor)
       VALUES ($1, $2, $3, $4)`,
      [codId, codmarca, referencia, codcredor],
    );

    const criada = await client.query(
      `SELECT rf.cod_id, rf.referencia, rf.codmarca, rf.codcredor, m.descr AS marca_nome
         FROM dbref_fabrica rf
         LEFT JOIN dbmarcas m ON m.codmarca = rf.codmarca
        WHERE rf.cod_id = $1`,
      [codId],
    );

    return res.status(201).json({
      referencia: serializeBigInt(criada.rows[0]),
      criada: true,
    });
  } catch (error: any) {
    console.error('Erro ao criar referência de fábrica:', error.message);
    return res
      .status(500)
      .json({ error: error.message || 'Erro ao criar referência' });
  } finally {
    client.release();
  }
}

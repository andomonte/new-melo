import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { NextApiRequest, NextApiResponse } from 'next';

// Defina a interface para o dado de prazo para maior segurança
interface ParcelaItem {
  id: number;
  dataVencimento: string; // Mudado para string para facilitar o transporte via JSON
  dias: number;
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  let client: PoolClient | undefined;

  try {
    const pool = getPgPool();
    client = await pool.connect();
    // Inicia a transação
    await client.query('BEGIN');

    const vendaData = req.body;
    const prazosArray: ParcelaItem[] = vendaData.prazos;

    // Remove o array de prazos do objeto principal para não tentar inseri-lo na dbvenda
    delete vendaData.prazos;

    // --- Inserção na tabela dbvenda (o seu código original) ---
    const fields = Object.keys(vendaData);
    const values = Object.values(vendaData);
    const placeholders = fields.map((_, index) => `$${index + 1}`).join(', ');
    const fieldNames = fields.map((field) => `"${field}"`).join(', ');

    const insertVendaQuery = `
      INSERT INTO db_manaus.dbvenda (${fieldNames})
      VALUES (${placeholders})
      RETURNING *
    `;
    const resultVenda = await client.query(insertVendaQuery, values);
    const idVenda = resultVenda.rows[0].id; // Pega o ID da venda recém-criada

    // --- NOVA SEÇÃO: Inserção na tabela prazopagamento ---
    if (prazosArray && prazosArray.length > 0) {
      for (const prazo of prazosArray) {
        const insertPrazoQuery = `
          INSERT INTO db_manaus.prazopagamento (id_venda, data, dia)
          VALUES ($1, $2, $3)
        `;
        // O id_venda será o id da venda principal para relacionar
        const prazoValues = [idVenda, prazo.dataVencimento, prazo.dias];
        await client.query(insertPrazoQuery, prazoValues);
      }
    }
    // --- Fim da nova seção ---

    // Finaliza a transação
    await client.query('COMMIT');

    res
      .status(200)
      .json({ message: 'Venda criada com sucesso', data: resultVenda.rows[0] });
  } catch (error: any) {
    // Em caso de qualquer erro, desfaz todas as operações da transação
    await client?.query('ROLLBACK');
    console.error('Erro ao finalizar venda:', error);
    res.status(400).json({ error: 'Erro ao criar venda no banco' });
  } finally {
    if (client) {
      // Libera o cliente de volta para o pool
      client.release();
    }
  }
}

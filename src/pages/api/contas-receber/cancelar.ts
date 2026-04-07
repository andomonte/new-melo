import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido. Use POST.' });
  }

  const client = await pool.connect();

  try {
    const { cod_receb, motivo } = req.body;

    if (!cod_receb) {
      return res.status(400).json({ erro: 'cod_receb é obrigatório' });
    }

    // Validar se o título existe e não está já cancelado
    const verificarQuery = `
      SELECT 
        cod_receb, 
        cancel,
        rec,
        bradesco
      FROM db_manaus.dbreceb
      WHERE cod_receb = $1
    `;
    
    const verificarResult = await client.query(verificarQuery, [cod_receb]);

    if (verificarResult.rows.length === 0) {
      return res.status(404).json({ erro: 'Título não encontrado' });
    }

    const titulo = verificarResult.rows[0];

    if (titulo.cancel === 'S') {
      return res.status(400).json({ erro: 'Título já está cancelado' });
    }

    if (titulo.rec === 'S') {
      return res.status(400).json({ erro: 'Não é possível cancelar título já recebido. Retire a baixa primeiro.' });
    }

    // ✅ Validar se título já foi enviado ao banco (Oracle business rule)
    if (titulo.bradesco === 'S' || titulo.bradesco === 'B') {
      return res.status(400).json({ 
        erro: 'Não é possível cancelar título que já foi enviado ao banco.',
        detalhes: titulo.bradesco === 'S' 
          ? 'Título está em remessa bancária aguardando retorno' 
          : 'Título já foi baixado pelo banco'
      });
    }

    // Iniciar transação
    await client.query('BEGIN');

    // Cancelar título
    const updateQuery = `
      UPDATE db_manaus.dbreceb
      SET 
        cancel = 'S'
      WHERE cod_receb = $1
      RETURNING *
    `;

    const updateResult = await client.query(updateQuery, [cod_receb]);

    // Registrar no histórico
    const historicoQuery = `
      INSERT INTO db_manaus.dbfreceb (
        cod_freceb,
        cod_receb,
        valor,
        dt_pgto,
        dt_emissao,
        tipo,
        sf,
        nome
      ) VALUES (
        (SELECT COALESCE(MAX(CAST(cod_freceb AS INTEGER)), 0) + 1 FROM db_manaus.dbfreceb WHERE cod_receb = $1),
        $1,
        0,
        CURRENT_DATE,
        CURRENT_DATE,
        'C',
        'N',
        $2
      )
    `;

    await client.query(historicoQuery, [
      cod_receb,
      motivo || 'Cancelamento via sistema'
    ]);

    await client.query('COMMIT');

    return res.status(200).json({
      sucesso: true,
      mensagem: 'Título cancelado com sucesso',
      titulo: updateResult.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao cancelar título:', error);
    return res.status(500).json({
      erro: 'Erro interno do servidor',
      detalhes: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  } finally {
    client.release();
  }
}

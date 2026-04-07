import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * API para gerenciar sugestões de compra
 *
 * POST /api/produtos/sugestao-compra
 * Body: {
 *   produto_cod: string,
 *   produto_descricao?: string,
 *   quantidade_sugerida: number,
 *   data_necessidade?: string (YYYY-MM-DD),
 *   usuario_cod?: string,
 *   usuario_nome?: string,
 *   observacao?: string
 * }
 *
 * DELETE /api/produtos/sugestao-compra?id=XXX
 */
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const pool = getPgPool();

  if (req.method === 'POST') {
    const {
      produto_cod,
      produto_descricao,
      quantidade_sugerida,
      data_necessidade,
      usuario_cod,
      usuario_nome,
      observacao,
    } = req.body;

    if (!produto_cod) {
      return res.status(400).json({ error: 'Código do produto é obrigatório' });
    }

    if (!quantidade_sugerida || quantidade_sugerida <= 0) {
      return res.status(400).json({ error: 'Quantidade deve ser maior que zero' });
    }

    try {
      const query = `
        INSERT INTO sugestoes_compra (
          produto_cod,
          produto_descricao,
          quantidade_sugerida,
          data_necessidade,
          usuario_cod,
          usuario_nome,
          observacao,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDENTE')
        RETURNING *
      `;

      const result = await pool.query(query, [
        produto_cod,
        produto_descricao || null,
        quantidade_sugerida,
        data_necessidade || null,
        usuario_cod || null,
        usuario_nome || null,
        observacao || null,
      ]);

      return res.status(201).json({
        success: true,
        sugestao: result.rows[0],
        message: 'Sugestão de compra registrada com sucesso',
      });
    } catch (error: any) {
      console.error('Erro ao criar sugestão de compra:', error);
      return res.status(500).json({
        error: 'Erro ao criar sugestão de compra',
        message: error.message,
      });
    }
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'ID da sugestão é obrigatório' });
    }

    try {
      const query = `
        DELETE FROM sugestoes_compra
        WHERE id = $1
        RETURNING *
      `;

      const result = await pool.query(query, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Sugestão não encontrada' });
      }

      return res.status(200).json({
        success: true,
        message: 'Sugestão removida com sucesso',
      });
    } catch (error: any) {
      console.error('Erro ao remover sugestão:', error);
      return res.status(500).json({
        error: 'Erro ao remover sugestão',
        message: error.message,
      });
    }
  }

  if (req.method === 'PUT') {
    const { id } = req.query;
    const { status } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'ID da sugestão é obrigatório' });
    }

    try {
      const query = `
        UPDATE sugestoes_compra
        SET status = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await pool.query(query, [id, status || 'ATENDIDO']);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Sugestão não encontrada' });
      }

      return res.status(200).json({
        success: true,
        sugestao: result.rows[0],
        message: 'Sugestão atualizada com sucesso',
      });
    } catch (error: any) {
      console.error('Erro ao atualizar sugestão:', error);
      return res.status(500).json({
        error: 'Erro ao atualizar sugestão',
        message: error.message,
      });
    }
  }

  return res.status(405).json({ error: 'Método não permitido' });
}

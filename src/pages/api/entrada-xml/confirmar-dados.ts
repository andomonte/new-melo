import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

interface NFeConfirmationData {
  nfeId: string;
  operacao: string;
  compradorId: string;
  fornecedorId: string;
  transportadoraId: string;
  calculoCusto: boolean;
  devolucao: boolean;
  nfeComplementar: boolean;
}

interface ConfirmarDadosResponse {
  success: boolean;
  message: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ConfirmarDadosResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const dados: NFeConfirmationData = req.body;

  if (!dados.nfeId || !dados.compradorId) {
    return res.status(400).json({ 
      error: 'NFE ID e Comprador são obrigatórios' 
    });
  }

  let client;
  
  try {
    client = await pool.connect();
    
    // Iniciar transação
    await client.query('BEGIN');
    
    // Salvar dados de confirmação na tabela de entrada NFe
    const updateQuery = `
      UPDATE nfe_entrada 
      SET 
        operacao = $1,
        comprador_id = $2,
        fornecedor_id = $3,
        transportadora_id = $4,
        calculo_custo = $5,
        devolucao = $6,
        nfe_complementar = $7,
        status = 'DADOS_CONFIRMADOS',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
    `;

    const updateResult = await client.query(updateQuery, [
      dados.operacao,
      dados.compradorId,
      dados.fornecedorId,
      dados.transportadoraId,
      dados.calculoCusto,
      dados.devolucao,
      dados.nfeComplementar,
      dados.nfeId
    ]);

    if (updateResult.rowCount === 0) {
      throw new Error('NFe não encontrada');
    }

    // Log da operação
    await client.query(`
      INSERT INTO nfe_entrada_log (
        nfe_id, 
        acao, 
        descricao, 
        usuario_id,
        created_at
      ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    `, [
      dados.nfeId,
      'DADOS_CONFIRMADOS',
      `Dados da entrada confirmados - Operação: ${dados.operacao}`,
      dados.compradorId // Assumindo que compradorId representa o usuário logado
    ]);
    
    // Commit da transação
    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Dados da NFe confirmados com sucesso!'
    });
  } catch (err) {
    // Rollback da transação em caso de erro
    if (client) {
      await client.query('ROLLBACK');
    }
    
    console.error('Erro ao confirmar dados da NFe:', err);
    res.status(500).json({ 
      error: 'Falha ao confirmar dados da NFe.'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
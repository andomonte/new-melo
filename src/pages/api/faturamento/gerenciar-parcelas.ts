import { NextApiRequest, NextApiResponse } from 'next';
import {
  buscarParcelasPagamento,
  atualizarParcelaPagamento,
  salvarParcelasPagamento,
  removerParcelasPagamento
} from '@/utils/parcelasPagamento';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { method } = req;

  switch (method) {
    case 'GET':
      return await buscarParcelas(req, res);
    case 'POST':
      return await salvarParcelas(req, res);
    case 'PUT':
      return await atualizarParcela(req, res);
    case 'DELETE':
      return await removerParcelas(req, res);
    default:
      return res.status(405).json({ error: 'Método não permitido' });
  }
}

// Buscar parcelas de uma venda
async function buscarParcelas(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { codvenda } = req.query;

    if (!codvenda || typeof codvenda !== 'string') {
      return res.status(400).json({ error: 'Parâmetro codvenda é obrigatório' });
    }

    const parcelas = await buscarParcelasPagamento(codvenda);
    return res.status(200).json({ parcelas });
  } catch (error) {
    console.error('Erro ao buscar parcelas:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// Salvar parcelas para uma venda
async function salvarParcelas(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { codvenda, parcelas } = req.body;

    if (!codvenda || !parcelas || !Array.isArray(parcelas)) {
      return res.status(400).json({
        error: 'Parâmetros codvenda e parcelas são obrigatórios. Parcelas deve ser um array.'
      });
    }

    // Validar estrutura das parcelas
    for (const parcela of parcelas) {
      if (typeof parcela.dia !== 'number' || parcela.dia < 0) {
        return res.status(400).json({
          error: 'Cada parcela deve ter um campo "dia" numérico positivo'
        });
      }
    }

    await salvarParcelasPagamento(codvenda, parcelas);
    return res.status(201).json({ message: 'Parcelas salvas com sucesso' });
  } catch (error) {
    console.error('Erro ao salvar parcelas:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// Atualizar uma parcela específica
async function atualizarParcela(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { id, dia } = req.body;

    if (!id || typeof id !== 'number') {
      return res.status(400).json({ error: 'Parâmetro id é obrigatório e deve ser numérico' });
    }

    if (typeof dia !== 'number' || dia < 0) {
      return res.status(400).json({ error: 'Parâmetro dia é obrigatório e deve ser numérico positivo' });
    }

    await atualizarParcelaPagamento(id, dia);
    return res.status(200).json({ message: 'Parcela atualizada com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar parcela:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// Remover todas as parcelas de uma venda
async function removerParcelas(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { codvenda } = req.query;

    if (!codvenda || typeof codvenda !== 'string') {
      return res.status(400).json({ error: 'Parâmetro codvenda é obrigatório' });
    }

    await removerParcelasPagamento(codvenda);
    return res.status(200).json({ message: 'Parcelas removidas com sucesso' });
  } catch (error) {
    console.error('Erro ao remover parcelas:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
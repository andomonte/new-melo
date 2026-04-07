// src/pages/api/impostos/calculadora-governo.ts
/**
 * API para calcular impostos usando a Calculadora Tributária do Governo Federal
 * Endpoint: POST /api/impostos/calculadora-governo
 * Aceita dados manuais sem necessidade de consultar banco de dados
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import {
  calcularImpostosGoverno,
  type CalculadoraTributariaRequest,
} from '@/services/calculadoraTributaria';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const {
      ncm,
      cest,
      quantidade = 1,
      valorUnitario,
      descricaoProduto,
      ufOrigem,
      ufDestino,
      tipoOperacao,
      finalidade,
      regimeTributario,
    } = req.body;

    // Validações básicas
    if (!ncm || ncm.length < 8) {
      return res.status(400).json({ 
        error: 'NCM é obrigatório e deve ter 8 dígitos' 
      });
    }

    if (!valorUnitario || valorUnitario <= 0) {
      return res.status(400).json({ 
        error: 'valorUnitario inválido' 
      });
    }

    if (!ufOrigem || !ufDestino) {
      return res.status(400).json({ 
        error: 'UF de origem e destino são obrigatórias' 
      });
    }

    // Calcular valor total da operação
    const valorOperacao = parseFloat(
      (parseFloat(quantidade) * parseFloat(valorUnitario)).toFixed(2)
    );

    // Preparar requisição para a API do governo
    const requestParams: CalculadoraTributariaRequest = {
      ncm: ncm.replace(/\D/g, '').substring(0, 8).padEnd(8, '0'),
      cest: cest || undefined,
      valorOperacao,
      quantidadeComercial: parseFloat(quantidade),
      ufOrigem: ufOrigem.toUpperCase(),
      ufDestino: ufDestino.toUpperCase(),
      tipoOperacao: tipoOperacao || 'venda',
      finalidade: finalidade || 'consumo',
      regimeTributario: regimeTributario || 'simples_nacional',
    };

    // Chamar a API da Calculadora Tributária
    const resultado = await calcularImpostosGoverno(requestParams);

    // Retornar resultado
    return res.status(200).json({
      sucesso: resultado.sucesso,
      produto: {
        descricao: descricaoProduto || 'Produto',
        ncm: requestParams.ncm,
        cest: requestParams.cest,
      },
      operacao: {
        quantidade: parseFloat(quantidade),
        valorUnitario: parseFloat(valorUnitario),
        valorTotal: valorOperacao,
        ufOrigem: requestParams.ufOrigem,
        ufDestino: requestParams.ufDestino,
      },
      impostos: resultado.impostos,
      totalImpostos: resultado.totalImpostos,
      valorTotalComImpostos: resultado.valorTotal,
      detalhes: resultado.detalhes,
      erro: resultado.erro,
    });
  } catch (error) {
    console.error('Erro ao calcular impostos:', error);
    return res.status(500).json({
      error: 'Erro ao calcular impostos',
      detalhes: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}

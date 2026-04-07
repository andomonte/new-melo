import { NextApiRequest, NextApiResponse } from 'next';
import { calcularJurosTitulo } from '@/lib/oracleService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido. Use POST.' });
  }

  try {
    const { valor_pgto, dt_venc, taxa_juros = 8 } = req.body;

    if (!valor_pgto || !dt_venc) {
      return res.status(400).json({ 
        erro: 'Parâmetros obrigatórios: valor_pgto e dt_venc' 
      });
    }

    const resultado = calcularJurosTitulo(
      parseFloat(valor_pgto),
      new Date(dt_venc),
      taxa_juros
    );

    res.status(200).json({
      sucesso: true,
      valor_original: parseFloat(valor_pgto),
      dt_venc: dt_venc,
      taxa_juros_mensal: taxa_juros,
      taxa_juros_diaria: taxa_juros / 3000,
      dias_atraso: resultado.dias,
      valor_juros: resultado.juros,
      valor_total: parseFloat(valor_pgto) + resultado.juros,
      atrasado: resultado.dias > 0
    });

  } catch (error: any) {
    console.error('❌ Erro ao calcular juros:', error);
    res.status(500).json({
      erro: 'Erro interno do servidor',
      detalhes: error.message
    });
  }
}

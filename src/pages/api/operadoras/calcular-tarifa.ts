import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

interface CalculoTarifa {
  codopera: string;
  descr_operadora: string;
  valorBruto: number;
  taxaPercentual: number;
  valorTaxa: number;
  valorLiquido: number;
  valorParcela: number;
  prazoRecebimento: number;
  numParcelas: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { codopera, valorTotal, numParcelas } = req.body;

  if (!codopera || !valorTotal || !numParcelas) {
    return res.status(400).json({ 
      error: 'Parâmetros obrigatórios: codopera, valorTotal, numParcelas' 
    });
  }

  const pool = getPgPool();

  try {
    // 1. Buscar dados da operadora
    const queryOperadora = `
      SELECT 
        codopera,
        descr,
        txopera,
        pzopera
      FROM db_manaus.dbopera
      WHERE codopera = $1
        AND COALESCE(desativado, 0) = 0
    `;

    const resultOperadora = await pool.query(queryOperadora, [codopera]);

    if (resultOperadora.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Operadora não encontrada ou desativada' 
      });
    }

    const operadora = resultOperadora.rows[0];
    const valorBruto = parseFloat(valorTotal);
    const taxaPercentual = parseFloat(operadora.txopera || 0);
    
    // 2. Calcular valores
    const valorTaxa = valorBruto * (taxaPercentual / 100);
    const valorLiquido = valorBruto - valorTaxa;
    const valorParcela = valorLiquido / parseInt(numParcelas);

    const calculo: CalculoTarifa = {
      codopera: operadora.codopera,
      descr_operadora: operadora.descr,
      valorBruto: parseFloat(valorBruto.toFixed(2)),
      taxaPercentual: parseFloat(taxaPercentual.toFixed(2)),
      valorTaxa: parseFloat(valorTaxa.toFixed(2)),
      valorLiquido: parseFloat(valorLiquido.toFixed(2)),
      valorParcela: parseFloat(valorParcela.toFixed(2)),
      prazoRecebimento: parseInt(operadora.pzopera || 0),
      numParcelas: parseInt(numParcelas)
    };

    return res.status(200).json(calculo);
  } catch (error: any) {
    console.error('Erro ao calcular tarifa:', error);
    return res.status(500).json({ 
      error: 'Erro ao calcular tarifa',
      details: error.message 
    });
  }
}

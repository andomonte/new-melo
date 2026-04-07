import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
  }

  try {
    const { cod_credor } = req.query;

    if (!cod_credor) {
      return res.status(400).json({ erro: 'cod_credor é obrigatório' });
    }

    // Buscar conta bancária e banco mais usados por este credor
    const resultConta = await pool.query(
      `
      SELECT 
        cod_conta,
        COUNT(*) as quantidade_uso,
        MAX(dt_pgto) as ultimo_uso
      FROM dbpgto
      WHERE (cod_credor = $1 OR cod_transp = $1)
        AND cod_conta IS NOT NULL
        AND paga = 'S'
      GROUP BY cod_conta
      ORDER BY quantidade_uso DESC, ultimo_uso DESC
      LIMIT 1
      `,
      [cod_credor]
    );

    // Buscar banco mais usado por este credor
    const resultBanco = await pool.query(
      `
      SELECT 
        banco,
        COUNT(*) as quantidade_uso,
        MAX(dt_pgto) as ultimo_uso
      FROM dbpgto
      WHERE (cod_credor = $1 OR cod_transp = $1)
        AND banco IS NOT NULL
        AND banco != ''
        AND paga = 'S'
      GROUP BY banco
      ORDER BY quantidade_uso DESC, ultimo_uso DESC
      LIMIT 1
      `,
      [cod_credor]
    );

    const response: any = {};

    if (resultConta.rows.length > 0) {
      response.cod_conta = resultConta.rows[0].cod_conta;
      response.cod_conta_uso = resultConta.rows[0].quantidade_uso;
      response.cod_conta_ultimo = resultConta.rows[0].ultimo_uso;
    } else {
      response.cod_conta = null;
    }

    if (resultBanco.rows.length > 0) {
      response.banco = resultBanco.rows[0].banco;
      response.banco_uso = resultBanco.rows[0].quantidade_uso;
      response.banco_ultimo = resultBanco.rows[0].ultimo_uso;
    } else {
      response.banco = null;
    }

    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Erro ao buscar conta preferencial:', error);
    return res.status(500).json({
      erro: 'Erro ao buscar conta preferencial',
      detalhes: error.message
    });
  }
}

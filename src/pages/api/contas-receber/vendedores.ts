// Busca de vendedores para o relatório "Em atraso no período" (escopo Vendedor).
//
// Mesmo contrato do /api/contas-receber/clientes (value/label), para o
// componente Autocomplete: o Delphi também escolhe o vendedor por consulta,
// não digitando o código.
//
// O filtro do relatório compara LTRIM(codvend,'0'), então tanto faz devolver
// '00150' ou '150' — aqui vai o código como está no cadastro.

import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
  }

  try {
    const { search = '' } = req.query;

    const query = `
      SELECT
        codvend AS value,
        CONCAT(codvend, ' - ', nome) AS label,
        nome
      FROM dbvend
      WHERE (
          CAST(codvend AS TEXT) LIKE $1
          OR UPPER(nome) LIKE UPPER($2)
        )
      ORDER BY nome
      LIMIT 50
    `;

    const searchPattern = `%${search}%`;
    const result = await pool.query(query, [searchPattern, searchPattern]);

    return res.status(200).json({
      sucesso: true,
      vendedores: result.rows,
    });
  } catch (error) {
    console.error('Erro ao buscar vendedores:', error);
    return res.status(500).json({
      erro: 'Erro ao buscar vendedores',
      mensagem: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}

// Lista de UFs para o filtro do relatório "Títulos Diário à Vista".
//
// No Delphi (UnitRelTituloAVista.dfm) a lista é fixa no formulário — as 27 UFs
// digitadas no Items.Strings do combo. Aqui vem da dbuf_n, que é o cadastro de
// UF do próprio sistema: mesma lista, sem duplicar constante no código, e já
// acompanha o cadastro se ele mudar.

import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
  }

  try {
    // dbuf_n tem as colunas em maiúsculas (precisam de aspas no Postgres).
    const { rows } = await pool.query(`
      SELECT "UF" AS value, "UF" || ' - ' || COALESCE("DESCRICAO", '') AS label
      FROM dbuf_n
      WHERE COALESCE("UF", '') <> ''
      ORDER BY "UF"
    `);

    return res.status(200).json({ sucesso: true, ufs: rows });
  } catch (error) {
    console.error('Erro ao buscar UFs:', error);
    return res.status(500).json({
      erro: 'Erro ao buscar UFs',
      mensagem: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}

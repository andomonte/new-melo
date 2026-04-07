import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  const pool = getPgPool(filial);
  const { search } = req.query;

  try {
    // Buscar bancos da tabela dbbanco com filtro opcional
    let query = `
      SELECT
        cod_banco as banco,
        nome
      FROM db_manaus.dbbanco
    `;

    const params: string[] = [];

    if (search && typeof search === 'string' && search.trim()) {
      query += ` WHERE UPPER(nome) LIKE UPPER($1)`;
      params.push(`%${search.trim()}%`);
    }

    query += ` ORDER BY nome ASC LIMIT 50`;

    const result = await pool.query(query, params);

    res.status(200).json(result.rows);

  } catch (error: any) {
    console.error("Erro ao buscar bancos:", error);

    // Se falhar, retornar lista padrão
    return res.status(200).json([
      { banco: '001', nome: 'Banco do Brasil' },
      { banco: '104', nome: 'Caixa Econômica Federal' },
      { banco: '237', nome: 'Bradesco' },
      { banco: '341', nome: 'Itaú' },
      { banco: '033', nome: 'Santander' },
      { banco: '748', nome: 'Sicredi' },
      { banco: '756', nome: 'Sicoob' },
      { banco: '212', nome: 'Banco Original' },
      { banco: '260', nome: 'Nu Pagamentos (Nubank)' },
      { banco: '077', nome: 'Banco Inter' },
    ]);
  }
}

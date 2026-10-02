import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPoolPorNomeFilial } from '@/lib/pg';
import { parseCookies } from 'nookies';

/**
 * Lista as contas de caixa (dbconta) para o select de "Operador" no cadastro de usuário
 * — equivalente ao /api/compradores/get, mas para a conta do operador de caixa.
 *
 * A filial vem por parâmetro (?filial=) e, na falta dele, do cookie. Quem
 * cadastra pode estar logado numa filial e montando a linha de outra, e a
 * dbconta é por schema — sem isso, o select oferece as contas da filial errada.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const search = String(req.query.search || '').trim();
  const cookies = parseCookies({ req });
  const filial = String(req.query.filial || cookies.filial_melo || '').trim();
  const pool = await getPgPoolPorNomeFilial(filial);
  const client = await pool.connect();
  try {
    const params: any[] = [];
    let where = '';
    if (search) {
      where = 'WHERE cod_conta ILIKE $1 OR UPPER(nro_conta) LIKE UPPER($1)';
      params.push(`%${search}%`);
    }
    // Sem busca → traz TODAS as contas (dbconta é pequena, ~133) para que uma conta já
    // salva no usuário sempre apareça no select ao editar (senão o valor não é exibido).
    const r = await client.query(
      `SELECT cod_conta, nro_conta FROM dbconta ${where} ORDER BY cod_conta LIMIT 500`,
      params,
    );
    return res.status(200).json({ data: r.rows });
  } catch (error: any) {
    console.error('Erro ao listar contas de caixa:', error);
    return res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
}

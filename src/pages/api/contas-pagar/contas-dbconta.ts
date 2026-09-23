import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  try {
    const { busca, search, limit } = req.query;
    const termoBusca = (busca || search) as string;
    // Limite configurável (o dropdown do modal de Pagamento carrega TODAS as contas de
    // uma vez p/ filtrar client-side; a busca-as-you-type do cadastro usa o default 50).
    const limiteNum = Math.min(Math.max(parseInt(String(limit ?? ''), 10) || 50, 1), 2000);
    const pool = getPgPool();

    let query = `
      SELECT 
        c.cod_conta,
        c.cod_banco,
        c.nro_conta,
        c.oficial,
        c.digito,
        b.nome as banco_nome,
        b.cod_bc as banco_codigo
      FROM dbconta c
      LEFT JOIN dbbanco b ON b.cod_banco = c.cod_banco
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;
    
    // Filtro por busca: casa com o CÓDIGO da conta, o Nº da conta OU o NOME do banco
    // (o "nome" exibido no combobox é banco_nome, ex.: "MANAUS - CENTRO", que antes
    // não era pesquisado — só o cod_conta/nro_conta batiam).
    if (termoBusca && typeof termoBusca === 'string' && termoBusca.trim() !== '') {
      const termo = `%${termoBusca.trim()}%`;
      query += ` AND (c.cod_conta ILIKE $${paramIndex} OR c.nro_conta ILIKE $${paramIndex} OR b.nome ILIKE $${paramIndex})`;
      params.push(termo);
      paramIndex++;
    }
    
    query += ` ORDER BY c.cod_conta LIMIT ${limiteNum}`;

    const result = await pool.query(query, params);

    return res.status(200).json({
      contas: result.rows.map(row => ({
        value: row.cod_conta,
        cod_conta: row.cod_conta,
        cod_banco: row.cod_banco,
        nro_conta: row.nro_conta,
        oficial: row.oficial,
        digito: row.digito,
        banco_nome: row.banco_nome,
        banco_codigo: row.banco_codigo,
        label: `${row.cod_conta} - ${row.nro_conta}${row.banco_nome ? ` | ${row.banco_nome}` : ''}`
      }))
    });

  } catch (error: any) {
    console.error('Erro ao buscar contas (dbconta):', error);
    return res.status(500).json({
      erro: 'Erro ao buscar contas',
      detalhes: error.message
    });
  }
}

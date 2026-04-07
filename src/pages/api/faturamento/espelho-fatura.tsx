import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { codfat } = req.query;

  if (!codfat || typeof codfat !== 'string') {
    return res.status(400).json({ error: 'Código da fatura é obrigatório.' });
  }

  try {
    const client = await getPgPool().connect();

    const query = `
      SELECT 
        f.*, 
        v.nome as nomevendedor,
        c.*,
        dv.*
      FROM dbfatura f
      LEFT JOIN dbvenda dv ON f.codcli = dv.codcli AND f.data = dv.data
      LEFT JOIN dbvend v ON f.codvend = v.codvend
      LEFT JOIN dbclien c ON f.codcli = c.codcli
      WHERE f.codfat = $1
      LIMIT 1;
    `;

    const result = await client.query(query, [codfat]);

    if (result.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Fatura não encontrada.' });
    }

    const f = result.rows[0];

    const queryProdutos = `
      SELECT 
        p.codprod, p.descr, p.ref as prodref, p.unimed,
        i.ref, i.qtd::numeric, i.prunit::numeric, i.desconto::numeric,
        (i.qtd * i.prunit)::numeric as total_item
      FROM dbfatura f
      LEFT JOIN dbvenda dv ON f.codcli = dv.codcli AND f.data = dv.data
      LEFT JOIN dbitvenda i ON i.codvenda = dv.codvenda
      LEFT JOIN dbprod p ON p.codprod = i.codprod
      WHERE f.codfat = $1
      ORDER BY i.ref;
    `;

    const produtos = await client.query(queryProdutos, [codfat]);

    const queryVendas = `
      SELECT 
        dv.*
      FROM dbfatura f
      JOIN dbvenda dv ON f.codcli = dv.codcli AND f.data = dv.data
      WHERE f.codfat = $1
      ORDER BY dv.nrovenda;
    `;

    const vendas = await client.query(queryVendas, [codfat]);

    client.release();

    return res.status(200).json({
      fatura: f,
      venda: {
        tipo: f.tipo,
        nrovenda: f.nrovenda,
        data: f.data,
        total: f.total,
        status: f.status,
        pedido: f.pedido,
        obs: f.obs,
        transp: f.transp,
        vlrfrete: f.vlrfrete,
        prazo: f.prazo,
        tipo_desc: f.tipo_desc,
        ...f,
      },
      cliente: {
        codcli: f.codcli,
        nome: f.nome,
        uf: f.uf,
        cidade: f.cidade,
        endereco: f.endereco,
        bairro: f.bairro,
        cep: f.cep,
        fone: f.fone,
        email: f.email,
        ...f,
      },
      vendas_faturadas: vendas.rows,
      itens_por_venda: produtos.rows.map((row) => ({
        codprod: row.codprod,
        ref: row.ref,
        descr: row.descr,
      })),
      produtos: produtos.rows.map((row) => ({
        codprod: row.codprod,
        descr: row.descr,
        qtd: Number(row.qtd),
        prunit: Number(row.prunit),
        total_item: Number(row.total_item),
        ref: row.ref,
        unimed: row.unimed,
        desconto: Number(row.desconto),
      })),
    });
  } catch (error) {
    console.error('Erro ao buscar espelho da fatura:', error);
    return res.status(500).json({ error: 'Erro ao buscar espelho da fatura.' });
  }
}

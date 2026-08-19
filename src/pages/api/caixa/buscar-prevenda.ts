import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * GET /api/caixa/buscar-prevenda?termo=
 * Lista PRÉ-VENDAS faturáveis (dbvenda) para o Caixa faturar.
 * Faturável = status NOT IN ('F','B','C') AND cancel='N' (F=faturada, B=bloqueada, C=cancelada) —
 * mesma regra de /api/faturamento/listar-vendas.
 * Busca por nº da venda (nrovenda) OU código/nome do cliente.
 * Somente leitura — não altera nada.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido.' });
  const termo = String(req.query.termo || '').trim();
  if (!termo) return res.status(200).json({ prevendas: [] });

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const soDigitos = /^\d+$/.test(termo);
    const params: any[] = [`%${termo}%`];
    // por número da venda (exato) OU código do cliente (exato) OU nome do cliente (ilike)
    let filtro = `(UPPER(c.nome) LIKE UPPER($1))`;
    if (soDigitos) {
      params.push(termo);
      filtro = `(v.nrovenda = $2 OR v.codcli = $2 OR ${filtro})`;
    }

    // total da FATURA = soma dos itens + frete (o campo v.total pode estar inconsistente
    // com os itens em vendas antigas). É o valor que vai na NF e será recebido.
    const q = `
      SELECT v.codvenda, v.nrovenda, v.data, v.codvend, v.codcli, v.tipo, v.status,
             c.nome AS nome_cliente, c.cpfcgc,
             COALESCE((SELECT SUM(i.totalproduto) FROM db_manaus.dbitvenda i WHERE i.codvenda = v.codvenda), 0)
               + COALESCE(v.vlrfrete, 0) AS total
        FROM db_manaus.dbvenda v
        LEFT JOIN db_manaus.dbclien c ON c.codcli = v.codcli
       WHERE v.status NOT IN ('F','B','C')
         AND COALESCE(v.cancel,'N') = 'N'
         AND ${filtro}
       ORDER BY v.data DESC, v.nrovenda DESC
       LIMIT 30`;

    const r = await client.query(q, params);

    // Vendas JÁ FATURADAS com NF-e autorizada (para reimprimir a nota no caixa)
    const qEmitidas = `
      SELECT v.nrovenda, v.codcli, v.data, c.nome AS nome_cliente,
             fv.codfat, nfe.nrodoc_fiscal, nfe.chave, nfe.modelo
        FROM db_manaus.dbvenda v
        JOIN db_manaus.fatura_venda fv ON fv.codvenda = v.codvenda AND fv.status = 'ativo'
        JOIN db_manaus.dbfat_nfe nfe ON nfe.codfat = fv.codfat AND nfe.status = '100'
        LEFT JOIN db_manaus.dbclien c ON c.codcli = v.codcli
       WHERE ${filtro}
       ORDER BY v.data DESC, v.nrovenda DESC
       LIMIT 20`;
    const re = await client.query(qEmitidas, params);

    return res.status(200).json({
      emitidas: re.rows.map((x) => ({
        nrovenda: x.nrovenda,
        codcli: x.codcli,
        nome_cliente: x.nome_cliente,
        data: x.data,
        codfat: x.codfat,
        nrodoc: x.nrodoc_fiscal,
        chave: x.chave,
        modelo: x.modelo,
      })),
      prevendas: r.rows.map((x) => ({
        codvenda: x.codvenda,
        nrovenda: x.nrovenda,
        data: x.data,
        codvend: x.codvend,
        codcli: x.codcli,
        nome_cliente: x.nome_cliente,
        total: Number(x.total || 0),
        tipo: x.tipo,
        status: x.status,
        // documento do cliente decide o tipo de nota (CNPJ→NF-e 55, CPF→NFC-e 65)
        doc: x.cpfcgc || null,
      })),
    });
  } catch (error: any) {
    console.error('Erro ao buscar pré-vendas no caixa:', error);
    return res.status(500).json({ erro: 'Erro ao buscar pré-vendas', detalhes: error.message });
  } finally {
    client.release();
  }
}

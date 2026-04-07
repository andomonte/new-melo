import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * API para consultar extrato de movimentações de produto
 *
 * Mostra todas entradas e saídas do produto em um período
 *
 * POST /api/produtos/extrato
 * Body: {
 *   codprod: string,
 *   dataInicial: string (YYYY-MM-DD),
 *   dataFinal: string (YYYY-MM-DD),
 *   armazem?: string
 * }
 */
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { codprod, dataInicial, dataFinal, armazem } = req.body;

  console.log('📊 API Extrato - Parâmetros recebidos:', {
    codprod,
    dataInicial,
    dataFinal,
    armazem,
  });

  if (!codprod) {
    return res.status(400).json({ error: 'Código do produto é obrigatório' });
  }

  if (!dataInicial || !dataFinal) {
    return res
      .status(400)
      .json({ error: 'Data inicial e final são obrigatórias' });
  }

  const pool = getPgPool();

  try {
    // Array para armazenar todas as movimentações
    const movimentacoes: any[] = [];

    // 1. ENTRADAS (Notas Fiscais de Entrada)
    const queryEntradas = `
      SELECT
        e.dtentrada as data,
        e.nrodoc as nro_documento,
        e.nronf as nota_fiscal,
        f.nomefant as cliente_fornecedor,
        'ENTRADA' as operacao,
        ei.prunit as preco_unitario,
        ei.quantidade,
        e.codfilial as armazem
      FROM db_manaus.dbentradaitens ei
      INNER JOIN db_manaus.dbentrada e ON ei.nrodoc = e.nrodoc
      LEFT JOIN db_manaus.dbfornec f ON e.codfornec = f.codfornec
      WHERE ei.codprod = $1
        AND e.dtentrada >= $2
        AND e.dtentrada <= $3
        ${armazem ? 'AND e.codfilial = $4' : ''}
      ORDER BY e.dtentrada DESC
    `;

    const paramsEntradas = armazem
      ? [codprod, dataInicial, dataFinal, armazem]
      : [codprod, dataInicial, dataFinal];

    const resultEntradas = await pool.query(queryEntradas, paramsEntradas);
    movimentacoes.push(...resultEntradas.rows);

    // 2. SAÍDAS/VENDAS (Notas Fiscais de Venda)
    const queryVendas = `
      SELECT
        v.dtemissao as data,
        v.numvenda as nro_documento,
        v.nronf as nota_fiscal,
        c.nome as cliente_fornecedor,
        'VENDA' as operacao,
        vi.prunit as preco_unitario,
        vi.quantidade * -1 as quantidade,
        v.codfilial as armazem
      FROM db_manaus.dbvendaitens vi
      INNER JOIN db_manaus.dbvenda v ON vi.numvenda = v.numvenda
      LEFT JOIN db_manaus.dbcliente c ON v.codcliente = c.codcliente
      WHERE vi.codprod = $1
        AND v.dtemissao >= $2
        AND v.dtemissao <= $3
        AND v.situacao IN ('F', 'E')
        ${armazem ? 'AND v.codfilial = $4' : ''}
      ORDER BY v.dtemissao DESC
    `;

    const paramsVendas = armazem
      ? [codprod, dataInicial, dataFinal, armazem]
      : [codprod, dataInicial, dataFinal];

    const resultVendas = await pool.query(queryVendas, paramsVendas);
    movimentacoes.push(...resultVendas.rows);

    // 3. TRANSFERÊNCIAS (Saídas)
    const queryTransferencias = `
      SELECT
        t.dtemissao as data,
        t.numtrans as nro_documento,
        t.nronf as nota_fiscal,
        'FILIAL ' || t.codfilialdest as cliente_fornecedor,
        'TRANSFERÊNCIA' as operacao,
        ti.prunit as preco_unitario,
        ti.quantidade * -1 as quantidade,
        t.codfilial as armazem
      FROM db_manaus.dbtransitens ti
      INNER JOIN db_manaus.dbtrans t ON ti.numtrans = t.numtrans
      WHERE ti.codprod = $1
        AND t.dtemissao >= $2
        AND t.dtemissao <= $3
        ${armazem ? 'AND t.codfilial = $4' : ''}
      ORDER BY t.dtemissao DESC
    `;

    const paramsTransferencias = armazem
      ? [codprod, dataInicial, dataFinal, armazem]
      : [codprod, dataInicial, dataFinal];

    const resultTransferencias = await pool.query(
      queryTransferencias,
      paramsTransferencias,
    );
    movimentacoes.push(...resultTransferencias.rows);

    // 4. DEVOLUÇÕES
    const queryDevolucoes = `
      SELECT
        d.dtdevolucao as data,
        d.numdevolucao as nro_documento,
        d.nronf as nota_fiscal,
        c.nome as cliente_fornecedor,
        'DEVOLUÇÃO' as operacao,
        di.prunit as preco_unitario,
        di.quantidade as quantidade,
        d.codfilial as armazem
      FROM db_manaus.dbdevolucaoitens di
      INNER JOIN db_manaus.dbdevolucao d ON di.numdevolucao = d.numdevolucao
      LEFT JOIN db_manaus.dbcliente c ON d.codcliente = c.codcliente
      WHERE di.codprod = $1
        AND d.dtdevolucao >= $2
        AND d.dtdevolucao <= $3
        ${armazem ? 'AND d.codfilial = $4' : ''}
      ORDER BY d.dtdevolucao DESC
    `;

    const paramsDevolucoes = armazem
      ? [codprod, dataInicial, dataFinal, armazem]
      : [codprod, dataInicial, dataFinal];

    const resultDevolucoes = await pool.query(
      queryDevolucoes,
      paramsDevolucoes,
    );
    movimentacoes.push(...resultDevolucoes.rows);

    // Ordenar todas as movimentações por data (mais recente primeiro)
    movimentacoes.sort((a, b) => {
      const dataA = new Date(a.data).getTime();
      const dataB = new Date(b.data).getTime();
      return dataB - dataA;
    });

    // Calcular estatísticas
    const totalEntradas = movimentacoes
      .filter((m) => parseFloat(m.quantidade) > 0)
      .reduce((sum, m) => sum + parseFloat(m.quantidade), 0);

    const totalSaidas = Math.abs(
      movimentacoes
        .filter((m) => parseFloat(m.quantidade) < 0)
        .reduce((sum, m) => sum + parseFloat(m.quantidade), 0),
    );

    const saldo = totalEntradas - totalSaidas;

    // Calcular preço médio ponderado das entradas
    const entradasComPreco = movimentacoes.filter(
      (m) => parseFloat(m.quantidade) > 0 && parseFloat(m.preco_unitario) > 0,
    );
    const somaValorEntradas = entradasComPreco.reduce(
      (sum, m) =>
        sum + parseFloat(m.quantidade) * parseFloat(m.preco_unitario),
      0,
    );
    const precoMedio =
      totalEntradas > 0 ? somaValorEntradas / totalEntradas : 0;

    // Buscar estoque atual
    const queryEstoque = `
      SELECT qtest, qtdreservada
      FROM db_manaus.dbproduto
      WHERE codprod = $1
    `;
    const resultEstoque = await pool.query(queryEstoque, [codprod]);
    const estoque = resultEstoque.rows[0] || {
      qtest: 0,
      qtdreservada: 0,
    };

    const estoqueDisponivel =
      parseFloat(estoque.qtest || 0) - parseFloat(estoque.qtdreservada || 0);

    console.log(`📊 API Extrato - Retornando ${movimentacoes.length} movimentações`);
    console.log('📊 API Extrato - Stats:', {
      estoqueDisponivel,
      estoqueFisico: parseFloat(estoque.qtest || 0),
      totalEntradas,
      totalSaidas,
      saldo,
      precoMedio,
    });

    return res.status(200).json({
      movimentacoes,
      stats: {
        estoqueDisponivel: estoqueDisponivel,
        estoqueFisico: parseFloat(estoque.qtest || 0),
        totalEntradas: totalEntradas,
        totalSaidas: totalSaidas,
        saldo: saldo,
        precoMedio: precoMedio,
      },
    });
  } catch (error: any) {
    console.error('Erro ao buscar extrato:', error);
    return res.status(500).json({
      error: 'Erro ao buscar extrato',
      message: error.message,
    });
  }
}

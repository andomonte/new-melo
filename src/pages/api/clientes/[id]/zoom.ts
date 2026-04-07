import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { id } = req.query;
  const filial = req.cookies.filial_melo;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID do cliente é obrigatório' });
  }

  if (!filial) {
    return res.status(400).json({ error: 'Filial não especificada' });
  }

  const pool = getPgPool();

  try {
    // Buscar dados principais do cliente
    const clienteQuery = `
      SELECT 
        codcli,
        nome,
        datacad,
        codcc,
        banco,
        status,
        COALESCE(acrescimo, 0) as acrescimo,
        COALESCE(desconto, 0) as desconto,
        COALESCE(prvenda, '0') as preco_venda,
        COALESCE(kickback, 0) as kickback,
        COALESCE(limite, 0) as limite,
        COALESCE(debito, 0) as debito,
        bloquear_preco,
        codvend
      FROM dbclien
      WHERE codcli = $1
    `;
    const clienteResult = await pool.query(clienteQuery, [id]);

    if (clienteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    const cliente = clienteResult.rows[0];

    // Buscar desconto aplicado e bloquear preço do próprio cliente
    const descontoAplicado = '-'; // Será implementado conforme tabela específica
    const bloquearPreco = cliente.bloquear_preco === 'S' ? 'Sim' : 'Não';

    // Buscar vendedor externo
    let vendedorExterno = '-';
    if (cliente.codvend) {
      try {
        const vendedorQuery = `
          SELECT nome FROM dbvended WHERE codvend = $1
        `;
        const vendedorResult = await pool.query(vendedorQuery, [
          cliente.codvend,
        ]);
        vendedorExterno = vendedorResult.rows[0]?.nome || '-';
      } catch (err) {
        console.error('Erro ao buscar vendedor:', err);
      }
    }

    // Buscar última compra
    let ultimaCompra = { nf: '-', data: '-', valor_total: 0 };
    try {
      const ultimaCompraQuery = `
        SELECT 
          nronf as nf,
          TO_CHAR(data, 'DD/MM/YYYY') as data,
          COALESCE(total, 0) as valor_total
        FROM dbvenda
        WHERE codcli = $1 
          AND (cancel IS NULL OR cancel = 'N')
        ORDER BY data DESC
        LIMIT 1
      `;
      const ultimaCompraResult = await pool.query(ultimaCompraQuery, [id]);
      ultimaCompra = ultimaCompraResult.rows[0] || ultimaCompra;
    } catch (err) {
      console.error('Erro ao buscar última compra:', err);
    }

    // Buscar maior compra em 12 meses
    let maiorCompra = { nf: '-', data: '-', valor_total: 0 };
    try {
      const maiorCompraQuery = `
        SELECT 
          nronf as nf,
          TO_CHAR(data, 'DD/MM/YYYY') as data,
          COALESCE(total, 0) as valor_total
        FROM dbvenda
        WHERE codcli = $1 
          AND (cancel IS NULL OR cancel = 'N')
          AND data >= CURRENT_DATE - INTERVAL '12 months'
        ORDER BY total DESC
        LIMIT 1
      `;
      const maiorCompraResult = await pool.query(maiorCompraQuery, [id]);
      maiorCompra = maiorCompraResult.rows[0] || maiorCompra;
    } catch (err) {
      console.error('Erro ao buscar maior compra:', err);
    }

    // Buscar maior atraso
    let maiorAtraso = { periodo: '-', valor_total_acumulado: 0 };
    try {
      const maiorAtrasoQuery = `
        SELECT 
          TO_CHAR(dt_venc, 'MM/YYYY') as periodo,
          COALESCE(SUM(valor_rec), 0) as valor_total_acumulado
        FROM dbreceb
        WHERE codcli = $1 
          AND (rec IS NULL OR rec = 'N')
          AND (cancel IS NULL OR cancel = 'N')
          AND dt_venc < CURRENT_DATE
        GROUP BY TO_CHAR(dt_venc, 'MM/YYYY')
        ORDER BY valor_total_acumulado DESC
        LIMIT 1
      `;
      const maiorAtrasoResult = await pool.query(maiorAtrasoQuery, [id]);
      maiorAtraso = maiorAtrasoResult.rows[0] || maiorAtraso;
    } catch (err) {
      console.error('Erro ao buscar maior atraso:', err);
    }

    // Buscar todos os títulos em aberto
    let titulosResult: any = { rows: [] };
    let valorTotalReceber = 0;
    let valorTotalVencido = 0;

    try {
      const titulosQuery = `
        SELECT 
          COALESCE(nro_doc, '') as documento,
          COALESCE(cod_conta, '') as cod_receita,
          TO_CHAR(dt_emissao, 'DD/MM/YYYY') as dt_emissao,
          TO_CHAR(dt_venc, 'DD/MM/YYYY') as dt_venc,
          COALESCE(valor_rec, 0) as valor,
          CASE 
            WHEN dt_venc < CURRENT_DATE THEN (CURRENT_DATE - dt_venc)
            ELSE 0
          END as atraso
        FROM dbreceb
        WHERE codcli = $1 
          AND (rec IS NULL OR rec = 'N')
          AND (cancel IS NULL OR cancel = 'N')
        ORDER BY dt_venc ASC
      `;
      titulosResult = await pool.query(titulosQuery, [id]);

      // Calcular valor total a receber
      valorTotalReceber = titulosResult.rows.reduce(
        (sum: number, t: any) => sum + parseFloat(t.valor || '0'),
        0,
      );

      // Calcular valor total vencido
      valorTotalVencido = titulosResult.rows
        .filter((t: any) => parseInt(t.atraso || '0') > 0)
        .reduce((sum: number, t: any) => sum + parseFloat(t.valor || '0'), 0);
    } catch (err) {
      console.error('Erro ao buscar títulos:', err);
    }

    // Calcular saldo disponível
    const limiteCredito = parseFloat(cliente.limite || 0);
    const debito = parseFloat(cliente.debito || 0);
    const saldoDisponivel = limiteCredito - debito;

    // Formatar data de cadastro
    const dataCadastro = cliente.datacad
      ? new Date(cliente.datacad).toLocaleDateString('pt-BR')
      : '-';

    // Montar resposta
    const response = {
      codigo: cliente.codcli,
      id: cliente.codcli,
      razaoSocial: cliente.nome,
      dataCadastro,
      classe: cliente.codcc || '-',
      banco: cliente.banco || '-',
      status: cliente.status === 'S' ? 'CRÉDITO AUTORIZADO' : 'SEM CRÉDITO',

      acrescimo: parseFloat(cliente.acrescimo || 0),
      desconto: parseFloat(cliente.desconto || 0),
      descontoAplicado,
      precoVenda:
        cliente.preco_venda === '0'
          ? 0
          : parseInt(cliente.preco_venda || '0', 10),
      kickback: parseInt(cliente.kickback || 0, 10),
      bloquearPreco,
      vendedorExterno,

      limiteCredito,
      saldoDisponivel,
      ultimaCompra: {
        nf: ultimaCompra.nf,
        data: ultimaCompra.data,
        valorTotal:
          typeof ultimaCompra.valor_total === 'string'
            ? parseFloat(ultimaCompra.valor_total)
            : ultimaCompra.valor_total || 0,
      },
      maiorCompra: {
        nf: maiorCompra.nf,
        data: maiorCompra.data,
        valorTotal:
          typeof maiorCompra.valor_total === 'string'
            ? parseFloat(maiorCompra.valor_total)
            : maiorCompra.valor_total || 0,
      },
      maiorAtraso: {
        periodo: maiorAtraso.periodo,
        valorTotalAcumulado:
          typeof maiorAtraso.valor_total_acumulado === 'string'
            ? parseFloat(maiorAtraso.valor_total_acumulado)
            : maiorAtraso.valor_total_acumulado || 0,
      },
      valorTotalReceber,
      valorTotalVencido,

      titulosAberto: titulosResult.rows.map((t: any) => ({
        documento: t.documento,
        codReceita: t.cod_receita,
        dtEmissao: t.dt_emissao,
        dtVenc: t.dt_venc,
        valor: typeof t.valor === 'string' ? parseFloat(t.valor) : t.valor || 0,
        atraso:
          typeof t.atraso === 'string' ? parseInt(t.atraso) : t.atraso || 0,
      })),
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Erro ao buscar dados do zoom:', error);
    return res.status(500).json({
      error: 'Erro ao buscar dados do cliente',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}

import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';

// Converte 'MM/YYYY' para 'MMM/AAAA' em português (ex.: '12/2014' -> 'DEZ/2014'), igual ao Delphi.
const MESES_ABREV = [
  'JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN',
  'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ',
];
function formatarPeriodo(periodo: string): string {
  if (!periodo || !periodo.includes('/')) return periodo || '-';
  const [mm, yyyy] = periodo.split('/');
  const idx = parseInt(mm, 10) - 1;
  if (idx < 0 || idx > 11) return periodo;
  return `${MESES_ABREV[idx]}/${yyyy}`;
}

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

  const pool = getPgPool(filial);

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
    // Fonte: DBFATURA (tipodoc='V'), igual ao Delphi. A NF é o CODFAT e o valor é TOTALNF.
    let ultimaCompra = { nf: '-', data: '-', valor_total: 0 };
    try {
      const ultimaCompraQuery = `
        SELECT
          codfat as nf,
          TO_CHAR(data, 'DD/MM/YYYY') as data,
          COALESCE(totalnf, 0) as valor_total
        FROM dbfatura
        WHERE codcli = $1
          AND tipodoc = 'V'
          AND (cancel IS NULL OR cancel = 'N')
        ORDER BY data DESC, codfat DESC
        LIMIT 1
      `;
      const ultimaCompraResult = await pool.query(ultimaCompraQuery, [id]);
      ultimaCompra = ultimaCompraResult.rows[0] || ultimaCompra;
    } catch (err) {
      console.error('Erro ao buscar última compra:', err);
    }

    // Buscar maior compra (todo o histórico, igual ao Delphi)
    let maiorCompra = { nf: '-', data: '-', valor_total: 0 };
    try {
      const maiorCompraQuery = `
        SELECT
          codfat as nf,
          TO_CHAR(data, 'DD/MM/YYYY') as data,
          COALESCE(totalnf, 0) as valor_total
        FROM dbfatura
        WHERE codcli = $1
          AND tipodoc = 'V'
          AND (cancel IS NULL OR cancel = 'N')
        ORDER BY totalnf DESC, codfat ASC
        LIMIT 1
      `;
      const maiorCompraResult = await pool.query(maiorCompraQuery, [id]);
      maiorCompra = maiorCompraResult.rows[0] || maiorCompra;
    } catch (err) {
      console.error('Erro ao buscar maior compra:', err);
    }

    // Buscar maior acumulado: mês (MM/AAAA) com maior soma faturada.
    // Igual ao Delphi: agrupa DBFATURA (tipodoc='V') por mês e pega o de maior total.
    let maiorAtraso = { periodo: '-', valor_total_acumulado: 0 };
    try {
      const maiorAtrasoQuery = `
        SELECT TO_CHAR(data, 'MM/YYYY') AS periodo,
               COALESCE(SUM(totalnf), 0) AS valor_total_acumulado
        FROM (
          SELECT DISTINCT codfat, data, totalnf
          FROM dbfatura
          WHERE codcli = $1 AND tipodoc = 'V'
        ) s
        GROUP BY TO_CHAR(data, 'MM/YYYY')
        ORDER BY valor_total_acumulado DESC
        LIMIT 1
      `;
      const maiorAtrasoResult = await pool.query(maiorAtrasoQuery, [id]);
      if (maiorAtrasoResult.rows[0]) {
        maiorAtraso = {
          periodo: formatarPeriodo(maiorAtrasoResult.rows[0].periodo),
          valor_total_acumulado: maiorAtrasoResult.rows[0].valor_total_acumulado,
        };
      }
    } catch (err) {
      console.error('Erro ao buscar maior acumulado:', err);
    }

    // Buscar todos os títulos em aberto.
    // Igual ao Delphi: apenas dbreceb com tipo IN ('F','S','G','T'), não cancelado e não recebido.
    // O saldo em aberto de cada título é (valor_pgto - valor_rec).
    let titulosResult: any = { rows: [] };
    try {
      const titulosQuery = `
        SELECT
          COALESCE(nro_doc, '') as documento,
          COALESCE(cod_conta, '') as cod_receita,
          TO_CHAR(dt_emissao, 'DD/MM/YYYY') as dt_emissao,
          TO_CHAR(dt_venc, 'DD/MM/YYYY') as dt_venc,
          COALESCE(valor_pgto, 0) - COALESCE(valor_rec, 0) as valor,
          CASE
            WHEN dt_venc < CURRENT_DATE THEN (CURRENT_DATE - dt_venc)
            ELSE 0
          END as atraso
        FROM dbreceb
        WHERE codcli = $1
          AND COALESCE(rec, 'N') = 'N'
          AND COALESCE(cancel, 'N') = 'N'
          AND tipo IN ('F', 'S', 'G', 'T')
        ORDER BY dt_venc ASC
      `;
      titulosResult = await pool.query(titulosQuery, [id]);
    } catch (err) {
      console.error('Erro ao buscar títulos:', err);
    }

    // Valor total a receber e vencido — fórmula idêntica à SP do Delphi:
    // SUM(valor_pgto - valor_rec), zerando quando negativo.
    let valorTotalReceber = 0;
    let valorTotalVencido = 0;
    try {
      const totaisQuery = `
        SELECT
          GREATEST(COALESCE(SUM(valor_pgto - valor_rec), 0), 0) AS receber,
          GREATEST(COALESCE(SUM(
            CASE WHEN dt_venc < CURRENT_DATE THEN (valor_pgto - valor_rec) ELSE 0 END
          ), 0), 0) AS vencido
        FROM dbreceb
        WHERE codcli = $1
          AND COALESCE(rec, 'N') = 'N'
          AND COALESCE(cancel, 'N') = 'N'
          AND tipo IN ('F', 'S', 'G', 'T')
      `;
      const totais = await pool.query(totaisQuery, [id]);
      valorTotalReceber = parseFloat(totais.rows[0]?.receber || 0);
      valorTotalVencido = parseFloat(totais.rows[0]?.vencido || 0);
    } catch (err) {
      console.error('Erro ao calcular totais a receber/vencido:', err);
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
      // Status de crédito: coluna status '1' = autorizado, '2' = não autorizado (igual ao Delphi)
      status:
        String(cliente.status).trim() === '1'
          ? 'CRÉDITO AUTORIZADO'
          : 'CRÉDITO NÃO AUTORIZADO',

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

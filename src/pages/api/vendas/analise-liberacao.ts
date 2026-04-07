import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { parseCookies } from 'nookies';

/**
 * API para análise completa de uma venda bloqueada para liberação
 *
 * GET /api/vendas/analise-liberacao?codvenda=XXX
 *
 * Retorna:
 * - Dados da venda com itens (preço original, desconto, percentual)
 * - Dados completos do cliente
 * - Histórico financeiro (últimas compras, atrasos, títulos)
 * - Score/indicadores do cliente
 */

interface ItemVendaAnalise {
  codprod: string;
  ref: string;
  descr: string;
  qtd: number;
  prunit: number;
  prvenda_original: number;
  desconto_valor: number;
  desconto_percentual: number;
  total_item: number;
}

interface HistoricoCompra {
  codvenda: string;
  data: string;
  total: number;
  status: string;
}

interface TituloFinanceiro {
  documento: string;
  dt_venc: string;
  valor: number;
  dias_atraso: number;
  status: string;
}

interface AnaliseCliente {
  // Dados básicos
  codcli: string;
  nome: string;
  nomefant: string;
  cpfcgc: string;
  status: string;
  tipo: string;

  // Dados financeiros
  limite: number;
  debito: number;
  limite_disponivel: number;
  atraso_permitido: number;
  claspgto: string;
  faixafin: string;

  // Estatísticas calculadas
  media_compras_3m: number;
  maior_compra_12m: number;
  total_compras_12m: number;
  qtd_compras_12m: number;
  ultima_compra_data: string | null;
  ultima_compra_valor: number;
  dias_desde_ultima_compra: number | null;

  // Títulos
  titulos_vencer: number;
  titulos_vencidos: number;
  atraso_medio: number;
  maior_atraso: number;
  qtd_titulos_abertos: number;
  qtd_titulos_vencidos: number;

  // Histórico
  historico_compras: HistoricoCompra[];
  titulos_abertos: TituloFinanceiro[];

  // Score e indicadores
  score: 'BOM' | 'REGULAR' | 'RUIM' | 'NOVO';
  score_detalhes: string[];
  cliente_ativo: boolean;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { codvenda } = req.query;

  if (!codvenda || typeof codvenda !== 'string') {
    return res.status(400).json({ error: 'Código da venda é obrigatório' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || '1';

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    // 1. Buscar dados da venda
    const queryVenda = `
      SELECT
        v.codvenda,
        v.nrovenda,
        v.codcli,
        v.data,
        v.total,
        v.status,
        v.bloqueada,
        v.tipo,
        v.obs,
        v.obsfat,
        v.credito,
        v.debito as venda_debito,
        v.limite as venda_limite,
        v.codvend
      FROM dbvenda v
      WHERE v.codvenda = $1
    `;
    const resultVenda = await client.query(queryVenda, [codvenda]);

    if (resultVenda.rows.length === 0) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }

    const venda = resultVenda.rows[0];
    const codcli = venda.codcli;

    // 2. Buscar itens da venda com preços originais
    const queryItens = `
      SELECT
        i.codprod,
        p.ref,
        p.descr,
        i.qtd,
        i.prunit,
        COALESCE(p.prvenda, i.prunit) as prvenda_original,
        COALESCE(i.desconto, 0) as desconto_valor
      FROM dbitvenda i
      LEFT JOIN dbprod p ON i.codprod = p.codprod
      WHERE i.codvenda = $1
      ORDER BY i.codprod
    `;
    const resultItens = await client.query(queryItens, [codvenda]);

    const itens: ItemVendaAnalise[] = resultItens.rows.map((item) => {
      const qtd = Number(item.qtd) || 0;
      const prunit = Number(item.prunit) || 0;
      const prvenda_original = Number(item.prvenda_original) || prunit;
      const desconto_valor = Number(item.desconto_valor) || 0;
      const total_item = qtd * prunit;

      // Calcular percentual de desconto
      let desconto_percentual = 0;
      if (prvenda_original > 0 && prunit < prvenda_original) {
        desconto_percentual = ((prvenda_original - prunit) / prvenda_original) * 100;
      }

      return {
        codprod: item.codprod,
        ref: item.ref || item.codprod,
        descr: item.descr || '',
        qtd,
        prunit,
        prvenda_original,
        desconto_valor,
        desconto_percentual,
        total_item,
      };
    });

    // 3. Buscar dados do cliente
    const queryCliente = `
      SELECT
        codcli,
        nome,
        nomefant,
        cpfcgc,
        status,
        tipo,
        limite,
        debito,
        atraso,
        claspgto,
        faixafin,
        datacad
      FROM dbclien
      WHERE codcli = $1
    `;
    const resultCliente = await client.query(queryCliente, [codcli]);
    const clienteData = resultCliente.rows[0] || {};

    // 4. Buscar estatísticas de compras
    const queryEstatisticas = `
      SELECT
        -- Média últimos 3 meses
        COALESCE(
          (SELECT AVG(total) FROM dbvenda
           WHERE codcli = $1 AND (cancel IS NULL OR cancel = 'N')
           AND data >= CURRENT_DATE - INTERVAL '3 months'), 0
        ) as media_3m,

        -- Maior compra 12 meses
        COALESCE(
          (SELECT MAX(total) FROM dbvenda
           WHERE codcli = $1 AND (cancel IS NULL OR cancel = 'N')
           AND data >= CURRENT_DATE - INTERVAL '12 months'), 0
        ) as maior_compra_12m,

        -- Total compras 12 meses
        COALESCE(
          (SELECT SUM(total) FROM dbvenda
           WHERE codcli = $1 AND (cancel IS NULL OR cancel = 'N')
           AND data >= CURRENT_DATE - INTERVAL '12 months'), 0
        ) as total_compras_12m,

        -- Quantidade de compras 12 meses
        COALESCE(
          (SELECT COUNT(*) FROM dbvenda
           WHERE codcli = $1 AND (cancel IS NULL OR cancel = 'N')
           AND data >= CURRENT_DATE - INTERVAL '12 months'), 0
        ) as qtd_compras_12m,

        -- Última compra
        (SELECT data FROM dbvenda
         WHERE codcli = $1 AND (cancel IS NULL OR cancel = 'N')
         ORDER BY data DESC LIMIT 1) as ultima_compra_data,

        (SELECT total FROM dbvenda
         WHERE codcli = $1 AND (cancel IS NULL OR cancel = 'N')
         ORDER BY data DESC LIMIT 1) as ultima_compra_valor
    `;
    const resultEstatisticas = await client.query(queryEstatisticas, [codcli]);
    const stats = resultEstatisticas.rows[0] || {};

    // 5. Buscar títulos financeiros (dbreceb)
    const queryTitulos = `
      SELECT
        -- Títulos a vencer
        COALESCE(
          (SELECT SUM(valor_rec) FROM dbreceb
           WHERE codcli = $1 AND (cancel IS NULL OR cancel = 'N')
           AND (rec IS NULL OR rec = 'N') AND dt_venc >= CURRENT_DATE), 0
        ) as titulos_vencer,

        -- Títulos vencidos
        COALESCE(
          (SELECT SUM(valor_rec) FROM dbreceb
           WHERE codcli = $1 AND (cancel IS NULL OR cancel = 'N')
           AND (rec IS NULL OR rec = 'N') AND dt_venc < CURRENT_DATE), 0
        ) as titulos_vencidos,

        -- Atraso médio
        COALESCE(
          (SELECT AVG(CURRENT_DATE - dt_venc)::INTEGER FROM dbreceb
           WHERE codcli = $1 AND (cancel IS NULL OR cancel = 'N')
           AND (rec IS NULL OR rec = 'N') AND dt_venc < CURRENT_DATE), 0
        ) as atraso_medio,

        -- Maior atraso
        COALESCE(
          (SELECT MAX(CURRENT_DATE - dt_venc)::INTEGER FROM dbreceb
           WHERE codcli = $1 AND (cancel IS NULL OR cancel = 'N')
           AND (rec IS NULL OR rec = 'N') AND dt_venc < CURRENT_DATE), 0
        ) as maior_atraso,

        -- Quantidade de títulos abertos
        COALESCE(
          (SELECT COUNT(*) FROM dbreceb
           WHERE codcli = $1 AND (cancel IS NULL OR cancel = 'N')
           AND (rec IS NULL OR rec = 'N')), 0
        ) as qtd_titulos_abertos,

        -- Quantidade de títulos vencidos
        COALESCE(
          (SELECT COUNT(*) FROM dbreceb
           WHERE codcli = $1 AND (cancel IS NULL OR cancel = 'N')
           AND (rec IS NULL OR rec = 'N') AND dt_venc < CURRENT_DATE), 0
        ) as qtd_titulos_vencidos
    `;
    const resultTitulos = await client.query(queryTitulos, [codcli]);
    const titulos = resultTitulos.rows[0] || {};

    // 6. Buscar histórico de compras (últimas 10)
    const queryHistorico = `
      SELECT codvenda, data, total, status
      FROM dbvenda
      WHERE codcli = $1 AND (cancel IS NULL OR cancel = 'N')
      ORDER BY data DESC
      LIMIT 10
    `;
    const resultHistorico = await client.query(queryHistorico, [codcli]);
    const historicoCompras: HistoricoCompra[] = resultHistorico.rows.map((h) => ({
      codvenda: h.codvenda,
      data: h.data ? new Date(h.data).toISOString() : '',
      total: Number(h.total) || 0,
      status: h.status || '',
    }));

    // 7. Buscar títulos abertos detalhados
    const queryTitulosDetalhados = `
      SELECT
        COALESCE(nro_doc, cod_fat, cod_receb) as documento,
        dt_venc,
        valor_rec as valor,
        CASE WHEN dt_venc < CURRENT_DATE
             THEN (CURRENT_DATE - dt_venc)::INTEGER
             ELSE 0 END as dias_atraso
      FROM dbreceb
      WHERE codcli = $1
        AND (cancel IS NULL OR cancel = 'N')
        AND (rec IS NULL OR rec = 'N')
      ORDER BY dt_venc ASC
      LIMIT 20
    `;
    const resultTitulosDetalhados = await client.query(queryTitulosDetalhados, [codcli]);
    const titulosAbertos: TituloFinanceiro[] = resultTitulosDetalhados.rows.map((t) => ({
      documento: t.documento || '',
      dt_venc: t.dt_venc ? new Date(t.dt_venc).toISOString() : '',
      valor: Number(t.valor) || 0,
      dias_atraso: Number(t.dias_atraso) || 0,
      status: t.dias_atraso > 0 ? 'VENCIDO' : 'A VENCER',
    }));

    // 8. Calcular score do cliente
    const limite = Number(clienteData.limite) || 0;
    const debito = Number(clienteData.debito) || 0;
    const atrasoPermitido = Number(clienteData.atraso) || 0;
    const atrasoMedio = Number(titulos.atraso_medio) || 0;
    const maiorAtraso = Number(titulos.maior_atraso) || 0;
    const titulosVencidos = Number(titulos.titulos_vencidos) || 0;
    const qtdCompras12m = Number(stats.qtd_compras_12m) || 0;
    const ultimaCompraData = stats.ultima_compra_data;

    const scoreDetalhes: string[] = [];
    let pontuacao = 100;

    // Cliente novo (sem histórico)
    if (qtdCompras12m === 0) {
      scoreDetalhes.push('Cliente sem histórico de compras nos últimos 12 meses');
    }

    // Verificar atrasos
    if (maiorAtraso > 60) {
      pontuacao -= 40;
      scoreDetalhes.push(`Maior atraso: ${maiorAtraso} dias (crítico)`);
    } else if (maiorAtraso > 30) {
      pontuacao -= 25;
      scoreDetalhes.push(`Maior atraso: ${maiorAtraso} dias (alto)`);
    } else if (maiorAtraso > 15) {
      pontuacao -= 10;
      scoreDetalhes.push(`Maior atraso: ${maiorAtraso} dias (moderado)`);
    }

    // Verificar títulos vencidos
    if (titulosVencidos > 0) {
      const percentualVencido = limite > 0 ? (titulosVencidos / limite) * 100 : 100;
      if (percentualVencido > 50) {
        pontuacao -= 30;
        scoreDetalhes.push(`Títulos vencidos: R$ ${titulosVencidos.toFixed(2)} (>50% do limite)`);
      } else if (percentualVencido > 20) {
        pontuacao -= 15;
        scoreDetalhes.push(`Títulos vencidos: R$ ${titulosVencidos.toFixed(2)}`);
      }
    }

    // Verificar utilização do limite
    const utilizacaoLimite = limite > 0 ? (debito / limite) * 100 : 0;
    if (utilizacaoLimite > 90) {
      pontuacao -= 15;
      scoreDetalhes.push(`Limite quase esgotado: ${utilizacaoLimite.toFixed(0)}% utilizado`);
    }

    // Verificar frequência de compras
    if (qtdCompras12m >= 12) {
      pontuacao += 10;
      scoreDetalhes.push(`Cliente frequente: ${qtdCompras12m} compras/ano`);
    } else if (qtdCompras12m >= 6) {
      scoreDetalhes.push(`Cliente regular: ${qtdCompras12m} compras/ano`);
    } else if (qtdCompras12m > 0) {
      scoreDetalhes.push(`Cliente esporádico: ${qtdCompras12m} compras/ano`);
    }

    // Verificar última compra
    let diasDesdeUltimaCompra: number | null = null;
    if (ultimaCompraData) {
      diasDesdeUltimaCompra = Math.floor(
        (Date.now() - new Date(ultimaCompraData).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diasDesdeUltimaCompra > 180) {
        pontuacao -= 10;
        scoreDetalhes.push(`Última compra há ${diasDesdeUltimaCompra} dias (cliente inativo)`);
      }
    }

    // Determinar score
    let score: 'BOM' | 'REGULAR' | 'RUIM' | 'NOVO';
    if (qtdCompras12m === 0) {
      score = 'NOVO';
    } else if (pontuacao >= 70) {
      score = 'BOM';
    } else if (pontuacao >= 40) {
      score = 'REGULAR';
    } else {
      score = 'RUIM';
    }

    // Verificar se cliente está ativo (comprou nos últimos 90 dias)
    const clienteAtivo = diasDesdeUltimaCompra !== null && diasDesdeUltimaCompra <= 90;

    // Montar análise do cliente
    const analiseCliente: AnaliseCliente = {
      codcli,
      nome: clienteData.nome || '',
      nomefant: clienteData.nomefant || '',
      cpfcgc: clienteData.cpfcgc || '',
      status: clienteData.status || '',
      tipo: clienteData.tipo || '',

      limite,
      debito,
      limite_disponivel: Math.max(0, limite - debito),
      atraso_permitido: atrasoPermitido,
      claspgto: clienteData.claspgto || '',
      faixafin: clienteData.faixafin || '',

      media_compras_3m: Number(stats.media_3m) || 0,
      maior_compra_12m: Number(stats.maior_compra_12m) || 0,
      total_compras_12m: Number(stats.total_compras_12m) || 0,
      qtd_compras_12m: qtdCompras12m,
      ultima_compra_data: ultimaCompraData ? new Date(ultimaCompraData).toISOString() : null,
      ultima_compra_valor: Number(stats.ultima_compra_valor) || 0,
      dias_desde_ultima_compra: diasDesdeUltimaCompra,

      titulos_vencer: Number(titulos.titulos_vencer) || 0,
      titulos_vencidos: titulosVencidos,
      atraso_medio: atrasoMedio,
      maior_atraso: maiorAtraso,
      qtd_titulos_abertos: Number(titulos.qtd_titulos_abertos) || 0,
      qtd_titulos_vencidos: Number(titulos.qtd_titulos_vencidos) || 0,

      historico_compras: historicoCompras,
      titulos_abertos: titulosAbertos,

      score,
      score_detalhes: scoreDetalhes,
      cliente_ativo: clienteAtivo,
    };

    // Retornar resposta completa
    return res.status(200).json({
      venda: {
        codvenda: venda.codvenda,
        nrovenda: venda.nrovenda,
        data: venda.data ? new Date(venda.data).toISOString() : null,
        total: Number(venda.total) || 0,
        status: venda.status,
        bloqueada: venda.bloqueada,
        tipo: venda.tipo,
        obs: venda.obs,
        obsfat: venda.obsfat,
        codvend: venda.codvend,
      },
      itens,
      cliente: analiseCliente,
      resumo_desconto: {
        total_desconto: itens.reduce((acc, item) => acc + (item.prvenda_original - item.prunit) * item.qtd, 0),
        percentual_medio: itens.length > 0
          ? itens.reduce((acc, item) => acc + item.desconto_percentual, 0) / itens.length
          : 0,
        maior_desconto_percentual: Math.max(...itens.map(i => i.desconto_percentual), 0),
      },
    });
  } catch (error: any) {
    console.error('Erro ao analisar venda para liberação:', error);
    return res.status(500).json({
      error: 'Erro ao analisar venda',
      message: error.message,
    });
  } finally {
    client.release();
  }
}

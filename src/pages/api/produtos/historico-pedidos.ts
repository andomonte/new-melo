import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * API para consultar histórico de pedidos/compras de um produto
 *
 * GET /api/produtos/historico-pedidos?codprod=XXX
 * Retorna:
 * - Últimas entradas recebidas (dbentrada)
 * - Pedidos em andamento/pendentes (cmp_ordem_compra)
 * - Sugestões de compra pendentes
 */
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { codprod } = req.query;

  if (!codprod || typeof codprod !== 'string') {
    return res.status(400).json({ error: 'Código do produto é obrigatório' });
  }

  const pool = getPgPool();

  try {
    // 1. Buscar últimas entradas recebidas (últimos 12 meses)
    const queryEntradas = `
      SELECT
        e.id as numero_documento,
        e.nota_fiscal,
        e.data_entrada,
        e.fornecedor_nome as fornecedor,
        ei.quantidade,
        ei.valor_unitario as preco_unitario,
        e.status
      FROM entrada_itens ei
      INNER JOIN entradas_estoque e ON ei.entrada_id = e.id
      WHERE ei.produto_cod = $1
        AND e.data_entrada >= NOW() - INTERVAL '12 months'
      ORDER BY e.data_entrada DESC
      LIMIT 10
    `;

    let resultEntradas = { rows: [] as any[] };
    try {
      resultEntradas = await pool.query(queryEntradas, [codprod]);
    } catch (e) {
      console.log('Tabela entrada_itens pode não existir:', e);
    }

    // 2. Buscar pedidos em andamento/pendentes (ordens de compra)
    const queryPedidos = `
      SELECT
        o.orc_id as numero_ordem,
        r.req_id_composto as requisicao,
        o.orc_data as data_ordem,
        o.orc_status as status,
        cr.nome as fornecedor,
        ri.quantidade,
        ri.preco_unitario,
        ri.prazo_entrega as previsao_chegada,
        CASE
          WHEN o.orc_status = 'P' THEN 'PENDENTE'
          WHEN o.orc_status = 'A' THEN 'APROVADO'
          WHEN o.orc_status = 'E' THEN 'EM TRANSITO'
          WHEN o.orc_status = 'C' THEN 'CANCELADO'
          WHEN o.orc_status = 'F' THEN 'FINALIZADO'
          ELSE 'OUTRO'
        END as status_descricao
      FROM db_manaus.cmp_requisicao_item ri
      INNER JOIN db_manaus.cmp_requisicao r ON ri.req_id = r.req_id AND ri.req_versao = r.req_versao
      INNER JOIN db_manaus.cmp_ordem_compra o ON r.req_id = o.orc_req_id AND r.req_versao = o.orc_req_versao
      LEFT JOIN db_manaus.dbcredor cr ON r.req_cod_credor = cr.cod_credor
      WHERE ri.codprod = $1
        AND o.orc_status NOT IN ('C', 'F')
      ORDER BY o.orc_data DESC
      LIMIT 10
    `;

    let resultPedidos = { rows: [] as any[] };
    try {
      resultPedidos = await pool.query(queryPedidos, [codprod]);
    } catch (e) {
      console.log('Tabela cmp_ordem_compra pode não existir:', e);
    }

    // 3. Buscar sugestões de compra pendentes
    const querySugestoes = `
      SELECT
        id,
        quantidade_sugerida,
        data_sugestao,
        data_necessidade,
        usuario_nome,
        observacao,
        status
      FROM sugestoes_compra
      WHERE produto_cod = $1
        AND status = 'PENDENTE'
      ORDER BY data_sugestao DESC
      LIMIT 5
    `;

    let resultSugestoes = { rows: [] as any[] };
    try {
      resultSugestoes = await pool.query(querySugestoes, [codprod]);
    } catch (e) {
      console.log('Tabela sugestoes_compra pode não existir:', e);
    }

    // 4. Calcular estatísticas
    const queryStats = `
      SELECT
        COALESCE(SUM(ei.quantidade), 0) as total_entradas_12m,
        COUNT(DISTINCT e.id) as qtd_entradas_12m
      FROM entrada_itens ei
      INNER JOIN entradas_estoque e ON ei.entrada_id = e.id
      WHERE ei.produto_cod = $1
        AND e.data_entrada >= NOW() - INTERVAL '12 months'
    `;

    let resultStats = { rows: [{ total_entradas_12m: 0, qtd_entradas_12m: 0 }] };
    try {
      resultStats = await pool.query(queryStats, [codprod]);
    } catch (e) {
      console.log('Erro ao calcular estatísticas:', e);
    }

    // Montar resposta
    return res.status(200).json({
      entradas: resultEntradas.rows.map((row) => ({
        ...row,
        data_entrada: row.data_entrada
          ? new Date(row.data_entrada).toISOString()
          : null,
        quantidade: parseFloat(row.quantidade || 0),
        preco_unitario: parseFloat(row.preco_unitario || 0),
      })),
      pedidosPendentes: resultPedidos.rows.map((row) => ({
        ...row,
        data_ordem: row.data_ordem
          ? new Date(row.data_ordem).toISOString()
          : null,
        previsao_chegada: row.previsao_chegada
          ? new Date(row.previsao_chegada).toISOString()
          : null,
        quantidade: parseFloat(row.quantidade || 0),
        preco_unitario: parseFloat(row.preco_unitario || 0),
      })),
      sugestoes: resultSugestoes.rows.map((row) => ({
        ...row,
        data_sugestao: row.data_sugestao
          ? new Date(row.data_sugestao).toISOString()
          : null,
        data_necessidade: row.data_necessidade
          ? new Date(row.data_necessidade).toISOString()
          : null,
        quantidade_sugerida: parseFloat(row.quantidade_sugerida || 0),
      })),
      stats: {
        totalEntradas12m: parseFloat(resultStats.rows[0]?.total_entradas_12m || 0),
        qtdEntradas12m: parseInt(resultStats.rows[0]?.qtd_entradas_12m || 0),
        temPedidoPendente: resultPedidos.rows.length > 0,
      },
    });
  } catch (error: any) {
    console.error('Erro ao buscar histórico de pedidos:', error);
    return res.status(500).json({
      error: 'Erro ao buscar histórico de pedidos',
      message: error.message,
    });
  }
}

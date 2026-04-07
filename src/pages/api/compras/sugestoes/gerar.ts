import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';
import type { PoolClient } from 'pg';

/**
 * API - Gerar Sugestão Automática de Compras
 *
 * Calcula quantidade sugerida para compra baseado em:
 * - Demanda histórica (30/60 dias, trimestre, ano)
 * - Estoque atual, trânsito e pendências
 * - Curva ABC do produto
 * - Est

oque mínimo/máximo configurado
 *
 * Baseado no sistema legado Oracle: ORDEM_COMPRA.SUGERIR_PEDIDO
 */

export type TipoSugestao = 'DEMANDA_30D' | 'DEMANDA_60D' | 'ESTOQUE_MIN' | 'ESTOQUE_MAX';

export type FiltroSugestao = {
  tipo: 'marca' | 'grupo';
  codigo: string; // codmarca ou codgpp
};

export interface SugestaoRequest {
  tipo: TipoSugestao;
  filialId?: number; // Opcional: se não informado, usa todas as filiais
  filtro: FiltroSugestao;
}

export interface ItemSugestao {
  // Identificação
  codprod: string;
  codunico: string;
  ref: string;
  descr: string;

  // Classificação
  marca: string;
  grupo: string;
  curvaABC: string;

  // Quantidades
  qtdSugerida: number;
  estoque: number;
  transito: number;
  pendencia: number;
  disponivel: number;

  // Demanda
  demanda30d: number;
  demandaTrimestre: number;
  demandaAno: number;

  // Preço
  preco: number;

  // Metadados
  multiplo: number;
  multiploCompra: number; // Múltiplo específico para compras
  baseIndicacao: string; // 'SUGESTAO'
}

export interface SugestaoResponse {
  success: boolean;
  sugestoes?: ItemSugestao[];
  total?: number;
  error?: string;
}

/**
 * Fator de segurança por Curva ABC
 * Curva A: 1.8x (produtos críticos - 80% do faturamento)
 * Curva B: 1.3x (produtos importantes - 15% do faturamento)
 * Curva C: 1.1x (produtos secundários - 5% do faturamento)
 * Curva D: 1.0x (sem movimento - não comprar)
 */
function getFatorSegurancaPorCurva(curva: string): number {
  switch (curva?.toUpperCase()) {
    case 'A':
      return 1.8;
    case 'B':
      return 1.3;
    case 'C':
      return 1.1;
    case 'D':
      return 1.0;
    default:
      return 1.0;
  }
}

/**
 * Calcula demanda histórica por produto
 */
async function calcularDemanda(
  client: PoolClient,
  tipo: TipoSugestao,
  filtro: FiltroSugestao,
  filialId?: number
): Promise<any[]> {
  const dias = tipo === 'DEMANDA_30D' ? 30 : tipo === 'DEMANDA_60D' ? 60 : null;

  // Condição de filtro dinâmica
  const condicaoFiltro = filtro.tipo === 'marca'
    ? 'p.codmarca = $2'
    : 'p.codgpp = $2';

  // Condição de filial (opcional)
  const condicaoFilial = filialId ? 'AND v.codusr IN (SELECT codusr FROM dbusuario WHERE filial = $3)' : '';
  const params = filialId ? [dias || 365, filtro.codigo, filialId] : [dias || 365, filtro.codigo];

  const query = `
    SELECT
      p.codprod,
      p.ref,
      p.descr,
      p.codmarca,
      p.codgpp,
      p.prcompra as preco,
      p.multiplo,
      p.multiplocompra,
      COALESCE(p.qtestmin, 0) as estoque_minimo,
      COALESCE(p.qtestmax, 0) as estoque_maximo,

      -- Marca e Grupo
      COALESCE(m.descr, 'SEM MARCA') as marca_nome,
      COALESCE(g.descr, 'SEM GRUPO') as grupo_nome,

      -- Curva ABC (placeholder - precisa implementar cálculo)
      COALESCE(p.curva, 'D') as curva_abc,

      -- Demanda de vendas (itens de venda nos últimos períodos)
      COALESCE(SUM(CASE
        WHEN v.data >= CURRENT_DATE - INTERVAL '30 days'
          AND v.status NOT IN ('C', 'X') -- Excluir canceladas
        THEN iv.qtd
        ELSE 0
      END), 0) as demanda_30d,

      COALESCE(SUM(CASE
        WHEN v.data >= CURRENT_DATE - INTERVAL '90 days'
          AND v.status NOT IN ('C', 'X')
        THEN iv.qtd
        ELSE 0
      END), 0) as demanda_trimestre,

      COALESCE(SUM(CASE
        WHEN v.data >= CURRENT_DATE - INTERVAL '365 days'
          AND v.status NOT IN ('C', 'X')
        THEN iv.qtd
        ELSE 0
      END), 0) as demanda_ano,

      -- Demanda do período específico (para cálculo)
      COALESCE(SUM(CASE
        WHEN v.data >= CURRENT_DATE - INTERVAL '1 day' * $1
          AND v.status NOT IN ('C', 'X')
        THEN iv.qtd
        ELSE 0
      END), 0) as demanda_periodo

    FROM db_manaus.dbprod p
    LEFT JOIN db_manaus.dbmarcas m ON m.codmarca = p.codmarca
    LEFT JOIN db_manaus.dbgpprod g ON g.codgpp = p.codgpp
    LEFT JOIN db_manaus.dbitvenda iv ON iv.codprod = p.codprod
    LEFT JOIN db_manaus.dbvenda v ON v.codvenda = iv.codvenda ${condicaoFilial}

    WHERE ${condicaoFiltro}
      AND p.excluido = 0

    GROUP BY
      p.codprod, p.ref, p.descr, p.codmarca, p.codgpp,
      p.prcompra, p.multiplo, p.multiplocompra, p.qtestmin, p.qtestmax, p.curva,
      m.descr, g.descr

    HAVING
      -- Só produtos com movimento OU com estoque mínimo configurado
      (COALESCE(SUM(iv.qtd), 0) > 0 OR COALESCE(p.qtestmin, 0) > 0)

    ORDER BY demanda_periodo DESC
    LIMIT 1000
  `;

  const result = await client.query(query, params);
  return result.rows;
}

/**
 * Consulta estoque disponível por produto
 */
async function consultarEstoqueDisponivel(
  client: PoolClient,
  produtos: string[]
): Promise<Map<string, any>> {
  if (produtos.length === 0) return new Map();

  const query = `
    SELECT
      e.codprod,

      -- Estoque atual
      COALESCE(SUM(e.quantidade), 0) as estoque,

      -- Trânsito (requisições/ordens abertas)
      COALESCE((
        SELECT SUM(ir.itr_quantidade - ir.itr_quantidade_atendida)
        FROM db_manaus.cmp_it_requisicao ir
        JOIN db_manaus.cmp_requisicao r ON r.req_id = ir.itr_req_id AND r.req_versao = ir.itr_req_versao
        WHERE ir.itr_codprod = e.codprod
          AND r.req_status IN ('S', 'A') -- Submetida ou Aprovada
          AND ir.itr_quantidade > ir.itr_quantidade_atendida
      ), 0) as transito,

      -- Pendências (itens finalizados mas não entregues)
      COALESCE((
        SELECT SUM(ir.itr_quantidade_atendida - COALESCE(ir.itr_quantidade_fechada, 0))
        FROM db_manaus.cmp_it_requisicao ir
        JOIN db_manaus.cmp_requisicao r ON r.req_id = ir.itr_req_id AND r.req_versao = ir.itr_req_versao
        WHERE ir.itr_codprod = e.codprod
          AND r.req_status = 'A'
          AND ir.itr_status = 'F'
          AND ir.itr_quantidade_atendida > COALESCE(ir.itr_quantidade_fechada, 0)
      ), 0) as pendencia

    FROM db_manaus.dbestoque e
    WHERE e.codprod = ANY($1::VARCHAR[])
    GROUP BY e.codprod
  `;

  const result = await client.query(query, [produtos]);

  const mapaEstoque = new Map();
  result.rows.forEach(row => {
    mapaEstoque.set(row.codprod, {
      estoque: parseFloat(row.estoque) || 0,
      transito: parseFloat(row.transito) || 0,
      pendencia: parseFloat(row.pendencia) || 0,
      disponivel: (parseFloat(row.estoque) || 0) +
                  (parseFloat(row.transito) || 0) -
                  (parseFloat(row.pendencia) || 0)
    });
  });

  return mapaEstoque;
}

/**
 * Calcula quantidade sugerida
 */
function calcularQuantidadeSugerida(
  tipo: TipoSugestao,
  demanda: number,
  disponivel: number,
  curvaABC: string,
  estoqueMin: number,
  estoqueMax: number,
  multiplo: number
): number {
  let qtdSugerida = 0;

  switch (tipo) {
    case 'DEMANDA_30D':
    case 'DEMANDA_60D':
      // Demanda - Disponível × Fator de Segurança
      const fator = getFatorSegurancaPorCurva(curvaABC);
      qtdSugerida = Math.max(0, (demanda - disponivel) * fator);
      break;

    case 'ESTOQUE_MIN':
      // Estoque Mínimo - Disponível
      qtdSugerida = Math.max(0, estoqueMin - disponivel);
      break;

    case 'ESTOQUE_MAX':
      // Estoque Máximo - Disponível
      qtdSugerida = Math.max(0, estoqueMax - disponivel);
      break;
  }

  // Arredondar para o múltiplo
  if (multiplo > 1 && qtdSugerida > 0) {
    qtdSugerida = Math.ceil(qtdSugerida / multiplo) * multiplo;
  }

  return Math.round(qtdSugerida);
}

/**
 * Handler principal
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SugestaoResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido'
    });
  }

  const { tipo, filialId, filtro } = req.body as SugestaoRequest;

  // Validações
  if (!tipo || !filtro || !filtro.tipo || !filtro.codigo) {
    return res.status(400).json({
      success: false,
      error: 'Parâmetros inválidos. Informe: tipo, filtro.tipo e filtro.codigo'
    });
  }

  const client = await pool.connect();

  try {
    // 1. Calcular demanda histórica
    console.log('[Sugestão] Calculando demanda...', { tipo, filtro });
    const produtosComDemanda = await calcularDemanda(client, tipo, filtro, filialId);

    if (produtosComDemanda.length === 0) {
      return res.status(200).json({
        success: true,
        sugestoes: [],
        total: 0
      });
    }

    // 2. Consultar estoque disponível
    console.log(`[Sugestão] Consultando estoque de ${produtosComDemanda.length} produtos...`);
    const codigos = produtosComDemanda.map(p => p.codprod);
    const mapaEstoque = await consultarEstoqueDisponivel(client, codigos);

    // 3. Calcular quantidade sugerida para cada produto
    const sugestoes: ItemSugestao[] = produtosComDemanda.map(item => {
      const estoqueInfo = mapaEstoque.get(item.codprod) || {
        estoque: 0,
        transito: 0,
        pendencia: 0,
        disponivel: 0
      };

      const demandaPeriodo = tipo === 'DEMANDA_30D' ? item.demanda_30d :
                             tipo === 'DEMANDA_60D' ? item.demanda_periodo :
                             0;

      // Usa multiplocompra para cálculo, se existir; senão usa multiplo
      const multiploParaCalculo = parseInt(item.multiplocompra) || parseInt(item.multiplo) || 1;

      const qtdSugerida = calcularQuantidadeSugerida(
        tipo,
        demandaPeriodo,
        estoqueInfo.disponivel,
        item.curva_abc,
        parseInt(item.estoque_minimo) || 0,
        parseInt(item.estoque_maximo) || 0,
        multiploParaCalculo
      );

      return {
        codprod: item.codprod,
        codunico: item.codprod, // TODO: implementar codunico real
        ref: item.ref,
        descr: item.descr,
        marca: item.marca_nome,
        grupo: item.grupo_nome,
        curvaABC: item.curva_abc,
        qtdSugerida,
        estoque: estoqueInfo.estoque,
        transito: estoqueInfo.transito,
        pendencia: estoqueInfo.pendencia,
        disponivel: estoqueInfo.disponivel,
        demanda30d: parseInt(item.demanda_30d) || 0,
        demandaTrimestre: parseInt(item.demanda_trimestre) || 0,
        demandaAno: parseInt(item.demanda_ano) || 0,
        preco: parseFloat(item.preco) || 0,
        multiplo: parseInt(item.multiplo) || 1,
        multiploCompra: parseInt(item.multiplocompra) || parseInt(item.multiplo) || 1,
        baseIndicacao: 'SUGESTAO'
      };
    }).filter(s => s.qtdSugerida > 0); // Só retornar itens com sugestão > 0

    console.log(`[Sugestão] ${sugestoes.length} produtos com sugestão positiva`);

    return res.status(200).json({
      success: true,
      sugestoes,
      total: sugestoes.length
    });

  } catch (error: any) {
    console.error('[Sugestão] Erro:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao gerar sugestões'
    });
  } finally {
    client.release();
  }
}

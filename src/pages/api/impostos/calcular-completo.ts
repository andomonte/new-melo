// src/pages/api/impostos/calcular-completo.ts

/**
 * API Unificada de Cálculo de Impostos
 *
 * Calcula TODOS os impostos para múltiplos itens em uma única chamada.
 * Retorna objeto completo pronto para salvar em dbitvenda.
 *
 * Performance: < 500ms por item (otimizada para lotes)
 * Uso: Tela de vendas, NFe, etc.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import type { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { CalculadoraImpostos } from '@/lib/impostos/calculadoraImpostos';
import type {
  CalculoCompletoRequest,
  CalculoCompletoResponse,
  ResultadoCalculoCompleto,
  TotaisImpostos,
  DadosCalculoImposto,
} from '@/lib/impostos/types';

/**
 * Logger
 */
function mkLogger(tag: string) {
  const traceId = Math.random().toString(36).slice(2, 10);
  const log = (...args: any[]) =>
    console.log(`[api/impostos/calcular-completo] [${traceId}]`, ...args);
  const err = (msg: string, e?: any) => {
    console.error(`[api/impostos/calcular-completo] [${traceId}] ERROR: ${msg}`);
    if (e) {
      console.error(e?.message || e);
      if (e?.stack) console.error(e.stack);
    }
  };
  return { traceId, log, err };
}

/**
 * Util para número
 */
const toN = (v: any): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Handler principal
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CalculoCompletoResponse>,
) {
  const { traceId, log, err } = mkLogger('handler');
  const inicio = Date.now();

  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: 'Método não permitido',
    });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({
      ok: false,
      error: 'Filial não informada no cookie',
    });
  }

  const body = req.body as CalculoCompletoRequest;

  log('request', {
    filial,
    cliente: body.codcli || body.cliente_id,
    itens_count: body.itens?.length || 0,
    tipo_operacao: body.tipo_operacao,
  });

  // Validações
  if (!body.itens || !Array.isArray(body.itens) || body.itens.length === 0) {
    return res.status(400).json({
      ok: false,
      error: 'Campo itens[] é obrigatório e deve conter ao menos 1 item',
    });
  }

  const clienteId = body.cliente_id || parseInt(body.codcli || '0');
  if (!clienteId || clienteId <= 0) {
    return res.status(400).json({
      ok: false,
      error: 'Cliente ID inválido (codcli ou cliente_id obrigatório)',
    });
  }

  let client: PoolClient | null = null;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Criar calculadora (reutiliza conexão)
    const calculadora = new CalculadoraImpostos(client);

    // Arrays para resultados
    const resultados: typeof calculadora.calcular extends (...args: any[]) => Promise<infer R> ? R[] : never = [];
    const observacoesGerais: string[] = [];
    const warningsGerais: string[] = [];

    log('calculando', `${body.itens.length} itens`);

    // Calcular cada item
    for (let i = 0; i < body.itens.length; i++) {
      const item = body.itens[i];

      try {
        // Buscar NCM do produto se não fornecido
        let ncm = '';
        const codprod = String(item.codprod || item.produto_id || '').padStart(6, '0');

        if (!codprod) {
          throw new Error(`Item ${i + 1}: codprod ou produto_id obrigatório`);
        }

        const prodResult = await client.query(
          `SELECT clasfiscal as ncm FROM dbprod WHERE codprod = $1 LIMIT 1`,
          [codprod]
        );

        if (prodResult.rows.length === 0) {
          throw new Error(`Item ${i + 1}: Produto ${codprod} não encontrado`);
        }

        ncm = (prodResult.rows[0].ncm || '').replace(/\D/g, '').substring(0, 8);

        if (!ncm || ncm.length < 8) {
          throw new Error(`Item ${i + 1}: NCM inválido para produto ${codprod}`);
        }

        // Preparar dados para cálculo
        const dados: DadosCalculoImposto = {
          produto_id: item.produto_id,
          ncm: ncm,
          valor_produto: toN(item.valor_unitario),
          quantidade: toN(item.quantidade),
          desconto: toN(item.desconto || 0),
          cliente_id: clienteId,
          tipo_operacao: mapTipoOperacao(body.tipo_operacao || 'VENDA'),
          data_operacao: body.data_emissao,
          armazem_id: body.armazem_id,
        };

        // Validações do item
        if (dados.quantidade <= 0) {
          throw new Error(`Item ${i + 1}: quantidade deve ser maior que zero`);
        }

        if (dados.valor_produto <= 0) {
          throw new Error(`Item ${i + 1}: valor_unitario deve ser maior que zero`);
        }

        // Calcular impostos
        const resultado = await calculadora.calcular(dados);
        resultados.push(resultado);

        log(`item ${i + 1}`, {
          codprod,
          ncm,
          valor: dados.valor_produto,
          qtd: dados.quantidade,
          icms: resultado.icms,
          st: resultado.tem_st,
          cfop: resultado.cfop,
        });
      } catch (itemError: any) {
        err(`item ${i + 1}`, itemError);
        throw new Error(
          `Erro ao calcular item ${i + 1}: ${itemError?.message || 'Erro desconhecido'}`
        );
      }
    }

    // Calcular totais consolidados
    const totais = calcularTotais(resultados);

    // Consolidar observações e warnings
    resultados.forEach((r, i) => {
      if (r.observacoes.length > 0) {
        observacoesGerais.push(`Item ${i + 1}: ${r.observacoes.join('; ')}`);
      }
      if (r.warnings.length > 0) {
        warningsGerais.push(`Item ${i + 1}: ${r.warnings.join('; ')}`);
      }
    });

    // Montar resposta
    const resultado: ResultadoCalculoCompleto = {
      itens: resultados,
      totais,
      observacoes: observacoesGerais,
      warnings: warningsGerais,
      timestamp: new Date(),
    };

    const duracao = Date.now() - inicio;
    log('sucesso', {
      itens: resultados.length,
      total_nfe: totais.total_nfe,
      duracao: `${duracao}ms`,
      media_por_item: `${(duracao / resultados.length).toFixed(0)}ms`,
    });

    // Adicionar observação de performance
    observacoesGerais.push(
      `Cálculo executado em ${duracao}ms (média ${(duracao / resultados.length).toFixed(0)}ms/item)`
    );

    return res.status(200).json({
      ok: true,
      resultado,
    });
  } catch (e: any) {
    err('handler', e);
    return res.status(500).json({
      ok: false,
      error: e?.message || 'Erro ao calcular impostos',
    });
  } finally {
    if (client) client.release();
  }
}

/**
 * Calcula totais consolidados
 */
function calcularTotais(
  resultados: Array<{
    valor_total_item: number;
    desconto: number;
    totalicms: number;
    totalsubst_trib: number;
    totalipi: number;
    valorpis: number;
    valorcofins: number;
    valor_fcp: number;
    valorfcp_subst: number;
    ibs_valor: number;
    cbs_valor: number;
  }>
): TotaisImpostos {
  const totais: TotaisImpostos = {
    valor_produtos: 0,
    total_descontos: 0,
    subtotal: 0,
    total_icms: 0,
    total_st: 0,
    total_ipi: 0,
    total_pis: 0,
    total_cofins: 0,
    total_fcp: 0,
    total_fcp_st: 0,
    total_ibs: 0,
    total_cbs: 0,
    total_impostos: 0,
    total_nfe: 0,
  };

  for (const r of resultados) {
    totais.valor_produtos += r.valor_total_item + r.desconto; // valor bruto
    totais.total_descontos += r.desconto;
    totais.subtotal += r.valor_total_item;
    totais.total_icms += r.totalicms;
    totais.total_st += r.totalsubst_trib;
    totais.total_ipi += r.totalipi;
    totais.total_pis += r.valorpis;
    totais.total_cofins += r.valorcofins;
    totais.total_fcp += r.valor_fcp;
    totais.total_fcp_st += r.valorfcp_subst;
    totais.total_ibs += r.ibs_valor;
    totais.total_cbs += r.cbs_valor;
  }

  // Total de impostos que impactam o valor da nota
  totais.total_impostos =
    totais.total_st +
    totais.total_ipi +
    totais.total_fcp +
    totais.total_fcp_st;
  // Nota: ICMS, PIS, COFINS não somam no total da NFe (já estão por dentro)
  // IBS/CBS são informativos em 2026

  // Valor total da NFe
  totais.total_nfe = totais.subtotal + totais.total_impostos;

  // Arredondar todos os valores
  for (const key of Object.keys(totais) as Array<keyof TotaisImpostos>) {
    totais[key] = Number(totais[key].toFixed(2));
  }

  return totais;
}

/**
 * Mapeia tipo de operação
 */
function mapTipoOperacao(tipo: string): any {
  const t = String(tipo).toUpperCase();
  if (t.includes('VENDA') || t === 'V' || t === '1' || t === 'P') return 'VENDA';
  if (t.includes('TRANSFERENCIA') || t === 'T') return 'TRANSFERENCIA';
  if (t.includes('BONIFICACAO') || t === 'B') return 'BONIFICACAO';
  if (t.includes('DEVOLUCAO') || t === 'D') return 'DEVOLUCAO';
  if (t.includes('EXPORTACAO') || t === 'E') return 'EXPORTACAO';
  return 'VENDA'; // default
}

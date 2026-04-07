// src/pages/api/impostos/index.ts

/**
 * API de Cálculo de Impostos - REESCRITA COMPLETA
 *
 * Usa infraestrutura SQL (functions + views) do PostgreSQL
 * para cálculos precisos e completos de impostos.
 *
 * Performance: < 500ms por item
 * Cobertura: ICMS, ST, IPI, PIS, COFINS, FCP, IBS/CBS
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import type { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { CalculadoraImpostos } from '@/lib/impostos/calculadoraImpostos';
import type {
  ImpostoRequest,
  ImpostoResponse,
  DadosCalculoImposto,
} from '@/lib/impostos/types';

/**
 * Util leve para conversão de número
 */
const toN = (v: any): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  let s = String(v).trim();
  if (!s) return 0;
  s = s.replace(/[^\d,.\-]/g, '');
  const hasC = s.includes(','),
    hasD = s.includes('.');
  if (hasC && hasD) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasC) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Logger simples
 */
function log(tag: string, ...args: any[]) {
  console.log(`[api/impostos] [${tag}]`, ...args);
}

function err(tag: string, error: any) {
  console.error(`[api/impostos] [${tag}] ERROR:`, error?.message || error);
  if (error?.stack) console.error(error.stack);
}

/**
 * Handler principal
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ImpostoResponse | { error: string }>,
) {
  const inicio = Date.now();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  const body = req.body as ImpostoRequest;

  log('request', {
    filial,
    codProd: body.codProd,
    codCli: body.codCli,
    tipoOperacao: body.tipoOperacao,
  });

  // Validações mínimas
  if (!body.codProd || !body.codCli) {
    return res.status(400).json({
      error: 'codProd e codCli são obrigatórios.',
    });
  }

  if (!body.quantidade || !body.valorUnitario) {
    return res.status(400).json({
      error: 'quantidade e valorUnitario são obrigatórios.',
    });
  }

  let client: PoolClient | null = null;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Preparar dados para a calculadora
    const qtd = toN(body.quantidade ?? 1);
    const vu = toN(body.valorUnitario ?? 0);
    const subtotalItem = body.usarAuto
      ? +(qtd * vu).toFixed(2)
      : +toN(body.totalItem ?? qtd * vu).toFixed(2);

    // 1. Buscar NCM do produto
    const prodResult = await client.query(
      `SELECT codprod, clasfiscal as ncm
       FROM dbprod
       WHERE codprod = $1
       LIMIT 1`,
      [String(body.codProd).trim().padStart(6, '0')]
    );

    if (prodResult.rows.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    const ncm = (prodResult.rows[0].ncm || '').replace(/\D/g, '').substring(0, 8);

    // 2. Buscar cliente_id
    const cliResult = await client.query(
      `SELECT codcli FROM dbclien WHERE codcli = $1 LIMIT 1`,
      [String(body.codCli).trim()]
    );

    if (cliResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    const clienteId = parseInt(body.codCli);
    const produtoId = parseInt(prodResult.rows[0].codprod);

    // 3. Preparar dados para cálculo
    const dados: DadosCalculoImposto = {
      produto_id: produtoId,
      ncm: ncm,
      valor_produto: vu,
      quantidade: qtd,
      desconto: 0,
      cliente_id: clienteId,
      tipo_operacao: mapTipoOperacao(body.tipoOperacao || 'VENDA'),
      uf_empresa: body.uf_empresa,
      usar_regras_oracle_procedimento: body.usarRegrasOracleProcedimento,
    };

    // 4. Executar cálculo completo
    const calculadora = new CalculadoraImpostos(client);
    const resultado = await calculadora.calcular(dados);

    // 5. Montar resposta no formato esperado pelo frontend
    // (mantém compatibilidade com sistema anterior + adiciona campos completos)
    const response: ImpostoResponse = {
      cards: {
        valorIPI: resultado.ipi, // percentual
        valorICMS: resultado.icms, // percentual
        valorICMS_Subst: resultado.tem_st ? resultado.totalsubst_trib : 0, // valor em R$
        valorPIS: resultado.pis, // percentual
        valorCOFINS: resultado.cofins, // percentual
        totalImpostos:
          resultado.icms +
          resultado.ipi +
          resultado.pis +
          resultado.cofins, // soma dos percentuais
        valorIBS: resultado.ibs_aliquota, // Informativo 2026
        valorCBS: resultado.cbs_aliquota, // Informativo 2026
      },
      aliquotas: {
        icms: resultado.icms,
        ipi: resultado.ipi,
        pis: resultado.pis,
        cofins: resultado.cofins,
        agregado: resultado.mva,
        ibs: resultado.ibs_aliquota, // Informativo 2026 - Total IBS
        ibs_e: resultado.ibs_e, // IBS Estadual (substitui ICMS)
        ibs_m: resultado.ibs_m, // IBS Municipal (substitui ISS)
        cbs: resultado.cbs_aliquota, // Informativo 2026
      },
      // Valores em R$ para salvar no banco
      valores: {
        totalicms: resultado.totalicms,
        totalsubst_trib: resultado.totalsubst_trib,
        totalipi: resultado.totalipi,
        valorpis: resultado.valorpis,
        valorcofins: resultado.valorcofins,
        valor_fcp: resultado.valor_fcp,
        valorfcp_subst: resultado.valorfcp_subst,
        ibs_valor: resultado.ibs_valor, // Informativo 2026
        cbs_valor: resultado.cbs_valor, // Informativo 2026
      },
      // Campos completos para salvar na dbitvenda
      campos: {
        icms: resultado.icms,
        baseicms: resultado.baseicms,
        totalicms: resultado.totalicms,
        icmsinterno_dest: resultado.icmsinterno_dest,
        icmsexterno_orig: resultado.icmsexterno_orig,
        csticms: resultado.csticms,

        mva: resultado.mva,
        basesubst_trib: resultado.basesubst_trib,
        totalsubst_trib: resultado.totalsubst_trib,

        ipi: resultado.ipi,
        baseipi: resultado.baseipi,
        totalipi: resultado.totalipi,
        cstipi: resultado.cstipi,

        pis: resultado.pis,
        basepis: resultado.basepis,
        valorpis: resultado.valorpis,
        cstpis: resultado.cstpis,

        cofins: resultado.cofins,
        basecofins: resultado.basecofins,
        valorcofins: resultado.valorcofins,
        cstcofins: resultado.cstcofins,

        fcp: resultado.fcp,
        base_fcp: resultado.base_fcp,
        valor_fcp: resultado.valor_fcp,
        fcp_subst: resultado.fcp_subst,
        basefcp_subst: resultado.basefcp_subst,
        valorfcp_subst: resultado.valorfcp_subst,

        cfop: resultado.cfop,
        tipocfop: resultado.tipocfop,
        ncm: resultado.ncm,

        totalproduto: resultado.valor_total_item,

        // IBS/CBS (Reforma Tributária 2026)
        ibs_e: resultado.ibs_e, // IBS Estadual (substitui ICMS)
        ibs_m: resultado.ibs_m, // IBS Municipal (substitui ISS)
      },
      debug: {
        input: {
          tipoMovimentacao: body.tipoMovimentacao || '',
          tipoOperacao: body.tipoOperacao || '',
          tipoFatura: body.tipoFatura || '',
          zerarSubstituicao: body.zerarSubstituicao || 'N',
          codProd: body.codProd,
          codCli: body.codCli,
          qtd,
          valorUnitario: vu,
          total: subtotalItem,
          usarAuto: !!body.usarAuto,
        },
        uf: {
          ufEmpresa: resultado.operacao_interna
            ? resultado.ncm // hack: precisamos melhorar isso
            : '',
          ufCliente: '',
          icmsIntra: resultado.icmsinterno_dest,
          icmsInter: resultado.icmsexterno_orig,
          flagST: resultado.tem_st ? 'S' : 'N',
        },
        produto: {
          ncm8: resultado.ncm,
          ipiProd: resultado.ipi,
          pisProd: resultado.pis,
          cofinsProd: resultado.cofins,
        },
        mva: {
          mvaOriginal: resultado.mva,
          origem: resultado.origem_mva,
        },
        st: resultado.tem_st
          ? {
              baseSubstTrib: resultado.basesubst_trib,
              totalSubstTrib: resultado.totalsubst_trib,
              mvaAjustado: resultado.mva,
              protocolo: resultado.protocolo_icms,
            }
          : undefined,
        cfop: resultado.cfop,
        observacao: resultado.observacoes.join(' | '),
        ibs_cbs_informativo: resultado.ibs_cbs_informativo,
      },
    };

    const duracao = Date.now() - inicio;
    log('sucesso', { duracao: `${duracao}ms`, cfop: resultado.cfop });

    return res.status(200).json(response);
  } catch (e: any) {
    err('handler', e);
    return res.status(500).json({
      error: e?.message || 'Erro interno ao calcular impostos',
    });
  } finally {
    if (client) client.release();
  }
}

/**
 * Mapeia tipo de operação do frontend para enum interno
 */
function mapTipoOperacao(tipo: string): any {
  const t = String(tipo).toUpperCase();
  if (t.includes('VENDA')) return 'VENDA';
  if (t.includes('TRANSFERENCIA')) return 'TRANSFERENCIA';
  if (t.includes('BONIFICACAO')) return 'BONIFICACAO';
  if (t.includes('DEVOLUCAO')) return 'DEVOLUCAO';
  if (t.includes('EXPORTACAO')) return 'EXPORTACAO';
  return 'VENDA'; // default
}

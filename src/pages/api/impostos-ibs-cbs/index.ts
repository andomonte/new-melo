// src/pages/api/impostos-ibs-cbs/index.ts

/**
 * API Específica para IBS/CBS (Reforma Tributária 2026+)
 *
 * Usa a function SQL buscar_aliquota_ncm(ncm, ano) para
 * retornar alíquotas corretas conforme a categoria do produto.
 *
 * Em 2026: Valores informativos (fase de transição)
 * Em 2027+: Valores efetivos para cobrança
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import type { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';

/**
 * Util para converter para número
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
 * Request esperado
 */
interface IBSCBSRequest {
  ncm?: string;
  codProd?: string;
  ano?: number;
  valorProduto?: number;
  valor_produto?: number;

  // Legacy (compatibilidade)
  tipoMovimentacao?: string;
  tipoOperacao?: string;
  codCli?: string;
  quantidade?: number;
  valorUnitario?: number;
  totalItem?: number;
  usarAuto?: boolean;
}

/**
 * Response
 */
interface IBSCBSResponse {
  ano: number;
  ncm: string;
  categoria: string;

  // Alíquotas (percentuais)
  aliquota_ibs: number;
  aliquota_cbs: number;
  aliquota_total: number;

  // Valores calculados (R$)
  valor_ibs: number;
  valor_cbs: number;
  valor_total: number;

  // Flags
  informativo: boolean;
  observacao: string;

  // Compatibilidade com formato anterior
  cards?: {
    valorIBS: number;
    valorCBS: number;
    totalIBSCBS: number;
    percentualIBS: number;
    percentualCBS: number;
    percentualTotal: number;
  };
  aliquotas?: {
    ibs: number;
    cbs: number;
    total: number;
  };
  debug?: any;
}

/**
 * Handler
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<IBSCBSResponse | { error: string }>,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  const body = req.body as IBSCBSRequest;

  let client: PoolClient | null = null;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // 1. Determinar NCM
    let ncm = body.ncm || '';

    if (!ncm && body.codProd) {
      const prodResult = await client.query(
        `SELECT clasfiscal as ncm FROM dbprod WHERE codprod = $1 LIMIT 1`,
        [String(body.codProd).trim().padStart(6, '0')]
      );

      if (prodResult.rows.length === 0) {
        return res.status(404).json({ error: 'Produto não encontrado' });
      }

      ncm = (prodResult.rows[0].ncm || '').replace(/\D/g, '');
    }

    ncm = ncm.replace(/\D/g, '').substring(0, 8);

    if (!ncm || ncm.length < 8) {
      return res.status(400).json({
        error: 'NCM inválido ou não fornecido (mínimo 8 dígitos)',
      });
    }

    // 2. Determinar ano
    const ano = body.ano || new Date().getFullYear();

    // 3. Determinar valor do produto
    let valorProduto = toN(body.valorProduto || body.valor_produto || 0);

    if (valorProduto === 0 && body.quantidade && body.valorUnitario) {
      const qtd = toN(body.quantidade);
      const vu = toN(body.valorUnitario);
      valorProduto = body.usarAuto
        ? qtd * vu
        : toN(body.totalItem || qtd * vu);
    }

    if (valorProduto <= 0) {
      return res.status(400).json({
        error: 'Valor do produto deve ser maior que zero',
      });
    }

    // 4. Buscar alíquotas IBS/CBS usando function SQL
    let aliquotaIBS = 27.0; // padrão
    let aliquotaCBS = 10.0; // padrão
    let categoria = 'PADRAO';

    try {
      const result = await client.query(
        `SELECT * FROM buscar_aliquota_ncm($1, $2)`,
        [ncm, ano]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0];
        aliquotaIBS = Number(row.aliquota_ibs) || 27.0;
        aliquotaCBS = Number(row.aliquota_cbs) || 10.0;
        categoria = row.categoria || 'PADRAO';
      }
    } catch (error) {
      console.error('[api/impostos-ibs-cbs] Erro ao buscar alíquotas:', error);
      // Continua com valores padrão
    }

    // 5. Verificar se é exportação (alíquota zero)
    const isExportacao = body.tipoOperacao
      ?.toString()
      .toUpperCase()
      .includes('EXPORTACAO');

    if (isExportacao) {
      aliquotaIBS = 0;
      aliquotaCBS = 0;
      categoria = 'ZERO_EXPORTACAO';
    }

    // 6. Calcular valores
    const valorIBS = (valorProduto * aliquotaIBS) / 100;
    const valorCBS = (valorProduto * aliquotaCBS) / 100;
    const valorTotal = valorIBS + valorCBS;
    const aliquotaTotal = aliquotaIBS + aliquotaCBS;

    // 7. Determinar se é informativo
    const informativo = ano === 2026;

    // 8. Observação
    let observacao = '';
    if (informativo) {
      observacao =
        'Valores informativos - Reforma Tributária em fase de transição (2026). ' +
        'A cobrança efetiva inicia em 2027.';
    } else if (isExportacao) {
      observacao = 'Exportação - Alíquota zero conforme legislação';
    } else {
      observacao = `Categoria: ${categoria} - IBS ${aliquotaIBS.toFixed(2)}% + CBS ${aliquotaCBS.toFixed(2)}%`;
    }

    // 9. Montar resposta
    const response: IBSCBSResponse = {
      ano,
      ncm,
      categoria,

      aliquota_ibs: aliquotaIBS,
      aliquota_cbs: aliquotaCBS,
      aliquota_total: aliquotaTotal,

      valor_ibs: Number(valorIBS.toFixed(2)),
      valor_cbs: Number(valorCBS.toFixed(2)),
      valor_total: Number(valorTotal.toFixed(2)),

      informativo,
      observacao,

      // Compatibilidade com formato anterior
      cards: {
        valorIBS: Number(valorIBS.toFixed(2)),
        valorCBS: Number(valorCBS.toFixed(2)),
        totalIBSCBS: Number(valorTotal.toFixed(2)),
        percentualIBS: aliquotaIBS,
        percentualCBS: aliquotaCBS,
        percentualTotal: aliquotaTotal,
      },
      aliquotas: {
        ibs: aliquotaIBS,
        cbs: aliquotaCBS,
        total: aliquotaTotal,
      },
      debug: {
        input: {
          ncm_fornecido: body.ncm,
          codProd: body.codProd,
          ano_solicitado: body.ano,
          valor_produto: valorProduto,
        },
        calculo: {
          baseCalculo: valorProduto,
          aliquotaIBS,
          aliquotaCBS,
          valorIBS: Number(valorIBS.toFixed(2)),
          valorCBS: Number(valorCBS.toFixed(2)),
          isExportacao,
        },
        metadata: {
          categoria,
          informativo,
        },
      },
    };

    return res.status(200).json(response);
  } catch (e: any) {
    console.error('[api/impostos-ibs-cbs] erro:', e);
    return res.status(500).json({
      error: e?.message || 'Erro interno ao calcular IBS/CBS',
    });
  } finally {
    if (client) client.release();
  }
}

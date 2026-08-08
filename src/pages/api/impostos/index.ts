// src/pages/api/impostos/index.ts
//
// API de Cálculo de Impostos — FASE 3 (port PL/pgSQL).
// Este endpoint NÃO calcula nada em JS: valida a entrada, chama a função
// db_manaus.calcular_imposto_item (tradução fiel de CALCULO_IMPOSTO do Oracle)
// e mapeia o retorno. Toda a aritmética fiscal vive no banco.

import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import type { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import type { ImpostoRequest, ImpostoResponse } from '@/lib/impostos/types';

/** Conversão leve de número (aceita "1.234,56"). */
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

function log(tag: string, ...args: any[]) {
  console.log(`[api/impostos] [${tag}]`, ...args);
}
function err(tag: string, error: any) {
  console.error(`[api/impostos] [${tag}] ERROR:`, error?.message || error);
}

/** Mapeia tipo de operação do frontend para o vocabulário da procedure. */
function mapTipoOperacao(tipo: string): string {
  const t = String(tipo).toUpperCase();
  if (t.includes('VENDA')) return 'VENDA';
  if (t.includes('TRANSFERENCIA')) return 'TRANSFERENCIA';
  if (t.includes('DEVOLUCAO')) return 'DEVOLUCAO_COMPRA';
  if (t.includes('BONIFICACAO')) return 'REMESSA_BONIFICACAO';
  return 'VENDA';
}

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
  if (!body.codProd || !body.codCli) {
    return res.status(400).json({ error: 'codProd e codCli são obrigatórios.' });
  }
  if (!body.quantidade || !body.valorUnitario) {
    return res.status(400).json({ error: 'quantidade e valorUnitario são obrigatórios.' });
  }

  const num = (v: any) => Number(v ?? 0);
  let client: PoolClient | null = null;
  try {
    client = await getPgPool(filial).connect();

    const qtd = toN(body.quantidade ?? 1);
    const vu = toN(body.valorUnitario ?? 0);
    const tipoOp = mapTipoOperacao(body.tipoOperacao || 'VENDA');

    // Cálculo 100% no banco — sem aritmética fiscal em JS.
    const { rows } = await client.query(
      `SELECT * FROM db_manaus.calcular_imposto_item($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        String(body.codProd).trim().padStart(6, '0'),
        String(body.codCli).trim(),
        qtd,
        vu,
        'SAIDA',
        tipoOp,
        'NOTA_FISCAL',
        '04',
        'N',
        0,
      ],
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Produto ou cliente não encontrado' });
    }
    const r = rows[0];

    const response: ImpostoResponse = {
      cards: {
        valorIPI: num(r.ipi),
        valorICMS: num(r.icms),
        valorICMS_Subst: num(r.totalsubst_trib),
        valorPIS: num(r.pis),
        valorCOFINS: num(r.cofins),
        totalImpostos: num(r.icms) + num(r.ipi) + num(r.pis) + num(r.cofins),
        valorIBS: num(r.ibs_e) + num(r.ibs_m),
        valorCBS: num(r.cbs_aliquota),
      },
      aliquotas: {
        icms: num(r.icms),
        ipi: num(r.ipi),
        pis: num(r.pis),
        cofins: num(r.cofins),
        agregado: num(r.mva),
        ibs: num(r.ibs_e) + num(r.ibs_m),
        cbs: num(r.cbs_aliquota),
      },
      valores: {
        totalicms: num(r.totalicms),
        totalsubst_trib: num(r.totalsubst_trib),
        totalipi: num(r.totalipi),
        valorpis: num(r.valorpis),
        valorcofins: num(r.valorcofins),
        valor_fcp: 0,
        valorfcp_subst: 0,
        ibs_valor: num(r.valor_ibs),
        cbs_valor: num(r.valor_cbs),
      },
      campos: {
        icms: num(r.icms),
        baseicms: num(r.baseicms),
        totalicms: num(r.totalicms),
        icmsinterno_dest: num(r.icmsinterno_dest),
        icmsexterno_orig: num(r.icmsexterno_orig),
        csticms: r.csticms ?? '', // CST ICMS via ICMS_CST (FASE 4 P1)
        mva: num(r.mva),
        basesubst_trib: num(r.basesubst_trib),
        totalsubst_trib: num(r.totalsubst_trib),
        ipi: num(r.ipi),
        baseipi: num(r.baseipi),
        totalipi: num(r.totalipi),
        cstipi: r.cstipi ?? '',
        pis: num(r.pis),
        basepis: num(r.basepis),
        valorpis: num(r.valorpis),
        cstpis: r.cstpis ?? '',
        cofins: num(r.cofins),
        basecofins: num(r.basecofins),
        valorcofins: num(r.valorcofins),
        cstcofins: r.cstcofins ?? '',
        fcp: 0,
        base_fcp: 0,
        valor_fcp: 0,
        fcp_subst: 0,
        basefcp_subst: 0,
        valorfcp_subst: 0,
        cfop: r.cfop ?? '',
        tipocfop: '',
        ncm: r.ncm ?? '',
        totalproduto: num(r.totalproduto),
      } as any,
      debug: {
        input: {
          tipoOperacao: body.tipoOperacao || '',
          codProd: body.codProd,
          codCli: body.codCli,
          qtd,
          valorUnitario: vu,
        },
        uf: {},
        produto: { ncm8: r.ncm },
        mva: { mvaOriginal: num(r.mva) },
        cfop: r.cfop ?? '',
        observacao: 'port PL/pgSQL: db_manaus.calcular_imposto_item',
        ibs_cbs_informativo: true,
      },
    };

    log('sucesso', { duracao: `${Date.now() - inicio}ms`, cfop: r.cfop });
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

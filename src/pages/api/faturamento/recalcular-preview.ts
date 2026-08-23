import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

// PREVIEW do recálculo de imposto do faturamento — NÃO salva nada.
// Usa a MESMA função PG calcular_imposto_item que o salvar.ts usa em
// gravarItensFatRecalculado, mas RETORNA os itens em vez de inserir no dbprodfat.
//
// PORTÃO REMOVIDO (homolog): recalcula QUALQUER operação (passa tipo_movimentacao/
// tipo_operacao reais). Se um item/operação falhar no recálculo, mantém o imposto da
// venda para aquele item (não quebra a tela) e loga — ajusta-se depois.

const num = (v: any) => Number(v ?? 0);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const {
    codvendas = [],
    codcli,
    tipoMovimentacao,
    tipoOperacao,
    zerarIpi = 'N',
    zerarIcms = 'N',
    zerarSubst = 'N',
    suframa = 'N',
    mvaAnt = 0,
    cfopManual = null,
    tipofat = 'NOTA_FISCAL',
    insc = '04',
  } = req.body || {};

  const vendas = (Array.isArray(codvendas) ? codvendas : [codvendas])
    .filter(Boolean)
    .map((v: any) => String(v));

  if (!vendas.length || !codcli) {
    return res.status(400).json({ error: 'codvendas e codcli são obrigatórios.' });
  }

  const mov = String(tipoMovimentacao ?? 'SAIDA').toUpperCase();
  const op = String(tipoOperacao ?? 'VENDA').toUpperCase();
  const client = await getPgPool().connect();

  try {
    const out: any[] = [];
    let recalculados = 0;
    let mantidos = 0;

    for (const codvenda of vendas) {
      const itens = (
        await client.query(
          `SELECT codprod, qtd, prunit, descr, ref, codint, nrequis, nritem, cfop, ncm,
                  icms, aliquota_icms, baseicms, totalicms, csticms, mva, basesubst_trib, totalsubst_trib,
                  ipi, aliquota_ipi, baseipi, totalipi, cstipi, pis, valorpis, cofins, valorcofins,
                  totalproduto, totalicmsdesconto, aliquota_ibs, aliquota_cbs, ibs_e, ibs_m, valor_ibs, valor_cbs
             FROM dbitvenda WHERE codvenda = $1 ORDER BY nritem`,
          [codvenda],
        )
      ).rows;

      for (const it of itens) {
        try {
          const { rows } = await client.query(
            `SELECT * FROM calcular_imposto_item($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
            [
              String(it.codprod).trim().padStart(6, '0'),
              String(codcli).trim(),
              num(it.qtd),
              num(it.prunit),
              mov,
              op,
              tipofat,
              insc,
              zerarSubst,
              mvaAnt,
              zerarIpi,
              zerarIcms,
              suframa,
              cfopManual,
            ],
          );
          const r = rows[0];
          if (!r) throw new Error('sem retorno da função de imposto');
          // Convenção dbitvenda: `icms`/`ipi` = VALOR; `aliquota_*` = alíquota.
          out.push({
            codvenda,
            codprod: it.codprod,
            descr: it.descr,
            ref: it.ref,
            codint: it.codint,
            nritem: it.nritem,
            nrequis: it.nrequis,
            qtd: num(it.qtd),
            qtde: num(it.qtd),
            prunit: num(it.prunit),
            cfop: r.cfop,
            ncm: r.ncm,
            icms: num(r.totalicms),
            aliquota_icms: num(r.icms),
            baseicms: num(r.baseicms),
            totalicms: num(r.totalicms),
            csticms: r.csticms ?? '',
            mva: num(r.mva),
            basesubst_trib: num(r.basesubst_trib),
            totalsubst_trib: num(r.totalsubst_trib),
            ipi: num(r.totalipi),
            aliquota_ipi: num(r.ipi),
            baseipi: num(r.baseipi),
            totalipi: num(r.totalipi),
            cstipi: r.cstipi ?? '',
            pis: num(r.pis),
            valorpis: num(r.valorpis),
            cofins: num(r.cofins),
            valorcofins: num(r.valorcofins),
            totalproduto: num(r.totalproduto),
            totalicmsdesconto: num(it.totalicmsdesconto),
            aliquota_ibs: num(r.ibs_e) + num(r.ibs_m),
            aliquota_cbs: num(r.cbs_aliquota),
            ibs_e: num(r.ibs_e),
            ibs_m: num(r.ibs_m),
            valor_ibs: num(r.valor_ibs),
            valor_cbs: num(r.valor_cbs),
          });
          recalculados++;
        } catch (errItem: any) {
          // Operação/produto que não recalcula -> mantém o imposto da venda p/ não travar a tela.
          console.warn(
            `recalcular-preview: item ${it.codprod} (${mov}/${op}) não recalculou, mantendo venda:`,
            errItem?.message,
          );
          out.push({ ...it, qtde: num(it.qtd) });
          mantidos++;
        }
      }
    }

    return res.status(200).json({
      itens: out,
      recalculado: recalculados > 0,
      recalculados,
      mantidos,
    });
  } catch (e: any) {
    console.error('Erro em recalcular-preview:', e);
    return res.status(500).json({ error: e?.message || 'Erro no recálculo de imposto.' });
  } finally {
    client.release();
  }
}

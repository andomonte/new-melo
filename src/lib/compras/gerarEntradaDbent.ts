/**
 * Geração de entrada no modelo Delphi (dbent + dbitent), em DUAS FASES:
 *
 *  1) gerarEntradaDbent  → ENTRADA_INCLUIR + Inc_ItEntrada: cria o cabeçalho (dbent status 'A'),
 *     os itens (dbitent, com os insumos de imposto já mapeados do XML) e a linha de estado do
 *     workflow físico (dbent_recebimento = 'PENDENTE'). NÃO calcula custo ainda (custos = 0).
 *
 *  2) confirmarPrecoEntrada → Confirmar_Preco/CalculaPrCusto + CALCULAR_MEDIO: calcula o custo
 *     por item (grava em dbitent), a média ponderada do produto (dbprod / dbprod_custo /
 *     dbprod_contabil) e reprecifica a venda (recalcularPrecosProduto). Roda DEPOIS de eventuais
 *     edições de preço na tela de Confirmar Preço, como no Delphi.
 *
 * Roda em paralelo ao modelo entradas_estoque (dual-write) na MESMA transação. NÃO mexe no
 * estoque (qtest/qtdreservada) — isso segue no fluxo existente para não incrementar duas vezes.
 * Cliente pg injetado (transacional) para ser testável isoladamente.
 */
import { calcularCustoItem, freteConhecimento, EmpresaZona } from './custoEntrada';
import { calcularMedia } from './custoMedio';
import { montarLinhasDbitent, LinhaDbitent } from './mapearItensEntrada';
import { recalcularPrecosProduto } from '../calcularPrecos';

export interface HeaderEntrada {
  custofin?: number;
  desconto?: number;
  verba_tmk?: number;
  acrescimo?: number;
  temcon?: string; // 'S'/'N'
  nrocon?: string | null; // nº do conhecimento (quando temcon='S')
  selo?: string | null; // nº do selo da NF
  dtselo?: string | Date | null; // data do selo
  operacao?: string; // '0'=COMPRA
  cfop?: string | null;
  temcusto?: string; // 'S'/'N'
  zerar_ipi?: string; // 'S'/'N'
  zerar_st?: string; // 'S'/'N'
  frete?: number; // frete unitário-base (freteConhecimento) se temcon='S'
}

export interface GerarEntradaOpts {
  nfeId: string;
  chave: string;
  empresa: EmpresaZona;
  codCredor?: string | null;
  codTransp?: string | null;
  codComprador?: string | null;
  codUsr?: string | null;
  header?: HeaderEntrada;
}

export interface ResultadoGeracao {
  codent: string;
  itens: LinhaDbitent[]; // itens com insumos (sem custo — calculado no confirmar-preço)
}

export interface CustosItemOut {
  codprod: string;
  codreq: string;
  quant: number;
  prcusto: number;
  prcusto_zf: number;
  prcusto_fe: number;
  prcusto_contabil: number;
  prtransferencia_liquido: number;
  prtransferencia_bruto: number;
}

export interface ResultadoConfirmacao {
  produtosAtualizados: number;
  itens: CustosItemOut[];
}

const strzero = (n: number, len: number) => String(n).padStart(len, '0');

/**
 * FASE 1 — cria dbent (status 'A') + dbitent (insumos, custos = 0) + dbent_recebimento ('PENDENTE').
 * Não calcula custo (isso é responsabilidade de confirmarPrecoEntrada).
 */
export async function gerarEntradaDbent(client: any, opts: GerarEntradaOpts): Promise<ResultadoGeracao> {
  const h = opts.header || {};
  await client.query('SET LOCAL search_path TO db_manaus, public');

  // 1) próximo codent = MAIOR numérico + 1, zero-padded (como ENTRADA_INCLUIR)
  const prox = await client.query(
    `select coalesce(max(codent::bigint), 0) + 1 as n from db_manaus.dbent where codent ~ '^[0-9]+$'`
  );
  const codent = strzero(Number(prox.rows[0].n), 9);

  // 2) totais da NFe (para o cabeçalho)
  const tot = await client.query(
    `select coalesce(vprod,0) vprod, coalesce(vipi,0) vipi, coalesce(vnf,0) vnf,
            coalesce(vicms,0) vicms, coalesce(vbc,0) vbc
       from db_manaus.dbnfe_ent where codnfe_ent=$1`, [opts.nfeId]);
  const t = tot.rows[0] || {};

  // 3) INSERT cabeçalho dbent — status 'A' (aberta; custo será feito no Confirmar Preço)
  await client.query(
    `insert into db_manaus.dbent
       (codent, cod_credor, codtransp, codcomprador, dtent, status, operacao, cfop,
        custofin, desconto, verba_tmk, acrescimo, temcon, temcusto,
        zerar_ipi, zerar_st,
        totalprod, totalipi, totalnf, icms, baseicms, codusr, chave, est_alocado,
        selo, dtselo, nrocon)
     values ($1,$2,$3,$4, now(), 'A', $5, $6, $7,$8,$9,$10, $11, $12,
             $13, $14,
             $15,$16,$17,$18,$19, $20, $21, 0,
             $22, $23, $24)`,
    [codent, opts.codCredor || null, opts.codTransp || null, opts.codComprador || null,
     h.operacao || '0', h.cfop || null,
     Number(h.custofin || 0), Number(h.desconto || 0), Number(h.verba_tmk || 0), Number(h.acrescimo || 0),
     h.temcon || 'N', h.temcusto || 'S',
     h.zerar_ipi || 'N', h.zerar_st || 'N',
     Number(t.vprod || 0), Number(t.vipi || 0), Number(t.vnf || 0), Number(t.vicms || 0), Number(t.vbc || 0),
     opts.codUsr || null, opts.chave,
     h.selo || null, h.dtselo || null, h.nrocon || null]);

  // 3.1) estado do workflow físico (recebimento/alocação) — tabela companheira
  await client.query(
    `insert into db_manaus.dbent_recebimento (codent, status) values ($1, 'PENDENTE')
     on conflict (codent) do nothing`, [codent]);

  // 4) carrega associações + det (imposto) + produto (fiscal) + regra do credor
  const assocs = (await client.query(
    `select a.id, a.nfe_item_id, a.produto_cod, a.quantidade_associada, a.quantidade_nf,
            a.valor_unitario, a.preco_real, a.preco_unitario_nf, a.meia_nota,
            d.qcom, d.vicms, d.vicmsst, d.vipi, d.vpis, d.vcofins, d.vicmsdeson,
            p.strib, p.percsubst, p.isentoipi, p.ipi, p.dolar
       from db_manaus.nfe_item_associacao a
       left join db_manaus.dbnfe_ent_det d on d.codnfe_ent=a.nfe_id and d.nitem::text=a.nfe_item_id::text
       left join db_manaus.dbprod p on p.codprod=a.produto_cod
      where a.nfe_id=$1 and a.status <> 'ASSOCIADO_TESTE' order by a.id`, [opts.nfeId])).rows;

  const regra = opts.codCredor
    ? (await client.query(
        `select desc_icms_sufra, desc_icms_sufra_importado from db_manaus.cad_credor_regra_faturamento where crf_id=$1`,
        [opts.codCredor])).rows[0] || null
    : null;

  // 5) monta e insere as linhas de dbitent (insumos; custos = 0, feitos no confirmar-preço)
  const itensOut: LinhaDbitent[] = [];
  for (const a of assocs) {
    const peds = (await client.query(
      `select req_id, quantidade, valor_unitario from db_manaus.nfe_item_pedido_associacao where nfe_associacao_id=$1`,
      [a.id])).rows;
    const linhas = montarLinhasDbitent(a, a, { strib: a.strib, percsubst: a.percsubst }, regra, peds);

    for (const ln of linhas) {
      await client.query(
        `insert into db_manaus.dbitent
           (codent, codprod, codreq, quant, quantnf, prunit, prunitnf,
            valor_icms, valor_ipi, valor_icms_subst, pis, cofins,
            totalicmsdesconto, fis_icmsdeson, prtransf, qtd_transferido,
            prcusto, prcusto_zf, prcusto_fe, prcusto_contabil,
            prtransferencia_liquido, prtransferencia_bruto)
         values ($1,$2,$3,$4,$5,$6,$7, $8,$9,$10,$11,$12, $13,$14,$15, 0,
                 0,0,0,0,0,0)`,
        [codent, ln.codprod, ln.codreq, ln.quant, ln.quantnf, ln.prunit, ln.prunitnf,
         ln.valor_icms, ln.valor_ipi, ln.valor_icms_subst, ln.pis, ln.cofins,
         ln.totalicmsdesconto, ln.fis_icmsdeson, ln.prtransf]);
      itensOut.push(ln);
    }
  }

  return { codent, itens: itensOut };
}

/**
 * FASE 2 — Confirmar Preço: calcula o custo por item (grava em dbitent), a média ponderada do
 * produto (dbprod / dbprod_custo / dbprod_contabil) e reprecifica a venda. Idempotente para o
 * preço; a média usa o estoque disponível vigente do produto (rodar UMA vez por entrada).
 * Não altera o status — isso fica a cargo do endpoint chamador.
 */
export async function confirmarPrecoEntrada(
  client: any,
  codent: string,
  empresa: EmpresaZona,
  frete = 0,
  opts: { atualizarProdutoOverride?: boolean } = {}
): Promise<ResultadoConfirmacao> {
  await client.query('SET LOCAL search_path TO db_manaus, public');

  const ent = (await client.query(
    `select custofin, desconto, verba_tmk, acrescimo, temcusto, temcon, codtransp, nrocon
       from db_manaus.dbent where codent=$1`, [codent])).rows[0];
  if (!ent) throw new Error(`Entrada ${codent} não encontrada em dbent`);
  // temcusto='N' (Cálculo do Custo desmarcado) = confirma SEM atualizar média/preço do produto
  // (espelha Confirmar_Sem_Custo do Delphi): calcula só o custo do item.
  // O override permite forçar "sem custo" na chamada (ação "Confirmar sem Custo").
  const atualizaProduto =
    opts.atualizarProdutoOverride !== undefined
      ? opts.atualizarProdutoOverride
      : (ent.temcusto ?? 'S') !== 'N';
  const header = {
    custofin: Number(ent.custofin || 0), desconto: Number(ent.desconto || 0),
    verba_tmk: Number(ent.verba_tmk || 0), acrescimo: Number(ent.acrescimo || 0),
  };

  // Frete do conhecimento (Delphi CalculaPrCusto): se temcon='S' e não-CIF,
  // Frete = (TotalCon + STCon) / TotalTransp, rateado por item no custoEntrada.
  // Calcula a partir do dbconhecimentoent (chave codtransp+nrocon) gravado ao gerar.
  let freteFinal = frete;
  if ((ent.temcon ?? 'N') === 'S' && ent.codtransp && ent.nrocon) {
    const con = (await client.query(
      `select cif, totaltransp, totalcon, stcon from db_manaus.dbconhecimentoent
        where codtransp=$1 and nrocon=$2 and coalesce(cancel,'N')<>'S'`,
      [ent.codtransp, ent.nrocon])).rows[0];
    if (con) {
      freteFinal = freteConhecimento({
        cif: con.cif,
        totaltransp: Number(con.totaltransp || 0),
        totalcon: Number(con.totalcon || 0),
        stcon: Number(con.stcon || 0),
      });
    }
  }

  const itens = (await client.query(
    `select ie.codprod, ie.codreq, ie.quant, ie.quantnf, ie.prunit, ie.prunitnf,
            ie.valor_ipi, ie.valor_icms_subst, ie.pis, ie.cofins, ie.totalicmsdesconto,
            ie.fis_icmsdeson, ie.prtransf,
            p.isentoipi, p.ipi, p.dolar
       from db_manaus.dbitent ie
       left join db_manaus.dbprod p on p.codprod=ie.codprod
      where ie.codent=$1 order by ie.codprod`, [codent])).rows;

  // 1) custo por item -> grava em dbitent
  const itensOut: CustosItemOut[] = [];
  for (const ie of itens) {
    const prod = { isentoipi: ie.isentoipi, ipi: ie.ipi, dolar: ie.dolar };
    const custos = calcularCustoItem(ie, header, prod, empresa, freteFinal);
    await client.query(
      `update db_manaus.dbitent set prcusto=$4, prcusto_zf=$5, prcusto_fe=$6,
              prcusto_contabil=$7, prtransferencia_liquido=$8, prtransferencia_bruto=$9
       where codent=$1 and codprod=$2 and codreq=$3`,
      [codent, ie.codprod, ie.codreq, custos.prcusto, custos.prcusto_zf, custos.prcusto_fe,
       custos.prcusto_contabil, custos.prtransferencia_liquido, custos.prtransferencia_bruto]);
    itensOut.push({ codprod: ie.codprod, codreq: ie.codreq, quant: Number(ie.quant), ...custos });
  }

  // 2) média ponderada por item (sequencial; cria a linha de custo/contábil se faltar).
  //    Só quando "Cálculo do Custo" está marcado (temcusto <> 'N').
  let produtosAtualizados = 0;
  if (atualizaProduto) for (const it of itensOut) {
    const prodRow = (await client.query(
      `select prcompra, qtest, qtdreservada, prcompraf, prcomprasemst from db_manaus.dbprod where codprod=$1`, [it.codprod])).rows[0];
    if (!prodRow) continue;

    const custoRow = (await client.query(
      `select prcusto_zf, prtransferencia_bruto from db_manaus.dbprod_custo where codprod=$1`, [it.codprod])).rows[0];
    const contRow = (await client.query(
      `select prcusto, estoque from db_manaus.dbprod_contabil where codprod=$1`, [it.codprod])).rows[0];

    const custoEstado = custoRow || { prcusto_zf: 0, prtransferencia_bruto: 0 };
    const contEstado = contRow || { prcusto: 0, estoque: 0 };
    const nc = calcularMedia(prodRow, custoEstado, contEstado, it, it.quant);

    await client.query(
      `update db_manaus.dbprod set prcompra=$2, prcomprasemst=$3, prcompraf=$4, qtdcompra=$5,
              dtprcompra=now(), dtcompra=now() where codprod=$1`,
      [it.codprod, nc.dbprod.prcompra, nc.dbprod.prcomprasemst, nc.dbprod.prcompraf, nc.dbprod.qtdcompra]);

    if (custoRow) {
      await client.query(
        `update db_manaus.dbprod_custo set prcusto=$2, prtransferencia_liquido=$3,
                prtransferencia_bruto=$4, prcusto_zf=$5, prcusto_fe=$6 where codprod=$1`,
        [it.codprod, nc.dbprod_custo.prcusto, nc.dbprod_custo.prtransferencia_liquido,
         nc.dbprod_custo.prtransferencia_bruto, nc.dbprod_custo.prcusto_zf, nc.dbprod_custo.prcusto_fe]);
    } else {
      await client.query(
        `insert into db_manaus.dbprod_custo (codprod, prcusto, prtransferencia_liquido, prtransferencia_bruto, prcusto_zf, prcusto_fe)
         values ($1,$2,$3,$4,$5,$6)`,
        [it.codprod, nc.dbprod_custo.prcusto, nc.dbprod_custo.prtransferencia_liquido,
         nc.dbprod_custo.prtransferencia_bruto, nc.dbprod_custo.prcusto_zf, nc.dbprod_custo.prcusto_fe]);
    }

    if (contRow) {
      await client.query(
        `update db_manaus.dbprod_contabil set prcusto=$2 where codprod=$1`,
        [it.codprod, nc.dbprod_contabil.prcusto]);
    } else {
      await client.query(
        `insert into db_manaus.dbprod_contabil (codprod, prcusto, estoque) values ($1,$2,$3)`,
        [it.codprod, nc.dbprod_contabil.prcusto, 0]);
    }
    produtosAtualizados++;

    // 3) reprecificação de venda com o novo custo (idempotente; reusa margem+alíquotas)
    try {
      await recalcularPrecosProduto(client, { codprod: it.codprod, prcompra: nc.dbprod.prcompra }, 'db_manaus');
    } catch (precoErr: any) {
      console.error(`⚠️ reprecificação falhou p/ ${it.codprod}:`, precoErr?.message || precoErr);
    }
  }

  return { produtosAtualizados, itens: itensOut };
}

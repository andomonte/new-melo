// pages/api/faturamento/dados-fatura-completos.ts
// API para buscar dados completos por codfat (para preview de faturas já processadas)
// Padrão alinhado com detalhes-venda.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { codfat } = req.query;

  if (!codfat || typeof codfat !== 'string') {
    return res.status(400).json({ error: 'Código da fatura é obrigatório.' });
  }

  const client = await getPgPool().connect();
  try {
    // Query para buscar dados completos da fatura através da tabela intermediária fatura_venda
    const query = `
      SELECT DISTINCT ON (i.codvenda, i.nritem, i.codprod)
        -- Dados da fatura
        f.codfat,
        f.nroform,
        f.data AS fatura_data,
        f.codvend AS fatura_codvend,
        f.codcli AS fatura_codcli,
        f.totalnf,
        f.totalfat,
        f.tipofat,
        f.selo,
        f.serie,
        f.cfop1,
        f.cfop2,

        -- Dados do cliente
        c.codcli,
        c.nomefant,
        c.nome,
        c.cpfcgc,
        c.ender,
        c.numero AS cliente_numero,
        c.bairro,
        c.cidade,
        c.uf,
        c.cep,
        c.email,
        c.contato,
        c.iest,
        c.isuframa,
        c.imun,
        c.status AS cliente_status,
        c.tipoemp,
        c.sit_tributaria,
        c.complemento,
        c.emailnfe,

        -- Dados da venda
        v.codvenda,
        v.nrovenda,
        v.data AS venda_data,
        v.codvend AS venda_codvend,
        v.total,
        v.obs,
        v.tipo,
        v.status AS venda_status,
        v.vlrfrete,
        v.ie_empresa,

        -- Campos principais do item da venda
        i.ref,
        i.codprod,
        i.qtd,
        i.prunit,
        i.demanda,
        i.descr AS item_descr,
        i.comissao,
        i.origemcom,
        i.codoperador,
        i.codvend AS item_codvend,
        i.desconto AS item_desconto,
        i.nritem,
        i.cfop AS item_cfop,
        i.tipocfop,
        i.ncm,

        -- Campos de ICMS
        i.icms,
        i.baseicms,
        i.totalicms,
        i.mva,
        i.basesubst_trib,
        i.totalsubst_trib,
        i.icmsinterno_dest,
        i.icmsexterno_orig,
        i.totalicmsdesconto,
        i.csticms,
        i.aliquota_icms,
        i.aliquota_ipi,

        -- Campos de IPI
        i.ipi,
        i.totalipi,
        i.baseipi,
        i.cstipi,

        -- Campos de PIS
        i.pis,
        i.basepis,
        i.valorpis,
        i.cstpis,

        -- Campos de COFINS
        i.cofins,
        i.basecofins,
        i.valorcofins,
        i.cstcofins,

        -- Campos de FCP (Fundo de Combate à Pobreza)
        i.fcp,
        i.base_fcp,
        i.valor_fcp,
        i.fcp_subst,
        i.basefcp_subst,
        i.valorfcp_subst,
        i.fcp_substret,
        i.basefcp_substret,
        i.valorfcp_substret,

        -- Campos IBS/CBS (Nova Lei de Impostos)
        i.aliquota_ibs,
        i.aliquota_cbs,
        i.valor_ibs,
        i.valor_cbs,
        i.ibs_e,
        i.ibs_m,

        -- Campos adicionais
        i.fretebase,
        i.acrescimo,
        i.freteicms,
        i.ftp_st,
        i.totalproduto,

        -- Dados do produto
        p.codprod AS p_codprod,
        p.descr AS p_descr,
        p.unimed AS p_unimed,
        p.ref AS p_ref,
        p.prvenda AS p_prvenda,
        p.codmarca AS p_codmarca

      FROM dbfatura f
      JOIN fatura_venda fv ON fv.codfat = f.codfat
      JOIN dbvenda v ON v.codvenda = fv.codvenda
      JOIN dbitvenda i ON i.codvenda = v.codvenda
      LEFT JOIN dbprod p ON TRIM(LEADING '0' FROM i.codprod::text) = TRIM(LEADING '0' FROM p.codprod::text)
      LEFT JOIN dbclien c ON c.codcli = f.codcli
      WHERE f.codfat = $1
      ORDER BY i.codvenda, i.nritem, i.codprod
    `;

    console.log('🔍 Buscando dados completos para fatura:', codfat);
    const { rows } = await client.query(query, [codfat]);

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Fatura não encontrada',
        codfat: codfat,
      });
    }

    // Montar estrutura de dados similar ao detalhes-venda
    const firstRow = rows[0];

    const dbfatura = {
      codfat: firstRow.codfat,
      nroform: firstRow.nroform,
      data: firstRow.fatura_data,
      codvend: firstRow.fatura_codvend,
      codcli: firstRow.fatura_codcli,
      totalnf: firstRow.totalnf,
      totalfat: firstRow.totalfat,
      tipofat: firstRow.tipofat,
      selo: firstRow.selo,
      serie: firstRow.serie,
      cfop1: firstRow.cfop1,
      cfop2: firstRow.cfop2,
    };

    const dbclien = {
      codcli: firstRow.codcli,
      nomefant: firstRow.nomefant,
      nome: firstRow.nome,
      cpfcgc: firstRow.cpfcgc,
      ender: firstRow.ender,
      numero: firstRow.cliente_numero,
      bairro: firstRow.bairro,
      cidade: firstRow.cidade,
      uf: firstRow.uf,
      cep: firstRow.cep,
      email: firstRow.email,
      contato: firstRow.contato,
      iest: firstRow.iest,
      isuframa: firstRow.isuframa,
      imun: firstRow.imun,
      status: firstRow.cliente_status,
      tipoemp: firstRow.tipoemp,
      sit_tributaria: firstRow.sit_tributaria,
      complemento: firstRow.complemento,
      emailnfe: firstRow.emailnfe,
    };

    const dbvenda = {
      codvenda: firstRow.codvenda,
      nrovenda: firstRow.nrovenda,
      data: firstRow.venda_data,
      codvend: firstRow.venda_codvend,
      total: firstRow.total,
      obs: firstRow.obs,
      tipo: firstRow.tipo,
      status: firstRow.venda_status,
      vlrfrete: firstRow.vlrfrete || 0,
      vlrseg: 0, // Campo não existe na tabela, usando valor padrão
      vlrdesc: firstRow.vlrdesc || 0,
      vlracresc: 0, // Campo não existe na tabela, usando valor padrão
      ie_empresa: firstRow.ie_empresa,
    };

    // Montar array de itens
    const dbitvenda = rows.map((row: any) => ({
      ref: row.ref,
      codprod: row.codprod,
      codvenda: row.codvenda,
      qtd: row.qtd,
      prunit: row.prunit,
      demanda: row.demanda,
      descr: row.item_descr,
      comissao: row.comissao,
      origemcom: row.origemcom,
      codoperador: row.codoperador,
      codvend: row.item_codvend,
      desconto: row.item_desconto,
      nritem: row.nritem,
      cfop: row.item_cfop,
      tipocfop: row.tipocfop,
      ncm: row.ncm,

      // Campos de ICMS
      icms: row.icms,
      baseicms: row.baseicms,
      totalicms: row.totalicms,
      mva: row.mva,
      basesubst_trib: row.basesubst_trib,
      totalsubst_trib: row.totalsubst_trib,
      icmsinterno_dest: row.icmsinterno_dest,
      icmsexterno_orig: row.icmsexterno_orig,
      totalicmsdesconto: row.totalicmsdesconto,
      csticms: row.csticms,
      aliquota_icms: row.aliquota_icms,
      aliquota_ipi: row.aliquota_ipi,

      // Campos de IPI
      ipi: row.ipi,
      totalipi: row.totalipi,
      baseipi: row.baseipi,
      cstipi: row.cstipi,

      // Campos de PIS
      pis: row.pis,
      basepis: row.basepis,
      valorpis: row.valorpis,
      cstpis: row.cstpis,

      // Campos de COFINS
      cofins: row.cofins,
      basecofins: row.basecofins,
      valorcofins: row.valorcofins,
      cstcofins: row.cstcofins,

      // Campos de FCP
      fcp: row.fcp,
      base_fcp: row.base_fcp,
      valor_fcp: row.valor_fcp,
      fcp_subst: row.fcp_subst,
      basefcp_subst: row.basefcp_subst,
      valorfcp_subst: row.valorfcp_subst,
      fcp_substret: row.fcp_substret,
      basefcp_substret: row.basefcp_substret,
      valorfcp_substret: row.valorfcp_substret,

      // Campos IBS/CBS (Nova Lei de Impostos)
      aliquota_ibs: row.aliquota_ibs,
      aliquota_cbs: row.aliquota_cbs,
      valor_ibs: row.valor_ibs,
      valor_cbs: row.valor_cbs,
      ibs_e: row.ibs_e,
      ibs_m: row.ibs_m,

      // Campos adicionais
      fretebase: row.fretebase,
      acrescimo: row.acrescimo,
      freteicms: row.freteicms,
      ftp_st: row.ftp_st,
      totalproduto: row.totalproduto,

      // Dados do produto
      dbprod: {
        codprod: row.p_codprod ?? null,
        descr: row.p_descr ?? null,
        unimed: row.p_unimed ?? null,
        ref: row.p_ref ?? null,
        prvenda: row.p_prvenda ?? null,
        codmarca: row.p_codmarca ?? null,
      },
    }));

    // Calcular resumoFinanceiro (padrão igual ao detalhes-venda)
    const totaisImpostos = {
      totalAliquotaIBS: 0,
      totalAliquotaCBS: 0,
      totalValorIBS: 0,
      totalValorCBS: 0,
      totalIBSEstadual: 0,
      totalIBSMunicipal: 0,
      totalICMS: 0,
      totalIPI: 0,
      totalBaseICMS: 0,
      totalBaseIPI: 0,
      aliquotaICMS: 0,
      aliquotaIPI: 0,
      totalProdutos: 0,
      totalImpostos: 0,
      frete: 0,
      seguro: 0,
      desconto: 0,
      acrescimo: 0,
      totalGeral: 0,
    };

    let weightedAliquotaIBS = 0;
    let baseForAliquotaIBS = 0;
    let weightedAliquotaCBS = 0;
    let baseForAliquotaCBS = 0;
    let weightedAliquotaICMS = 0;
    let baseForAliquotaICMS = 0;
    let weightedAliquotaIPI = 0;
    let baseForAliquotaIPI = 0;

    dbitvenda.forEach((item: any) => {
      const quantidade = parseFloat(item.qtd || 0);
      const precoUnitario = parseFloat(item.prunit || 0);
      const valorItem = Number(item.totalproduto) || quantidade * precoUnitario;

      totaisImpostos.totalProdutos += valorItem;

      // IBS e CBS
      const itemValorIBS = parseFloat(item.valor_ibs || 0);
      const itemValorCBS = parseFloat(item.valor_cbs || 0);
      const itemAliquotaIBS = parseFloat(item.aliquota_ibs || 0);
      const itemAliquotaCBS = parseFloat(item.aliquota_cbs || 0);
      const itemIBSEstadual = parseFloat(item.ibs_e || 0);
      const itemIBSMunicipal = parseFloat(item.ibs_m || 0);

      totaisImpostos.totalValorIBS += itemValorIBS;
      totaisImpostos.totalValorCBS += itemValorCBS;
      totaisImpostos.totalIBSEstadual += itemIBSEstadual;
      totaisImpostos.totalIBSMunicipal += itemIBSMunicipal;

      if (itemAliquotaIBS > 0) {
        weightedAliquotaIBS += itemAliquotaIBS * valorItem;
        baseForAliquotaIBS += valorItem;
      }
      if (itemAliquotaCBS > 0) {
        weightedAliquotaCBS += itemAliquotaCBS * valorItem;
        baseForAliquotaCBS += valorItem;
      }

      // ICMS e IPI
      const itemTotalICMS = parseFloat(item.totalicms || 0);
      const itemTotalIPI = parseFloat(item.totalipi || 0);
      const itemBaseICMS = parseFloat(item.baseicms || 0);
      const itemBaseIPI = parseFloat(item.baseipi || 0);

      totaisImpostos.totalICMS += itemTotalICMS;
      totaisImpostos.totalIPI += itemTotalIPI;
      totaisImpostos.totalBaseICMS += itemBaseICMS;
      totaisImpostos.totalBaseIPI += itemBaseIPI;

      if (item.aliquota_icms != null && !Number.isNaN(parseFloat(item.aliquota_icms))) {
        weightedAliquotaICMS += parseFloat(item.aliquota_icms) * (itemBaseICMS || 0);
        baseForAliquotaICMS += (itemBaseICMS || 0);
      }
      if (item.aliquota_ipi != null && !Number.isNaN(parseFloat(item.aliquota_ipi))) {
        weightedAliquotaIPI += parseFloat(item.aliquota_ipi) * (itemBaseIPI || 0);
        baseForAliquotaIPI += (itemBaseIPI || 0);
      }
    });

    // Calcular alíquotas médias ponderadas
    totaisImpostos.totalAliquotaIBS = baseForAliquotaIBS > 0
      ? Math.round((weightedAliquotaIBS / baseForAliquotaIBS) * 100) / 100
      : 0;
    totaisImpostos.totalAliquotaCBS = baseForAliquotaCBS > 0
      ? Math.round((weightedAliquotaCBS / baseForAliquotaCBS) * 100) / 100
      : 0;

    if (baseForAliquotaICMS > 0) {
      totaisImpostos.aliquotaICMS = Math.round((weightedAliquotaICMS / baseForAliquotaICMS) * 100) / 100;
    } else {
      totaisImpostos.aliquotaICMS = totaisImpostos.totalBaseICMS > 0
        ? Math.round((totaisImpostos.totalICMS / totaisImpostos.totalBaseICMS) * 10000) / 100
        : 0;
    }

    if (baseForAliquotaIPI > 0) {
      totaisImpostos.aliquotaIPI = Math.round((weightedAliquotaIPI / baseForAliquotaIPI) * 100) / 100;
    } else {
      totaisImpostos.aliquotaIPI = totaisImpostos.totalBaseIPI > 0
        ? Math.round((totaisImpostos.totalIPI / totaisImpostos.totalBaseIPI) * 10000) / 100
        : 0;
    }

    // Extrair frete, seguro, desconto, acréscimo
    totaisImpostos.frete = parseFloat(dbvenda.vlrfrete || 0);
    totaisImpostos.desconto = parseFloat(dbvenda.vlrdesc || 0);


    // Calcular total de impostos e total geral
    totaisImpostos.totalImpostos = totaisImpostos.totalICMS + totaisImpostos.totalIPI;
    // Total Geral: Produtos + IPI (por fora) + ICMS + Frete + Seguro + Acréscimo - Desconto
    // NOTA: IBS e CBS estão em fase de pesquisa na SEFAZ, não devem ser somados ainda
    totaisImpostos.totalGeral =
      totaisImpostos.totalProdutos +
      totaisImpostos.totalIPI +    // IPI é "por fora"
      totaisImpostos.totalICMS +   // ICMS agora incluído no total
      totaisImpostos.frete +
      totaisImpostos.seguro +
      totaisImpostos.acrescimo -
      totaisImpostos.desconto;

    const dadosCompletos = {
      dbfatura,
      dbclien,
      dbvenda,
      dbitvenda,
      faturas: [],
      resumoFinanceiro: totaisImpostos,
    };

    console.log('✅ Dados completos da fatura encontrados:', {
      fatura: dadosCompletos.dbfatura?.codfat,
      cliente: dadosCompletos.dbclien?.nomefant || dadosCompletos.dbclien?.nome,
      produtos: dadosCompletos.dbitvenda?.length || 0,
      resumoFinanceiro: {
        totalProdutos: totaisImpostos.totalProdutos,
        totalValorIBS: totaisImpostos.totalValorIBS,
        totalValorCBS: totaisImpostos.totalValorCBS,
        totalIBSEstadual: totaisImpostos.totalIBSEstadual,
        totalIBSMunicipal: totaisImpostos.totalIBSMunicipal,
        totalGeral: totaisImpostos.totalGeral,
      },
    });

    return res.status(200).json(dadosCompletos);
  } catch (error) {
    console.error('❌ Erro ao buscar dados da fatura:', error);
    return res.status(500).json({
      error: 'Erro ao buscar dados da fatura',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  } finally {
    client.release();
  }
}

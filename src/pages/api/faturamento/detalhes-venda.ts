// pages/api/faturamento/detalhes-venda.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { nrovenda } = req.query;

  if (!nrovenda || typeof nrovenda !== 'string') {
    return res.status(400).json({ error: 'Número(s) da venda inválido(s)' });
  }

  const numeros = nrovenda
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);

  if (!numeros.length) {
    return res
      .status(400)
      .json({ error: 'Informe ao menos um número ou código de venda.' });
  }

  const client = await getPgPool().connect();
  try {
    const codvendaQuery = `
      SELECT codvenda
      FROM dbvenda
      WHERE nrovenda = ANY($1) OR codvenda = ANY($1)
    `;
    const codvendaResult = await client.query(codvendaQuery, [numeros]);
    const codigos = codvendaResult.rows.map((r: any) => r.codvenda);

    if (codigos.length === 0) {
      return res.status(404).json({ error: 'Nenhuma venda encontrada' });
    }

    // Busca faturas associadas via tabela intermediária
    const faturasQuery = `
      SELECT fv.codfat, fv.codvenda, f.*
      FROM fatura_venda fv
      JOIN dbfatura f ON f.codfat = fv.codfat
      WHERE fv.codvenda = ANY($1)
    `;
    const faturasResult = await client.query(faturasQuery, [codigos]);
    const faturasMap: Record<string, any[]> = {};
    for (const row of faturasResult.rows) {
      if (!faturasMap[row.codvenda]) faturasMap[row.codvenda] = [];
      faturasMap[row.codvenda].push(row);
    }

    const query = `
      SELECT DISTINCT ON (i.codvenda, i.nritem, i.codprod)
        -- Campos principais do item da venda
        i.ref,
        i.codprod,
        i.codvenda,
        i.qtd,
        i.prunit,
        i.demanda,
        i.descr,
        i.comissao,
        i.origemcom,
        i.codoperador,
        i.codvend,
        i.prcompra,
        i.prmedio,
        i.comissaovend,
        i.comissao_operador,
        i.desconto,
        i.codreq,
        i.codent,
        i.nrequis,
        i.nritem,
        i.arm_id,
        i.codint,
        i.cfop,
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
        -- Novas alíquotas por item (disponíveis no banco)
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
        i.ibs_e,  -- IBS Estadual
        i.ibs_m,  -- IBS Municipal

        -- Campos adicionais
        i.fretebase,
        i.acrescimo,
        i.freteicms,
        i.ftp_st,
        i.totalproduto,

        -- Alias para compatibilidade
        i.codprod AS codprod_itvenda,

        -- Dados do produto
        p.codprod AS p_codprod,
        p.descr AS p_descr,
        p.unimed AS p_unimed,
        p.ref AS p_ref,
        p.prvenda AS p_prvenda,
        p.codmarca AS p_codmarca,

        -- Dados da venda
        v.*,

        -- Dados do cliente
        c.*,

        -- Dados do banco de cobrança
        bc.banco AS banco_codigo,
        bc.nome AS banco_nome,

        -- Dados bancários (usando subquery para evitar duplicação)
        db.id AS dados_banco_id,
        db.tipo AS dados_banco_tipo,
        db.nroconta AS dados_banco_nroconta,
        db.convenio AS dados_banco_convenio,
        db.variacao AS dados_banco_variacao,
        db.carteira AS dados_banco_carteira,
        db.melo AS dados_banco_melo,
        db.agencia AS dados_banco_agencia

      FROM dbitvenda i
      LEFT JOIN dbvenda v ON i.codvenda = v.codvenda
      LEFT JOIN dbclien c ON v.codcli = c.codcli
      LEFT JOIN dbprod p ON TRIM(LEADING '0' FROM i.codprod::text) = TRIM(LEADING '0' FROM p.codprod::text)
      LEFT JOIN dbbanco_cobranca bc ON c.banco = bc.banco::text
      LEFT JOIN LATERAL (
        SELECT * FROM dbdados_banco db2 
        WHERE c.banco = db2.banco::text 
        ORDER BY db2.id LIMIT 1
      ) db ON true
      WHERE i.codvenda = ANY($1)
      ORDER BY i.codvenda, i.nritem, i.codprod
    `;

    const { rows } = await client.query(query, [codigos]);

    const vendasMap: Record<string, any> = {};
    for (const row of rows) {
      const cod = row.codvenda;
      if (!vendasMap[cod]) {
        vendasMap[cod] = {
          codvenda: row.codvenda,
          dbvenda: {
            codvenda: row.codvenda,
            nrovenda: row.nrovenda,
            tipo: row.tipo,
            data: row.data,
            transp: row.transp,
            obs: row.obs,
            total: row.total,
            codcli: row.codcli,
            codvend: row.codvend,
            cnpj_empresa: row.cnpj_empresa,
            ie_empresa: row.ie_empresa,
          },
          dbclien: {
            codcli: row.codcli,
            nome: row.nome,
            nomefant: row.nomefant,
            cpfcgc: row.cpfcgc,
            tipo: row.tipo,
            codcc: row.codcc,
            codvend: row.codvend,
            datacad: row.datacad,
            ender: row.ender,
            numero: row.numero,
            bairro: row.bairro,
            cidade: row.cidade,
            uf: row.uf,
            cep: row.cep,
            iest: row.iest,
            isuframa: row.isuframa,
            imun: row.imun,
            status: row.status,
            obs: row.obs,
            tipoemp: row.tipoemp,
            debito: row.debito,
            limite: row.limite,
            contato: row.contato,
            socios: row.socios,
            icms: row.icms,
            endercobr: row.endercobr,
            cidadecobr: row.cidadecobr,
            bairrocobr: row.bairrocobr,
            ufcobr: row.ufcobr,
            cepcobr: row.cepcobr,
            claspgto: row.claspgto,
            email: row.email,
            atraso: row.atraso,
            ipi: row.ipi,
            prvenda: row.prvenda,
            codbairro: row.codbairro,
            codbairrocobr: row.codbairrocobr,
            banco: row.banco,
            tipocliente: row.tipocliente,
            codtmk: row.codtmk,
            kickback: row.kickback,
            sit_tributaria: row.sit_tributaria,
            complemento: row.complemento,
            complementocobr: row.complementocobr,
            emailnfe: row.emailnfe,
            bloquear_preco: row.bloquear_preco,
            faixafin: row.faixafin,
            banco_codigo: row.banco_codigo,
            banco_nome: row.banco_nome,
            dados_banco: {
              id: row.dados_banco_id,
              tipo: row.dados_banco_tipo,
              nroconta: row.dados_banco_nroconta,
              convenio: row.dados_banco_convenio,
              variacao: row.dados_banco_variacao,
              carteira: row.dados_banco_carteira,
              melo: row.dados_banco_melo,
              agencia: row.dados_banco_agencia,
            },
          },
          faturas: faturasMap[cod] || [],
          dbitvenda: [],
        };
      }

      vendasMap[cod].dbitvenda.push({
        // Campos principais do item
        ref: row.ref,
        codprod: row.codprod_itvenda ?? null,
        codvenda: row.codvenda,
        qtd: row.qtd,
        prunit: row.prunit,
        demanda: row.demanda,
        descr: row.descr,
        comissao: row.comissao,
        origemcom: row.origemcom,
        codoperador: row.codoperador,
        codvend: row.codvend,
        prcompra: row.prcompra,
        prmedio: row.prmedio,
        comissaovend: row.comissaovend,
        comissao_operador: row.comissao_operador,
        desconto: row.desconto,
        codreq: row.codreq,
        codent: row.codent,
        nrequis: row.nrequis,
        nritem: row.nritem,
        arm_id: row.arm_id,
        codint: row.codint,
        cfop: row.cfop,
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

        // Campos de FCP (Fundo de Combate à Pobreza)
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
        ibs_e: row.ibs_e,  // IBS Estadual
        ibs_m: row.ibs_m,  // IBS Municipal

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
      });
    }

    // Calcular totais de impostos para cada venda (NOVA LEI - IBS/CBS)
    const vendas = Object.values(vendasMap).map((venda: any) => {
      const totaisImpostos = {
        // IBS e CBS (Novos impostos unificados)
        totalAliquotaIBS: 0,
        totalAliquotaCBS: 0,
        totalValorIBS: 0,
        totalValorCBS: 0,
        totalIBSEstadual: 0,  // IBS Estadual (valor)
        totalIBSMunicipal: 0, // IBS Municipal (valor)
        aliquotaIBSEstadual: 0.5,  // IBS Estadual (default 0.5%)
        aliquotaIBSMunicipal: 0.5, // IBS Municipal (default 0.5%)

        // ICMS e IPI (Impostos tradicionais)
        totalICMS: 0,
        totalIPI: 0,
        totalBaseICMS: 0,
        totalBaseIPI: 0,
        aliquotaICMS: 0,
        aliquotaIPI: 0,

        // Totais gerais
        totalProdutos: 0,
        totalImpostos: 0,
        frete: 0,
        seguro: 0,
        desconto: 0,
        acrescimo: 0,
        totalGeral: 0,
      };

      // Calcular totais baseados nos itens da venda
      // Usar `totalproduto` quando disponível (já considera descontos/ajustes por item),
      // somar bases e valores de imposto diretamente e calcular alíquotas por média ponderada
      let weightedAliquotaICMS = 0;
      let baseForAliquotaICMS = 0;
      let weightedAliquotaIPI = 0;
      let baseForAliquotaIPI = 0;
      // Variáveis para cálculo de alíquotas IBS e CBS
      let weightedAliquotaIBS = 0;
      let baseForAliquotaIBS = 0;
      let weightedAliquotaCBS = 0;
      let baseForAliquotaCBS = 0;

      venda.dbitvenda.forEach((item: any) => {
        const quantidade = parseFloat(item.qtd || 0);
        const precoUnitario = parseFloat(item.prunit || 0);
        // Preferir totalproduto quando presente (considera descontos/agregados por item)
        const valorItem = Number(item.totalproduto) || quantidade * precoUnitario;

        // Acumular valor dos produtos
        totaisImpostos.totalProdutos += valorItem;

        // IBS e CBS (Novos impostos)
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
        
        // Acumular para cálculo de média ponderada de alíquotas IBS e CBS
        if (itemAliquotaIBS > 0) {
          weightedAliquotaIBS += itemAliquotaIBS * valorItem;
          baseForAliquotaIBS += valorItem;
        }
        if (itemAliquotaCBS > 0) {
          weightedAliquotaCBS += itemAliquotaCBS * valorItem;
          baseForAliquotaCBS += valorItem;
        }

        // ICMS e IPI (Impostos tradicionais)
        const itemTotalICMS = parseFloat(item.totalicms || 0);
        const itemTotalIPI = parseFloat(item.totalipi || 0);
        const itemBaseICMS = parseFloat(item.baseicms || 0);
        const itemBaseIPI = parseFloat(item.baseipi || 0);

        totaisImpostos.totalICMS += itemTotalICMS;
        totaisImpostos.totalIPI += itemTotalIPI;
        totaisImpostos.totalBaseICMS += itemBaseICMS;
        totaisImpostos.totalBaseIPI += itemBaseIPI;

        // Acumular para cálculo de média ponderada de alíquotas, se disponíveis
        if (item.aliquota_icms != null && !Number.isNaN(parseFloat(item.aliquota_icms))) {
          weightedAliquotaICMS += parseFloat(item.aliquota_icms) * (itemBaseICMS || 0);
          baseForAliquotaICMS += (itemBaseICMS || 0);
        }
        if (item.aliquota_ipi != null && !Number.isNaN(parseFloat(item.aliquota_ipi))) {
          weightedAliquotaIPI += parseFloat(item.aliquota_ipi) * (itemBaseIPI || 0);
          baseForAliquotaIPI += (itemBaseIPI || 0);
        }
      });
      
      // Calcular alíquotas IBS e CBS por média ponderada
      totaisImpostos.totalAliquotaIBS = baseForAliquotaIBS > 0 
        ? Math.round((weightedAliquotaIBS / baseForAliquotaIBS) * 100) / 100 
        : 0;
      totaisImpostos.totalAliquotaCBS = baseForAliquotaCBS > 0 
        ? Math.round((weightedAliquotaCBS / baseForAliquotaCBS) * 100) / 100 
        : 0;

      // Se houver bases para média ponderada, calcular alíquotas a partir das alíquotas por item
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

      // Extrair valores de frete, seguro, desconto e acréscimo da venda
      totaisImpostos.frete = parseFloat(venda.vlrfrete || 0);
      totaisImpostos.seguro = parseFloat(venda.vlrseg || 0);
      totaisImpostos.desconto = parseFloat(venda.vlrdesc || 0);
      totaisImpostos.acrescimo = parseFloat(venda.vlracresc || 0);

      // Calcular alíquotas de ICMS e IPI
      totaisImpostos.aliquotaICMS = totaisImpostos.totalBaseICMS > 0 
        ? (totaisImpostos.totalICMS / totaisImpostos.totalBaseICMS) * 100 
        : 0;
      totaisImpostos.aliquotaIPI = totaisImpostos.totalBaseIPI > 0 
        ? (totaisImpostos.totalIPI / totaisImpostos.totalBaseIPI) * 100 
        : 0;

      // Aplicar arredondamento de centavos (2 casas decimais) em todos os valores monetários
      totaisImpostos.totalValorIBS = Math.round(totaisImpostos.totalValorIBS * 100) / 100;
      totaisImpostos.totalValorCBS = Math.round(totaisImpostos.totalValorCBS * 100) / 100;
      totaisImpostos.totalICMS = Math.round(totaisImpostos.totalICMS * 100) / 100;
      totaisImpostos.totalIPI = Math.round(totaisImpostos.totalIPI * 100) / 100;
      totaisImpostos.totalBaseICMS = Math.round(totaisImpostos.totalBaseICMS * 100) / 100;
      totaisImpostos.totalBaseIPI = Math.round(totaisImpostos.totalBaseIPI * 100) / 100;
      totaisImpostos.totalImpostos = Math.round(totaisImpostos.totalImpostos * 100) / 100;
      totaisImpostos.totalProdutos = Math.round(totaisImpostos.totalProdutos * 100) / 100;
      totaisImpostos.frete = Math.round(totaisImpostos.frete * 100) / 100;
      totaisImpostos.seguro = Math.round(totaisImpostos.seguro * 100) / 100;
      totaisImpostos.desconto = Math.round(totaisImpostos.desconto * 100) / 100;
      totaisImpostos.acrescimo = Math.round(totaisImpostos.acrescimo * 100) / 100;
      totaisImpostos.totalGeral = Math.round(totaisImpostos.totalGeral * 100) / 100;

      // Arredondar alíquotas para 2 casas decimais
      totaisImpostos.aliquotaICMS = Math.round(totaisImpostos.aliquotaICMS * 100) / 100;
      totaisImpostos.aliquotaIPI = Math.round(totaisImpostos.aliquotaIPI * 100) / 100;

      // Calcular total de impostos e total geral
      totaisImpostos.totalImpostos =
        totaisImpostos.totalValorIBS +
        totaisImpostos.totalValorCBS +
        // totaisImpostos.totalICMS +
        totaisImpostos.totalIPI;

      // Total Geral: Produtos + IPI (por fora) + ICMS + Frete + Seguro + Acréscimo - Desconto
      // NOTA: IBS e CBS estão em fase de pesquisa na SEFAZ, não devem ser somados ainda
      totaisImpostos.totalGeral =
        totaisImpostos.totalProdutos +
        totaisImpostos.totalIPI +    // IPI é "por fora"
        // totaisImpostos.totalICMS +   // ICMS agora incluído no total
        totaisImpostos.frete +
        totaisImpostos.seguro +
        totaisImpostos.acrescimo -
        totaisImpostos.desconto;

      return {
        ...venda,
        resumoFinanceiro: totaisImpostos,
      };
    });

    res.status(200).json(numeros.length === 1 ? vendas[0] : vendas);
  } catch (error: any) {
    console.error('Erro ao buscar detalhes das vendas:', error);
    res
      .status(500)
      .json({ error: error.message || 'Erro interno ao buscar vendas' });
  } finally {
    client.release();
  }
}

import axios from 'axios';
import { ALIQUOTA_IBS_2026, ALIQUOTA_CBS_2026 } from '@/constants/tributacao2026';

export async function normalizarPayloadNFe(payload: any) {
  // A 'payload' já contém 'emitente', então não precisamos buscar de novo.
  const { dbclien, dbvenda, dbitvenda, dbfatura, emitente } = payload;

  // ===============================
  // VALIDAÇÕES
  // ===============================
  console.log('🔍 Debug payload recebido:', {
    tem_dbclien: !!dbclien,
    tem_dbvenda: !!dbvenda,
    tem_dbitvenda: !!dbitvenda,
    tipo_dbitvenda: Array.isArray(dbitvenda) ? 'array' : typeof dbitvenda,
    length_dbitvenda: Array.isArray(dbitvenda) ? dbitvenda.length : 'N/A',
    tem_dbfatura: !!dbfatura,
    dbfatura_nroform: dbfatura?.nroform,
    dbfatura_serie: dbfatura?.serie,
    tem_emitente: !!emitente
  });
  
  // 🚨 LOG CRÍTICO: Verificar se nroform existe
  if (!dbfatura?.nroform || dbfatura.nroform === '') {
    console.error('🚨 ALERTA CRÍTICO: dbfatura.nroform está VAZIO!');
    console.error('   Número da NFe usará fallback = 1');
    console.error('   dbfatura completo:', dbfatura);
  }

  if (!dbitvenda || !Array.isArray(dbitvenda)) {
    throw new Error(`dbitvenda deve ser um array. Recebido: ${typeof dbitvenda}`);
  }

  if (dbitvenda.length === 0) {
    throw new Error('dbitvenda não pode estar vazio');
  }

  // ===============================
  // CLIENTE
  // ===============================
  const cliente = {
    // CORREÇÃO: Use o CNPJ real se disponível
    cnpj: dbclien?.cpfcgc || '18.053.139/0001-69',
    nome: dbclien?.nome ?? 'CLIENTE',
    iest: dbclien?.iest ?? '',
    ender: dbclien?.ender ?? '',
    numero: dbclien?.numero?.trim() || 'S/N',
    bairro: dbclien?.bairro ?? '',
    cidade: dbclien?.cidade ?? '',
    uf: dbclien?.uf ?? '',
    cep: dbclien?.cep ?? '',
    isuframa: dbclien?.isuframa ?? '',
    ipi: dbclien?.ipi ?? 'N',
    icms: parseFloat(dbclien?.icms ?? '0'),
  };

  // ===============================
  // PRODUTOS COM IMPOSTOS REAIS + ARITMÉTICA DE CENTAVOS
  // ===============================
  const produtos = dbitvenda.map((item: any, index: number) => {
    const prod = item.dbprod ?? {};
    const qtde = Number(item.qtd ?? 1);
    const preco = Number(item.prunit ?? 0);
    // CORREÇÃO CRÍTICA: Usar aritmética de centavos
    const vProd = Math.round(qtde * preco * 100) / 100;

    // IMPOSTOS REAIS DO BANCO (usando aritmética de centavos)
    const vICMS = Math.round(Number(item.totalicms ?? 0) * 100) / 100;
    const vIPI = Math.round(Number(item.totalipi ?? 0) * 100) / 100;
    const vPIS = Math.round(Number(item.valorpis ?? 0) * 100) / 100;
    const vCOFINS = Math.round(Number(item.valorcofins ?? 0) * 100) / 100;
    const vFCP = Math.round(Number(item.valor_fcp ?? 0) * 100) / 100;

    // Calcular percentuais (aritmética de centavos)
    const pICMS = vProd > 0 ? Math.round((vICMS / vProd) * 10000) / 100 : 0;
    const pIPI = vProd > 0 ? Math.round((vIPI / vProd) * 10000) / 100 : 0; 
    const pPIS = vProd > 0 ? Math.round((vPIS / vProd) * 10000) / 100 : 0;
    const pCOFINS = vProd > 0 ? Math.round((vCOFINS / vProd) * 10000) / 100 : 0;

    // IBS/CBS (Reforma Tributária 2026 — LC 214/2025). Usa alíquotas do item quando
    // vierem (ibs_e = estadual/substitui ICMS, ibs_m = municipal/substitui ISS,
    // aliquota_cbs = CBS); senão aplica a transição 2026 (fase informativa).
    const pIBSUF = Number(item.ibs_e ?? ALIQUOTA_IBS_2026);
    const pIBSMun = Number(item.ibs_m ?? 0);
    const pCBS = Number(item.aliquota_cbs ?? ALIQUOTA_CBS_2026);
    const vIBSUF = Math.round(vProd * pIBSUF) / 100; // vProd * (pIBSUF/100) em centavos
    const vIBSMun = Math.round(vProd * pIBSMun) / 100;
    const vIBSItem = Math.round((vIBSUF + vIBSMun) * 100) / 100;
    const vCBSItem = Math.round(vProd * pCBS) / 100;

    return {
      codprod: item.codprod ?? `P${index + 1}`,
      nome: prod.descr?.trim() || `Produto ${index + 1}`,
      qtde,
      preco,
      ncm: /^[0-9]{8}$/.test(prod.clasfiscal) ? prod.clasfiscal : '87089990',
      vProd,
      // IMPOSTOS REAIS DO BANCO
      icms: {
        pICMS,
        vICMS,
        baseICMS: Math.round(Number(item.baseicms ?? vProd) * 100) / 100,
        cstICMS: (item.csticms ?? '00').toString().padStart(2, '0').slice(-2),
      },
      ipi: {
        pIPI,
        vIPI,
        cstIPI: item.cstipi ?? '50',
      },
      pis: {
        pPIS,
        vPIS,
        cstPIS: item.cstpis ?? '01',
      },
      cofins: {
        pCOFINS,
        vCOFINS,  
        cstCOFINS: item.cstcofins ?? '01',
      },
      fcp: {
        vFCP,
      },
      cfop: item.cfop ?? '5102',
      ibscbs: {
        cst: (item.cstibscbs ?? '000').toString().padStart(3, '0'),
        cClassTrib: (item.cclasstrib ?? '000001').toString().padStart(6, '0'),
        vBC: vProd,
        pIBSUF,
        vIBSUF,
        pIBSMun,
        vIBSMun,
        vIBS: vIBSItem,
        pCBS,
        vCBS: vCBSItem,
      },
    };
  });

  // CORREÇÃO CRÍTICA: Calcular totais com aritmética de centavos
  const totalProdutos = produtos.reduce((acc: number, p: any) => {
    return Math.round((acc + p.vProd) * 100) / 100;
  }, 0);

  // ===============================
  // DESCONTO/ACRÉSCIMO — RATEIO POR PRODUTO (fiel ao Delphi, FATURAMENTOS_NF_ELETRONICA_2)
  // ===============================
  // dbfatura.desconto/acrescimo guardam o PERCENTUAL; o valor é DILUÍDO POR PRODUTO
  // (dbprodfat.desconto = round(bruto_item × %,2)). Na NF-e cada item leva vDesc/vOutro e
  // o total = Σ dos itens (SEFAZ exige ICMSTot.vDesc = Σ det.prod.vDesc). Resto de centavos
  // no ÚLTIMO item → Σ(itens) = round(totalProd × %) exatamente (bate com nota e cobrança).
  // IMPORTANTE (validado com dados reais no Oracle): o desconto REDUZ a base de ICMS —
  // baseicms_final = baseicms × (bruto−desconto)/bruto — e o valor do ICMS reduz junto.
  // Feito ANTES dos totais de imposto abaixo, para que vBC/vICMS já saiam líquidos.
  const r2n = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
  const descPercNf = String(dbfatura?.desconto_nf ?? 'N') === 'S' ? Number(dbfatura?.desconto ?? 0) : 0;
  const acrePercNf = String(dbfatura?.acrescimo_nf ?? 'N') === 'S' ? Number(dbfatura?.acrescimo ?? 0) : 0;
  const descTotalAlvo = descPercNf > 0 ? r2n(totalProdutos * descPercNf / 100) : 0;
  const acreTotalAlvo = acrePercNf > 0 ? r2n(totalProdutos * acrePercNf / 100) : 0;
  // Frete/seguro do cabeçalho: compõem o VALOR DA OPERAÇÃO (LC 214/2025 art. 12) e entram
  // na base de IBS/CBS. Diluídos por produto proporcional ao vProd (resto no último item),
  // igual ao desconto. NÃO alteram vProd nem o total da linha (ficam brutos no DANFE).
  const freteNum = Math.round(Number(dbfatura?.totalfrete ?? dbfatura?.vlrfrete ?? dbvenda?.vlrfrete ?? 0) * 100) / 100;
  const seguroNum = Math.round(Number(dbfatura?.vlrseg ?? dbvenda?.vlrseg ?? 0) * 100) / 100;
  let dAcum = 0;
  let aAcum = 0;
  let fAcum = 0;
  let sAcum = 0;
  const rateioProp = (total: number, acum: number, vProd: number, ult: boolean) =>
    total > 0 && totalProdutos > 0 ? (ult ? r2n(total - acum) : r2n(vProd * total / totalProdutos)) : 0;
  produtos.forEach((p: any, i: number) => {
    const ult = i === produtos.length - 1;
    p.vDesc = descPercNf > 0 ? (ult ? r2n(descTotalAlvo - dAcum) : r2n(p.vProd * descPercNf / 100)) : 0;
    p.vOutro = acrePercNf > 0 ? (ult ? r2n(acreTotalAlvo - aAcum) : r2n(p.vProd * acrePercNf / 100)) : 0;
    p.vFrete = rateioProp(freteNum, fAcum, p.vProd, ult);
    p.vSeg = rateioProp(seguroNum, sAcum, p.vProd, ult);
    dAcum += p.vDesc;
    aAcum += p.vOutro;
    fAcum += p.vFrete;
    sAcum += p.vSeg;
    // Redução da base/valor de ICMS pelo desconto (proporcional, preservando qualquer
    // redução de base já existente no item). Para item isento/ZFM (base 0) é no-op.
    if (p.vDesc > 0 && p.vProd > 0) {
      const fator = (p.vProd - p.vDesc) / p.vProd;
      p.icms.baseICMS = r2n(p.icms.baseICMS * fator);
      p.icms.vICMS = r2n(p.icms.vICMS * fator);
    }
    // Base de IBS/CBS = valor da operação por item = vProd − desconto + frete + seguro +
    // acréscimo (LC 214/2025 art. 12). Recalcula IBS/CBS sobre a base composta. Antes a
    // base era só vProd → IBS/CBS a menor (crítico a partir de 2027, CBS cheia).
    const baseOperIbsCbs = r2n(p.vProd - p.vDesc + p.vFrete + p.vSeg + p.vOutro);
    p.ibscbs.vBC = baseOperIbsCbs;
    p.ibscbs.vIBSUF = Math.round(baseOperIbsCbs * (p.ibscbs.pIBSUF || 0)) / 100;
    p.ibscbs.vIBSMun = Math.round(baseOperIbsCbs * (p.ibscbs.pIBSMun || 0)) / 100;
    p.ibscbs.vIBS = r2n(p.ibscbs.vIBSUF + p.ibscbs.vIBSMun);
    p.ibscbs.vCBS = Math.round(baseOperIbsCbs * (p.ibscbs.pCBS || 0)) / 100;
  });
  const descontoNum = descTotalAlvo;   // = Σ p.vDesc
  const acrescimoNum = acreTotalAlvo;  // = Σ p.vOutro

  // CALCULAR TOTAIS DE IMPOSTOS (aritmética de centavos) — já com a base de ICMS líquida
  const totalICMS = produtos.reduce((acc: number, p: any) => {
    return Math.round((acc + p.icms.vICMS) * 100) / 100;
  }, 0);
  
  const totalBaseICMS = produtos.reduce((acc: number, p: any) => {
    return Math.round((acc + p.icms.baseICMS) * 100) / 100;
  }, 0);
  
  const totalIPI = produtos.reduce((acc: number, p: any) => {
    return Math.round((acc + p.ipi.vIPI) * 100) / 100;
  }, 0);
  
  const totalPIS = produtos.reduce((acc: number, p: any) => {
    return Math.round((acc + p.pis.vPIS) * 100) / 100;
  }, 0);
  
  const totalCOFINS = produtos.reduce((acc: number, p: any) => {
    return Math.round((acc + p.cofins.vCOFINS) * 100) / 100;
  }, 0);

  // Totais IBS/CBS (Reforma Tributária 2026)
  const totalBaseIBSCBS = produtos.reduce((acc: number, p: any) => Math.round((acc + p.ibscbs.vBC) * 100) / 100, 0);
  const totalIBSUF = produtos.reduce((acc: number, p: any) => Math.round((acc + p.ibscbs.vIBSUF) * 100) / 100, 0);
  const totalIBSMun = produtos.reduce((acc: number, p: any) => Math.round((acc + p.ibscbs.vIBSMun) * 100) / 100, 0);
  const totalIBS = Math.round((totalIBSUF + totalIBSMun) * 100) / 100;
  const totalCBS = produtos.reduce((acc: number, p: any) => Math.round((acc + p.ibscbs.vCBS) * 100) / 100, 0);

  // vNF = vProd + vSeg + vFrete + vOutro - vDesc + vIPI (conforme manual Sefaz)
  // ICMS, PIS, COFINS estão INCLUÍDOS no vProd (CST 00/01); IPI é "por fora" (CST 50).
  // desconto/acréscimo/frete/seguro já foram diluídos por item acima (freteNum/seguroNum
  // declarados lá, antes dos totais de imposto, p/ compor a base de IBS/CBS).

  // Para Regime Normal com IPI por fora: vNF = vProd + vFrete + vSeg + vOutro - vDesc + vIPI
  const totalNF = Math.round((totalProdutos + freteNum + seguroNum + acrescimoNum - descontoNum + totalIPI) * 100) / 100;

  console.log(`🔍 [normalizarPayloadNFe] Totais calculados:`, {
    totalProdutos,
    totalIPI,
    totalNF: totalNF,
    calculo: `${totalProdutos} + ${totalIPI} = ${totalNF}`
  });

  // ===============================
  // TRANSPORTADORA
  // ===============================
  let nomeTransportadora = '';
  if (dbvenda?.transp) {
    try {
      const { data } = await axios.get(
        `/api/faturamento/transporte/${dbvenda.transp}`,
      );
      nomeTransportadora = data?.nome || dbvenda.transp;
    } catch (e) {
      nomeTransportadora = dbvenda.transp;
    }
  }

  // ===============================
  // RETORNO FINAL
  // ===============================

  // CORREÇÃO: A série deve vir de dbfatura.serie (pode ser alfanumérica: AA, AB, 1, etc)
  // Não gerar série automaticamente - usar sempre a série cadastrada na fatura
  const serieFatura = dbfatura?.serie || '1'; // Série da fatura (ex: AA, 1, AB)
  
  console.log(`🔍 [normalizarPayload] Série da fatura (dbfatura.serie): ${serieFatura} (tipo: ${typeof serieFatura})`);
  console.log(`🔍 [normalizarPayload] Número NFe (nroform): ${dbfatura?.nroform} (da fatura, sem zeros à esquerda no XML)`);
  console.log(`🔍 [normalizarPayload] Fontes dos dados:`, {
    dbfatura_existe: !!dbfatura,
    dbfatura_serie: dbfatura?.serie,
    dbfatura_nroform: dbfatura?.nroform,
    dbvenda_nrovenda: dbvenda?.nrovenda,
  });
  
  return {
    emitente, // Usando o emitente que já veio no payload
    cliente,
    produtos,
    vendedor: dbvenda?.codvend ?? '',
    transportadora: nomeTransportadora,
    // modFrete (frete por conta) — fiel ao Delphi: dbfatura.destfrete é BASE 1 e o XML usa
    // modFrete = destfrete − 1 (destfrete 1→0 CIF, 2→1 FOB, 10→9 sem ocorrência). Fallback
    // p/ modalidadeTransporte da venda (já 0-based) e, por fim, 0 (Remetente/CIF).
    modalidadeTransporte:
      dbfatura?.destfrete != null && dbfatura?.destfrete !== ''
        ? String((Number(dbfatura.destfrete) || 1) - 1)
        : (dbvenda?.modalidadeTransporte ?? '0'),
    data:
      dbvenda?.data && new Date(dbvenda.data).getFullYear() > 2020
        ? dbvenda.data
        : new Date().toISOString(),
    pedido: dbfatura?.nroform ?? dbvenda?.nrovenda ?? '',
    // CORREÇÃO: Série vem de dbfatura.serie (campo correto no banco)
    serie: serieFatura,
    mensagensNF: [],
    totalProdutos,
    totalBaseICMS,
    totalICMS,
    totalIPI, 
    totalPIS,
    totalCOFINS,
    totalBaseIBSCBS,
    totalIBSUF,
    totalIBSMun,
    totalIBS,
    totalCBS,
    totalNF,
    desconto: descontoNum.toFixed(2),
    acrescimo: acrescimoNum.toFixed(2),
    frete: freteNum.toFixed(2),
    seguro: seguroNum.toFixed(2),
    observacoes: dbvenda?.obs ?? '',

    especie: dbvenda?.especie ?? '',
    marca: dbvenda?.marca ?? '',
    numero: dbvenda?.numero ?? '',
    pesoBruto: dbvenda?.pesoBruto ?? '1.000',
    pesoLiquido: dbvenda?.pesoLiquido ?? '1.000',
    quantidade: dbvenda?.quantidade ?? '1',

    fatura: dbfatura,
    statusVenda: payload.statusVenda ?? {},
  };
}
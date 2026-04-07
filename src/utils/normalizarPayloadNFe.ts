import axios from 'axios';

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
    };
  });

  // CORREÇÃO CRÍTICA: Calcular totais com aritmética de centavos
  const totalProdutos = produtos.reduce((acc: number, p: any) => {
    return Math.round((acc + p.vProd) * 100) / 100;
  }, 0);

  // CALCULAR TOTAIS DE IMPOSTOS (aritmética de centavos)
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

  // vNF = vProd + vSeg + vFrete + vOutro - vDesc + vIPI (conforme manual Sefaz)
  // ICMS, PIS, COFINS estão INCLUÍDOS no vProd (CST 00/01)
  // IPI é "por fora" (CST 50) - deve ser somado
  const descontoNum = Math.round(Number(dbfatura?.vlrdesc ?? dbvenda?.vlrdesc ?? 0) * 100) / 100;
  const acrescimoNum = Math.round(Number(dbfatura?.vlracresc ?? dbvenda?.vlracresc ?? 0) * 100) / 100;
  const freteNum = Math.round(Number(dbfatura?.vlrfrete ?? dbvenda?.vlrfrete ?? 0) * 100) / 100;
  const seguroNum = Math.round(Number(dbfatura?.vlrseg ?? dbvenda?.vlrseg ?? 0) * 100) / 100;

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
    modalidadeTransporte: dbvenda?.modalidadeTransporte ?? '0',
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
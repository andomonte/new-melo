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
    tem_emitente: !!emitente
  });

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
    // cnpj: dbclien?.cpfcgc ?? '',
    cnpj: '18.053.139/0001-69',
    nome: dbclien?.nome ?? '',
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
  // PRODUTOS
  // ===============================
  const produtos = dbitvenda.map((item: any, index: number) => {
    const prod = item.dbprod ?? {};
    const qtde = Number(item.qtd ?? 1);
    const preco = Number(item.prunit ?? 0);
    const vProd = qtde * preco;
    
    // ✅ USAR VALORES REAIS DOS IMPOSTOS DO BANCO (não hardcoded)
    const vICMS = parseFloat(item.totalicms ?? '0') || 0;
    const vIPI = parseFloat(item.totalipi ?? '0') || 0;
    const vPIS = parseFloat(item.valorpis ?? '0') || 0;
    const vCOFINS = parseFloat(item.valorcofins ?? '0') || 0;
    const vFCP = parseFloat(item.valor_fcp ?? '0') || 0;
    
    // Calcular percentuais baseados nos valores reais (para compatibilidade)
    const pICMS = vProd > 0 ? (vICMS / vProd) * 100 : 0;
    const pIPI = vProd > 0 ? (vIPI / vProd) * 100 : 0;
    const pPIS = vProd > 0 ? (vPIS / vProd) * 100 : 0;
    const pCOFINS = vProd > 0 ? (vCOFINS / vProd) * 100 : 0;

    return {
      codprod: item.codprod ?? `P${index + 1}`,
      nome: prod.descr?.trim() || `Produto ${index + 1}`,
      qtde,
      preco,
      ncm: /^[0-9]{8}$/.test(prod.clasfiscal) ? prod.clasfiscal : '87089990',
      vProd,
      icms: {
        pICMS: parseFloat(pICMS.toFixed(2)),
        vICMS: parseFloat(vICMS.toFixed(2)),
        // Adicionar outros campos ICMS se necessário
        baseICMS: parseFloat(item.baseicms ?? '0') || vProd,
        cstICMS: (item.csticms ?? '00').toString().padStart(2, '0').slice(-2), // Garantir exatamente 2 dígitos
      },
      ipi: {
        pIPI: parseFloat(pIPI.toFixed(2)),
        vIPI: parseFloat(vIPI.toFixed(2)),
        cstIPI: item.cstipi ?? '50',
      },
      pis: {
        pPIS: parseFloat(pPIS.toFixed(2)),
        vPIS: parseFloat(vPIS.toFixed(2)),
        cstPIS: item.cstpis ?? '01',
      },
      cofins: {
        pCOFINS: parseFloat(pCOFINS.toFixed(2)),
        vCOFINS: parseFloat(vCOFINS.toFixed(2)),
        cstCOFINS: item.cstcofins ?? '01',
      },
      fcp: {
        vFCP: parseFloat(vFCP.toFixed(2)),
      },
      cfop: item.cfop ?? '5102',
    };
  });  const totalProdutos = produtos.reduce(
    (acc: number, p: any) => acc + p.vProd,
    0,
  );
  
  // ✅ CALCULAR TOTAIS DE IMPOSTOS USANDO VALORES REAIS
  const totalICMS = produtos.reduce((acc: number, p: any) => acc + p.icms.vICMS, 0);
  const totalIPI = produtos.reduce((acc: number, p: any) => acc + p.ipi.vIPI, 0);
  const totalPIS = produtos.reduce((acc: number, p: any) => acc + p.pis.vPIS, 0);
  const totalCOFINS = produtos.reduce((acc: number, p: any) => acc + p.cofins.vCOFINS, 0);
  const totalFCP = produtos.reduce((acc: number, p: any) => acc + p.fcp.vFCP, 0);
  
  const totalImpostos = totalICMS + totalIPI + totalPIS + totalCOFINS + totalFCP;
  
  // ✅ CALCULAR FRETE E SEGURO
  const frete = parseFloat(dbfatura?.vlrfrete ?? dbvenda?.vlrfrete ?? '0') || 0;
  const seguro = parseFloat(dbfatura?.vlrseg ?? dbvenda?.vlrseg ?? '0') || 0;
  
  // ✅ CALCULAR DESCONTO E ACRESCIMO DOS ITENS
  const totalDesconto = produtos.reduce((acc: number, p: any) => acc + (p.desconto || 0), 0);
  const totalAcrescimo = produtos.reduce((acc: number, p: any) => acc + (p.acrescimo || 0), 0);
  
  // ✅ CALCULAR DESCONTO E ACRESCIMO DA FATURA/VENDA
  const descontoFatura = parseFloat(dbfatura?.vlrdesc ?? dbvenda?.vlrdesc ?? '0') || 0;
  const acrescimoFatura = parseFloat(dbfatura?.vlracresc ?? dbvenda?.vlracresc ?? '0') || 0;
  
  // ✅ TOTAL DESCONTO E ACRESCIMO
  const descontoTotal = totalDesconto + descontoFatura;
  const acrescimoTotal = totalAcrescimo + acrescimoFatura;
  
  // ✅ TOTAL DA NF: vProd + vFrete + vSeg + vOutro - vDesc + impostos
  const totalNF = totalProdutos + frete + seguro + acrescimoTotal - descontoTotal + totalImpostos;

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

      const serienf = Number(Math.floor(Math.random() * 1000)).toString();
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
    pedido: dbvenda?.nrovenda ?? '',
    // --- CORREÇÃO APLICADA AQUI ---
    // Adicionado o campo 'serie'. Ajuste o nome 'dbvenda.serie' se for diferente no seu banco.
    serie: dbvenda?.numeroserie?? serienf,
    mensagensNF: [],
    totalProdutos,
    totalImpostos, // ✅ TOTAL DE IMPOSTOS CALCULADO COM VALORES REAIS
    totalNF,       // ✅ TOTAL DA NF INCLUINDO IMPOSTOS
    desconto: descontoTotal.toFixed(2),
    acrescimo: acrescimoTotal.toFixed(2),
    observacoes: dbvenda?.obs ?? '',

    especie: dbvenda?.especie ?? '',
    marca: dbvenda?.marca ?? '',
    numero: dbvenda?.numero ?? '',
    pesoBruto: dbvenda?.pesoBruto ?? '1.000',
    pesoLiquido: dbvenda?.pesoLiquido ?? '1.000',
    quantidade: dbvenda?.quantidade ?? '1',

    fatura: {
      ...dbfatura,
      frete: dbfatura?.vlrfrete ?? dbvenda?.vlrfrete ?? 0,
      seguro: dbfatura?.vlrseg ?? dbvenda?.vlrseg ?? 0,
    },
    statusVenda: payload.statusVenda ?? {},
  };
}

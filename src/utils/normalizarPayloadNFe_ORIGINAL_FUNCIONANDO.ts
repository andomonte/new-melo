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
  // PRODUTOS COM ARITMÉTICA DE CENTAVOS
  // ===============================
  const produtos = dbitvenda.map((item: any, index: number) => {
    const prod = item.dbprod ?? {};
    const qtde = Number(item.qtd ?? 1);
    const preco = Number(item.prunit ?? 0);
    // CORREÇÃO CRÍTICA: Usar aritmética de centavos
    const vProd = Math.round(qtde * preco * 100) / 100;

    return {
      codprod: item.codprod ?? `P${index + 1}`,
      nome: prod.descr?.trim() || `Produto ${index + 1}`,
      qtde,
      preco,
      ncm: /^[0-9]{8}$/.test(prod.clasfiscal) ? prod.clasfiscal : '87089990',
      vProd,
      // EXATAMENTE COMO O ORIGINAL QUE FUNCIONAVA: valores para compatibilidade, 
      // mas o XML força tudo para zero mesmo
      icms: {
        pICMS: 0,
        vICMS: 0,
      },
      ipi: {
        vIPI: 0,
      },
    };
  });

  // CORREÇÃO CRÍTICA: Usar aritmética de centavos para somas
  const totalProdutos = produtos.reduce((acc: number, p: any) => {
    return Math.round((acc + p.vProd) * 100) / 100;
  }, 0);
  const totalNF = totalProdutos;

  console.log(`🔍 [normalizarPayloadNFe] Totais calculados -> totalProdutos: ${totalProdutos} totalNF: ${totalNF}`);

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
    serie: dbvenda?.numeroserie ?? serienf,
    mensagensNF: [],
    totalProdutos,
    totalNF,
    desconto: '0.00',
    acrescimo: '0.00',
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
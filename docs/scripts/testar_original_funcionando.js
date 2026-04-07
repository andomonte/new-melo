// Importar como CommonJS
const fs = require('fs');
const { create } = require('xmlbuilder2');

// Copiar a função diretamente para evitar problemas de import
function calcularDV(chave) {
  let soma = 0;
  let peso = 2;
  for (let i = chave.length - 1; i >= 0; i--) {
    soma += parseInt(chave[i], 10) * peso;
    peso++;
    if (peso > 9) {
      peso = 2;
    }
  }
  const resto = soma % 11;
  const dv = 11 - resto;
  return (dv === 0 || dv === 10 || dv === 11) ? 0 : dv;
}

function formatarDataSefaz(data) {
  const pad = (num) => num.toString().padStart(2, '0');

  const ano = data.getFullYear();
  const mes = pad(data.getMonth() + 1);
  const dia = pad(data.getDate());
  const hora = pad(data.getHours());
  const minuto = pad(data.getMinutes());
  const segundo = pad(data.getSeconds());

  const fuso = '-04:00';
  
  return `${ano}-${mes}-${dia}T${hora}:${minuto}:${segundo}${fuso}`;
}

function gerarXMLNFe(dados) {
  const {
    emitente,
    cliente,
    produtos,
    transportadora,
    modalidadeTransporte,
    data,
    pedido,
    serie,
    mensagensNF,
    totalProdutos,
    totalNF,
    desconto,
    acrescimo,
    observacoes,
    especie,
    marca,
    numero,
    pesoBruto,
    pesoLiquido,
    quantidade,
    fatura,
  } = dados;

  console.log(`🔍 [gerarXMLNFe] Totais recebidos -> totalProdutos: ${totalProdutos} totalNF: ${totalNF} desconto: ${desconto} acrescimo: ${acrescimo}`);

  const cUF = '13';
  const dhEmi = new Date(data || new Date());
  const AAMM = dhEmi.getFullYear().toString().substring(2) + ('0' + (dhEmi.getMonth() + 1)).slice(-2);
  const CNPJ = emitente?.cnpj?.replace(/\D/g, '') ?? '';
  const mod = '55';
  
  const serieNF = Number(serie || Math.floor(Math.random() * 1000)).toString();
  const numeroNF = Number(pedido || '1').toString();

  const serieChave = ('000' + serieNF).slice(-3);
  const nNFChave = ('000000000' + numeroNF).slice(-9);
  const tpEmis = '1';

  const cNF = Math.floor(10000000 + Math.random() * 90000000).toString();

  const chaveSemDV = `${cUF}${AAMM}${CNPJ}${mod}${serieChave}${nNFChave}${tpEmis}${cNF}`;
  const cDV = calcularDV(chaveSemDV);
  const chaveAcesso = `${chaveSemDV}${cDV}`;

  const ieDestLimpa = cliente?.iest?.replace(/\D/g, '') ?? '';
  const destBlock = {
    CNPJ: cliente?.cnpj?.replace(/\D/g, '') ?? '',
    xNome: cliente?.nome || 'CLIENTE',
    enderDest: {
      xLgr: cliente?.ender ?? '',
      nro: cliente?.numero ?? 'S/N',
      xBairro: cliente?.bairro ?? '',
      cMun: '1302603',
      xMun: cliente?.cidade ?? '',
      UF: cliente?.uf ?? '',
      CEP: cliente?.cep?.replace(/\D/g, '') ?? '',
    },
  };

  if (ieDestLimpa && ieDestLimpa.length > 0) {
    destBlock.indIEDest = '1';
    destBlock.IE = ieDestLimpa;
  } else {
    destBlock.indIEDest = '9';
  }

  const xmlObj = {
    NFe: {
      '@xmlns': 'http://www.portalfiscal.inf.br/nfe',
      infNFe: {
        '@Id': `NFe${chaveAcesso}`,
        '@versao': '4.00',
        ide: {
          cUF,
          cNF,
          natOp: 'VENDA',
          mod,
          serie: serieNF,
          nNF: numeroNF,
          dhEmi: formatarDataSefaz(dhEmi),
          tpNF: '1',
          idDest: '1',
          cMunFG: '1302603',
          tpImp: '1',
          tpEmis,
          cDV,
          tpAmb: '2',
          finNFe: '1',
          indFinal: '1',
          indPres: '1',
          procEmi: '0',
          verProc: '1.0',
        },
        emit: {
          CNPJ,
          xNome: emitente?.xNome ?? '',
          enderEmit: {
            xLgr: emitente?.enderEmit?.xLgr ?? '',
            nro: emitente?.enderEmit?.nro ?? '',
            xBairro: emitente?.enderEmit?.xBairro ?? '',
            cMun: emitente?.enderEmit?.cMun ?? '',
            xMun: emitente?.enderEmit?.xMun ?? '',
            UF: emitente?.enderEmit?.UF ?? '',
            CEP: emitente?.enderEmit?.CEP?.replace(/\D/g, '') ?? '',
          },
          IE: emitente?.ie?.replace(/\D/g, '') ?? '',
          CRT: '1',
        },
        dest: destBlock,
        det: produtos.map((item, index) => {
          const preco = Number(item.preco ?? 0);
          const qtde = Number(item.qtde ?? 1);
          const vProd = Math.round(preco * qtde * 100) / 100;
          
          return {
            '@nItem': `${index + 1}`,
            prod: {
              cProd: item.codprod ?? `P${index + 1}`,
              cEAN: 'SEM GTIN',
              xProd: item.nome?.trim() || `Produto ${index + 1}`,
              NCM: item.ncm?.replace(/\D/g, '') ?? '00000000',
              CFOP: fatura?.cfop2 ?? '5102',
              uCom: item.unidade ?? 'UN',
              qCom: qtde.toFixed(4),
              vUnCom: preco.toFixed(4),
              vProd: vProd.toFixed(2),
              cEANTrib: 'SEM GTIN',
              uTrib: item.unidade ?? 'UN',
              qTrib: qtde.toFixed(4),
              vUnTrib: preco.toFixed(4),
              indTot: '1',
            },
            imposto: {
              vTotTrib: '0.00',
              ICMS: {
                ICMS00: {
                  orig: '0',
                  CST: '00',
                  modBC: '3',
                  vBC: vProd.toFixed(2),
                  pICMS: '0.00',
                  vICMS: '0.00',
                },
              },
              IPI: {
                cEnq: '999',
                IPITrib: {
                  CST: '50',
                  vBC: vProd.toFixed(2),
                  pIPI: '0.00',
                  vIPI: '0.00',
                },
              },
              PIS: { PISAliq: { CST: '01', vBC: vProd.toFixed(2), pPIS: '0.00', vPIS: '0.00' } },
              COFINS: { COFINSAliq: { CST: '01', vBC: vProd.toFixed(2), pCOFINS: '0.00', vCOFINS: '0.00' } }
            },
          };
        }),
        total: {
          ICMSTot: {
            vBC: Number(totalProdutos).toFixed(2),
            vICMS: '0.00',
            vICMSDeson: '0.00',
            vFCP: '0.00',
            vBCST: '0.00',
            vST: '0.00',
            vFCPST: '0.00',
            vFCPSTRet: '0.00',
            vProd: Number(totalProdutos).toFixed(2),
            vFrete: '0.00',
            vSeg: '0.00',
            vDesc: Number(desconto ?? 0).toFixed(2),
            vII: '0.00',
            vIPI: '0.00',
            vIPIDevol: '0.00',
            vPIS: '0.00',
            vCOFINS: '0.00',
            vOutro: Number(acrescimo ?? 0).toFixed(2),
            vNF: Number(totalNF).toFixed(2),
          },
        },
        transp: {
          modFrete: modalidadeTransporte || '0',
          ...(modalidadeTransporte !== '9' && modalidadeTransporte !== 9
            ? {
                transporta: {
                  xNome: (typeof transportadora === 'string' && transportadora.trim().length > 0) ? transportadora : 'TRANSPORTADORA',
                },
              }
            : {}),
          vol: {
            qVol: (quantidade && !isNaN(Number(quantidade)) && Number(quantidade) > 0)
              ? String(Number(quantidade))
              : '1',
            esp: (typeof especie === 'string' && especie.trim().length > 0) ? especie : 'VOL',
            marca: (typeof marca === 'string' && marca.trim().length > 0) ? marca : 'MARCA',
            nVol: (typeof numero === 'string' && numero.trim().length > 0) ? numero : '1',
            pesoL: Number(pesoLiquido ?? 0).toFixed(3),
            pesoB: Number(pesoBruto ?? 0).toFixed(3),
          },
        },
        pag: {
          detPag: {
            tPag: '01',
            vPag: Number(totalNF).toFixed(2),
          }
        },
        infAdic: {
          infCpl: ([...(mensagensNF ?? []), observacoes ?? ''].join(' | ') || '.'),
        },
        infRespTec: {
            CNPJ: '18053139000169',
            xContato: 'NOME DO RESPONSAVEL',
            email: 'email@desenvolvedor.com.br',
            fone: '92999999999',
        },
      },
    },
  };

  return create({ version: '1.0', encoding: 'UTF-8' }).ele(xmlObj).end({ prettyPrint: true });
}

// Simular dados como no seu sistema
const dadosSimulados = {
  emitente: {
    cnpj: '18053139000169',
    xNome: 'EMPRESA TESTE LTDA',
    enderEmit: {
      xLgr: 'RUA TESTE',
      nro: '123',
      xBairro: 'BAIRRO TESTE',
      cMun: '1302603',
      xMun: 'MANAUS',
      UF: 'AM',
      CEP: '69000000',
    },
    ie: '123456789',
  },
  cliente: {
    cnpj: '18053139000169', // Mesmo do seu código original
    nome: 'CLIENTE TESTE',
    iest: '',
    ender: 'RUA CLIENTE',
    numero: '456',
    bairro: 'BAIRRO CLIENTE',
    cidade: 'MANAUS',
    uf: 'AM',
    cep: '69000001',
  },
  produtos: [
    {
      codprod: 'P001',
      nome: 'PRODUTO TESTE 1',
      qtde: 2,
      preco: 15.50,
      ncm: '87089990',
      unidade: 'UN',
    },
    {
      codprod: 'P002',
      nome: 'PRODUTO TESTE 2',
      qtde: 3,
      preco: 22.33,
      ncm: '87089990',
      unidade: 'UN',
    }
  ],
  transportadora: '',
  modalidadeTransporte: '9',
  data: new Date().toISOString(),
  pedido: '12345',
  serie: '123',
  mensagensNF: [],
  totalProdutos: (2 * 15.50) + (3 * 22.33), // 31.00 + 66.99 = 97.99
  totalNF: (2 * 15.50) + (3 * 22.33),       // 97.99
  desconto: '0.00',
  acrescimo: '0.00',
  observacoes: 'Teste NFe',
  especie: 'VOL',
  marca: 'MARCA',
  numero: '1',
  pesoBruto: '2.000',
  pesoLiquido: '1.800',
  quantidade: '1',
  fatura: {
    cfop2: '5102'
  }
};

console.log('📊 Testando código ORIGINAL com aritmética de centavos...');
console.log(`Produto 1: 2 × 15.50 = ${2 * 15.50}`);
console.log(`Produto 2: 3 × 22.33 = ${3 * 22.33}`);
console.log(`Total esperado: ${(2 * 15.50) + (3 * 22.33)}`);

console.log('\n🔢 Testando aritmética de centavos:');
const p1_centavos = Math.round(2 * 15.50 * 100) / 100;
const p2_centavos = Math.round(3 * 22.33 * 100) / 100;
const total_centavos = Math.round((p1_centavos + p2_centavos) * 100) / 100;

console.log(`Produto 1 (centavos): ${p1_centavos}`);
console.log(`Produto 2 (centavos): ${p2_centavos}`);
console.log(`Total (centavos): ${total_centavos}`);

try {
  const xml = gerarXMLNFe(dadosSimulados);
  
  // Extrair valores do XML para validação
  const vProdMatch = xml.match(/<vProd>([\d.]+)<\/vProd>/g);
  const vNFMatch = xml.match(/<vNF>([\d.]+)<\/vNF>/);
  const vPagMatch = xml.match(/<vPag>([\d.]+)<\/vPag>/);
  
  console.log('\n✅ XML gerado com sucesso!');
  console.log('📋 Valores extraídos do XML:');
  
  if (vProdMatch) {
    console.log('vProd encontrados:', vProdMatch.map(m => m.replace(/<\/?vProd>/g, '')));
    const somaVProd = vProdMatch
      .map(m => parseFloat(m.replace(/<\/?vProd>/g, '')))
      .reduce((acc, val) => Math.round((acc + val) * 100) / 100, 0);
    console.log(`Soma vProd: ${somaVProd}`);
  }
  
  if (vNFMatch) {
    const vNF = vNFMatch[1];
    console.log(`vNF: ${vNF}`);
  }
  
  if (vPagMatch) {
    const vPag = vPagMatch[1];
    console.log(`vPag: ${vPag}`);
  }
  
  // Salvar o XML para inspeção
  fs.writeFileSync('xml_original_teste.xml', xml);
  console.log('\n💾 XML salvo como: xml_original_teste.xml');
  
} catch (error) {
  console.error('❌ Erro ao gerar XML:', error.message);
}
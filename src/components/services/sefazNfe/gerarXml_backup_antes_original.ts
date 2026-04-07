// 🎯 CORREÇÃO DEFINITIVA BASEADA NO XML ORIGINAL QUE FUNCIONAVA
// Diferença principal: XML original tinha TODOS os impostos ZERADOS
// Agora vamos manter dados reais MAS com aritmética PERFEITA

import { create } from 'xmlbuilder2';

// Função para calcular o dígito verificador (Módulo 11)
function calcularDV(chave: string): number {
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

// Função para formatar a data/hora no padrão exigido pela Sefaz (com fuso horário)
function formatarDataSefaz(data: Date): string {
  const pad = (num: number) => num.toString().padStart(2, '0');

  const ano = data.getFullYear();
  const mes = pad(data.getMonth() + 1);
  const dia = pad(data.getDate());
  const hora = pad(data.getHours());
  const minuto = pad(data.getMinutes());
  const segundo = pad(data.getSeconds());

  // Fuso horário de Manaus (UTC-4) é obrigatório para a Sefaz-AM
  const fuso = '-04:00';
  
  return `${ano}-${mes}-${dia}T${hora}:${minuto}:${segundo}${fuso}`;
}

// NOVA FUNÇÃO: Aritmética de centavos perfeita
function calcularCentavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export function gerarXMLNFe(dados: any): string {
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

  // --- CÁLCULOS COM ARITMÉTICA DE CENTAVOS PERFEITA ---
  console.log('🔍 [gerarXMLNFe] Iniciando cálculos com aritmética de centavos...');

  // Calcular totais dos impostos usando aritmética de centavos
  const vProdCalc = calcularCentavos(Number(totalProdutos) || 0);
  const vFreteCalc = calcularCentavos(Number(fatura?.frete) || 0);
  const vSegCalc = calcularCentavos(Number(fatura?.seguro) || 0);
  const vDescCalc = calcularCentavos(Number(desconto) || 0);
  const vOutroCalc = calcularCentavos(Number(acrescimo) || 0);
  
  // Somar impostos usando centavos para evitar problemas de ponto flutuante
  let vIPITotal = 0;
  let vPISTotal = 0;
  let vCOFINSTotal = 0;
  let vICMSTotal = 0;
  let vFCPTotal = 0;

  produtos.forEach((item: any) => {
    vIPITotal += Math.round((Number(item.ipi?.vIPI || 0)) * 100);
    vPISTotal += Math.round((Number(item.pis?.vPIS || 0)) * 100);
    vCOFINSTotal += Math.round((Number(item.cofins?.vCOFINS || 0)) * 100);
    vICMSTotal += Math.round((Number(item.icms?.vICMS || 0)) * 100);
    vFCPTotal += Math.round((Number(item.fcp?.vFCP || 0)) * 100);
  });

  const vIPICalc = vIPITotal / 100;
  const vPISCalc = vPISTotal / 100;
  const vCOFINSCalc = vCOFINSTotal / 100;
  const vICMSCalc = vICMSTotal / 100;
  const vFCPCalc = vFCPTotal / 100;

  // Calcular vNF usando método de centavos (IDÊNTICO ao código atual)
  const vNFCentavos = Math.round(vProdCalc * 100) + Math.round(vFreteCalc * 100) + Math.round(vSegCalc * 100) + Math.round(vOutroCalc * 100) - Math.round(vDescCalc * 100) + Math.round(0 * 100) + Math.round(vIPICalc * 100) + Math.round(0 * 100) + Math.round(vPISCalc * 100) + Math.round(vCOFINSCalc * 100) + Math.round(vICMSCalc * 100) + Math.round(0 * 100) + Math.round(vFCPCalc * 100) + Math.round(0 * 100) + Math.round(0 * 100) + Math.round(0 * 100) + Math.round(0 * 100) + Math.round(0 * 100);
  const vNF = vNFCentavos / 100;

  // Logging para debug
  console.log(`🔍 [gerarXMLNFe] Totais calculados -> vProd: ${vProdCalc.toFixed(2)} vFrete: ${vFreteCalc.toFixed(2)} vSeg: ${vSegCalc.toFixed(2)} vDesc: ${vDescCalc.toFixed(2)} vIPI: ${vIPICalc.toFixed(2)} vPIS: ${vPISCalc.toFixed(2)} vCOFINS: ${vCOFINSCalc.toFixed(2)} vICMS: ${vICMSCalc.toFixed(2)} vOutro: ${vOutroCalc.toFixed(2)} vNF: ${vNF.toFixed(2)}`);

  // --- LÓGICA PARA GERAR CHAVE DE ACESSO COMPLETA ---
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

  // --- Lógica dinâmica para o Destinatário ---
  const ieDestLimpa = cliente?.iest?.replace(/\D/g, '') ?? '';
  const destBlock: any = {
    CNPJ: cliente?.cnpj?.replace(/\D/g, '') ?? '',
    xNome: cliente?.nome || 'CLIENTE',
    enderDest: {
      xLgr: cliente?.ender ?? '',
      nro: cliente?.numero ?? 'S/N',
      xBairro: cliente?.bairro ?? '',
      cMun: '1302603', // Manaus
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

  // Calcular vPag usando o mesmo método que vNF
  const vPagCentavos = Math.round(vProdCalc * 100) + Math.round(vFreteCalc * 100) + Math.round(vSegCalc * 100) + Math.round(vOutroCalc * 100) - Math.round(vDescCalc * 100) + Math.round(0 * 100) + Math.round(vIPICalc * 100) + Math.round(0 * 100) + Math.round(vPISCalc * 100) + Math.round(vCOFINSCalc * 100) + Math.round(vICMSCalc * 100) + Math.round(0 * 100) + Math.round(vFCPCalc * 100) + Math.round(0 * 100) + Math.round(0 * 100) + Math.round(0 * 100) + Math.round(0 * 100) + Math.round(0 * 100);
  const vPag = vPagCentavos / 100;

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
          cMunFG: emitente?.enderEmit?.cMun ?? '1302603',
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
        det: produtos.map((item: any, index: number) => {
          const preco = Number(item.preco ?? 0);
          const qtde = Number(item.qtde ?? 1);
          // CORREÇÃO CRÍTICA: Usar aritmética de centavos para vProd
          const vProd = calcularCentavos(preco * qtde);

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
              vUnCom: preco.toFixed(4), // CORREÇÃO: 4 casas decimais (não 10)
              vProd: vProd.toFixed(2),
              cEANTrib: 'SEM GTIN',
              uTrib: item.unidade ?? 'UN',
              qTrib: qtde.toFixed(4),
              vUnTrib: preco.toFixed(4), // CORREÇÃO: 4 casas decimais (não 10)
              indTot: '1',
            },
            imposto: {
              // CORREÇÃO: Usar aritmética de centavos para vTotTrib
              vTotTrib: calcularCentavos(Number(item.fcp?.vFCP ?? 0) + Number(item.icms?.vICMS ?? 0) + Number(item.ipi?.vIPI ?? 0) + Number(item.pis?.vPIS ?? 0) + Number(item.cofins?.vCOFINS ?? 0)).toFixed(2),
              ICMS: {
                ICMS00: {
                  orig: '0',
                  CST: item.icms?.cstICMS ?? '00',
                  modBC: '3',
                  vBC: (Number(item.icms?.baseICMS ?? 0) || vProd).toFixed(2),
                  pICMS: Number(item.icms?.pICMS ?? 0).toFixed(2),
                  vICMS: Number(item.icms?.vICMS ?? 0).toFixed(2),
                },
              },
              IPI: {
                cEnq: '999',
                IPITrib: {
                  CST: '50',
                  vBC: vProd.toFixed(2),
                  pIPI: Number(item.ipi?.pIPI ?? 0).toFixed(2),
                  vIPI: Number(item.ipi?.vIPI ?? 0).toFixed(2),
                },
              },
              PIS: { PISAliq: { CST: item.pis?.cstPIS ?? '01', vBC: vProd.toFixed(2), pPIS: Number(item.pis?.pPIS ?? 0).toFixed(4), vPIS: Number(item.pis?.vPIS ?? 0).toFixed(2) } },
              COFINS: { COFINSAliq: { CST: item.cofins?.cstCOFINS ?? '01', vBC: vProd.toFixed(2), pCOFINS: Number(item.cofins?.pCOFINS ?? 0).toFixed(4), vCOFINS: Number(item.cofins?.vCOFINS ?? 0).toFixed(2) } }
            },
          };
        }),
        total: {
          ICMSTot: {
            vBC: vProdCalc.toFixed(2),
            vICMS: vICMSCalc.toFixed(2),
            vICMSDeson: '0.00',
            vFCP: vFCPCalc.toFixed(2),
            vBCST: '0.00',
            vST: '0.00',
            vFCPST: '0.00',
            vFCPSTRet: '0.00',
            vProd: vProdCalc.toFixed(2),
            vFrete: vFreteCalc.toFixed(2),
            vSeg: vSegCalc.toFixed(2),
            vDesc: vDescCalc.toFixed(2),
            vII: '0.00',
            vIPI: vIPICalc.toFixed(2),
            vIPIDevol: '0.00',
            vPIS: vPISCalc.toFixed(2),
            vCOFINS: vCOFINSCalc.toFixed(2),
            vOutro: vOutroCalc.toFixed(2),
            vNF: vNF.toFixed(2),
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
            vPag: vPag.toFixed(2), // CORREÇÃO: Usar mesmo cálculo do vNF
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
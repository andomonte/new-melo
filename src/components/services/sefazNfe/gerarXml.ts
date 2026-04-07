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

  // Converter para o horário de Manaus (UTC-4)
  // Se o servidor estiver em UTC, subtrai 4 horas
  const dataManaus = new Date(data.getTime() - (4 * 60 * 60 * 1000));
  
  const ano = dataManaus.getUTCFullYear();
  const mes = pad(dataManaus.getUTCMonth() + 1);
  const dia = pad(dataManaus.getUTCDate());
  const hora = pad(dataManaus.getUTCHours());
  const minuto = pad(dataManaus.getUTCMinutes());
  const segundo = pad(dataManaus.getUTCSeconds());

  // Fuso horário de Manaus (UTC-4) é obrigatório para a Sefaz-AM
  const fuso = '-04:00';
  
  return `${ano}-${mes}-${dia}T${hora}:${minuto}:${segundo}${fuso}`;
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
    serie, // Este é o valor que deve vir do seu sistema
    mensagensNF,
    totalProdutos,
    totalBaseICMS,
    totalICMS,
    totalIPI,
    totalPIS,
    totalCOFINS,
    totalNF,
    desconto,
    acrescimo,
    frete,
    seguro,
    observacoes,
    especie,
    marca,
    numero,
    pesoBruto,
    pesoLiquido,
    quantidade,
    fatura,
  } = dados;

  console.log(`🔍 [gerarXMLNFe] Totais recebidos:`, {
    totalProdutos,
    totalBaseICMS,
    totalICMS, 
    totalIPI,
    totalPIS,
    totalCOFINS,
    totalNF,
    desconto,
    acrescimo,
    frete,
    seguro
  });

  // 🔍 VALIDAÇÃO: Verificar se vBC (totalBaseICMS) corresponde à soma das bases dos itens
  const somaBasesItens = produtos.reduce((acc: number, p: any) => acc + (p.icms?.baseICMS || 0), 0);
  if (Math.abs(Number(totalBaseICMS) - somaBasesItens) > 0.01) {
    console.warn(`⚠️ [gerarXMLNFe] ATENÇÃO: totalBaseICMS (${totalBaseICMS}) difere da soma das bases dos itens (${somaBasesItens.toFixed(2)})`);
    console.warn(`   Isso pode causar rejeição SEFAZ cStat=531`);
  } else {
    console.log(`✅ [gerarXMLNFe] Validação OK: totalBaseICMS (${totalBaseICMS}) = soma bases itens (${somaBasesItens.toFixed(2)})`);
  }

  
  const cUF = '13';
  const dhEmi = new Date(data || new Date());
  const AAMM = dhEmi.getFullYear().toString().substring(2) + ('0' + (dhEmi.getMonth() + 1)).slice(-2);
  const CNPJ = emitente?.cnpj?.replace(/\D/g, '') ?? '';
  const mod = '55';
  const isCNPJ = CNPJ && CNPJ.length === 14;
  const isCPF = CNPJ && CNPJ.length === 11;
  
  // ⚠️ VALIDAÇÃO CRÍTICA: IE do emitente
  const ieEmitente = emitente?.ie?.replace(/\D/g, '') ?? '';
  if (!ieEmitente || ieEmitente.length < 9) {
    console.error('🚨 ERRO CRÍTICO: Inscrição Estadual (IE) do emitente está vazia ou inválida!');
    console.error('   IE recebida:', emitente?.ie);
    console.error('   IE limpa:', ieEmitente);
    console.error('   ⚠️  Isso pode causar erro "Série já vinculada a outra IE"');
    console.error('   ⚠️  Verifique o cadastro da empresa no banco de dados!');
  }
  
  // CORREÇÃO: A série SEMPRE vem de dbfatura.serie (pode ser alfanumérica: AA, AB, 1, etc)
  // Nunca gerar série automaticamente - usar sempre a do banco
  const serieNF = serie || '1';
  
  console.log(`🔍 [gerarXml] Série recebida (dbfatura.serie):`, serieNF, `(tipo: ${typeof serieNF})`);
  console.log(`🔍 [gerarXml] Documento: ${isCNPJ ? 'CNPJ' : isCPF ? 'CPF' : 'INDEFINIDO'}, Série NFe: ${serieNF}, Documento: ${CNPJ}`);
  
  // CORREÇÃO CRÍTICA: Converter para número inteiro para remover zeros à esquerda
  // SEFAZ exige padrão [1-9]{1}[0-9]{0,8} - primeiro dígito não pode ser zero
  const numeroNF = String(parseInt(pedido || '1', 10));
  
  console.log(`🔄 Número NFe (nNF): ${numeroNF} (convertido para inteiro - remove zeros à esquerda)`);
  console.log(`📋 Valor original do nroform: ${pedido}`);
  console.log(`⚠️ IMPORTANTE: SEFAZ não aceita zeros à esquerda no número da NFe`);
  

  // Preparar componentes da chave de acesso
  // CORREÇÃO: Converter série alfanumérica para numérica (3 dígitos)
  let serieChave: string;
  if (/^\d+$/.test(serieNF)) {
    // Série é numérica, apenas formatar com zeros à esquerda
    serieChave = ('000' + serieNF).slice(-3);
  } else {
    // Série é alfanumérica (ex: AA, AB), converter para código numérico
    // Usar soma dos códigos ASCII dos caracteres
    let codigoSerie = 0;
    for (let i = 0; i < serieNF.length; i++) {
      codigoSerie += serieNF.charCodeAt(i);
    }
    // Limitar a 999 e formatar com 3 dígitos
    serieChave = String(codigoSerie % 1000).padStart(3, '0');
    console.log(`🔄 Série alfanumérica "${serieNF}" convertida para código numérico: ${serieChave}`);
  }
  
  const nNFChave = ('000000000' + numeroNF).slice(-9); // 9 dígitos com zeros à esquerda
  const tpEmis = '1'; // Tipo de emissão: 1 = Normal

  // CORREÇÃO: cNF (Código Numérico) - SEMPRE 8 dígitos
  // IMPORTANTE: Deve ser único para cada emissão, mesmo com o mesmo número de NFe
  // Isso evita duplicidade quando há retry ou reemissão
  const numeroNFInt = parseInt(numeroNF, 10);
  
  // Gerar cNF único combinando:
  // - 4 dígitos do número da NFe (para rastreabilidade)
  // - 4 dígitos aleatórios (para unicidade em retry/reemissão)
  const parte1 = String(numeroNFInt).padStart(4, '0').slice(-4);
  const parte2 = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  const cNF = parte1 + parte2;
  
  // Validação: garantir que cNF tem exatamente 8 dígitos numéricossssssss
  if (cNF.length !== 8 || !/^\d{8}$/.test(cNF)) {
    throw new Error(`cNF deve ter 8 dígitos numéricos. Valor gerado: ${cNF} (${cNF.length} dígitos)`);
  }
  
  console.log(`🔑 Componentes da chave de acesso:`, {
    cUF,
    AAMM,
    CNPJ: CNPJ.substring(0, 8) + '...',
    mod,
    serie: serieChave,
    numeroNFe: nNFChave,
    tpEmis,
    cNF,
    cNF_length: cNF.length,
    cNF_parte1: parte1,
    cNF_parte2: parte2,
    nota: 'cNF único para evitar duplicidade em retry'
  });

  const chaveSemDV = `${cUF}${AAMM}${CNPJ}${mod}${serieChave}${nNFChave}${tpEmis}${cNF}`;
  const cDV = calcularDV(chaveSemDV);
  const chaveAcesso = `${chaveSemDV}${cDV}`;
  
  console.log(`✅ Chave de acesso gerada: ${chaveAcesso}`);

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
          // CORREÇÃO: Usar a mesma variável 'serieNF' aqui para garantir consistência.
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
          // CORREÇÃO: Usar campo correto baseado no tipo de documento
          ...(isCNPJ ? { CNPJ } : { CPF: CNPJ }), // Se for CPF, usar campo CPF; se CNPJ, usar campo CNPJ
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
          IE: ieEmitente, // ✅ Usar variável validada acima
          // 🆕 CRT dinâmico: obtido automaticamente da ReceitaWS ou cadastro
          CRT: emitente?.crt || '1', // Fallback para '1' se não informado
        },
        dest: destBlock,
        det: produtos.map((item: any, index: number) => {
          const preco = Number(item.preco ?? 0);
          const qtde = Number(item.qtde ?? 1);
          // CORREÇÃO CRÍTICA: Usar aritmética de centavos
          const vProd = Math.round(preco * qtde * 100) / 100;
          
          return {
            '@nItem': `${index + 1}`,
            prod: {
              cProd: item.codprod ?? `P${index + 1}`,
              cEAN: 'SEM GTIN',
              xProd: item.nome?.trim() || `Produto ${index + 1}`,
              NCM: item.ncm?.replace(/\D/g, '') ?? '00000000',
              CFOP: item.cfop ?? fatura?.cfop2 ?? '5102',
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
              // USANDO IMPOSTOS REAIS DO BANCO (aritmética de centavos)
              vTotTrib: (item.icms?.vICMS + item.ipi?.vIPI + item.pis?.vPIS + item.cofins?.vCOFINS + (item.fcp?.vFCP ?? 0)).toFixed(2),
              ICMS: {
                ICMS00: {
                  orig: '0',
                  CST: item.icms?.cstICMS ?? '00',
                  modBC: '3',
                  vBC: item.icms?.baseICMS?.toFixed(2) ?? vProd.toFixed(2),
                  pICMS: item.icms?.pICMS?.toFixed(2) ?? '0.00',
                  vICMS: item.icms?.vICMS?.toFixed(2) ?? '0.00',
                },
              },
              IPI: {
                cEnq: '999',
                IPITrib: {
                  CST: item.ipi?.cstIPI ?? '50',
                  vBC: item.ipi?.baseIPI?.toFixed(2) ?? vProd.toFixed(2),
                  pIPI: item.ipi?.pIPI?.toFixed(2) ?? '0.00',
                  vIPI: item.ipi?.vIPI?.toFixed(2) ?? '0.00',
                },
              },
              PIS: { 
                PISAliq: { 
                  CST: item.pis?.cstPIS ?? '01', 
                  vBC: vProd.toFixed(2), 
                  pPIS: item.pis?.pPIS?.toFixed(4) ?? '0.0000', 
                  vPIS: item.pis?.vPIS?.toFixed(2) ?? '0.00' 
                } 
              },
              COFINS: { 
                COFINSAliq: { 
                  CST: item.cofins?.cstCOFINS ?? '01', 
                  vBC: vProd.toFixed(2), 
                  pCOFINS: item.cofins?.pCOFINS?.toFixed(4) ?? '0.0000', 
                  vCOFINS: item.cofins?.vCOFINS?.toFixed(2) ?? '0.00' 
                } 
              }
            },
          };
        }),
        total: {
          ICMSTot: {
            vBC: Number(totalBaseICMS).toFixed(2),
            // USANDO TOTAIS REAIS CALCULADOS
            vICMS: Number(totalICMS ?? 0).toFixed(2),
            vICMSDeson: '0.00',
            vFCP: '0.00', // Somar FCP se houver
            vBCST: '0.00',
            vST: '0.00',
            vFCPST: '0.00',
            vFCPSTRet: '0.00',
            vProd: Number(totalProdutos).toFixed(2),
            vFrete: Number(frete ?? 0).toFixed(2),
            vSeg: Number(seguro ?? 0).toFixed(2),
            vDesc: Number(desconto ?? 0).toFixed(2),
            vII: '0.00',
            vIPI: Number(totalIPI ?? 0).toFixed(2),
            vIPIDevol: '0.00',
            vPIS: Number(totalPIS ?? 0).toFixed(2),
            vCOFINS: Number(totalCOFINS ?? 0).toFixed(2),
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
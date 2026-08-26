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

// Monta o grupo de ICMS conforme o CST. O schema da SEFAZ exige a tag compatível
// com o código: CST 00 -> <ICMS00>, 60 -> <ICMS60>, 40/41/50 -> <ICMS40>, etc.
// Emitir o CST dentro da tag errada causa "cvc-enumeration-valid".
// O payload traz apenas os campos básicos (base, alíquota, valor); campos de ST
// retido (CST 60) são opcionais no schema — só entram se vierem no payload.
function montarGrupoICMS(icms: any, vProdStr: string): Record<string, any> {
  const orig = String(icms?.origem ?? '0');
  const cst = String(icms?.cstICMS ?? '00').padStart(2, '0').slice(-2);
  const modBC = String(icms?.modBC ?? '3');
  const vBC = (icms?.baseICMS != null ? Number(icms.baseICMS) : Number(vProdStr)).toFixed(2);
  const pICMS = Number(icms?.pICMS ?? 0).toFixed(2);
  const vICMS = Number(icms?.vICMS ?? 0).toFixed(2);
  // Campos de ST na própria operação (CST 10/70), quando existirem.
  const modBCST = String(icms?.modBCST ?? '4');
  const vBCST = Number(icms?.vBCST ?? 0).toFixed(2);
  const pICMSST = Number(icms?.pICMSST ?? 0).toFixed(2);
  const vICMSST = Number(icms?.vICMSST ?? 0).toFixed(2);

  switch (cst) {
    case '00':
      return { ICMS00: { orig, CST: cst, modBC, vBC, pICMS, vICMS } };

    case '10':
      return { ICMS10: { orig, CST: cst, modBC, vBC, pICMS, vICMS, modBCST, vBCST, pICMSST, vICMSST } };

    case '20':
      return { ICMS20: { orig, CST: cst, modBC, pRedBC: Number(icms?.pRedBC ?? 0).toFixed(2), vBC, pICMS, vICMS } };

    case '40':
    case '41':
    case '50':
      // Isenta / não tributada / suspensão: apenas origem e CST.
      return { ICMS40: { orig, CST: cst } };

    case '51':
      return { ICMS51: { orig, CST: cst, modBC, vBC, pICMS, vICMS } };

    case '60': {
      // ICMS cobrado anteriormente por ST. Retenção (vBCSTRet, pST,
      // vICMSSubstituto, vICMSSTRet) é opcional — só inclui se vier no payload.
      const grupo: Record<string, any> = { orig, CST: cst };
      if (icms?.vBCSTRet != null) {
        grupo.vBCSTRet = Number(icms.vBCSTRet).toFixed(2);
        grupo.pST = Number(icms?.pST ?? 0).toFixed(4);
        grupo.vICMSSubstituto = Number(icms?.vICMSSubstituto ?? 0).toFixed(2);
        grupo.vICMSSTRet = Number(icms?.vICMSSTRet ?? 0).toFixed(2);
      }
      return { ICMS60: grupo };
    }

    case '70':
      return { ICMS70: { orig, CST: cst, modBC, pRedBC: Number(icms?.pRedBC ?? 0).toFixed(2), vBC, pICMS, vICMS, modBCST, vBCST, pICMSST, vICMSST } };

    default:
      // Catch-all schema-válido: <ICMS90> exige CST 90.
      return { ICMS90: { orig, CST: '90', modBC, vBC, pICMS, vICMS, vBCST, pICMSST, vICMSST } };
  }
}

// Monta o grupo de IPI conforme o CST. Tributado (00,49,50,99) -> <IPITrib> com
// base/alíquota/valor; demais (não tributado/isento/suspenso) -> <IPINT> só com CST.
function montarGrupoIPI(ipi: any, vProdStr: string): Record<string, any> {
  const cst = String(ipi?.cstIPI ?? '50').padStart(2, '0').slice(-2);
  const tributado = ['00', '49', '50', '99'].includes(cst);
  if (tributado) {
    return {
      cEnq: '999',
      IPITrib: {
        CST: cst,
        vBC: (ipi?.baseIPI != null ? Number(ipi.baseIPI) : Number(vProdStr)).toFixed(2),
        pIPI: Number(ipi?.pIPI ?? 0).toFixed(2),
        vIPI: Number(ipi?.vIPI ?? 0).toFixed(2),
      },
    };
  }
  return { cEnq: '999', IPINT: { CST: cst } };
}

// Monta o grupo de PIS conforme o CST. Tributado por alíquota (01,02) -> <PISAliq>;
// não tributado (04..09) -> <PISNT> só com CST; demais (49..99) -> <PISOutr>.
function montarGrupoPIS(pis: any, vProdStr: string): Record<string, any> {
  const cst = String(pis?.cstPIS ?? '01').padStart(2, '0').slice(-2);
  const vBC = Number(vProdStr).toFixed(2);
  const pPIS = Number(pis?.pPIS ?? 0).toFixed(4);
  const vPIS = Number(pis?.vPIS ?? 0).toFixed(2);
  if (['01', '02'].includes(cst)) return { PISAliq: { CST: cst, vBC, pPIS, vPIS } };
  if (['04', '05', '06', '07', '08', '09'].includes(cst)) return { PISNT: { CST: cst } };
  return { PISOutr: { CST: cst, vBC, pPIS, vPIS } };
}

// Monta o grupo de COFINS conforme o CST (mesma lógica do PIS).
function montarGrupoCOFINS(cofins: any, vProdStr: string): Record<string, any> {
  const cst = String(cofins?.cstCOFINS ?? '01').padStart(2, '0').slice(-2);
  const vBC = Number(vProdStr).toFixed(2);
  const pCOFINS = Number(cofins?.pCOFINS ?? 0).toFixed(4);
  const vCOFINS = Number(cofins?.vCOFINS ?? 0).toFixed(2);
  if (['01', '02'].includes(cst)) return { COFINSAliq: { CST: cst, vBC, pCOFINS, vCOFINS } };
  if (['04', '05', '06', '07', '08', '09'].includes(cst)) return { COFINSNT: { CST: cst } };
  return { COFINSOutr: { CST: cst, vBC, pCOFINS, vCOFINS } };
}

// Monta o grupo IBS/CBS por item (Reforma Tributária 2026 — NT 2025.002).
// O IBS é dividido em estadual (gIBSUF) e municipal (gIBSMun); vIBS = vIBSUF + vIBSMun.
function montarGrupoIBSCBS(ibs: any, vProdStr: string): Record<string, any> {
  const vBC = Number(ibs?.vBC ?? vProdStr).toFixed(2);
  const pIBSUF = Number(ibs?.pIBSUF ?? 0).toFixed(4);
  const vIBSUF = Number(ibs?.vIBSUF ?? 0).toFixed(2);
  const pIBSMun = Number(ibs?.pIBSMun ?? 0).toFixed(4);
  const vIBSMun = Number(ibs?.vIBSMun ?? 0).toFixed(2);
  const vIBS = Number(ibs?.vIBS ?? 0).toFixed(2);
  const pCBS = Number(ibs?.pCBS ?? 0).toFixed(4);
  const vCBS = Number(ibs?.vCBS ?? 0).toFixed(2);
  return {
    CST: String(ibs?.cst ?? '000').padStart(3, '0'),
    cClassTrib: String(ibs?.cClassTrib ?? '000001').padStart(6, '0'),
    gIBSCBS: {
      vBC,
      gIBSUF: { pIBSUF, vIBSUF },
      gIBSMun: { pIBSMun, vIBSMun },
      vIBS,
      gCBS: { pCBS, vCBS },
    },
  };
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
    totalBaseIBSCBS,
    totalIBSUF,
    totalIBSMun,
    totalIBS,
    totalCBS,
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
  // dhEmi = INSTANTE REAL da emissão (com hora), igual à NFC-e. Antes usava `data`
  // (data da VENDA, que vinha sem hora → 00:00 e com dia desatualizado); a SEFAZ
  // espera o momento real de emissão da nota, não a data do pedido/venda.
  const dhEmi = new Date();
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
  const tpEmis = '1'; // Tipo de emissão: 1 = Normal (sem contingência — igual ao legado)
  // Ambiente (1=produção, 2=homologação) vem parametrizado do chamador
  // (dadosEmpresa.ambiente); default homologação. Não entra na chave de acesso.
  const tpAmb = String(dados?.ambiente ?? '2');

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

  // SEFAZ (NT 2014/... regra de homologação): em AMBIENTE DE HOMOLOGAÇÃO
  // (tpAmb=2) o nome do destinatário DEVE ser exatamente este texto — senão
  // algumas UFs rejeitam. Deixa a emissão 100% conforme. Sem valor fiscal.
  if (tpAmb === '2') {
    destBlock.xNome = 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';
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
          // Natureza da operação vem da fatura (conforme a operação escolhida),
          // igual ao Delphi; default 'VENDA' quando não informada.
          natOp: String(dados?.naturezaOperacao || 'VENDA'),
          mod,
          // CORREÇÃO: Usar a mesma variável 'serieNF' aqui para garantir consistência.
          serie: serieNF,
          nNF: numeroNF,
          dhEmi: formatarDataSefaz(dhEmi),
          // tpNF: 0=entrada (devolução), 1=saída (venda, padrão)
          tpNF: String(dados?.tpNF ?? '1'),
          idDest: '1',
          cMunFG: '1302603',
          tpImp: '1',
          tpEmis,
          cDV,
          tpAmb,
          // finNFe: 1=normal (padrão), 4=devolução de mercadoria
          finNFe: String(dados?.finNFe ?? '1'),
          indFinal: '1',
          indPres: '1',
          procEmi: '0',
          verProc: '1.0',
          // Referência à NF-e original (devolução/estorno).
          ...(dados?.refNFe ? { NFref: { refNFe: String(dados.refNFe) } } : {}),
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
              // Desconto/acréscimo diluídos por produto (fiel ao Delphi). O SEFAZ exige
              // ICMSTot.vDesc = Σ prod.vDesc — por isso o rateio vem por item, não só total.
              ...(Number(item.vDesc) > 0 ? { vDesc: Number(item.vDesc).toFixed(2) } : {}),
              ...(Number(item.vOutro) > 0 ? { vOutro: Number(item.vOutro).toFixed(2) } : {}),
              indTot: '1',
            },
            imposto: {
              // USANDO IMPOSTOS REAIS DO BANCO (aritmética de centavos)
              vTotTrib: (item.icms?.vICMS + item.ipi?.vIPI + item.pis?.vPIS + item.cofins?.vCOFINS + (item.fcp?.vFCP ?? 0)).toFixed(2),
              // Grupo de ICMS montado conforme o CST (tag precisa casar com o código).
              ICMS: montarGrupoICMS(item.icms, vProd.toFixed(2)),
              // Grupos IPI/PIS/COFINS montados conforme o CST (tag casa com o código).
              IPI: montarGrupoIPI(item.ipi, vProd.toFixed(2)),
              PIS: montarGrupoPIS(item.pis, vProd.toFixed(2)),
              COFINS: montarGrupoCOFINS(item.cofins, vProd.toFixed(2)),
              // IBS/CBS (Reforma Tributária 2026)
              IBSCBS: montarGrupoIBSCBS(item.ibscbs, vProd.toFixed(2)),
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
          // Totais IBS/CBS (Reforma Tributária 2026 — NT 2025.002)
          IBSCBSTot: {
            vBCIBSCBS: Number(totalBaseIBSCBS ?? 0).toFixed(2),
            gIBS: {
              gIBSUF: {
                vDif: '0.00',
                vDevTrib: '0.00',
                vIBSUF: Number(totalIBSUF ?? 0).toFixed(2),
              },
              gIBSMun: {
                vDif: '0.00',
                vDevTrib: '0.00',
                vIBSMun: Number(totalIBSMun ?? 0).toFixed(2),
              },
              vIBS: Number(totalIBS ?? 0).toFixed(2),
              vCredPres: '0.00',
              vCredPresCondSus: '0.00',
            },
            gCBS: {
              vDif: '0.00',
              vDevTrib: '0.00',
              vCBS: Number(totalCBS ?? 0).toFixed(2),
              vCredPres: '0.00',
              vCredPresCondSus: '0.00',
            },
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
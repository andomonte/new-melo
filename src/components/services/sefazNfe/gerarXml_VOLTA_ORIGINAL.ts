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

  // --- LÓGICA PARA GERAR CHAVE DE ACESSO COMPLETA ---
  const cUF = '13';
  const dhEmi = new Date(data || new Date());
  const AAMM = dhEmi.getFullYear().toString().substring(2) + ('0' + (dhEmi.getMonth() + 1)).slice(-2);
  const CNPJ = emitente?.cnpj?.replace(/\D/g, '') ?? '';
  const mod = '55';
  
  // CORREÇÃO: Usar a variável 'serie' que vem dos dados.
  // Lembre-se que para resolver a Rejeição 997, este valor não pode ser '1'.

  const serieNF = Number(serie || Math.floor(Math.random() * 1000)).toString();
  const numeroNF = Number(pedido || '1').toString();

  const serieChave = ('000' + serieNF).slice(-3);
  const nNFChave = ('000000000' + numeroNF).slice(-9);
  const tpEmis = '1';

  // O cNF é um código numérico aleatório que compõe a chave. Esta parte está correta.
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
          // CORREÇÃO: Alterado para '1' (Simples Nacional).
          // O ideal é que este valor venha do cadastro da empresa no seu sistema.
          CRT: '1',
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
              // EXATAMENTE COMO O SEU ORIGINAL QUE FUNCIONAVA
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
            // EXATAMENTE COMO O SEU ORIGINAL QUE FUNCIONAVA
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
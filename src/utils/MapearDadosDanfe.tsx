// Coloque esta função no mesmo arquivo ou em um arquivo de 'utils'
import qrcode from 'qrcode';
import { parseStringPromise } from 'xml2js';

interface Emitente {
  nome: string;
  razaoSocial: string;
  cnpj: string;
  ie: string;
  endereco: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone: string;
}

interface Destinatario {
  nome: string;
  cpfCnpj: string;
  endereco: string;
  bairro: string;
  cep: string;
  cidade: string;
  telefone: string;
}

interface Produto {
  codigo: string;
  descricao: string;
  ncm: string;
  cst: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

interface Totais {
  valorProdutos: number;
  desconto: number;
  valorNota: number;
}

interface DanfeData {
  emitente: Emitente;
  destinatario: Destinatario;
  produtos: Produto[];
  totais: Totais;
  info: {
    numero: string;
    serie: string;
    dataEmissao: string;
    dataSaida: string;
    chaveAcesso: string;
    protocolo: string;
    formaPagamento: string;
    infoComplementar: string;
  };
  // O QR Code será gerado como uma imagem e passado como buffer
  qrCodeImage: Buffer; 
}
// Lembre-se de importar as interfaces (DanfeData, etc.)


// (As interfaces Emitente, Destinatario, etc. continuam aqui)

// Objeto de mapeamento
const formasPagamentoMap = {
  '01': 'Dinheiro',
  '02': 'Cheque',
  '03': 'Cartão de Crédito',
  '04': 'Cartão de Débito',
  '17': 'PIX',
  '99': 'Outros',
};

// ✅ PASSO 1: Criar um tipo dinâmico a partir das chaves do objeto
type CodigoPagamento = keyof typeof formasPagamentoMap;


async function mapearDadosParaDanfe(
    // ✅ PASSO 2: Usar o novo tipo na assinatura da função
    dados: { xmlBruto: any; pag: { detPag: { tPag: CodigoPagamento; }[] }; emitente: { xNome: any; cnpj: any; ie: any; enderEmit: { xLgr: any; nro: any; xMun: any; UF: any; CEP: any; }; }; dest: { xNome: any; CPF: any; CNPJ: any; enderDest: { xLgr: any; nro: any; xBairro: any; CEP: any; xMun: any; fone: any; }; }; det: any[]; total: { ICMSTot: { vProd: string; vDesc: string; vNF: string; }; }; ide: { nNF: any; serie: any; dhEmi: string | number | Date; dhSaiEnt: string | number | Date; }; infAdic: { infCpl: any; }; }, 
    respostaSefaz: { Envelope: { Body: { nfeResultMsg: { retEnviNFe: any; }; }; }; }
): Promise<DanfeData> {
  const retEnviNFe = respostaSefaz.Envelope.Body.nfeResultMsg.retEnviNFe;
  const infProt = retEnviNFe.protNFe.infProt;
  
  const xmlNFeObj = await parseStringPromise(dados.xmlBruto, { explicitArray: false });
  const urlQrCode = xmlNFeObj.NFe.infNFeSupl.qrCode;

  const codPagamento = dados.pag.detPag[0].tPag;
  
  const dadosDanfe: DanfeData = {
    emitente: {
      nome: dados.emitente.xNome,
      razaoSocial: dados.emitente.xNome,
      cnpj: dados.emitente.cnpj,
      ie: dados.emitente.ie,
      endereco: `${dados.emitente.enderEmit.xLgr}, ${dados.emitente.enderEmit.nro}`,
      cidade: dados.emitente.enderEmit.xMun,
      uf: dados.emitente.enderEmit.UF,
      cep: dados.emitente.enderEmit.CEP,
      telefone: '',
    },
    destinatario: {
      nome: dados.dest.xNome,
      cpfCnpj: dados.dest.CPF || dados.dest.CNPJ,
      endereco: `${dados.dest.enderDest.xLgr}, ${dados.dest.enderDest.nro}`,
      bairro: dados.dest.enderDest.xBairro,
      cep: dados.dest.enderDest.CEP,
      cidade: dados.dest.enderDest.xMun,
      telefone: dados.dest.enderDest.fone || '',
    },
    produtos: dados.det.map(item => ({
      codigo: item.prod.cProd,
      descricao: item.prod.xProd,
      ncm: item.prod.NCM,
      cst: item.imposto.ICMS.ICMS00?.CST || item.imposto.ICMS.ICMSSN102?.CSOSN || '00',
      cfop: item.prod.CFOP,
      unidade: item.prod.uCom,
      quantidade: parseFloat(item.prod.qCom),
      valorUnitario: parseFloat(item.prod.vUnCom),
      valorTotal: parseFloat(item.prod.vProd),
    })),
    totais: {
      valorProdutos: parseFloat(dados.total.ICMSTot.vProd),
      desconto: parseFloat(dados.total.ICMSTot.vDesc),
      valorNota: parseFloat(dados.total.ICMSTot.vNF),
    },
    info: {
      numero: dados.ide.nNF,
      serie: dados.ide.serie,
      dataEmissao: new Date(dados.ide.dhEmi).toLocaleString('pt-BR'),
      dataSaida: dados.ide.dhSaiEnt ? new Date(dados.ide.dhSaiEnt).toLocaleString('pt-BR') : '',
      chaveAcesso: infProt.chNFe,
      protocolo: infProt.nProt,
      // ✅ Agora o TypeScript sabe que 'codPagamento' é uma chave válida!
      formaPagamento: formasPagamentoMap[codPagamento] || 'Outros',
      infoComplementar: dados.infAdic?.infCpl || '',
    },
    qrCodeImage: await qrcode.toBuffer(urlQrCode),
  };

  return dadosDanfe;
}

export default mapearDadosParaDanfe;
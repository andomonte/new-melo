/**
 * API para processar XML de CTe e extrair dados
 *
 * POST /api/cte/parse-xml
 * Body: { xml: string }
 *
 * Retorna dados extraídos do CTe para preencher o formulário
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { parseStringPromise } from 'xml2js';

interface CteData {
  // Identificação
  chave: string;
  nrocon: string;
  serie: string;
  cfop: string;
  dtcon: string;

  // Transportadora
  transp_cnpj: string;
  transp_nome: string;
  transp_uf: string;

  // Remetente
  rem_cnpj: string;
  rem_nome: string;
  rem_uf: string;

  // Destinatário
  dest_cnpj: string;
  dest_nome: string;
  dest_uf: string;

  // Valores
  totalcon: number;
  totaltransp: number;
  baseicms: number;
  icms: number;
  aliqicms: number;

  // Pesos
  kg: number;
  kgcub: number;

  // Outros
  tipocon: '08' | '09' | '10';
  cif: 'S' | 'N';
  protocolo: string;

  // NFes vinculadas
  nfes_vinculadas: string[];
}

// Helper para extrair valor de forma segura
function getVal(obj: any, ...paths: string[]): string | null {
  for (const path of paths) {
    const keys = path.split('.');
    let value = obj;
    for (const key of keys) {
      if (value && typeof value === 'object') {
        value = value[key];
        if (Array.isArray(value)) {
          value = value[0];
        }
      } else {
        value = null;
        break;
      }
    }
    if (value !== null && value !== undefined) {
      if (typeof value === 'object' && value._) {
        return value._;
      }
      return String(value);
    }
  }
  return null;
}

// Determina tipo de transporte baseado no modal
function getTipoTransporte(modal: string): '08' | '09' | '10' {
  switch (modal) {
    case '01': return '08'; // Rodoviário
    case '02': return '10'; // Aéreo
    case '03': return '09'; // Aquaviário
    case '04': return '08'; // Ferroviário -> Rodoviário
    default: return '08';   // Default Rodoviário
  }
}

// Formata data ISO para YYYY-MM-DD
function formatDate(dateStr: string | null): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];

  // Remove timezone se existir
  const cleanDate = dateStr.split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
    return cleanDate;
  }

  // Tenta parse de data ISO completa
  try {
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { xml } = req.body;

  if (!xml) {
    return res.status(400).json({
      success: false,
      error: 'XML é obrigatório'
    });
  }

  try {
    // Parse XML
    const result = await parseStringPromise(xml, {
      explicitArray: false,
      ignoreAttrs: false,
      tagNameProcessors: [(name) => name.replace(/^.*:/, '')] // Remove namespaces
    });

    // Encontrar nó principal do CTe
    let cteNode = result.cteProc?.CTe || result.CTe || result;
    let infCte = cteNode?.infCte;

    if (!infCte) {
      // Tenta outra estrutura
      infCte = result?.cteProc?.CTe?.infCte ||
               result?.CTe?.infCte ||
               result?.infCte;
    }

    if (!infCte) {
      return res.status(400).json({
        success: false,
        error: 'Estrutura do CTe não encontrada no XML. Verifique se é um XML de CTe válido.'
      });
    }

    // Extrair chave do atributo Id
    let chave = infCte.$?.Id || '';
    if (chave.startsWith('CTe')) {
      chave = chave.substring(3);
    }

    // Extrair dados de identificação
    const ide = infCte.ide || {};
    const nrocon = getVal(ide, 'nCT') || '';
    const serie = getVal(ide, 'serie') || '1';
    const cfop = getVal(ide, 'CFOP') || '6352';
    const modal = getVal(ide, 'modal') || '01';
    const dhEmi = getVal(ide, 'dhEmi') || '';

    // Transportadora (emitente do CTe)
    const emit = infCte.emit || {};
    const enderEmit = emit.enderEmit || {};
    const transp_cnpj = getVal(emit, 'CNPJ') || '';
    const transp_nome = getVal(emit, 'xNome') || getVal(emit, 'xFant') || '';
    const transp_uf = getVal(enderEmit, 'UF') || '';

    // Remetente
    const rem = infCte.rem || {};
    const enderRem = rem.enderReme || {};
    const rem_cnpj = getVal(rem, 'CNPJ') || getVal(rem, 'CPF') || '';
    const rem_nome = getVal(rem, 'xNome') || '';
    const rem_uf = getVal(enderRem, 'UF') || '';

    // Destinatário
    const dest = infCte.dest || {};
    const enderDest = dest.enderDest || {};
    const dest_cnpj = getVal(dest, 'CNPJ') || getVal(dest, 'CPF') || '';
    const dest_nome = getVal(dest, 'xNome') || '';
    const dest_uf = getVal(enderDest, 'UF') || '';

    // Valores da prestação
    const vPrest = infCte.vPrest || {};
    const totalcon = parseFloat(getVal(vPrest, 'vTPrest') || '0');
    const totaltransp = parseFloat(getVal(vPrest, 'vRec') || getVal(vPrest, 'vTPrest') || '0');

    // ICMS
    const imp = infCte.imp || {};
    let icmsNode = imp.ICMS?.ICMS00 || imp.ICMS?.ICMS20 || imp.ICMS?.ICMS45 ||
                   imp.ICMS?.ICMS60 || imp.ICMS?.ICMS90 || imp.ICMS?.ICMSOutraUF || {};

    const baseicms = parseFloat(getVal(icmsNode, 'vBC') || '0');
    const icms = parseFloat(getVal(icmsNode, 'vICMS') || '0');
    const aliqicms = parseFloat(getVal(icmsNode, 'pICMS') || '0');

    // Pesos (infCarga)
    const infCarga = infCte.infCTeNorm?.infCarga || {};
    let kg = 0;
    let kgcub = 0;

    // infQ pode ser array ou objeto
    const infQList = Array.isArray(infCarga.infQ) ? infCarga.infQ : [infCarga.infQ].filter(Boolean);
    for (const infQ of infQList) {
      const cUnid = getVal(infQ, 'cUnid');
      const qCarga = parseFloat(getVal(infQ, 'qCarga') || '0');
      const tpMed = getVal(infQ, 'tpMed') || '';

      if (cUnid === '01') { // KG
        if (tpMed.toUpperCase().includes('CUBADO') || tpMed.toUpperCase().includes('CUBAGEM')) {
          kgcub = qCarga;
        } else {
          kg = qCarga;
        }
      }
    }

    // NFes vinculadas
    const infDoc = infCte.infCTeNorm?.infDoc || {};
    const nfes_vinculadas: string[] = [];

    // infNFe pode ser array ou objeto
    const infNFeList = Array.isArray(infDoc.infNFe) ? infDoc.infNFe : [infDoc.infNFe].filter(Boolean);
    for (const infNFe of infNFeList) {
      const chaveNfe = getVal(infNFe, 'chave');
      if (chaveNfe) {
        nfes_vinculadas.push(chaveNfe);
      }
    }

    // Protocolo de autorização
    const protCTe = result.cteProc?.protCTe || cteNode?.protCTe || {};
    const infProt = protCTe.infProt || {};
    const protocolo = getVal(infProt, 'nProt') || '';

    // Determinar CIF/FOB
    // Por padrão consideramos FOB (frete a pagar pelo destinatário)
    // Se tiver tomador = 0 (remetente), é CIF
    const toma = getVal(ide, 'toma3.toma') || getVal(ide, 'toma4.toma') || getVal(ide, 'toma') || '3';
    // toma: 0=Remetente, 1=Expedidor, 2=Recebedor, 3=Destinatário, 4=Outros
    const cif: 'S' | 'N' = toma === '0' ? 'S' : 'N';

    const cteData: CteData = {
      chave,
      nrocon,
      serie,
      cfop,
      dtcon: formatDate(dhEmi),

      transp_cnpj,
      transp_nome,
      transp_uf,

      rem_cnpj,
      rem_nome,
      rem_uf,

      dest_cnpj,
      dest_nome,
      dest_uf,

      totalcon,
      totaltransp,
      baseicms,
      icms,
      aliqicms,

      kg,
      kgcub,

      tipocon: getTipoTransporte(modal),
      cif,
      protocolo,

      nfes_vinculadas
    };

    return res.status(200).json({
      success: true,
      data: cteData,
      message: `CTe ${nrocon} processado com sucesso. ${nfes_vinculadas.length} NF-e(s) vinculada(s).`
    });

  } catch (error) {
    console.error('Erro ao processar XML do CTe:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao processar XML do CTe',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

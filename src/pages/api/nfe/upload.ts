import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import formidable from 'formidable';
import fs from 'fs';
import { parseStringPromise } from 'xml2js';

export const config = {
  api: {
    bodyParser: false,
  },
};

interface NFDataExtracted {
  chave: string;
  serie: number;
  nnf: number;
  demi: Date;
  vnf: number;
  // Campos de impostos do ICMSTot
  vbc: number;
  vicms: number;
  vbcst: number;
  vst: number;
  vprod: number;
  vfrete: number;
  vseg: number;
  vdesc: number;
  vii: number;
  vipi: number;
  vpis: number;
  vcofins: number;
  voutro: number;
  vtottrib: number;
  vipidevol: number;
  xml_completo: string;
  emitente: {
    cnpj: string;
    xnome: string;
    xlgr?: string;
    nro?: string;
    xbairro?: string;
    xmun?: string;
    uf?: string;
    cep?: string;
    ie?: string;
  };
  destinatario?: {
    cnpj?: string;
    xnome?: string;
    xlgr?: string;
    nro?: string;
    xbairro?: string;
    xmun?: string;
    uf?: string;
    cep?: string;
    ie?: string;
  };
  itens: Array<{
    nitem: string;
    cprod: string;
    xprod: string;
    qcom: number;
    vuncom: number;
    vprod: number;
    ncm?: string;
    cfop?: number;
  }>;
  parcelas?: Array<{
    nDup: string;
    dVenc: string;
    vDup: number;
  }>;
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial n\u00e3o informada no cookie' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  const pgPool = getPgPool(filial);
  const pgClient = await pgPool.connect();

  try {
    await pgClient.query('SET search_path TO db_manaus');

    const form = formidable({
      multiples: true,
      maxFileSize: 5 * 1024 * 1024, // 5MB
    });

    const [, files] = await form.parse(req);
    const uploadedFiles = Array.isArray(files.xmlFiles) ? files.xmlFiles : files.xmlFiles ? [files.xmlFiles] : [];

    if (uploadedFiles.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo XML enviado' });
    }

    const results: Array<{ file: string | null; nfe: string; chave: string; status: string }> = [];
    const errors: string[] = [];

    for (const file of uploadedFiles) {
      try {
        // Ler conte\u00fado do arquivo XML
        const xmlContent = fs.readFileSync(file.filepath, 'utf8');

        // Parse do XML
        const xmlData = await parseStringPromise(xmlContent);

        // Extrair dados da NFe
        const nfeData = extractNFeData(xmlData, xmlContent);

        // Verificar se a NFe j\u00e1 existe
        const existingResult = await pgClient.query(
          'SELECT chave FROM dbnfe_ent WHERE chave = $1',
          [nfeData.chave]
        );

        if (existingResult.rows.length > 0) {
          errors.push(`NFe ${nfeData.nnf}/${nfeData.serie} - Chave ${nfeData.chave} j\u00e1 existe no sistema`);
          continue;
        }

        // Gerar c\u00f3digo sequencial para a NFe
        const lastNFeResult = await pgClient.query(
          'SELECT codnfe_ent FROM dbnfe_ent ORDER BY codnfe_ent DESC LIMIT 1'
        );

        const nextCode = lastNFeResult.rows.length > 0
          ? (parseInt(lastNFeResult.rows[0].codnfe_ent) + 1).toString().padStart(9, '0')
          : '000000001';

        // Iniciar transa\u00e7\u00e3o
        await pgClient.query('BEGIN');

        try {
          // Inserir NFe principal com todos os campos de impostos
          await pgClient.query(`
            INSERT INTO dbnfe_ent (
              codnfe_ent, chave, serie, nnf, demi, vnf, exec, dtimport,
              vbc, vicms, vbcst, vst, vprod, vfrete, vseg, vdesc,
              vii, vipi, vpis, vcofins, voutro, vtottrib, vipidevol,
              xml_completo
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8,
              $9, $10, $11, $12, $13, $14, $15, $16,
              $17, $18, $19, $20, $21, $22, $23,
              $24
            )
          `, [
            nextCode, nfeData.chave, nfeData.serie, nfeData.nnf, nfeData.demi, nfeData.vnf, 'N', new Date(),
            nfeData.vbc, nfeData.vicms, nfeData.vbcst, nfeData.vst, nfeData.vprod, nfeData.vfrete, nfeData.vseg, nfeData.vdesc,
            nfeData.vii, nfeData.vipi, nfeData.vpis, nfeData.vcofins, nfeData.voutro, nfeData.vtottrib, nfeData.vipidevol,
            nfeData.xml_completo
          ]);

          // Inserir dados do emitente
          await pgClient.query(`
            INSERT INTO dbnfe_ent_emit (
              codnfe_ent, cpf_cnpj, xnome, xlgr, nro, xbairro, xmun, uf, cep, ie
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `, [
            nextCode, nfeData.emitente.cnpj, nfeData.emitente.xnome,
            nfeData.emitente.xlgr, nfeData.emitente.nro, nfeData.emitente.xbairro,
            nfeData.emitente.xmun, nfeData.emitente.uf, nfeData.emitente.cep, nfeData.emitente.ie
          ]);

          // Inserir dados do destinat\u00e1rio se existir
          if (nfeData.destinatario) {
            await pgClient.query(`
              INSERT INTO dbnfe_ent_dest (
                codnfe_ent, cpf_cnpj, xnome, xlgr, nro, xbairro, xmun, uf, cep, ie
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [
              nextCode, nfeData.destinatario.cnpj, nfeData.destinatario.xnome,
              nfeData.destinatario.xlgr, nfeData.destinatario.nro, nfeData.destinatario.xbairro,
              nfeData.destinatario.xmun, nfeData.destinatario.uf, nfeData.destinatario.cep, nfeData.destinatario.ie
            ]);
          }

          // Inserir itens da NFe
          for (const item of nfeData.itens) {
            await pgClient.query(`
              INSERT INTO dbnfe_ent_det (
                codnfe_ent, nitem, cprod, xprod, qcom, vuncom, vprod, ncm, cfop
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
              nextCode, item.nitem, item.cprod, item.xprod,
              item.qcom, item.vuncom, item.vprod, item.ncm, item.cfop
            ]);
          }

          // Inserir parcelas se existirem
          if (nfeData.parcelas && nfeData.parcelas.length > 0) {
            for (const parcela of nfeData.parcelas) {
              // Converter valor de reais para centavos (vdup \u00e9 integer)
              const vdupCentavos = Math.round(parcela.vDup * 100);

              await pgClient.query(`
                INSERT INTO dbnfe_ent_cobr (codnfe_ent, ndup, dvencdup, vdup)
                VALUES ($1, $2, $3, $4)
              `, [nextCode, parcela.nDup, parcela.dVenc, vdupCentavos]);
            }
          }

          await pgClient.query('COMMIT');

          results.push({
            file: file.originalFilename,
            nfe: `${nfeData.nnf}/${nfeData.serie}`,
            chave: nfeData.chave,
            status: 'success',
          });

        } catch (txError) {
          await pgClient.query('ROLLBACK');
          throw txError;
        }

        // Limpar arquivo tempor\u00e1rio
        fs.unlinkSync(file.filepath);

      } catch (error) {
        console.error(`Erro ao processar arquivo ${file.originalFilename}:`, error);
        errors.push(`${file.originalFilename}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);

        // Limpar arquivo tempor\u00e1rio mesmo em caso de erro
        try {
          fs.unlinkSync(file.filepath);
        } catch { /* ignore */ }
      }
    }

    res.status(200).json({
      message: `Processamento conclu\u00eddo. ${results.length} arquivo(s) importado(s) com sucesso.`,
      results,
      errors,
    });

  } catch (error) {
    console.error('Erro no upload de XML:', error);
    res.status(500).json({ error: (error as Error).message });
  } finally {
    pgClient.release();
  }
}

function extractNFeData(xmlData: any, xmlContent: string): NFDataExtracted {
  // Extrair dados do XML da NFe
  const nfe = xmlData.nfeProc?.NFe?.[0]?.infNFe?.[0] || xmlData.NFe?.[0]?.infNFe?.[0];

  if (!nfe) {
    throw new Error('Estrutura XML inv\u00e1lida - n\u00e3o \u00e9 uma NFe v\u00e1lida');
  }

  const ide = nfe.ide?.[0];
  const emit = nfe.emit?.[0];
  const dest = nfe.dest?.[0];
  const total = nfe.total?.[0]?.ICMSTot?.[0];
  const det = nfe.det || [];
  const cobr = nfe.cobr?.[0]; // Tag de cobran\u00e7a
  const dup = cobr?.dup || []; // Duplicatas/Parcelas

  return {
    chave: nfe.$.Id?.replace('NFe', '') || '',
    serie: parseInt(ide?.serie?.[0] || '0'),
    nnf: parseInt(ide?.nNF?.[0] || '0'),
    demi: new Date(ide?.dhEmi?.[0] || ide?.dEmi?.[0]),
    vnf: parseFloat(total?.vNF?.[0] || '0'),
    // Extrair todos os valores de impostos do ICMSTot
    vbc: parseFloat(total?.vBC?.[0] || '0'),
    vicms: parseFloat(total?.vICMS?.[0] || '0'),
    vbcst: parseFloat(total?.vBCST?.[0] || '0'),
    vst: parseFloat(total?.vST?.[0] || '0'),
    vprod: parseFloat(total?.vProd?.[0] || '0'),
    vfrete: parseFloat(total?.vFrete?.[0] || '0'),
    vseg: parseFloat(total?.vSeg?.[0] || '0'),
    vdesc: parseFloat(total?.vDesc?.[0] || '0'),
    vii: parseFloat(total?.vII?.[0] || '0'),
    vipi: parseFloat(total?.vIPI?.[0] || '0'),
    vpis: parseFloat(total?.vPIS?.[0] || '0'),
    vcofins: parseFloat(total?.vCOFINS?.[0] || '0'),
    voutro: parseFloat(total?.vOutro?.[0] || '0'),
    vtottrib: parseFloat(total?.vTotTrib?.[0] || '0'),
    vipidevol: parseFloat(total?.vIPIDevol?.[0] || '0'),
    xml_completo: xmlContent,
    emitente: {
      cnpj: emit?.CNPJ?.[0] || emit?.CPF?.[0] || '',
      xnome: emit?.xNome?.[0] || '',
      xlgr: emit?.enderEmit?.[0]?.xLgr?.[0],
      nro: emit?.enderEmit?.[0]?.nro?.[0],
      xbairro: emit?.enderEmit?.[0]?.xBairro?.[0],
      xmun: emit?.enderEmit?.[0]?.xMun?.[0],
      uf: emit?.enderEmit?.[0]?.UF?.[0],
      cep: emit?.enderEmit?.[0]?.CEP?.[0],
      ie: emit?.IE?.[0],
    },
    destinatario: dest ? {
      cnpj: dest?.CNPJ?.[0] || dest?.CPF?.[0],
      xnome: dest?.xNome?.[0],
      xlgr: dest?.enderDest?.[0]?.xLgr?.[0],
      nro: dest?.enderDest?.[0]?.nro?.[0],
      xbairro: dest?.enderDest?.[0]?.xBairro?.[0],
      xmun: dest?.enderDest?.[0]?.xMun?.[0],
      uf: dest?.enderDest?.[0]?.UF?.[0],
      cep: dest?.enderDest?.[0]?.CEP?.[0],
      ie: dest?.IE?.[0],
    } : undefined,
    itens: det.map((item: any, index: number) => {
      const prod = item.prod?.[0];
      return {
        nitem: (index + 1).toString(),
        cprod: prod?.cProd?.[0] || '',
        xprod: prod?.xProd?.[0] || '',
        qcom: parseFloat(prod?.qCom?.[0] || '0'),
        vuncom: parseFloat(prod?.vUnCom?.[0] || '0'),
        vprod: parseFloat(prod?.vProd?.[0] || '0'),
        ncm: prod?.NCM?.[0],
        cfop: parseInt(prod?.CFOP?.[0] || '0'),
      };
    }),
    parcelas: dup.length > 0 ? dup.map((duplicata: any) => ({
      nDup: duplicata?.nDup?.[0] || '',
      dVenc: duplicata?.dVenc?.[0] || '',
      vDup: parseFloat(duplicata?.vDup?.[0] || '0'),
    })) : undefined,
  };
}

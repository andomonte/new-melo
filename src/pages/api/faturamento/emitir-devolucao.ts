import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import https from 'https';
import { parseStringPromise } from 'xml2js';
import { gerarXMLNFe } from '@/components/services/sefazNfe/gerarXml';
import { assinarXMLComCertificados } from '@/components/services/sefazNfe/assinarXml';
import { normalizarPayloadNFe } from '@/utils/normalizarPayloadNFe';
import { decrypt } from '@/utils/crypto';
import { getUrlSefazAtual } from '@/utils/gerarXmlCupomFiscal';
import { getPgPool } from '@/lib/pg';

// ESTORNO — FASE 2: emite a NF-e de DEVOLUÇÃO da DI (Documento Interno) gerada na fase 1.
// Emite a partir da FATURA (dbfatura + dbprodfat), como o Delphi (sem venda), com
// tpNF=0 (entrada), finNFe=4 (devolução) e <refNFe> apontando para a NF-e original.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }
  const { codfat } = req.body || {}; // codfat da DI (fatura de devolução)
  if (!codfat) return res.status(400).json({ erro: 'codfat (da DI) é obrigatório.' });

  const pool = getPgPool();
  try {
    // 1. DI (fatura de devolução) + validação de que é uma DI e ainda não foi emitida.
    const fatRes = await pool.query('SELECT * FROM dbfatura WHERE codfat = $1', [String(codfat)]);
    if (fatRes.rowCount === 0) return res.status(404).json({ erro: 'DI não encontrada.' });
    const dbfatura = fatRes.rows[0];
    if (!dbfatura.codfatrel) {
      return res.status(400).json({ erro: 'Esta fatura não é uma DI de devolução (sem codfatrel).' });
    }
    const jaEmitida = await pool.query(
      "SELECT 1 FROM dbfat_nfe WHERE codfat = $1 AND status = '100' LIMIT 1",
      [String(codfat)],
    );
    if (jaEmitida.rowCount) {
      return res.status(400).json({ erro: 'A devolução desta DI já foi emitida/autorizada.' });
    }

    // 2. Chave da NF-e ORIGINAL (para o refNFe) via codfatrel.
    const origRes = await pool.query(
      "SELECT chave FROM dbfat_nfe WHERE codfat = $1 AND status = '100' ORDER BY dthrprotocolo DESC LIMIT 1",
      [String(dbfatura.codfatrel)],
    );
    const chaveOriginal = origRes.rows[0]?.chave;
    if (!chaveOriginal) {
      return res.status(400).json({ erro: 'NF-e original (autorizada) não encontrada para referenciar na devolução.' });
    }

    // 3. Cliente da DI.
    const cliRes = await pool.query('SELECT * FROM dbclien WHERE codcli = $1', [dbfatura.codcli]);
    const dbclien = cliRes.rows[0] || {};

    // 4. Itens da DI (dbprodfat) → shape que o normalizarPayloadNFe espera (como dbitvenda).
    const itRes = await pool.query('SELECT * FROM dbprodfat WHERE codfat = $1', [String(codfat)]);
    if (itRes.rowCount === 0) return res.status(400).json({ erro: 'DI sem itens.' });
    const dbitvenda = itRes.rows.map((r: any) => ({
      ...r,
      qtd: r.qtde, // normalizarPayloadNFe lê item.qtd
      dbprod: { descr: r.descr, clasfiscal: r.ncm }, // descrição + NCM
    }));

    // 5. Empresa + certificado (emitente real da emissão).
    const empRes = await pool.query(
      `SELECT * FROM dadosempresa
        WHERE "certificadoKey" IS NOT NULL AND "certificadoCrt" IS NOT NULL LIMIT 1`,
    );
    if (empRes.rowCount === 0) return res.status(400).json({ erro: 'Nenhuma empresa com certificado configurado.' });
    const emitenteRaw = empRes.rows[0];
    const ambienteEmpresa = String(emitenteRaw?.ambiente || process.env.AMBIENTE_NFCE || '2');
    const certificadoKey = (await decrypt(emitenteRaw.certificadoKey)) || '';
    const certificadoCrt = (await decrypt(emitenteRaw.certificadoCrt)) || '';
    const cadeiaCrt = emitenteRaw.cadeiaCrt ? await decrypt(emitenteRaw.cadeiaCrt) : null;
    if (!certificadoKey || !certificadoCrt) {
      return res.status(400).json({ erro: 'Erro ao descriptografar o certificado.' });
    }
    const emitente = {
      cnpj: emitenteRaw.cgc,
      cgc: emitenteRaw.cgc,
      xNome: emitenteRaw.nomecontribuinte,
      nomecontribuinte: emitenteRaw.nomecontribuinte,
      ie: emitenteRaw.inscricaoestadual,
      inscricaoestadual: emitenteRaw.inscricaoestadual,
      crt: emitenteRaw.crt || '3',
      enderEmit: {
        xLgr: emitenteRaw.logradouro,
        nro: emitenteRaw.numero,
        xBairro: emitenteRaw.bairro,
        cMun: '1302603',
        xMun: emitenteRaw.municipio,
        UF: emitenteRaw.uf || 'AM',
        CEP: emitenteRaw.cep,
      },
      uf: emitenteRaw.uf || 'AM',
    };

    // 6. Payload → normaliza → gera XML com tpNF=0, finNFe=4, refNFe (devolução).
    const naturezaOperacao = dbfatura.descrcfop || 'DEVOLUCAO DE VENDA';
    const dados = { codfat, dbfatura, dbvenda: {}, dbclien, dbitvenda, produtos: dbitvenda, emitente };
    const dadosNormalizados = await normalizarPayloadNFe(dados);
    const xmlBruto = gerarXMLNFe({
      ...dadosNormalizados,
      ambiente: ambienteEmpresa,
      naturezaOperacao,
      tpNF: '0', // entrada
      finNFe: '4', // devolução
      refNFe: chaveOriginal,
    });

    const xmlAssinado = await assinarXMLComCertificados(xmlBruto, 'infNFe', certificadoKey, certificadoCrt);
    const chaveMatch = xmlAssinado.match(/Id="NFe(\d{44})"/);
    const chaveDevolucao = chaveMatch ? chaveMatch[1] : '';
    const urlSefaz = getUrlSefazAtual('NFE_AUTORIZACAO', ambienteEmpresa);

    // 7. Envelope + envio SEFAZ.
    const xmlNFeOnly = xmlAssinado.replace(/^<\?xml[^>]*\?>/, '').trim();
    const xmlEnvio =
      `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>000000000000001</idLote><indSinc>1</indSinc>${xmlNFeOnly}</enviNFe>`;
    const envelope = `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">${xmlEnvio}</nfeDadosMsg></soap:Body></soap:Envelope>`;
    const agent = new https.Agent({
      key: Buffer.from(certificadoKey),
      cert: Buffer.from(certificadoCrt),
      ca: cadeiaCrt ? Buffer.from(cadeiaCrt) : undefined,
      rejectUnauthorized: false,
    });
    const sefazResponse = await axios.post(urlSefaz, envelope, {
      httpsAgent: agent,
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        SOAPAction: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote',
      },
      timeout: 30000,
    });

    const xmlResposta = sefazResponse.data;
    const json = await parseStringPromise(xmlResposta, {
      explicitArray: false,
      tagNameProcessors: [(name: string) => name.split(':').pop() || name],
    });
    const retEnviNFe = json?.Envelope?.Body?.nfeResultMsg?.retEnviNFe;
    if (!retEnviNFe) throw new Error('Estrutura de resposta da SEFAZ inesperada.');

    let status: string, motivo: string, protocolo: string | null;
    if (retEnviNFe.cStat === '104') {
      const infProt = retEnviNFe.protNFe?.infProt;
      status = infProt?.cStat;
      motivo = infProt?.xMotivo;
      protocolo = infProt?.nProt || null;
    } else {
      status = retEnviNFe.cStat;
      motivo = retEnviNFe.xMotivo;
      protocolo = null;
    }

    // 8. Se autorizada (100), grava o dbfat_nfe da DI.
    if (status === '100') {
      const chaveAut = retEnviNFe.protNFe?.infProt?.chNFe || chaveDevolucao;
      await pool.query(
        `INSERT INTO dbfat_nfe
           (codfat, nrodoc_fiscal, codnumerico, "data", chave, versao, xmlremessa, xmlretorno,
            status, numprotocolo, dthrprotocolo, motivo, tipo_emissao, modelo, tpemissao, emailenviado)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          String(codfat),
          dbfatura.nroform || '',
          String(chaveAut).substring(35, 43),
          new Date(),
          chaveAut,
          '4.00',
          xmlAssinado,
          xmlResposta,
          status,
          protocolo,
          new Date(),
          motivo,
          1,
          '55',
          '1',
          'N',
        ],
      );
      return res.status(200).json({
        sucesso: true,
        status,
        motivo,
        protocolo,
        chave: chaveAut,
        codfat: String(codfat),
        refNFe: chaveOriginal,
      });
    }

    // Rejeitada: registra a tentativa (histórico) e devolve o motivo.
    await pool
      .query(
        `INSERT INTO dbfat_nfe
           (codfat, nrodoc_fiscal, "data", chave, versao, xmlremessa, xmlretorno, status, motivo, modelo, emailenviado)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [String(codfat), dbfatura.nroform || '', new Date(), chaveDevolucao, '4.00', xmlAssinado, xmlResposta, status, motivo, '55', 'N'],
      )
      .catch(() => {});
    return res.status(400).json({ sucesso: false, status, motivo });
  } catch (error: any) {
    console.error('Erro ao emitir devolução:', error);
    const detalhe = error?.response?.data || error.message || error;
    return res.status(500).json({ sucesso: false, erro: detalhe.toString() });
  }
}

import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import https from 'https';
import { getPgPool } from '@/lib/pg';
import { parseStringPromise } from 'xml2js';

import { assinarXMLComCertificados } from '@/components/services/sefazNfe/assinarXml';
import { decrypt } from '@/utils/crypto';

// Texto legal OBRIGATÓRIO da Carta de Correção (xCondUso) — padrão nacional (Convênio S/N 1970).
const XCONDUSO =
  'A Carta de Correcao e disciplinada pelo paragrafo 1o-A do art. 7o do Convenio S/N, ' +
  'de 15 de dezembro de 1970 e pode ser utilizada para regularizacao de erro ocorrido ' +
  'na emissao de documento fiscal, desde que o erro nao esteja relacionado com: ' +
  'I - as variaveis que determinam o valor do imposto tais como: base de calculo, ' +
  'aliquota, diferenca de preco, quantidade, valor da operacao ou da prestacao; ' +
  'II - a correcao de dados cadastrais que implique mudanca do remetente ou do ' +
  'destinatario; III - a data de emissao ou de saida.';

const escXml = (s: string) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const fmtDoc = (d: string) => {
  const s = String(d || '').replace(/\D/g, '');
  if (s.length === 14) return s.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  if (s.length === 11) return s.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  return s;
};

// Extrai emitente/destinatário do XML da própria NF-e (xmlremessa) — assim o
// comprovante da CC-e mostra os dados REAIS da nota, não valores fixos.
function parseEmitDest(xml: string) {
  const tag = (bloco: string, t: string) => {
    const m = bloco.match(new RegExp(`<${t}>([^<]*)</${t}>`));
    return m ? m[1].trim() : '';
  };
  const ender = (bloco: string) => {
    const lgr = tag(bloco, 'xLgr');
    const nro = tag(bloco, 'nro');
    const bairro = tag(bloco, 'xBairro');
    const mun = tag(bloco, 'xMun');
    const uf = tag(bloco, 'UF');
    return [lgr && `${lgr}, ${nro}`, bairro, mun && uf && `${mun}/${uf}`]
      .filter(Boolean)
      .join(' - ');
  };
  const emit = (String(xml).match(/<emit>([\s\S]*?)<\/emit>/) || [])[1] || '';
  const dest = (String(xml).match(/<dest>([\s\S]*?)<\/dest>/) || [])[1] || '';
  return {
    emitente: {
      nome: tag(emit, 'xNome'),
      cnpj: fmtDoc(tag(emit, 'CNPJ') || tag(emit, 'CPF')),
      ie: tag(emit, 'IE'),
      endereco: ender(emit),
      municipio: tag(emit, 'xMun'),
    },
    destinatario: {
      nome: tag(dest, 'xNome'),
      documento: fmtDoc(tag(dest, 'CNPJ') || tag(dest, 'CPF')),
      endereco: ender(dest),
    },
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  const { codfat, correcao, usuario = 'API' } = req.body || {};
  if (!codfat) return res.status(400).json({ erro: 'codfat é obrigatório' });

  // Texto NOVO desta carta (o trecho digitado agora).
  const correcaoNova = String(correcao ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (correcaoNova.length < 15) {
    return res
      .status(400)
      .json({ erro: 'O texto da correção deve ter no mínimo 15 caracteres.' });
  }

  try {
    // 1. Buscar a NF-e autorizada da fatura (mesma lógica do cancelamento).
    const client = await getPgPool().connect();
    let nota: any;
    let cceAnterior: { xcorrecao: string; nseqevento: number } | null = null;
    try {
      let result = await client.query(
        "SELECT * FROM dbfat_nfe WHERE codfat = $1 ORDER BY (status = '100') DESC, dthrprotocolo DESC NULLS LAST",
        [String(codfat)],
      );
      if (result.rowCount === 0) {
        const semZero = String(codfat).replace(/^0+/, '');
        result = await client.query(
          "SELECT * FROM dbfat_nfe WHERE codfat = $1 ORDER BY (status = '100') DESC, dthrprotocolo DESC NULLS LAST",
          [semZero],
        );
      }
      if (result.rowCount === 0) {
        return res.status(404).json({ erro: 'Nota não encontrada' });
      }
      nota = result.rows[0];

      // Última CC-e ACEITA desta fatura (texto cumulativo + próximo nSeqEvento).
      const prev = await client.query(
        `SELECT xcorrecao, nseqevento FROM db_manaus.fat_cce
          WHERE codfat = $1 AND status IN ('135','136')
          ORDER BY nseqevento DESC LIMIT 1`,
        [String(nota.codfat)],
      );
      if (prev.rowCount) cceAnterior = prev.rows[0];
    } finally {
      client.release();
    }

    // 2. Validações (fiéis ao Delphi)
    // 2.1 CC-e não vale para NFC-e (mod. 65).
    if (String(nota.modelo || '55') === '65') {
      return res
        .status(400)
        .json({ erro: 'Carta de Correção não é permitida para NFC-e.' });
    }
    // 2.2 Só nota autorizada (status 100) e não cancelada.
    if (nota.status !== '100' || nota.dthrcancelamento || nota.status === 'C') {
      return res.status(400).json({
        erro: 'Fatura não autorizada ou cancelada. Impossível gerar Carta de Correção.',
      });
    }
    if (!nota.chave || !nota.numprotocolo) {
      return res
        .status(400)
        .json({ erro: 'Nota não possui chave ou protocolo válido.' });
    }
    // 2.3 Prazo: até 30 dias após a autorização.
    const dataAutorizacaoRaw = nota.dthrprotocolo;
    if (!dataAutorizacaoRaw) {
      return res
        .status(400)
        .json({ erro: 'Data de autorização (dthrprotocolo) não encontrada.' });
    }
    const decorridoDias =
      (Date.now() - new Date(dataAutorizacaoRaw).getTime()) / 86400000;
    if (Number.isFinite(decorridoDias) && decorridoDias > 30) {
      return res.status(400).json({
        erro:
          'Esta NF-e não pode mais receber Carta de Correção. O prazo é de 30 dias ' +
          `após a autorização e já expirou (autorizada há ${Math.round(decorridoDias)} dias).`,
        prazoExpirado: true,
      });
    }

    // 3. Texto CUMULATIVO (anterior + novo) e sequência do evento.
    const nSeqEvento = cceAnterior ? Number(cceAnterior.nseqevento) + 1 : 1;
    if (nSeqEvento > 20) {
      return res
        .status(400)
        .json({ erro: 'Limite de 20 Cartas de Correção por NF-e atingido.' });
    }
    let cartaFinal = `${cceAnterior?.xcorrecao ?? ''} ${correcaoNova}`
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (cartaFinal.length < 15 || cartaFinal.length > 1000) {
      return res.status(400).json({
        erro: `O texto acumulado da correção deve ter entre 15 e 1000 caracteres (atual: ${cartaFinal.length}).`,
      });
    }

    // 4. Certificado do BANCO (mesmo da emissão/cancelamento).
    let certificadoKey = '';
    let certificadoCrt = '';
    let cadeiaCrt: string | null = null;
    let cnpjEmitente = '18053139000169';
    {
      const cliCert = await getPgPool().connect();
      try {
        const emp = await cliCert.query(
          `SELECT "certificadoKey", "certificadoCrt", "cadeiaCrt", cgc
             FROM dadosempresa
            WHERE "certificadoKey" IS NOT NULL AND "certificadoCrt" IS NOT NULL
            LIMIT 1`,
        );
        if (!emp.rowCount) {
          return res
            .status(400)
            .json({ erro: 'Nenhuma empresa com certificado digital configurado.' });
        }
        const raw = emp.rows[0];
        certificadoKey = (await decrypt(raw.certificadoKey)) || '';
        certificadoCrt = (await decrypt(raw.certificadoCrt)) || '';
        cadeiaCrt = raw.cadeiaCrt ? await decrypt(raw.cadeiaCrt) : null;
        if (!certificadoKey || !certificadoCrt) {
          return res
            .status(400)
            .json({ erro: 'Erro ao descriptografar o certificado digital.' });
        }
        cnpjEmitente = String(raw.cgc || '18053139000169').replace(/\D/g, '');
      } finally {
        cliCert.release();
      }
    }

    // 5. Montar o evento CC-e (110110). dhEvento = agora no fuso de Manaus (UTC-4).
    const chave = String(nota.chave);
    const agoraAm = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const p2 = (num: number) => String(num).padStart(2, '0');
    const dhEvento =
      `${agoraAm.getUTCFullYear()}-${p2(agoraAm.getUTCMonth() + 1)}-${p2(agoraAm.getUTCDate())}` +
      `T${p2(agoraAm.getUTCHours())}:${p2(agoraAm.getUTCMinutes())}:${p2(agoraAm.getUTCSeconds())}-04:00`;
    const seq2 = p2(nSeqEvento);

    const xmlEvento = `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
  <idLote>1</idLote>
  <evento versao="1.00">
    <infEvento Id="ID110110${chave}${seq2}">
      <cOrgao>13</cOrgao>
      <tpAmb>2</tpAmb>
      <CNPJ>${cnpjEmitente}</CNPJ>
      <chNFe>${chave}</chNFe>
      <dhEvento>${dhEvento}</dhEvento>
      <tpEvento>110110</tpEvento>
      <nSeqEvento>${nSeqEvento}</nSeqEvento>
      <verEvento>1.00</verEvento>
      <detEvento versao="1.00">
        <descEvento>Carta de Correcao</descEvento>
        <xCorrecao>${escXml(cartaFinal)}</xCorrecao>
        <xCondUso>${escXml(XCONDUSO)}</xCondUso>
      </detEvento>
    </infEvento>
  </evento>
</envEvento>`;

    // 6. Assinar (infEvento) com o certificado do banco.
    const xmlAssinado = await assinarXMLComCertificados(
      xmlEvento,
      'infEvento',
      certificadoKey,
      certificadoCrt,
    );
    const xmlLimpo = xmlAssinado.replace(/<\?xml[^>]*\?>\s*/, '');

    const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">
  <soap:Header/>
  <soap:Body>
    <nfe:nfeDadosMsg>
      ${xmlLimpo}
    </nfe:nfeDadosMsg>
  </soap:Body>
</soap:Envelope>`;

    // 7. Enviar à SEFAZ-AM (mesmo webservice de eventos do cancelamento).
    const agent = new https.Agent({
      key: Buffer.from(certificadoKey),
      cert: Buffer.from(certificadoCrt),
      ca: cadeiaCrt ? Buffer.from(cadeiaCrt) : undefined,
      rejectUnauthorized: false,
    });
    const urlSefaz =
      'https://homnfe.sefaz.am.gov.br/services2/services/RecepcaoEvento4';

    const sefazResponse = await axios.post(urlSefaz, envelope, {
      httpsAgent: agent,
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        SOAPAction:
          'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento',
      },
      timeout: 30000,
    });

    const xmlResposta = sefazResponse.data;
    const json = await parseStringPromise(xmlResposta, {
      explicitArray: false,
      tagNameProcessors: [(name: string) => name.split(':').pop() || name],
    });

    const retEnvEvento = json?.Envelope?.Body?.nfeResultMsg?.retEnvEvento;
    if (!retEnvEvento) {
      throw new Error('Estrutura de resposta da SEFAZ inesperada (retEnvEvento).');
    }
    const retEvento = retEnvEvento.retEvento;
    const status = retEvento?.infEvento?.cStat ?? retEnvEvento?.cStat;
    const motivoRet = retEvento?.infEvento?.xMotivo ?? retEnvEvento?.xMotivo;
    const protocolo = retEvento?.infEvento?.nProt;

    // 8. cStat 135 (registrado e vinculado) ou 136 (registrado, não vinculado) = sucesso.
    const aceito = status === '135' || status === '136';

    // Registra a CC-e (aceita ou não) para histórico/depuração.
    {
      const cliSave = await getPgPool().connect();
      try {
        await cliSave.query(
          `INSERT INTO db_manaus.fat_cce
             (codfat, chave, nseqevento, xcorrecao, correcao_nova, protocolo, status, motivo, xml_envio, xml_retorno, usuario)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            String(nota.codfat),
            chave,
            nSeqEvento,
            cartaFinal,
            correcaoNova,
            protocolo ?? null,
            status ?? null,
            motivoRet ?? null,
            xmlAssinado,
            xmlResposta,
            usuario,
          ],
        );
      } finally {
        cliSave.release();
      }
    }

    if (!aceito) {
      return res.status(400).json({
        sucesso: false,
        status,
        motivo: motivoRet,
        detalhes: retEnvEvento,
      });
    }

    // Emitente/destinatário REAIS da nota (do XML), para o comprovante.
    const partes = parseEmitDest(nota.xmlremessa || '');

    return res.status(200).json({
      sucesso: true,
      status,
      motivo: motivoRet,
      protocolo,
      nSeqEvento,
      chave,
      correcao: cartaFinal,
      dhEvento,
      codfat: String(nota.codfat),
      numeroNota: nota.nrodoc_fiscal ? String(nota.nrodoc_fiscal) : undefined,
      serie: nota.serie ? String(nota.serie) : undefined,
      emitente: partes.emitente,
      destinatario: partes.destinatario,
    });
  } catch (error: any) {
    console.error('Erro na Carta de Correção:', error);
    const detalhe = error?.response?.data || error.message || error;
    return res
      .status(500)
      .json({ sucesso: false, erro: detalhe.toString(), stack: error?.stack });
  }
}

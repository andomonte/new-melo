import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { parseStringPromise } from 'xml2js';
import { gerarCartaCorrecaoHtml } from '@/lib/danfe/gerarCartaCorrecaoHtml';
import { renderHtmlToPdf } from '@/lib/danfe/renderHtmlToPdf';

/**
 * GET /api/faturamento/cce-pdf?codfat=XXXX&seq=N
 *
 * Gera o PDF da Carta de Correção (CC-e) já existente (fat_cce), reconstruindo o
 * comprovante com gerarCartaCorrecaoHtml + renderHtmlToPdf. Emitente/destinatário
 * saem do XML da própria nota (dbfat_nfe.xmlremessa), best-effort. Abre inline.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido.' });
  }
  const codfat = String(req.query.codfat || '').trim();
  const seq = String(req.query.seq || '').trim();
  if (!codfat) return res.status(400).json({ erro: 'codfat é obrigatório.' });

  const client = await getPgPool().connect();
  try {
    // Carta de correção (a mais recente do seq, ou a última do codfat).
    const cceQ = await client.query(
      `SELECT chave, nseqevento, xcorrecao, correcao_nova, protocolo, data
         FROM db_manaus.fat_cce
        WHERE codfat = $1 ${seq ? 'AND nseqevento = $2' : ''}
        ORDER BY nseqevento DESC, data DESC
        LIMIT 1`,
      seq ? [codfat, seq] : [codfat],
    );
    if (cceQ.rows.length === 0) {
      return res.status(404).json({ erro: 'Carta de correção não encontrada.' });
    }
    const cce = cceQ.rows[0];

    // Nota (número + XML para extrair emitente/destinatário).
    const nfeQ = await client.query(
      `SELECT nrodoc_fiscal, xmlremessa
         FROM db_manaus.dbfat_nfe
        WHERE codfat = $1 AND chave = $2
        ORDER BY dthrprotocolo DESC NULLS LAST LIMIT 1`,
      [codfat, cce.chave],
    );
    const nfe = nfeQ.rows[0] || {};
    const fatQ = await client.query(
      `SELECT serie, codcli FROM db_manaus.dbfatura WHERE codfat = $1`,
      [codfat],
    );
    // Nome real do cliente (em homologação o XML traz o marcador "NF-E EMITIDA
    // EM AMBIENTE DE HOMOLOGACAO..." — preferimos o nome real, como no fluxo de criar CC-e).
    let nomeClienteReal = '';
    try {
      const cliQ = await client.query(
        `SELECT nome, nomefant FROM db_manaus.dbclien WHERE codcli = $1`,
        [fatQ.rows[0]?.codcli],
      );
      nomeClienteReal = cliQ.rows[0]?.nome || cliQ.rows[0]?.nomefant || '';
    } catch {
      /* segue sem nome real */
    }

    // Emitente / destinatário do XML da nota (mesmo do DANFE).
    let emitente: any;
    let destinatario: any;
    try {
      if (nfe.xmlremessa) {
        const p = await parseStringPromise(nfe.xmlremessa, {
          explicitArray: false,
          ignoreAttrs: true,
        });
        const inf = p?.NFe?.infNFe || p?.nfeProc?.NFe?.infNFe;
        const emit = inf?.emit;
        const dest = inf?.dest;
        if (emit) {
          emitente = {
            nome: emit.xNome,
            cnpj: emit.CNPJ || emit.CPF,
            ie: emit.IE,
            endereco: [emit.enderEmit?.xLgr, emit.enderEmit?.nro]
              .filter(Boolean)
              .join(', '),
            municipio: emit.enderEmit?.xMun,
          };
        }
        if (dest) {
          destinatario = {
            nome: nomeClienteReal || dest.xNome,
            documento: dest.CNPJ || dest.CPF,
            endereco: [dest.enderDest?.xLgr, dest.enderDest?.nro]
              .filter(Boolean)
              .join(', '),
          };
        }
      }
      if (!destinatario && nomeClienteReal) {
        destinatario = { nome: nomeClienteReal };
      }
    } catch {
      // segue sem emit/dest — a carta ainda sai com chave/protocolo/correção.
    }

    const html = gerarCartaCorrecaoHtml({
      numeroNota: nfe.nrodoc_fiscal,
      serie: fatQ.rows[0]?.serie,
      chave: cce.chave,
      protocolo: cce.protocolo,
      nSeqEvento: Number(cce.nseqevento) || 1,
      dhEvento: cce.data,
      correcao: cce.xcorrecao || cce.correcao_nova || '',
      homologacao: true,
      emitente,
      destinatario,
    });

    const pdf = await renderHtmlToPdf(html, { landscape: false });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="cce-${codfat}-${cce.nseqevento}.pdf"`,
    );
    return res.status(200).send(pdf);
  } catch (error: any) {
    console.error('Erro ao gerar PDF da CC-e:', error);
    return res
      .status(500)
      .json({ erro: 'Erro ao gerar o PDF da carta de correção.', detalhes: error?.message });
  } finally {
    client.release();
  }
}

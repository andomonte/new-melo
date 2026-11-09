/**
 * GET /api/faturamento/danfe-nacionalizacao?codfat=XXXXXXXXX
 * GET /api/faturamento/danfe-nacionalizacao?importacaoId=NN
 *
 * DANFE (PDF) da nota de NACIONALIZAÇÃO montado a partir do XML autorizado
 * (dbfat_nfe.xmlremessa): mesmos itens, na ordem da DI (adição/item), mesmos totais e
 * as mesmas informações complementares que foram para a SEFAZ. Não usa o PDF gravado
 * na emissão (as notas antigas guardaram o DANFE com os itens da fatura agrupados).
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPoolFilial } from '@/lib/pg';
import { danfeDoXmlNfe } from '@/lib/danfe/danfeDoXmlNfe';
import { gerarPdfNotaHtml } from '@/lib/danfe/gerarPdfNotaHtml';

export const config = { api: { responseLimit: '15mb' } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Método não permitido' });

  const codfat = typeof req.query.codfat === 'string' ? req.query.codfat.trim() : '';
  const importacaoId = Number(req.query.importacaoId) || 0;
  if (!codfat && !importacaoId) {
    return res.status(400).json({ message: 'Informe codfat ou importacaoId.' });
  }

  const pool = await getPgPoolFilial(req);
  try {
    // A nota autorizada (chave + protocolo) mesmo que depois cancelada: o DANFE de
    // uma nota cancelada continua sendo o da autorização, só com a tarja.
    const { rows } = await pool.query(
      `SELECT f.codfat, f.cancel, nf.xmlremessa, nf.numprotocolo, nf.dthrprotocolo,
              nf.status, nf.numcancelamento
         FROM dbfatura f
         JOIN dbfat_nfe nf ON nf.codfat = f.codfat
        WHERE f.importacao_id IS NOT NULL
          AND ${codfat ? 'f.codfat = $1' : 'f.importacao_id = $1'}
          AND nf.chave IS NOT NULL AND nf.numprotocolo IS NOT NULL
          AND nf.xmlremessa IS NOT NULL
        ORDER BY (COALESCE(f.cancel, 'N') <> 'S') DESC,
                 nf.dthrprotocolo DESC NULLS LAST, nf."data" DESC
        LIMIT 1`,
      [codfat || importacaoId],
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Nota de nacionalização autorizada não encontrada.' });
    }
    const r = rows[0];
    const d = danfeDoXmlNfe(String(r.xmlremessa), { protocolo: r.numprotocolo });
    const cancelada = r.status === 'C' || !!r.numcancelamento || r.cancel === 'S';

    const pdf = await gerarPdfNotaHtml('nfe-importacao', d.fatura, d.produtos, d.venda, d.emitente, d.dadosNFe, {
      homologacao: d.homologacao,
      entrada: d.entrada,
      cancelada,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="nota-${r.codfat}.pdf"`);
    return res.status(200).send(pdf);
  } catch (e: any) {
    console.error('[danfe-nacionalizacao] erro:', e);
    return res.status(500).json({ message: 'Erro ao gerar o DANFE da nota de nacionalização.', detail: e?.message });
  }
}

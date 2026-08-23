import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * GET /api/faturamento/eventos-nota?codfat=XXXX
 *
 * Histórico/eventos de uma NF-e: Autorização, Cancelamento (ambos em dbfat_nfe) e
 * Cartas de Correção (fat_cce). Usado pelo botão "Evento" do preview da nota.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido.' });
  }
  const codfat = String(req.query.codfat || '').trim();
  if (!codfat) return res.status(400).json({ erro: 'codfat é obrigatório.' });

  const client = await getPgPool().connect();
  try {
    const eventos: any[] = [];

    // Autorização + Cancelamento (dbfat_nfe).
    const nfe = await client.query(
      `SELECT nrodoc_fiscal, chave, status, numprotocolo, dthrprotocolo, "data",
              numcancelamento, dthrcancelamento, motivocancelamento, usuariocancelamento, motivo, modelo
         FROM dbfat_nfe
        WHERE codfat = $1
        ORDER BY dthrprotocolo NULLS LAST, "data"`,
      [codfat],
    );
    for (const n of nfe.rows) {
      if (n.numprotocolo) {
        eventos.push({
          tipo: 'AUTORIZACAO',
          descricao: n.modelo === '65' ? 'NFC-e autorizada' : 'NF-e autorizada',
          data: n.dthrprotocolo,
          protocolo: n.numprotocolo,
          chave: n.chave,
          numero: n.nrodoc_fiscal,
        });
      }
      if (n.numcancelamento || n.dthrcancelamento) {
        eventos.push({
          tipo: 'CANCELAMENTO',
          descricao: 'Nota cancelada',
          data: n.dthrcancelamento,
          protocolo: n.numcancelamento,
          motivo: n.motivocancelamento,
          usuario: n.usuariocancelamento,
          chave: n.chave,
        });
      }
      // Rejeição: tentativa sem autorização, status de erro/rejeição (≠ 100/C) com motivo.
      if (
        !n.numprotocolo &&
        n.status &&
        !['100', 'C'].includes(String(n.status)) &&
        n.motivo
      ) {
        eventos.push({
          tipo: 'REJEICAO',
          descricao: `Rejeitada (cStat ${n.status})`,
          data: n.dthrprotocolo || n.data,
          motivo: String(n.motivo).replace(/\s+/g, ' ').trim().slice(0, 300),
          chave: n.chave,
        });
      }
    }

    // Cartas de Correção (fat_cce) — best-effort (a tabela pode não existir em bases antigas).
    try {
      const cce = await client.query(
        `SELECT id, nseqevento, xcorrecao, correcao_nova, protocolo, status, data, usuario, chave
           FROM fat_cce
          WHERE codfat = $1
          ORDER BY nseqevento, data`,
        [codfat],
      );
      for (const c of cce.rows) {
        eventos.push({
          tipo: 'CARTA_CORRECAO',
          descricao: `Carta de Correção nº ${c.nseqevento ?? ''}`.trim(),
          data: c.data,
          protocolo: c.protocolo,
          seq: c.nseqevento,
          texto: c.xcorrecao || c.correcao_nova,
          usuario: c.usuario,
          chave: c.chave,
          cceId: c.id,
        });
      }
    } catch {
      // sem tabela de CC-e nesta base — ignora.
    }

    // Dedup: várias linhas dbfat_nfe (tentativas de emissão) podem repetir o mesmo
    // protocolo de autorização/cancelamento. Mantém 1 por (tipo + protocolo).
    const vistos = new Set<string>();
    const unicos = eventos.filter((e) => {
      // Inclui data + trecho do motivo na chave: rejeições não têm protocolo e
      // colapsariam todas se a chave fosse só tipo+protocolo.
      const k = `${e.tipo}:${e.protocolo ?? ''}:${e.seq ?? ''}:${e.data ?? ''}:${(e.motivo ?? '').slice(0, 40)}`;
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });

    // Ordena por data (mais antigo primeiro).
    unicos.sort(
      (a, b) => new Date(a.data || 0).getTime() - new Date(b.data || 0).getTime(),
    );

    return res.status(200).json({ codfat, eventos: unicos });
  } catch (error: any) {
    console.error('Erro ao buscar eventos da nota:', error);
    return res
      .status(500)
      .json({ erro: 'Erro ao buscar eventos da nota.', detalhes: error?.message });
  } finally {
    client.release();
  }
}

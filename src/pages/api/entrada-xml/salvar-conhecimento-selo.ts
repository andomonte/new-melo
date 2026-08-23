import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';

/**
 * POST /api/entrada-xml/salvar-conhecimento-selo
 *
 * Persiste o Selo e o Conhecimento de transporte da NFe ANTES de gerar a entrada
 * (paridade Delphi: Inc_ConhecimentoEnt grava dbConhecimentoEnt; ENTRADA_INCLUIR
 * grava selo/dtselo/temcon/nrocon no dbEnt). Aqui gravamos:
 *  - dbconhecimentoent (upsert por codtransp+nrocon) quando temConhecimento
 *  - dbconhecimentoentnf (link conhecimento ↔ chave da NFe)
 *  - dbnfe_ent_aux: selo, dtselo, temcon, nrocon, codtransp — o gerar-por-chave
 *    lê esses campos e o confirmar-preço usa o conhecimento para o frete do custo.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const {
    nfeId,
    chave,
    codtransp,
    selo,
    dtselo,
    temConhecimento,
    conhecimento,
    uname,
  } = req.body as {
    nfeId: string;
    chave?: string;
    codtransp?: string | null;
    selo?: string | null;
    dtselo?: string | null;
    temConhecimento?: boolean;
    conhecimento?: {
      codtransp: string;
      nrocon: string;
      serie?: string;
      cfop?: string;
      icms?: number;
      baseicms?: number;
      totalcon?: number;
      totaltransp?: number;
      stcon?: number;
      dtcon?: string;
      cif?: 'S' | 'N';
      tipocalc?: string;
      tipocon?: string;
      kg?: number;
      kgcub?: number;
      chave?: string;
      protocolo?: string;
      nomebarco?: string;
      placacarreta?: string;
      nfesVinculadas?: string[];
    } | null;
    uname?: string;
  };

  if (!nfeId) {
    return res.status(400).json({ error: 'nfeId é obrigatório.' });
  }

  const temCon = !!(temConhecimento && conhecimento && conhecimento.nrocon);
  const codTranspFinal =
    (temCon ? conhecimento!.codtransp : codtransp) || null;
  const nroConFinal = temCon ? conhecimento!.nrocon : null;

  let client: any;
  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();
    await client.query('BEGIN');

    // Resolve a chave da NFe pelo nfeId quando não veio (para o link do conhecimento).
    let chaveNfe = chave || null;
    if (!chaveNfe) {
      const r = await client.query(
        `SELECT chave FROM dbnfe_ent WHERE codnfe_ent = $1`, [nfeId]);
      chaveNfe = r.rows[0]?.chave || null;
    }

    // 1) Conhecimento → dbconhecimentoent (upsert por codtransp+nrocon) e link à NFe
    if (temCon) {
      const c = conhecimento!;
      const jaExiste = await client.query(
        `SELECT 1 FROM dbconhecimentoent WHERE codtransp=$1 AND nrocon=$2`,
        [c.codtransp, c.nrocon],
      );
      if (jaExiste.rows.length > 0) {
        await client.query(
          `UPDATE dbconhecimentoent
              SET serie=$3, cfop=$4, icms=$5, baseicms=$6, totalcon=$7, totaltransp=$8,
                  stcon=$9, dtcon=$10, tipocalc=$11, tipocon=$12, cif=$13, cancel='N',
                  kg=$14, kgcub=$15, chave=$16, protocolo=$17, nomebarco=$18, placacarreta=$19
            WHERE codtransp=$1 AND nrocon=$2`,
          [c.codtransp, c.nrocon, c.serie || null, c.cfop || null,
           Number(c.icms || 0), Number(c.baseicms || 0), Number(c.totalcon || 0),
           Number(c.totaltransp || 0), Number(c.stcon || 0), c.dtcon || null,
           c.tipocalc || null, c.tipocon || null, c.cif || 'N',
           c.kg ?? null, c.kgcub ?? null, c.chave || chaveNfe || null,
           c.protocolo || null, c.nomebarco || null, c.placacarreta || null],
        );
      } else {
        await client.query(
          `INSERT INTO dbconhecimentoent
             (codtransp, nrocon, serie, cfop, icms, baseicms, totalcon, dtcon, totaltransp,
              stcon, tipocalc, tipocon, cif, cancel, kg, kgcub, chave, protocolo,
              nomebarco, placacarreta, dtcadastro, uname)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'N',$14,$15,$16,$17,$18,$19, now(), $20)`,
          [c.codtransp, c.nrocon, c.serie || null, c.cfop || null,
           Number(c.icms || 0), Number(c.baseicms || 0), Number(c.totalcon || 0),
           c.dtcon || null, Number(c.totaltransp || 0), Number(c.stcon || 0),
           c.tipocalc || null, c.tipocon || null, c.cif || 'N',
           c.kg ?? null, c.kgcub ?? null, c.chave || chaveNfe || null,
           c.protocolo || null, c.nomebarco || null, c.placacarreta || null,
           uname || null],
        );
      }

      // link conhecimento ↔ NFe (PK codtransp+nrocon+chavenfe)
      if (chaveNfe) {
        await client.query(
          `INSERT INTO dbconhecimentoentnf (codtransp, nrocon, chavenfe, sequencia, dtinclusao)
           VALUES ($1,$2,$3,1, now())
           ON CONFLICT (codtransp, nrocon, chavenfe) DO NOTHING`,
          [c.codtransp, c.nrocon, chaveNfe],
        );
      }

      // Vincula TODAS as demais NF-e que o CTe transporta (do XML) e "reconhece"
      // o conhecimento nelas: ao processar cada nota, o frete é rateado (o motor
      // de custo lê temcon/nrocon/codtransp → dbconhecimentoent). Não sobrescreve
      // nota que já tenha outro conhecimento (guard temcon <> 'S').
      const vinculadas = Array.isArray(c.nfesVinculadas)
        ? Array.from(new Set(c.nfesVinculadas.map((s) => String(s).replace(/\D/g, '')).filter(Boolean)))
        : [];
      const outras = vinculadas.filter((ch) => ch && ch !== chaveNfe);
      let seq = 1; // 1 = a nota atual
      for (const ch of outras) {
        seq += 1;
        await client.query(
          `INSERT INTO dbconhecimentoentnf (codtransp, nrocon, chavenfe, sequencia, dtinclusao)
           VALUES ($1,$2,$3,$4, now())
           ON CONFLICT (codtransp, nrocon, chavenfe) DO NOTHING`,
          [c.codtransp, c.nrocon, ch, seq],
        );

        // Reconhece o conhecimento na NFe correspondente (se ela existir no sistema).
        const nrow = await client.query(
          `SELECT codnfe_ent FROM dbnfe_ent WHERE chave = $1`, [ch]);
        const codnfe = nrow.rows[0]?.codnfe_ent;
        if (!codnfe) continue;

        const u = await client.query(
          `UPDATE dbnfe_ent_aux
              SET temcon='S', nrocon=$2, codtransp=$3
            WHERE codnfe_ent=$1 AND (temcon IS NULL OR temcon <> 'S')`,
          [codnfe, c.nrocon, c.codtransp]);
        if (u.rowCount === 0) {
          const ex = await client.query(
            `SELECT 1 FROM dbnfe_ent_aux WHERE codnfe_ent=$1`, [codnfe]);
          if (ex.rowCount === 0) {
            await client.query(
              `INSERT INTO dbnfe_ent_aux (codnfe_ent, temcon, nrocon, codtransp)
               VALUES ($1,'S',$2,$3)`,
              [codnfe, c.nrocon, c.codtransp]);
          }
        }
      }
    }

    // 2) dbnfe_ent_aux: selo/dtselo/temcon/nrocon/codtransp (aux sem PK → update/insert)
    const upd = await client.query(
      `UPDATE dbnfe_ent_aux
          SET selo=$2, dtselo=$3, temcon=$4, nrocon=$5,
              codtransp=COALESCE($6, codtransp)
        WHERE codnfe_ent=$1`,
      [nfeId, selo || null, dtselo || null, temCon ? 'S' : 'N', nroConFinal, codTranspFinal],
    );
    if (upd.rowCount === 0) {
      await client.query(
        `INSERT INTO dbnfe_ent_aux (codnfe_ent, selo, dtselo, temcon, nrocon, codtransp)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [nfeId, selo || null, dtselo || null, temCon ? 'S' : 'N', nroConFinal, codTranspFinal],
      );
    }

    await client.query('COMMIT');
    return res.status(200).json({
      success: true,
      temcon: temCon ? 'S' : 'N',
      nrocon: nroConFinal,
      selo: selo || null,
    });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('Erro ao salvar conhecimento/selo:', error);
    return res.status(500).json({ error: error.message || 'Erro ao salvar conhecimento/selo' });
  } finally {
    if (client) client.release();
  }
}

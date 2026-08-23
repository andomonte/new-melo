import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';

/**
 * POST /api/entradas/criar-manual
 *
 * Cria uma entrada MANUAL (sem XML), espelhando o Delphi ENTRADASEFAZ.ENTRADA_INCLUIR:
 * grava o cabeçalho em dbent (status 'A'), o conhecimento (dbconhecimentoent) quando
 * houver, e a linha de workflow (dbent_recebimento 'PENDENTE'). Os ITENS são
 * adicionados depois (fase "selecionar itens").
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const b = req.body || {};
  const num = (v: any) => Number(v) || 0;
  const orNull = (v: any) => (v === '' || v == null ? null : v);

  if (!b.cod_credor) {
    return res.status(400).json({ success: false, error: 'Fornecedor é obrigatório.' });
  }

  let client;
  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query(`SET LOCAL search_path TO ${process.env.DB_SCHEMA || 'db_manaus'}, public`);

    // 1) Próximo codent (maior numérico + 1, 9 dígitos) — como no Delphi
    const maxRow = await client.query(
      `SELECT COALESCE(MAX(codent::bigint), 0) AS mx FROM dbent WHERE codent ~ '^[0-9]+$'`,
    );
    const codent = String(Number(maxRow.rows[0].mx) + 1).padStart(9, '0');

    // Romaneio já executado se só existe um armazém
    const armRow = await client.query(`SELECT COUNT(*) AS n FROM cad_armazem`);
    const romaneio = Number(armRow.rows[0].n) === 1 ? 'S' : 'N';

    const temcon = b.temcon === 'S' || b.temcon === true ? 'S' : 'N';
    const temcusto = b.temcusto === 'N' ? 'N' : 'S';

    // 2) Conhecimento (quando houver) — upsert em dbconhecimentoent
    if (temcon === 'S' && b.codtransp && b.conhecimento?.nrocon) {
      const c = b.conhecimento;
      const ja = await client.query(
        `SELECT 1 FROM dbconhecimentoent WHERE codtransp=$1 AND nrocon=$2`,
        [b.codtransp, c.nrocon],
      );
      if (ja.rows.length > 0) {
        await client.query(
          `UPDATE dbconhecimentoent
              SET serie=$3, cfop=$4, icms=$5, baseicms=$6, totalcon=$7, totaltransp=$8,
                  stcon=$9, dtcon=$10, tipocalc=$11, tipocon=$12, cif=$13, cancel='N'
            WHERE codtransp=$1 AND nrocon=$2`,
          [b.codtransp, c.nrocon, orNull(c.serie), orNull(c.cfop), num(c.icms), num(c.baseicms),
           num(c.totalcon), num(c.totaltransp), num(c.stcon), orNull(c.dtcon),
           orNull(c.tipocalc), orNull(c.tipocon), c.cif || 'N'],
        );
      } else {
        await client.query(
          `INSERT INTO dbconhecimentoent
             (codtransp, nrocon, serie, cfop, icms, baseicms, totalcon, dtcon, totaltransp,
              stcon, tipocalc, tipocon, cif, cancel, dtcadastro)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'N', now())`,
          [b.codtransp, c.nrocon, orNull(c.serie), orNull(c.cfop), num(c.icms), num(c.baseicms),
           num(c.totalcon), orNull(c.dtcon), num(c.totaltransp), num(c.stcon),
           orNull(c.tipocalc), orNull(c.tipocon), c.cif || 'N'],
        );
      }
    }

    // 3) Cabeçalho dbent (status 'A')
    await client.query(
      `INSERT INTO dbent
         (codent, cod_credor, codtransp, nrocon, nroform, selo, serie,
          icms, baseicms, totalprod, totalipi, totalnf, dtent, dtselo, dtnota, nrodi, dtdi,
          custofin, desconto, valordolar, cfop, origem, obs, codusr, status,
          temcon, temcusto, codcomprador, verba_tmk, acrescimo, operacao, selecionada,
          zerar_ipi, zerar_st, chave, est_alocado, romaneio)
       VALUES ($1,$2,$3,$4,$5,$6,$7, $8,$9,$10,$11,$12, now(), $13,$14,$15,$16,
               $17,$18,$19,$20,$21,$22,$23,'A', $24,$25,$26,$27,$28,$29,'N',
               $30,$31,$32, 0, $33)`,
      [
        codent, b.cod_credor, orNull(b.codtransp), orNull(b.conhecimento?.nrocon), orNull(b.nroform),
        orNull(b.selo), orNull(b.serie),
        num(b.icms), num(b.baseicms), num(b.totalprod), num(b.totalipi), num(b.totalnf),
        orNull(b.dtselo), orNull(b.dtnota), orNull(b.nrodi), orNull(b.dtdi),
        num(b.custofin), num(b.desconto), num(b.valordolar), orNull(b.cfop),
        b.origem === 'B' ? 'B' : 'A', orNull(b.obs), orNull(b.codusr),
        temcon, temcusto, orNull(b.codcomprador), num(b.verba_tmk), num(b.acrescimo),
        orNull(b.operacao), b.zerar_ipi === 'S' ? 'S' : 'N', b.zerar_st === 'S' ? 'S' : 'N',
        orNull(b.chave), romaneio,
      ],
    );

    // 4) Workflow físico
    await client.query(
      `INSERT INTO dbent_recebimento (codent, status) VALUES ($1, 'PENDENTE')
       ON CONFLICT (codent) DO NOTHING`,
      [codent],
    );

    await client.query('COMMIT');
    return res.status(200).json({
      success: true,
      message: `Entrada ${codent} criada. Selecione os itens.`,
      codent,
      entradaId: codent,
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Erro ao criar entrada manual:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao criar entrada: ' + (error instanceof Error ? error.message : 'Erro desconhecido'),
    });
  } finally {
    if (client) client.release();
  }
}

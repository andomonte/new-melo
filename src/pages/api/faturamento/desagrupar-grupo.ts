import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * POST /api/faturamento/desagrupar-grupo  { codgp }  (ou { codfat } de uma fatura do grupo)
 *
 * Desagrupa uma GP (grupo de pagamento) — espelha AGRUPAMENTO.GP_DESAGRUPAR do Oracle.
 * Desagrupar é a ação COMPLETA: cancela a cobrança do grupo E solta as faturas.
 *
 * Delphi GP_DESAGRUPAR:
 *   - por membro: PRAZO_DELETAR_FAT (dbpzfat WHERE codfat) + FATURA_ALTERAR_STATUS →
 *       codgp=NULL, agp='N', cobranca='N', cod_banco='0000', cod_conta='0000', frmfat=NULL;
 *   - COBRANCA_CANCELAR_GP(codgp): dbreceb cancel='S' WHERE codgp + PRAZO_DELETAR_GP (dbpzfat WHERE codgp);
 *   - update dbgpfatura.dtatualizacao + log 'DESAGRUPAR'.
 *
 * Trava (VALIDA_COBRANCA_GP): NÃO desagrupa se algum título ATIVO do grupo estiver
 * recebido (valor_rec>0 / rec='S' / dt_pgto — total OU parcial), registrado no banco
 * (bradesco='S') ou vencido (dt_venc < hoje).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    let { codgp, codfat, usuario } = req.body || {};

    // Se veio codfat, descobre a GP dele.
    if (!codgp && codfat) {
      const r = await client.query(
        `SELECT codgp FROM dbfatura WHERE codfat = $1`,
        [String(codfat)],
      );
      codgp = r.rows[0]?.codgp;
    }
    codgp = Number(codgp);
    if (!codgp) return res.status(400).json({ erro: 'GP (codgp) inválida ou não encontrada.' });

    const usuarioTxt = String(usuario ?? '').trim() || 'DESCONHECIDO';

    // Faturas membros do grupo.
    const membros = await client.query(
      `SELECT codfat FROM dbfatura
        WHERE codgp = $1 AND codfat NOT LIKE 'GP%'`,
      [codgp],
    );
    if (membros.rows.length === 0) {
      return res.status(404).json({ erro: 'Nenhuma fatura para desagrupar nesta GP.' });
    }

    // ===== Trava VALIDA_COBRANCA_GP (fiel ao Delphi) =====
    // Bloqueia se algum título ATIVO do grupo (codgp, cod_fat NULL, cancel='N') estiver
    // recebido (parcial/total), registrado no banco ou vencido.
    const val = await client.query(
      `SELECT
         COUNT(*) FILTER (WHERE bradesco = 'S')                          AS registrados,
         COUNT(*) FILTER (WHERE COALESCE(valor_rec,0) > 0
                             OR rec = 'S' OR dt_pgto IS NOT NULL)         AS recebidos,
         COUNT(*) FILTER (WHERE dt_venc < CURRENT_DATE)                  AS vencidos
       FROM dbreceb
      WHERE codgp = $1 AND cod_fat IS NULL AND (cancel IS NULL OR cancel <> 'S')`,
      [codgp],
    );
    const v = val.rows[0] || {};
    if (Number(v.recebidos) > 0) {
      return res.status(400).json({
        erro: 'A cobrança agrupada possui título recebido (total ou parcial) — não é possível desagrupar.',
      });
    }
    if (Number(v.registrados) > 0) {
      return res.status(400).json({
        erro: 'A cobrança agrupada possui título registrado no banco (Bradesco) — não é possível desagrupar.',
      });
    }
    if (Number(v.vencidos) > 0) {
      return res.status(400).json({
        erro: 'A cobrança agrupada possui título vencido — não é possível desagrupar.',
      });
    }

    await client.query('BEGIN');

    const codfatsMembros = membros.rows.map((r) => r.codfat);

    // 1. COBRANCA_CANCELAR_GP: cancela os títulos do grupo + apaga os prazos do grupo.
    const recCancel = await client.query(
      `UPDATE dbreceb SET cancel = 'S'
        WHERE codgp = $1 AND (cancel IS NULL OR cancel <> 'S')`,
      [codgp],
    );
    await client.query(`DELETE FROM dbpzfat WHERE codgp = $1`, [codgp]);

    // 2. Por membro: apaga os prazos da fatura (PRAZO_DELETAR_FAT) e solta do grupo
    //    (FATURA_ALTERAR_STATUS): codgp=NULL, agp='N', cobranca='N', banco/conta/forma zerados.
    await client.query(`DELETE FROM dbpzfat WHERE codfat = ANY($1)`, [codfatsMembros]);
    const upd = await client.query(
      `UPDATE dbfatura
          SET codgp = NULL, agp = 'N', cobranca = 'N',
              cod_banco = '0000', cod_conta = '0000', frmfat = NULL
        WHERE codgp = $1 AND codfat NOT LIKE 'GP%'`,
      [codgp],
    );

    // 3. Atualiza o cabeçalho do grupo (dbgpfatura.dtatualizacao) — igual ao Delphi.
    await client
      .query(`UPDATE dbgpfatura SET dtatualizacao = NOW() WHERE codgp = $1`, [codgp])
      .catch(() => {});

    // 4. Histórico — Usuario.inc_acao_usr 'DESAGRUPAR' / 'DBGPFATURA'.
    await client.query(
      `INSERT INTO dbacao (codusr, acao, tabela, obs, data)
       VALUES ($1, 'DESAGRUPAR', 'DBGPFATURA', $2, now())`,
      [usuarioTxt.substring(0, 60), `COD:${codgp}`.substring(0, 255)],
    );

    // 5. Tabelas auxiliares do web (não fazem parte do modelo Delphi) — best-effort.
    await client
      .query(
        `UPDATE grupo_pagamento SET status = 'DESAGRUPADO' WHERE codigo_gp = $1`,
        [codgp],
      )
      .catch(() => {});
    await client
      .query(
        `DELETE FROM grupo_pagamento_fatura
          WHERE grupo_pagamento_id IN (
            SELECT id FROM grupo_pagamento WHERE codigo_gp = $1
          )`,
        [codgp],
      )
      .catch(() => {});

    await client.query('COMMIT');

    return res.status(200).json({
      sucesso: true,
      codgp,
      faturasDesagrupadas: upd.rowCount ?? membros.rows.length,
      cobrancasCanceladas: recCancel.rowCount ?? 0,
      faturas: codfatsMembros,
    });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Erro ao desagrupar GP:', error);
    return res.status(500).json({ erro: 'Erro ao desagrupar a GP.', detalhes: error.message });
  } finally {
    client.release();
  }
}

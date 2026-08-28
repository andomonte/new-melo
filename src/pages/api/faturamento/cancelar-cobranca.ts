import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { codfat, codgp, usuario, motivo } = req.body;

  const ehGrupo = codgp !== undefined && codgp !== null && String(codgp) !== '';
  if (!ehGrupo && !codfat) {
    return res.status(400).json({ error: 'Código da fatura é obrigatório.' });
  }

  // Motivo obrigatório para o histórico (registro na dbacao).
  const motivoTxt = String(motivo ?? '').trim();
  if (motivoTxt.length < 5) {
    return res
      .status(400)
      .json({ error: 'Informe o motivo do cancelamento (mínimo 5 caracteres).' });
  }
  const usuarioTxt = String(usuario ?? '').trim() || 'DESCONHECIDO';

  try {
    const client = await getPgPool().connect();

    try {
      // ============================================================================
      // COBRANÇA AGRUPADA (GP) — espelha TCOBRANCA.COBRANCA_CANCELAR_GP do Delphi.
      // Os títulos do grupo estão em dbreceb.codgp (cod_fat NULL, tipo 'G'); o cancel
      // por cod_fat (abaixo) não os alcança. Cancelar o GP NÃO desagrupa — só cancela
      // os títulos do grupo e apaga os prazos (dbpzfat). Desagrupar é ação à parte.
      // ============================================================================
      if (ehGrupo) {
        // VALIDA_COBRANCA_GP: bloqueia se algum título ATIVO do grupo estiver
        // registrado no banco (bradesco='S'), recebido (valor_rec>0 / rec='S' /
        // dt_pgto) ou vencido (dt_venc < hoje).
        const val = await client.query(
          `SELECT
             COUNT(*) FILTER (WHERE bradesco = 'S')                       AS registrados,
             COUNT(*) FILTER (WHERE COALESCE(valor_rec,0) > 0
                                 OR rec = 'S' OR dt_pgto IS NOT NULL)      AS recebidos,
             COUNT(*) FILTER (WHERE dt_venc < CURRENT_DATE)               AS vencidos
           FROM dbreceb
          WHERE codgp = $1 AND cod_fat IS NULL AND (cancel IS NULL OR cancel <> 'S')`,
          [codgp],
        );
        const v = val.rows[0] || {};
        if (Number(v.registrados) > 0) {
          return res.status(409).json({
            error:
              'Cobrança do grupo não pode ser cancelada: possui título registrado no banco (Bradesco).',
          });
        }
        if (Number(v.recebidos) > 0) {
          return res.status(409).json({
            error:
              'Cobrança do grupo não pode ser cancelada: já possui título recebido.',
          });
        }
        if (Number(v.vencidos) > 0) {
          return res.status(409).json({
            error:
              'Cobrança do grupo não pode ser cancelada: possui título vencido.',
          });
        }

        await client.query('BEGIN');
        try {
          // COBRANCA_CANCELAR_GP: cancela todos os títulos do grupo + apaga prazos.
          const upd = await client.query(
            `UPDATE dbreceb SET cancel = 'S'
              WHERE codgp = $1 AND (cancel IS NULL OR cancel <> 'S')`,
            [codgp],
          );
          await client.query(`DELETE FROM dbpzfat WHERE codgp = $1`, [codgp]);
          // Web: reflete "sem cobrança ativa" nos membros (o grupo permanece — agp/codgp
          // intactos; STATUS = 'COBRANÇA AGRUPADA'). Permite regerar a cobrança do grupo.
          await client.query(
            `UPDATE dbfatura SET cobranca = 'N' WHERE codgp = $1`,
            [codgp],
          );
          // Histórico (Usuario.inc_acao_usr 'CANCEL.TITULO').
          await client.query(
            `INSERT INTO dbacao (codusr, acao, tabela, obs, data)
             VALUES ($1, 'CANCEL.TITULO', 'DBRECEB', $2, now())`,
            [
              usuarioTxt.substring(0, 60),
              `GP:${codgp} | MOTIVO: ${motivoTxt}`.substring(0, 255),
            ],
          );
          await client.query('COMMIT');
          if (upd.rowCount === 0) {
            return res.status(200).json({
              message: 'Nenhum título ativo no grupo (já estava cancelado).',
            });
          }
          return res.status(200).json({
            message: `Cobrança do grupo GP${codgp} cancelada (${upd.rowCount} título(s)).`,
          });
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        }
      }

      // 🛡️ REGRA (espelha o Delphi — VALIDA_COBRANCA_FAT): NÃO cancelar cobrança
      // que já possui parcela PAGA. Marcador de pago = rec='S' OU dt_pgto preenchido.
      // NÃO usar valor_pgto: em títulos em aberto ele guarda o valor projetado da
      // parcela (não o valor pago) → falso positivo (147k títulos no banco).
      // Restringe aos títulos da PRÓPRIA fatura (nro_doc NF...), excluindo os de
      // grupo (nro_doc 'GP...') — a cobrança agrupada é tratada no desagrupar.
      const pagas = await client.query(
        `SELECT COUNT(*)::int AS n
           FROM dbreceb
          WHERE cod_fat = $1
            AND (cancel IS NULL OR cancel <> 'S')
            AND (nro_doc IS NULL OR substr(nro_doc, 1, 2) <> 'GP')
            AND (rec = 'S' OR dt_pgto IS NOT NULL)`,
        [codfat],
      );
      const qtdPagas = pagas.rows[0]?.n ?? 0;
      if (qtdPagas > 0) {
        return res.status(409).json({
          error: `Cobrança não pode ser cancelada: já possui ${qtdPagas} parcela(s) paga(s).`,
        });
      }

      await client.query('BEGIN');
      try {
        // Atualiza o campo 'cobranca' na fatura para 'N'
        await client.query(
          `UPDATE dbfatura
             SET cobranca = 'N'
           WHERE codfat = $1`,
          [codfat],
        );

        // Espelha COBRANCA_CANCELAR_FAT do Delphi:
        //   UpDate DbReceb Set Cancel='S'
        //    Where Cod_Fat = vCodFat and SubStr(nro_Doc,1,2) <> 'GP';
        // Cancela apenas os títulos da própria fatura (NF...), preservando os
        // títulos de grupo (GP...) — que só são cancelados no desagrupamento.
        await client.query(
          `UPDATE dbreceb
             SET cancel = 'S'
           WHERE cod_fat = $1
             AND (nro_doc IS NULL OR substr(nro_doc, 1, 2) <> 'GP')`,
          [codfat],
        );

        // Histórico — espelha USUARIO.Inc_Acao_Usr do Delphi:
        //   Insert Into DbAcao(codusr,acao,tabela,obs,data)
        //   values(vcodusr,'CANCEL.TITULO','DBRECEB','COD:'||vCodFat,sysdate);
        // Estendido com o motivo no campo obs (o Delphi não guardava motivo).
        await client.query(
          `INSERT INTO dbacao (codusr, acao, tabela, obs, data)
           VALUES ($1, 'CANCEL.TITULO', 'DBRECEB', $2, now())`,
          [usuarioTxt.substring(0, 60), `COD:${codfat} | MOTIVO: ${motivoTxt}`.substring(0, 255)],
        );

        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }

      return res.status(200).json({ message: 'Cobrança cancelada com sucesso.' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Erro ao cancelar cobrança:', error);
    return res.status(500).json({ error: 'Erro ao cancelar cobrança.' });
  }
}

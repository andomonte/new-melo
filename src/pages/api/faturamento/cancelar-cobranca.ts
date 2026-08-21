import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { codfat, usuario, motivo } = req.body;

  if (!codfat) {
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
          `INSERT INTO db_manaus.dbacao (codusr, acao, tabela, obs, data)
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

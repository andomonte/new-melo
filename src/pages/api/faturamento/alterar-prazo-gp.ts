import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { inserirCobrancaGP } from '@/lib/faturamento/inserirCobrancaGP';
import { dropdownDeBancoInterno } from '@/lib/faturamento/bancoCobranca';

/**
 * POST /api/faturamento/alterar-prazo-gp
 *   { codgp, cobranca_dados: { banco, tipofat, parcelas:[{vencimento,valor,dias}] }, usuario }
 *
 * Espelha AGRUPAMENTO.GP_ALTERAR: cancela a cobrança atual do grupo e RECRIA com os novos
 * prazos/parcelas (banco/tipo/vencimentos), MANTENDO o grupo. Trava VALIDA_COBRANCA_GP.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // GET → devolve a config ATUAL da cobrança do grupo (banco dropdown, tipo, parcelas)
  // para pré-carregar o editor de "Alterar Prazo".
  if (req.method === 'GET') {
    const codgp = String(req.query.codgp || '').trim();
    if (!codgp) return res.status(400).json({ erro: 'Informe o codgp.' });
    const client = await getPgPool().connect();
    try {
      const tit = await client.query(
        `SELECT banco, forma_fat, to_char(dt_venc,'YYYY-MM-DD') AS dt_venc, valor_pgto,
                GREATEST((dt_venc::date - dt_emissao::date), 0) AS dias
           FROM dbreceb
          WHERE codgp=$1 AND cod_fat IS NULL AND (cancel IS NULL OR cancel<>'S')
          ORDER BY dt_venc, cod_receb`,
        [codgp],
      );
      const banco = tit.rows[0]
        ? dropdownDeBancoInterno(String(tit.rows[0].banco ?? ''))
        : null;
      return res.status(200).json({
        codgp,
        banco: banco ?? '',
        tipofat: tit.rows[0]?.forma_fat ?? '',
        parcelas: tit.rows.map((t: any) => ({
          vencimento: t.dt_venc,
          valor: Number(t.valor_pgto) || 0,
          dias: Number(t.dias) || 0, // prazo original = dt_venc − dt_emissao
        })),
      });
    } catch (error: any) {
      return res.status(500).json({ erro: 'Erro ao carregar cobrança do grupo.', detalhes: error?.message });
    } finally {
      client.release();
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });
  const { codgp, cobranca_dados, usuario } = req.body || {};
  if (!codgp) return res.status(400).json({ erro: 'Informe o codgp.' });
  const parcelas = Array.isArray(cobranca_dados?.parcelas) ? cobranca_dados.parcelas : [];
  if (parcelas.length === 0) {
    return res.status(400).json({
      erro: 'Gere ao menos uma parcela para a cobrança (informe intervalo + quantidade e clique em "Gerar parcelas").',
    });
  }
  const usuarioTxt = String(usuario ?? '').trim() || 'DESCONHECIDO';

  const client = await getPgPool().connect();
  try {
    const membrosRow = await client.query(
      `SELECT codfat, codcli FROM dbfatura WHERE codgp = $1 AND codfat NOT LIKE 'GP%'`,
      [codgp],
    );
    if (membrosRow.rows.length === 0) {
      return res.status(404).json({ erro: 'Grupo não encontrado ou sem faturas.' });
    }
    const codfatsMembros = membrosRow.rows.map((r) => r.codfat);
    const codcli = membrosRow.rows[0]?.codcli;

    // Trava VALIDA_COBRANCA_GP (recebido/registrado/vencido).
    const val = await client.query(
      `SELECT
         COUNT(*) FILTER (WHERE bradesco='S') AS registrados,
         COUNT(*) FILTER (WHERE COALESCE(valor_rec,0)>0 OR rec='S' OR dt_pgto IS NOT NULL) AS recebidos,
         COUNT(*) FILTER (WHERE dt_venc < CURRENT_DATE) AS vencidos
       FROM dbreceb
      WHERE codgp=$1 AND cod_fat IS NULL AND (cancel IS NULL OR cancel<>'S')`,
      [codgp],
    );
    const v = val.rows[0] || {};
    if (Number(v.recebidos) > 0)
      return res.status(400).json({ erro: 'A cobrança do grupo tem título recebido — não é possível alterar o prazo.' });
    if (Number(v.registrados) > 0)
      return res.status(400).json({ erro: 'A cobrança do grupo tem título registrado no banco.' });
    if (Number(v.vencidos) > 0)
      return res.status(400).json({ erro: 'A cobrança do grupo tem título vencido.' });

    await client.query('BEGIN');
    try {
      // 1. Cancela a cobrança atual do grupo + apaga os prazos (COBRANCA_CANCELAR_GP).
      await client.query(
        `UPDATE dbreceb SET cancel='S' WHERE codgp=$1 AND (cancel IS NULL OR cancel<>'S')`,
        [codgp],
      );
      await client.query(`DELETE FROM dbpzfat WHERE codgp=$1`, [codgp]);

      // 2. Recria com os novos prazos (COBRANCA_CONFIRMAR('G')). Mantém o grupo.
      await inserirCobrancaGP(client, {
        codgp: Number(codgp),
        codcli,
        banco: cobranca_dados.banco,
        tipofat: cobranca_dados.tipofat,
        parcelas,
        codfatsMembros,
      });

      // 3. Reafirma a cobrança nos membros + atualiza header + log.
      await client.query(`UPDATE dbfatura SET cobranca='S' WHERE codgp=$1`, [codgp]);
      await client
        .query(`UPDATE dbgpfatura SET dtatualizacao=NOW() WHERE codgp=$1`, [codgp])
        .catch(() => {});
      await client.query(
        `INSERT INTO dbacao (codusr, acao, tabela, obs, data)
         VALUES ($1,'ALTERAR','DBGPFATURA',$2,now())`,
        [usuarioTxt.substring(0, 60), `COD:${codgp}`.substring(0, 255)],
      );

      await client.query('COMMIT');
      return res.status(200).json({
        sucesso: true,
        codgp,
        parcelasGeradas: parcelas.length,
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  } catch (error: any) {
    console.error('Erro ao alterar prazo do grupo:', error);
    return res
      .status(500)
      .json({ erro: 'Erro ao alterar prazo do grupo.', detalhes: error?.message });
  } finally {
    client.release();
  }
}

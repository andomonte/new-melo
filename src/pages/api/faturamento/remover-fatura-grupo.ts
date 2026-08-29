import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { inserirCobrancaGP } from '@/lib/faturamento/inserirCobrancaGP';
import { dropdownDeBancoInterno } from '@/lib/faturamento/bancoCobranca';

/**
 * POST /api/faturamento/remover-fatura-grupo  { codgp, codfats: string[], usuario }
 *
 * Espelha AGRUPAMENTO.GP_REMOVER_FATURA: tira a(s) fatura(s) do grupo E RECALCULA a
 * cobrança das faturas RESTANTES — cancela os títulos atuais do grupo e recria com o
 * novo total (mesmos vencimentos/prazos), mantendo o grupo.
 *
 * Travas: precisa sobrar >= 2 faturas (o Delphi exige >=2; menos = usar Desagrupar) e a
 * cobrança não pode ter título recebido/registrado/vencido (VALIDA_COBRANCA_GP).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });
  const { codgp, codfats, usuario } = req.body || {};
  const remover: string[] = Array.isArray(codfats)
    ? codfats.map((x) => String(x)).filter(Boolean)
    : [];
  if (!codgp || remover.length === 0) {
    return res.status(400).json({ erro: 'Informe o codgp e as faturas a remover.' });
  }
  const usuarioTxt = String(usuario ?? '').trim() || 'DESCONHECIDO';

  const client = await getPgPool().connect();
  try {
    const mem = await client.query(
      `SELECT codfat FROM dbfatura WHERE codgp = $1 AND codfat NOT LIKE 'GP%'`,
      [codgp],
    );
    const membros: string[] = mem.rows.map((r) => r.codfat);
    if (membros.length === 0) {
      return res.status(404).json({ erro: 'Grupo não encontrado ou sem faturas.' });
    }
    const removerSet = new Set(remover);
    const restantes = membros.filter((c) => !removerSet.has(c));
    const invalidas = remover.filter((c) => !membros.includes(c));
    if (invalidas.length) {
      return res
        .status(400)
        .json({ erro: `Fatura(s) não pertence(m) ao grupo: ${invalidas.join(', ')}` });
    }
    // Trava VALIDA_COBRANCA_GP (recebido/registrado/vencido) — ANTES do check de <2, para o
    // motivo real (ex.: título recebido) ter prioridade sobre "sobrariam menos de 2".
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
      return res.status(400).json({ erro: 'A cobrança do grupo tem título recebido — não é possível remover fatura.' });
    if (Number(v.registrados) > 0)
      return res.status(400).json({ erro: 'A cobrança do grupo tem título registrado no banco.' });
    if (Number(v.vencidos) > 0)
      return res.status(400).json({ erro: 'A cobrança do grupo tem título vencido.' });

    if (restantes.length < 2) {
      return res.status(400).json({
        erro: 'Sobrariam menos de 2 faturas no grupo. Para isso, use Desagrupar.',
      });
    }

    // Config atual da cobrança (títulos ativos): banco interno, forma, vencimentos.
    const tit = await client.query(
      `SELECT banco, forma_fat, to_char(dt_venc,'YYYY-MM-DD') AS dt_venc
         FROM dbreceb
        WHERE codgp=$1 AND cod_fat IS NULL AND (cancel IS NULL OR cancel<>'S')
        ORDER BY dt_venc, cod_receb`,
      [codgp],
    );
    const codcliRow = await client.query(
      `SELECT codcli FROM dbfatura WHERE codgp=$1 LIMIT 1`,
      [codgp],
    );
    const codcli = codcliRow.rows[0]?.codcli;

    await client.query('BEGIN');
    try {
      // 1. Solta as faturas removidas (fiel ao FATURA_ALTERAR_STATUS 'N').
      await client.query(
        `UPDATE dbfatura
            SET codgp=NULL, agp='N', cobranca='N', cod_banco='0000', cod_conta='0000', frmfat=NULL
          WHERE codfat = ANY($1)`,
        [remover],
      );
      await client.query(`DELETE FROM dbpzfat WHERE codfat = ANY($1)`, [remover]);

      // 2. Cancela os títulos atuais do grupo + apaga os prazos do grupo.
      await client.query(
        `UPDATE dbreceb SET cancel='S' WHERE codgp=$1 AND (cancel IS NULL OR cancel<>'S')`,
        [codgp],
      );
      await client.query(`DELETE FROM dbpzfat WHERE codgp=$1`, [codgp]);

      // 3. Novo total = soma das faturas restantes.
      const tot = await client.query(
        `SELECT COALESCE(SUM(COALESCE(totalnf, totalfat, 0)),0) AS t
           FROM dbfatura WHERE codfat = ANY($1)`,
        [restantes],
      );
      const novoTotal = Number(tot.rows[0].t) || 0;

      // 4. Recria as parcelas: MESMOS vencimentos, valor redistribuído (resto na última).
      let parcelas: { vencimento: string; valor: number }[] = [];
      if (tit.rows.length > 0 && novoTotal > 0) {
        const n = tit.rows.length;
        const base = Math.floor((novoTotal / n) * 100) / 100;
        let acc = 0;
        parcelas = tit.rows.map((t: any, i: number) => {
          const valor =
            i === n - 1 ? Math.round((novoTotal - acc) * 100) / 100 : base;
          acc += valor;
          return { vencimento: t.dt_venc, valor };
        });
      }

      let parcelasRecriadas = 0;
      if (parcelas.length > 0) {
        const bancoDropdown =
          dropdownDeBancoInterno(String(tit.rows[0].banco ?? '')) ?? '5';
        const tipofat = String(tit.rows[0].forma_fat ?? '4');
        await inserirCobrancaGP(client, {
          codgp: Number(codgp),
          codcli,
          banco: bancoDropdown,
          tipofat,
          parcelas,
          codfatsMembros: restantes,
        });
        parcelasRecriadas = parcelas.length;
      }

      await client
        .query(`UPDATE dbgpfatura SET dtatualizacao=NOW() WHERE codgp=$1`, [codgp])
        .catch(() => {});
      await client.query(
        `INSERT INTO dbacao (codusr, acao, tabela, obs, data)
         VALUES ($1,'REMOVER FATURA','DBGPFATURA',$2,now())`,
        [
          usuarioTxt.substring(0, 60),
          `COD:${codgp} | REMOV:${remover.join(',')}`.substring(0, 255),
        ],
      );
      await client
        .query(`DELETE FROM grupo_pagamento_fatura WHERE fatura_id = ANY($1)`, [remover])
        .catch(() => {});

      await client.query('COMMIT');
      return res.status(200).json({
        sucesso: true,
        codgp,
        removidas: remover,
        restantes,
        parcelasRecriadas,
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  } catch (error: any) {
    console.error('Erro ao remover fatura do grupo:', error);
    return res
      .status(500)
      .json({ erro: 'Erro ao remover fatura do grupo.', detalhes: error?.message });
  } finally {
    client.release();
  }
}

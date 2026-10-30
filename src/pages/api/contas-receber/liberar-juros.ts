import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool, getPgPoolFilial, filialDaRequisicao } from '@/lib/pg';

/**
 * POST /api/contas-receber/liberar-juros
 * body: { cod_receb: string | string[], taxa: number, motivo: string, usuario }
 *
 * Porte de LIBERAR_JUROS (Delphi UniContasR.BaixarJuros1/btnJurosConfirmarClick): registra em
 * FIN_LIBERA_JUROS uma TAXA de juros autorizada para o(s) título(s), com motivo obrigatório
 * (mín. 15 caracteres). A taxa liberada sobrepõe a padrão no próximo recebimento (dados-recebimento
 * já lê lij_utilizada=0). Não recebe o título — só autoriza a taxa. Título já recebido não pode.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido. Use POST.' });
  const { cod_receb, taxa, motivo, usuario, codusr: codusrBody } = req.body || {};
  const ids: string[] = Array.isArray(cod_receb) ? cod_receb.map(String).filter(Boolean) : cod_receb ? [String(cod_receb)] : [];
  if (ids.length === 0) return res.status(400).json({ erro: 'Informe cod_receb.' });

  const tx = Number(taxa);
  if (!Number.isFinite(tx) || tx < 0) return res.status(400).json({ erro: 'Informe uma taxa de juros válida (>= 0).' });

  const mot = String(motivo ?? '').trim();
  if (mot.length < 15) return res.status(400).json({ erro: 'O motivo é obrigatório (mínimo 15 caracteres).' });

  // Títulos/liberação/log são da FILIAL; o Código Delphi do usuário é do acesso (central).
  const pool = await getPgPoolFilial(req);
  const client = await pool.connect();
  try {
    // lij_cod_usuario é varchar(4): precisa do CÓDIGO do operador (dbusuario.codusr), não do login.
    // Prioridade: Código Delphi do perfil (tb_user_perfil.codusr_delphi, login + filial) →
    // codusr da sessão (front; hoje é o codvend, vazio p/ quem não vende) → nomeusr → erro.
    let codusr = '';
    try {
      const filial = filialDaRequisicao(req);
      const d = await getPgPool().query(
        `SELECT codusr_delphi FROM tb_user_perfil
          WHERE UPPER(user_login_id) = UPPER($1) AND codusr_delphi IS NOT NULL
          ORDER BY (UPPER(nome_filial) = $2) DESC
          LIMIT 1`,
        [String(usuario ?? ''), filial],
      );
      if (d.rows[0]?.codusr_delphi) codusr = String(d.rows[0].codusr_delphi).trim();
    } catch {
      /* segue para os fallbacks */
    }
    if (!codusr) codusr = String(codusrBody ?? '').trim();
    if (!codusr) {
      try {
        const u = await client.query('SELECT codusr FROM dbusuario WHERE nomeusr=$1 LIMIT 1', [usuario]);
        if (u.rows[0]?.codusr) codusr = String(u.rows[0].codusr).trim();
      } catch {
        /* segue vazio */
      }
    }
    codusr = codusr.substring(0, 4);
    if (!codusr) {
      return res.status(400).json({
        erro: 'Usuário sem Código Delphi nesta filial. Cadastre-o em Controle de Acesso > Usuários.',
      });
    }

    await client.query('BEGIN');
    try {
      const liberados: string[] = [];
      const jaRecebidos: string[] = [];
      for (const id of ids) {
        const t = await client.query(`SELECT rec FROM dbreceb WHERE cod_receb=$1 FOR UPDATE`, [id]);
        if (t.rows.length === 0) continue;
        if (t.rows[0].rec === 'S') { jaRecebidos.push(id); continue; } // Delphi: título já recebido não libera
        await client.query(
          `INSERT INTO fin_libera_juros (lij_id, lij_cod_receb, lij_cod_usuario, lij_taxa_liberada, lij_motivo, lij_data, lij_utilizada)
           VALUES ((SELECT COALESCE(MAX(lij_id),0)+1 FROM fin_libera_juros), $1, $2, $3, $4, now(), 0)`,
          [id, codusr, tx, mot.substring(0, 255)],
        );
        liberados.push(id);
      }

      // Log de ação (quem/quando/taxa/motivo), igual ao padrão de auditoria. Em SAVEPOINT:
      // uma falha aqui abortaria a transação e o COMMIT viraria rollback silencioso.
      await client.query('SAVEPOINT log_acao');
      await client
        .query(
          `INSERT INTO dbacao (codusr, acao, tabela, obs, data)
           VALUES ($1,'LIBERAR JUROS','FIN_LIBERA_JUROS',$2,now())`,
          [codusr.substring(0, 60) || 'DESCONHECIDO', `TIT:${liberados.join(',')} | TAXA:${tx} | MOTIVO:${mot}`.substring(0, 255)],
        )
        .then(() => client.query('RELEASE SAVEPOINT log_acao'))
        .catch(() => client.query('ROLLBACK TO SAVEPOINT log_acao'));

      await client.query('COMMIT');
      return res.status(200).json({
        sucesso: true,
        liberados: liberados.length,
        titulos: liberados,
        jaRecebidos,
        taxa: tx,
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  } catch (error: any) {
    console.error('Erro ao liberar juros:', error);
    return res.status(500).json({ erro: 'Erro ao liberar juros', detalhes: error.message });
  } finally {
    client.release();
  }
}

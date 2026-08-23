/**
 * Finalizar alocação — modelo dbent/dbent_recebimento.
 * PUT /api/alocacao/finalizar
 * Body: entradaId (codent), matricula, observacao?
 * Marca ALOCADO + DISPONIVEL_VENDA, libera reserva e move estoque para os armazéns (romaneio).
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';

interface FinalizarRequest {
  entradaId: string; // codent
  matricula: string;
  observacao?: string;
}

interface FinalizarResponse {
  success: boolean;
  message: string;
}

const GET_ALOCACOES_QUERY = `
  SELECT da.codprod as cod_produto, da.arm_id, da.qtd, da.localizacao, arm.arm_descricao
  FROM dbitent_armazem da
  LEFT JOIN cad_armazem arm ON arm.arm_id = da.arm_id
  WHERE da.codent = $1
  ORDER BY da.codprod, da.arm_id
`;
const GET_ALOCACOES_FALLBACK_QUERY = `
  SELECT da.codprod as cod_produto, da.arm_id, da.qtd, NULL as localizacao, arm.arm_descricao
  FROM dbitent_armazem da
  LEFT JOIN cad_armazem arm ON arm.arm_id = da.arm_id
  WHERE da.codent = $1
  ORDER BY da.codprod, da.arm_id
`;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FinalizarResponse | { error: string }>,
) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  const { entradaId, matricula, observacao } = (req.body || {}) as FinalizarRequest;
  if (!entradaId || !matricula) {
    return res.status(400).json({ error: 'entradaId e matricula sao obrigatorios' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS';
  const pool = getPgPool(filial);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    const checkResult = await client.query(
      `SELECT id FROM entrada_operacoes
        WHERE codent = $1 AND alocador_matricula = $2 AND status = 'EM_ALOCACAO'`,
      [entradaId, matricula]);
    if (checkResult.rows.length === 0) {
      return res.status(403).json({ error: 'Voce nao esta autorizado a finalizar esta alocacao' });
    }

    await client.query('BEGIN');
    await client.query(`SET LOCAL search_path TO ${process.env.DB_SCHEMA || 'db_manaus'}, public`);

    const finalizarResult = await client.query(
      `UPDATE entrada_operacoes
          SET status = 'ALOCADO', fim_alocacao = NOW(),
              observacao = COALESCE($2, observacao), updated_at = NOW()
        WHERE codent = $1 AND status = 'EM_ALOCACAO' RETURNING id`,
      [entradaId, observacao || null]);
    if (finalizarResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Nao foi possivel finalizar a alocacao' });
    }

    // Entrada disponível para venda
    await client.query(`UPDATE dbent SET est_alocado = 1 WHERE codent = $1`, [entradaId]);
    await client.query(
      `UPDATE dbent_recebimento SET status = 'DISPONIVEL_VENDA', updated_at = now() WHERE codent = $1`,
      [entradaId]);

    // Estoque nos armazéns a partir do romaneio (dbitent_armazem)
    let alocacoesResult;
    try {
      alocacoesResult = await client.query(GET_ALOCACOES_QUERY, [entradaId]);
    } catch (err: any) {
      if (err.code === '42703') {
        alocacoesResult = await client.query(GET_ALOCACOES_FALLBACK_QUERY, [entradaId]);
      } else {
        throw err;
      }
    }

    for (const aloc of alocacoesResult.rows) {
      const { cod_produto, arm_id, qtd, localizacao } = aloc;
      const quantidade = parseFloat(qtd);

      // 1. Libera reserva no produto geral
      await client.query(
        `UPDATE dbprod SET qtdreservada = GREATEST(COALESCE(qtdreservada, 0) - $1, 0) WHERE codprod = $2`,
        [quantidade, cod_produto]);

      // 2. Garante registro no armazém
      await client.query(
        `INSERT INTO cad_armazem_produto (arp_arm_id, arp_codprod, arp_qtest, arp_qtest_reservada, arp_bloqueado)
         VALUES ($1, $2, 0, 0, 'N') ON CONFLICT (arp_arm_id, arp_codprod) DO NOTHING`,
        [arm_id, cod_produto]);

      // 3. Incrementa estoque do armazém
      await client.query(
        `UPDATE cad_armazem_produto SET arp_qtest = COALESCE(arp_qtest, 0) + $1
          WHERE arp_arm_id = $2 AND arp_codprod = $3`,
        [quantidade, arm_id, cod_produto]);

      // 4. Localização física
      if (localizacao && localizacao.trim() !== '') {
        const locTrimmed = localizacao.trim();
        const existingLoc = await client.query(
          `SELECT apl_id FROM cad_armazem_produto_locacao WHERE apl_arm_id = $1 AND apl_codprod = $2 LIMIT 1`,
          [arm_id, cod_produto]);
        if (existingLoc.rows.length > 0) {
          await client.query(
            `UPDATE cad_armazem_produto_locacao SET apl_descricao = $1 WHERE apl_arm_id = $2 AND apl_codprod = $3`,
            [locTrimmed, arm_id, cod_produto]);
        } else {
          const nextIdResult = await client.query(
            `SELECT COALESCE(MAX(apl_id), 0) + 1 as next_id FROM cad_armazem_produto_locacao WHERE apl_arm_id = $1 AND apl_codprod = $2`,
            [arm_id, cod_produto]);
          await client.query(
            `INSERT INTO cad_armazem_produto_locacao (apl_arm_id, apl_codprod, apl_id, apl_descricao) VALUES ($1, $2, $3, $4)`,
            [arm_id, cod_produto, nextIdResult.rows[0].next_id, locTrimmed]);
        }
      }
    }

    await client.query('COMMIT');
    return res.status(200).json({ success: true, message: 'Alocacao finalizada com sucesso' });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Erro ao finalizar alocacao:', error);
    return res.status(500).json({ error: 'Erro ao finalizar alocacao' });
  } finally {
    if (client) client.release();
  }
}

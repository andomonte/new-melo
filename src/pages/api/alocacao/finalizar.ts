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
import { creditarSemReserva, liberarReserva, posicionarReserva } from '@/lib/compras/estoqueEntrada';

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

    // Quantidade de cada produto: a recebida, limitada à da nota. O excesso não entra no
    // estoque (como no Delphi, vale a nota) e a falta segue reservada até resolver a devolução.
    const itensResult = await client.query(
      `SELECT ie.codprod,
              SUM(ie.quant) AS qtd_nota,
              SUM(COALESCE(eir.qtd_recebida, ie.quant)) AS qtd_recebida,
              COALESCE((SELECT SUM(da.qtd) FROM dbitent_armazem da
                         WHERE da.codent = ie.codent AND da.codprod = ie.codprod), 0) AS qtd_alocada
         FROM dbitent ie
         LEFT JOIN entrada_itens_recebimento eir
           ON eir.codent = ie.codent AND eir.produto_cod = ie.codprod
          AND COALESCE(eir.codreq,'') = COALESCE(ie.codreq,'')
        WHERE ie.codent = $1
        GROUP BY ie.codent, ie.codprod`,
      [entradaId]);

    const naoConfirmado = itensResult.rows.find(
      (i: any) => Number(i.qtd_recebida) > 0 && Number(i.qtd_alocada) !== Number(i.qtd_recebida));
    if (naoConfirmado) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Confirme a alocacao do produto ${naoConfirmado.codprod}: recebido ${Number(naoConfirmado.qtd_recebida)}, alocado ${Number(naoConfirmado.qtd_alocada)}`,
      });
    }

    const saldoProduto = new Map<string, number>(
      itensResult.rows.map((i: any) => [
        i.codprod,
        Math.min(Number(i.qtd_nota), Number(i.qtd_recebida)),
      ]));

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

    // Confirma o romaneio nos armazéns (dbitent_armazem). O estoque já entrou na geração.
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
      const { cod_produto, qtd, localizacao } = aloc;
      const arm_id = Number(aloc.arm_id);
      const saldo = saldoProduto.get(cod_produto) ?? 0;
      const quantidade = Math.min(parseFloat(qtd), saldo);
      saldoProduto.set(cod_produto, saldo - quantidade);

      if (quantidade > 0) {
        // 1. Libera reserva no produto geral
        const produtoResult = await client.query(
          `SELECT COALESCE(qtdreservada, 0) AS reservada FROM dbprod WHERE codprod = $1 FOR UPDATE`,
          [cod_produto]);
        const reservadaProduto = parseFloat(produtoResult.rows[0]?.reservada ?? 0);
        await client.query(
          `UPDATE dbprod SET qtdreservada = GREATEST(COALESCE(qtdreservada, 0) - $1, 0) WHERE codprod = $2`,
          [quantidade, cod_produto]);

        // 2. Leva a reserva ao armazém escolhido e libera (o total não muda)
        const semReserva = await posicionarReserva(client, cod_produto, arm_id, quantidade);
        await liberarReserva(client, cod_produto, arm_id, quantidade - semReserva);

        // 3. Reservada só no produto: entrada gerada antes deste modelo, com qtest somado
        //    e nada no armazém. Sem reserva também no produto, não há o que acertar.
        const faltaNoArmazem = Math.min(semReserva, reservadaProduto);
        if (faltaNoArmazem > 0) {
          await creditarSemReserva(client, cod_produto, arm_id, faltaNoArmazem);
        }
      }

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

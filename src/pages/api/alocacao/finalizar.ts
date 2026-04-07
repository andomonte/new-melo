/**
 * Endpoint para finalizar alocacao de uma entrada
 * PUT /api/entrada/alocacao/finalizar
 *
 * Body:
 * - entradaId: ID da entrada
 * - matricula: matricula do operador
 * - observacao: observacao geral opcional
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';

interface FinalizarRequest {
  entradaId: number;
  matricula: string;
  observacao?: string;
}

interface FinalizarResponse {
  success: boolean;
  message: string;
}

// Verificar se operador esta ativo na alocacao
const CHECK_OPERADOR_QUERY = `
  SELECT id
  FROM entrada_operacoes
  WHERE entrada_id = $1
    AND alocador_matricula = $2
    AND status = 'EM_ALOCACAO'
`;

// Finalizar operacao
const FINALIZAR_OPERACAO_QUERY = `
  UPDATE entrada_operacoes
  SET
    status = 'ALOCADO',
    fim_alocacao = NOW(),
    observacao = COALESCE($2, observacao),
    updated_at = NOW()
  WHERE entrada_id = $1
    AND status = 'EM_ALOCACAO'
  RETURNING id
`;

// Atualizar status da entrada para disponivel para venda
const ATUALIZAR_ENTRADA_QUERY = `
  UPDATE entradas_estoque
  SET
    status = 'DISPONIVEL_VENDA',
    est_alocado = 1,
    updated_at = NOW()
  WHERE id = $1
`;

// Buscar todas as alocações feitas para esta entrada (COM localização)
const GET_ALOCACOES_QUERY = `
  SELECT
    da.codprod as cod_produto,
    da.arm_id,
    da.qtd,
    da.localizacao,
    arm.arm_descricao
  FROM dbitent_armazem da
  LEFT JOIN cad_armazem arm ON arm.arm_id = da.arm_id
  WHERE da.codent = $1
  ORDER BY da.codprod, da.arm_id
`;

// Fallback: Buscar alocações SEM localização (se coluna não existir)
const GET_ALOCACOES_FALLBACK_QUERY = `
  SELECT
    da.codprod as cod_produto,
    da.arm_id,
    da.qtd,
    NULL as localizacao,
    arm.arm_descricao
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

  const body = req.body as FinalizarRequest;
  const { entradaId, matricula, observacao } = body;

  if (!entradaId || !matricula) {
    return res.status(400).json({
      error: 'entradaId e matricula sao obrigatorios',
    });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS';

  const pool = getPgPool(filial);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    // Verificar se operador esta ativo na alocacao
    const checkResult = await client.query(CHECK_OPERADOR_QUERY, [entradaId, matricula]);
    if (checkResult.rows.length === 0) {
      return res.status(403).json({
        error: 'Voce nao esta autorizado a finalizar esta alocacao',
      });
    }

    // Iniciar transacao
    await client.query('BEGIN');

    // Finalizar operacao
    const finalizarResult = await client.query(FINALIZAR_OPERACAO_QUERY, [
      entradaId,
      observacao || null,
    ]);

    if (finalizarResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Nao foi possivel finalizar a alocacao',
      });
    }

    // Atualizar status da entrada
    await client.query(ATUALIZAR_ENTRADA_QUERY, [entradaId]);

    // Buscar numero_entrada para usar na query de alocações
    const entradaResult = await client.query(
      `SELECT numero_entrada FROM entradas_estoque WHERE id = $1`,
      [entradaId]
    );
    const numeroEntrada = entradaResult.rows[0]?.numero_entrada;

    if (!numeroEntrada) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Entrada nao encontrada',
      });
    }

    // === ATUALIZAR ESTOQUE NOS ARMAZÉNS ===
    // Buscar todas as alocações feitas pelo peão (usando numero_entrada)
    let alocacoesResult;
    try {
      alocacoesResult = await client.query(GET_ALOCACOES_QUERY, [numeroEntrada]);
    } catch (err: any) {
      // Se coluna localizacao não existe, usar fallback
      if (err.code === '42703') { // undefined_column
        console.log('Coluna localizacao não existe, usando fallback');
        alocacoesResult = await client.query(GET_ALOCACOES_FALLBACK_QUERY, [numeroEntrada]);
      } else {
        throw err;
      }
    }

    console.log(`Atualizando estoque para ${alocacoesResult.rows.length} alocações`);

    for (const aloc of alocacoesResult.rows) {
      const { cod_produto, arm_id, qtd, arm_descricao, localizacao } = aloc;
      const quantidade = parseFloat(qtd);

      console.log(`Processando: ${cod_produto} | Armazém ${arm_id} (${arm_descricao}) | Qtd ${quantidade} | Loc: ${localizacao || 'N/A'}`);

      // 1. Liberar quantidade reservada no produto geral
      await client.query(`
        UPDATE dbprod
        SET qtdreservada = GREATEST(COALESCE(qtdreservada, 0) - $1, 0)
        WHERE codprod = $2
      `, [quantidade, cod_produto]);

      // 2. Garantir que existe registro no cad_armazem_produto
      await client.query(`
        INSERT INTO cad_armazem_produto (arp_arm_id, arp_codprod, arp_qtest, arp_qtest_reservada, arp_bloqueado)
        VALUES ($1, $2, 0, 0, 'N')
        ON CONFLICT (arp_arm_id, arp_codprod) DO NOTHING
      `, [arm_id, cod_produto]);

      // 3. Incrementar estoque do armazém (arp_qtest)
      await client.query(`
        UPDATE cad_armazem_produto
        SET arp_qtest = COALESCE(arp_qtest, 0) + $1
        WHERE arp_arm_id = $2 AND arp_codprod = $3
      `, [quantidade, arm_id, cod_produto]);

      console.log(`Estoque atualizado: ${cod_produto} +${quantidade} no armazém ${arm_id}`);

      // 4. Salvar/atualizar localização física em cad_armazem_produto_locacao
      if (localizacao && localizacao.trim() !== '') {
        const locTrimmed = localizacao.trim();

        // Verificar se já existe localização para este produto neste armazém
        const existingLoc = await client.query(`
          SELECT apl_id FROM cad_armazem_produto_locacao
          WHERE apl_arm_id = $1 AND apl_codprod = $2
          LIMIT 1
        `, [arm_id, cod_produto]);

        if (existingLoc.rows.length > 0) {
          // Atualizar localização existente
          await client.query(`
            UPDATE cad_armazem_produto_locacao
            SET apl_descricao = $1
            WHERE apl_arm_id = $2 AND apl_codprod = $3
          `, [locTrimmed, arm_id, cod_produto]);

          console.log(`Localização atualizada: ${cod_produto} no armazém ${arm_id} -> ${locTrimmed}`);
        } else {
          // Criar nova localização - gerar próximo apl_id
          const nextIdResult = await client.query(`
            SELECT COALESCE(MAX(apl_id), 0) + 1 as next_id
            FROM cad_armazem_produto_locacao
            WHERE apl_arm_id = $1 AND apl_codprod = $2
          `, [arm_id, cod_produto]);

          const nextId = nextIdResult.rows[0].next_id;

          await client.query(`
            INSERT INTO cad_armazem_produto_locacao (apl_arm_id, apl_codprod, apl_id, apl_descricao)
            VALUES ($1, $2, $3, $4)
          `, [arm_id, cod_produto, nextId, locTrimmed]);

          console.log(`Localização criada: ${cod_produto} no armazém ${arm_id} -> ${locTrimmed} (id: ${nextId})`);
        }
      }
    }

    await client.query('COMMIT');

    console.log('Alocacao finalizada:', {
      entradaId,
      matricula,
      filial,
    });

    return res.status(200).json({
      success: true,
      message: 'Alocacao finalizada com sucesso',
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Erro ao finalizar alocacao:', error);

    return res.status(500).json({
      error: 'Erro ao finalizar alocacao',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

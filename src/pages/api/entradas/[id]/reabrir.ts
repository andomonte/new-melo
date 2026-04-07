import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { id } = req.query;
  const { observacao } = req.body;

  let client;

  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();

    // Iniciar transação
    await client.query('BEGIN');
    await client.query('SET search_path TO db_manaus');

    console.log('Reabrindo entrada:', id);

    // Primeiro verificar o status atual da entrada
    const checkResult = await client.query(`
      SELECT
        id,
        numero_entrada,
        status,
        nfe_id
      FROM entradas_estoque
      WHERE id = $1
    `, [id]);

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Entrada não encontrada'
      });
    }

    const entrada = checkResult.rows[0];

    // Verificar se pode ser reaberta
    if (entrada.status === 'CANCELADA') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Entrada cancelada não pode ser reaberta'
      });
    }

    // Atualizar status da entrada para PENDENTE
    await client.query(`
      UPDATE entradas_estoque
      SET
        status = 'PENDENTE',
        updated_at = NOW(),
        observacoes = COALESCE(observacoes, '') || E'\n[REABERTA] ' || $2
      WHERE id = $1
    `, [id, observacao || '']);

    // Se havia confirmação de preço, limpar datas
    if (entrada.status === 'PRECO_CONFIRMADO' || entrada.status === 'DISPONIVEL_VENDA') {
      await client.query(`
        UPDATE entradas_estoque
        SET
          data_confirmacao_preco = NULL,
          observacao_preco = NULL
        WHERE id = $1
      `, [id]);
    }

    // Se havia confirmação de estoque, reverter
    if (entrada.status === 'DISPONIVEL_VENDA') {
      // Buscar romaneio para reverter corretamente por armazém
      const romaneioResult = await client.query(`
        SELECT da.codprod, da.arm_id, da.qtd
        FROM dbitent_armazem da
        WHERE da.codent = $1
      `, [entrada.numero_entrada]);

      // VALIDAR: verificar se há estoque disponível antes de reverter
      const produtosInsuficientes: string[] = [];

      for (const rom of romaneioResult.rows) {
        // Verificar estoque no armazém específico
        const estoqueArmResult = await client.query(`
          SELECT
            arp_qtest
          FROM cad_armazem_produto
          WHERE arp_arm_id = $1 AND arp_codprod = $2
        `, [rom.arm_id, rom.codprod]);

        if (estoqueArmResult.rows.length > 0) {
          const qtstArmazem = parseFloat(estoqueArmResult.rows[0].arp_qtest || 0);
          const qtdNecessaria = parseFloat(rom.qtd);

          if (qtstArmazem < qtdNecessaria) {
            produtosInsuficientes.push(
              `${rom.codprod} no armazém ${rom.arm_id}: disponível ${qtstArmazem}, necessário ${qtdNecessaria}`
            );
          }
        }
      }

      // Se há produtos sem estoque suficiente, bloquear reabertura
      if (produtosInsuficientes.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'Não é possível reabrir esta entrada. Estoque insuficiente para reverter a operação.',
          detalhes: produtosInsuficientes
        });
      }

      // Reverter estoque por armazém (baseado no romaneio)
      for (const rom of romaneioResult.rows) {
        const qtd = parseFloat(rom.qtd);

        // 1. Aumentar qtdreservada de volta (bloquear para venda)
        // NOTA: qtest NÃO é alterado pois não foi alterado no confirmar-estoque
        await client.query(`
          UPDATE dbprod
          SET qtdreservada = COALESCE(qtdreservada, 0) + $2
          WHERE codprod = $1
        `, [rom.codprod, qtd]);

        // 2. Diminuir estoque do armazém específico
        await client.query(`
          UPDATE cad_armazem_produto
          SET arp_qtest = GREATEST(COALESCE(arp_qtest, 0) - $3, 0)
          WHERE arp_arm_id = $1 AND arp_codprod = $2
        `, [rom.arm_id, rom.codprod, qtd]);

        console.log(`🔄 Revertido: ${rom.codprod} no armazém ${rom.arm_id} (-${qtd})`);
      }

      // 3. Deletar o romaneio (para permitir refazer)
      await client.query(`
        DELETE FROM dbitent_armazem
        WHERE codent = $1
      `, [entrada.numero_entrada]);

      // 4. Resetar flag de estoque alocado
      await client.query(`
        UPDATE entradas_estoque
        SET est_alocado = 0
        WHERE id = $1
      `, [id]);

      // Limpar data de confirmação de estoque
      await client.query(`
        UPDATE entradas_estoque
        SET
          data_confirmacao_estoque = NULL,
          observacao_estoque = NULL
        WHERE id = $1
      `, [id]);
    }

    // Se tinha NFe associada, reverter o status da NFe
    if (entrada.nfe_id) {
      // Reverter status da NFe para não processada
      await client.query(`
        UPDATE dbnfe_ent
        SET exec = 'N'
        WHERE codnfe_ent = $1
      `, [entrada.nfe_id]);
    }

    // Registrar log da operação
    await client.query(`
      INSERT INTO entrada_operacoes_log (
        entrada_id,
        operacao,
        status_anterior,
        status_novo,
        observacao,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
    `, [
      id,
      'REABRIR',
      entrada.status,
      'PENDENTE',
      observacao || 'Entrada reaberta'
    ]);

    await client.query('COMMIT');

    console.log('Entrada reaberta com sucesso:', id);

    return res.status(200).json({
      success: true,
      message: `Entrada ${entrada.numero_entrada} reaberta com sucesso!`,
      data: {
        entradaId: id,
        numeroEntrada: entrada.numero_entrada,
        novoStatus: 'PENDENTE'
      }
    });

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Erro ao reabrir entrada:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao reabrir entrada: ' + (error instanceof Error ? error.message : 'Erro desconhecido')
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
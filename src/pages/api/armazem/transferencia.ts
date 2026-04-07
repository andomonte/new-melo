import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';

/**
 * API para transferência de produtos entre armazéns
 *
 * IMPORTANTE: A quantidade disponível para transferência é sempre:
 * qtest_disponivel = arp_qtest - arp_qtest_reservada
 *
 * A qtd_reservada é usada para reservar estoque durante o processo de venda.
 * Não podemos transferir estoque que está reservado para vendas em andamento.
 *
 * POST /api/armazem/transferencia
 * Body: {
 *   armIdOrigem: number,        // ID do armazém de origem
 *   armIdDestino: number,       // ID do armazém de destino
 *   itens: Array<{
 *     codprod: string,          // Código do produto
 *     quantidade: number        // Quantidade a transferir
 *   }>,
 *   obs?: string                // Observação opcional
 * }
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;
  const codusr = cookies.codusr_melo || 'SYS';

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  const { armIdOrigem, armIdDestino, itens, obs } = req.body;

  // Validações básicas
  if (!armIdOrigem || !armIdDestino) {
    return res.status(400).json({
      error: 'Armazéns de origem e destino são obrigatórios'
    });
  }

  if (armIdOrigem === armIdDestino) {
    return res.status(400).json({
      error: 'Armazém de origem e destino devem ser diferentes'
    });
  }

  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({
      error: 'Selecione pelo menos um produto para transferir'
    });
  }

  // Valida cada item
  for (const item of itens) {
    if (!item.codprod) {
      return res.status(400).json({
        error: 'Código do produto é obrigatório'
      });
    }
    if (!item.quantidade || item.quantidade <= 0) {
      return res.status(400).json({
        error: `Quantidade inválida para o produto ${item.codprod}`
      });
    }
  }

  const pool = getPgPool(filial);
  let client: PoolClient | undefined;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // 1. Verifica se os armazéns existem
    const armazensResult = await client.query(`
      SELECT arm_id, arm_descricao
      FROM cad_armazem
      WHERE arm_id IN ($1, $2)
    `, [armIdOrigem, armIdDestino]);

    if (armazensResult.rowCount !== 2) {
      throw new Error('Um ou mais armazéns não foram encontrados');
    }

    const armazemOrigem = armazensResult.rows.find(a => a.arm_id === armIdOrigem);
    const armazemDestino = armazensResult.rows.find(a => a.arm_id === armIdDestino);

    // 2. Verifica estoque DISPONÍVEL para cada produto na origem
    // Usa SELECT FOR UPDATE para bloquear os registros durante a transação
    // Isso evita race conditions com vendas sendo realizadas simultaneamente
    const errosEstoque: string[] = [];
    const itensValidados: Array<{
      codprod: string;
      quantidade: number;
      estoqueTotal: number;
      estoqueReservado: number;
      estoqueDisponivel: number;
    }> = [];

    for (const item of itens) {
      const estoqueResult = await client.query(`
        SELECT
          COALESCE(arp_qtest, 0) as estoque_total,
          COALESCE(arp_qtest_reservada, 0) as estoque_reservado
        FROM cad_armazem_produto
        WHERE arp_arm_id = $1 AND arp_codprod = $2
        FOR UPDATE
      `, [armIdOrigem, item.codprod]);

      if (estoqueResult.rowCount === 0) {
        errosEstoque.push(
          `Produto ${item.codprod}: não possui registro no armazém "${armazemOrigem?.arm_descricao || armIdOrigem}"`
        );
        continue;
      }

      const estoqueTotal = Number(estoqueResult.rows[0].estoque_total);
      const estoqueReservado = Number(estoqueResult.rows[0].estoque_reservado);
      const estoqueDisponivel = estoqueTotal - estoqueReservado;

      if (estoqueDisponivel <= 0) {
        errosEstoque.push(
          `Produto ${item.codprod}: sem estoque disponível ` +
          `(Total: ${estoqueTotal}, Reservado: ${estoqueReservado}, Disponível: 0)`
        );
        continue;
      }

      if (item.quantidade > estoqueDisponivel) {
        errosEstoque.push(
          `Produto ${item.codprod}: quantidade solicitada (${item.quantidade}) ` +
          `excede o disponível (${estoqueDisponivel}). ` +
          `[Total: ${estoqueTotal}, Reservado para vendas: ${estoqueReservado}]`
        );
        continue;
      }

      // Item validado com sucesso
      itensValidados.push({
        codprod: item.codprod,
        quantidade: item.quantidade,
        estoqueTotal,
        estoqueReservado,
        estoqueDisponivel,
      });
    }

    if (errosEstoque.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Erro de validação de estoque',
        message: errosEstoque.join('\n'),
        detalhes: errosEstoque,
      });
    }

    if (itensValidados.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Nenhum item válido para transferência'
      });
    }

    // 3. Gera o próximo ID da transferência
    const nextIdResult = await client.query(`
      SELECT COALESCE(MAX(tra_id), 0) + 1 as next_id FROM arm_transferencia
    `);
    const traId = nextIdResult.rows[0].next_id;

    // 4. Cria o registro de transferência
    await client.query(`
      INSERT INTO arm_transferencia (
        tra_id, tra_arm_id_origem, tra_arm_id_destino,
        tra_codusr_emissao, tra_data_emissao,
        tra_obs, tra_status, tra_cancel
      ) VALUES ($1, $2, $3, $4, NOW(), $5, 'P', 'N')
    `, [traId, armIdOrigem, armIdDestino, codusr, obs || null]);

    // 5. Para cada item validado, realiza a transferência
    for (const item of itensValidados) {
      // 5.1 Insere o item da transferência
      await client.query(`
        INSERT INTO arm_it_transferencia (itt_tra_id, itt_codprod, itt_qtd)
        VALUES ($1, $2, $3)
      `, [traId, item.codprod, item.quantidade]);

      // 5.2 Diminui do armazém de origem (apenas do qtest, não do reservado)
      // A quantidade reservada permanece intacta para as vendas em andamento
      await client.query(`
        UPDATE cad_armazem_produto
        SET arp_qtest = COALESCE(arp_qtest, 0) - $1
        WHERE arp_arm_id = $2 AND arp_codprod = $3
      `, [item.quantidade, armIdOrigem, item.codprod]);

      // 5.3 Verifica se existe registro no destino
      const destinoResult = await client.query(`
        SELECT 1 FROM cad_armazem_produto
        WHERE arp_arm_id = $1 AND arp_codprod = $2
        FOR UPDATE
      `, [armIdDestino, item.codprod]);

      if (destinoResult.rowCount === 0) {
        // Cria registro no destino (sem reserva, pois é estoque novo)
        await client.query(`
          INSERT INTO cad_armazem_produto (
            arp_arm_id, arp_codprod, arp_qtest, arp_qtest_reservada, arp_bloqueado
          ) VALUES ($1, $2, $3, 0, 'N')
        `, [armIdDestino, item.codprod, item.quantidade]);
      } else {
        // Atualiza estoque no destino
        await client.query(`
          UPDATE cad_armazem_produto
          SET arp_qtest = COALESCE(arp_qtest, 0) + $1
          WHERE arp_arm_id = $2 AND arp_codprod = $3
        `, [item.quantidade, armIdDestino, item.codprod]);
      }
    }

    // 6. Atualiza status da transferência para finalizada
    await client.query(`
      UPDATE arm_transferencia
      SET tra_status = 'F', tra_data = NOW(), tra_codusr = $1
      WHERE tra_id = $2
    `, [codusr, traId]);

    await client.query('COMMIT');

    const totalQuantidade = itensValidados.reduce((acc, item) => acc + item.quantidade, 0);

    return res.status(200).json({
      success: true,
      message: `Transferência #${traId} realizada com sucesso. ` +
        `${itensValidados.length} produto(s), ${totalQuantidade} unidade(s) transferida(s) ` +
        `de "${armazemOrigem?.arm_descricao}" para "${armazemDestino?.arm_descricao}".`,
      transferencia: {
        id: traId,
        origem: {
          id: armIdOrigem,
          descricao: armazemOrigem?.arm_descricao,
        },
        destino: {
          id: armIdDestino,
          descricao: armazemDestino?.arm_descricao,
        },
        itens: itensValidados.length,
        totalQuantidade,
      },
    });

  } catch (error: any) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Erro ao realizar transferência:', error);
    return res.status(500).json({
      error: 'Erro ao realizar transferência',
      message: error.message,
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

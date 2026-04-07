import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

interface ConfirmarEstoqueRequest {
  observacao?: string;
}

interface ConfirmarEstoqueResponse {
  success: boolean;
  message: string;
}

/**
 * Confirmar Estoque - Libera a entrada para recebimento físico
 *
 * FLUXO CORRETO:
 * 1. PENDENTE (entrada criada)
 * 2. Romaneio (opcional) - planejamento de distribuição
 * 3. Confirmar Preço → PRECO_CONFIRMADO
 * 4. Confirmar Estoque → AGUARDANDO_RECEBIMENTO (esta API)
 * 5. Peão inicia recebimento → EM_RECEBIMENTO
 * 6. Peão finaliza recebimento → RECEBIDO
 * 7. Peão inicia alocação → EM_ALOCACAO
 * 8. Peão finaliza alocação → ALOCADO → DISPONIVEL_VENDA
 *
 * IMPORTANTE: Esta API NÃO atualiza estoque.
 * O estoque é atualizado quando o peão FINALIZA a alocação.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ConfirmarEstoqueResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { id } = req.query;
  const { observacao }: ConfirmarEstoqueRequest = req.body;

  if (!id) {
    return res.status(400).json({
      error: 'ID da entrada é obrigatório'
    });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || cookies.filial || 'MANAUS';

  let client;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    await client.query('BEGIN');

    // Verificar se entrada existe e está no status correto
    const entradaResult = await client.query(`
      SELECT id, numero_entrada, status
      FROM entradas_estoque
      WHERE id = $1
    `, [id]);

    if (entradaResult.rows.length === 0) {
      throw new Error('Entrada não encontrada');
    }

    const entrada = entradaResult.rows[0];

    if (entrada.status !== 'PRECO_CONFIRMADO') {
      throw new Error(`Não é possível liberar para recebimento. É necessário confirmar o preço primeiro. Status atual: ${entrada.status}`);
    }

    // Verificar se tem romaneio
    const romaneioResult = await client.query(`
      SELECT COUNT(*) as total
      FROM dbitent_armazem
      WHERE codent = $1
    `, [entrada.numero_entrada]);

    let temRomaneio = parseInt(romaneioResult.rows[0].total) > 0;

    // Se não tem romaneio, criar automaticamente com armazém padrão
    if (!temRomaneio) {
      const ARMAZEM_PADRAO = 1003;

      console.log(`Criando romaneio automático com armazém padrão ${ARMAZEM_PADRAO}`);

      // Buscar itens da entrada
      const itensResult = await client.query(`
        SELECT ei.produto_cod, ei.quantidade, ei.req_id
        FROM entrada_itens ei
        WHERE ei.entrada_id = $1
      `, [id]);

      for (const item of itensResult.rows) {
        const qtd = parseFloat(item.quantidade);

        await client.query(`
          INSERT INTO dbitent_armazem (codent, codprod, codreq, arm_id, qtd)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT DO NOTHING
        `, [entrada.numero_entrada, item.produto_cod, item.req_id, ARMAZEM_PADRAO, qtd]);
      }

      console.log(`Romaneio automático criado: ${itensResult.rows.length} itens → armazém ${ARMAZEM_PADRAO}`);
    }

    // Definir tipo de romaneio para mensagens
    const tipoRomaneio = parseInt(romaneioResult.rows[0].total) > 0 ? 'manual' : 'automático';

    // Atualizar status para AGUARDANDO_RECEBIMENTO (próximo passo é o peão receber)
    await client.query(`
      UPDATE entradas_estoque
      SET
        status = 'AGUARDANDO_RECEBIMENTO',
        data_confirmacao_estoque = CURRENT_TIMESTAMP,
        observacao_estoque = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [observacao || '', id]);

    // Log da operação
    await client.query(`
      INSERT INTO entrada_operacoes_log (
        entrada_id,
        operacao,
        status_anterior,
        status_novo,
        observacao,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    `, [
      id,
      'CONFIRMAR_ESTOQUE',
      'PRECO_CONFIRMADO',
      'AGUARDANDO_RECEBIMENTO',
      observacao || `Liberado para recebimento (romaneio ${tipoRomaneio})`
    ]);

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: tipoRomaneio === 'manual'
        ? `Entrada ${entrada.numero_entrada} liberada para recebimento. Romaneio planejado será exibido para o operador.`
        : `Entrada ${entrada.numero_entrada} liberada para recebimento. Romaneio automático criado (armazém padrão 1003).`
    });
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK');
    }

    console.error('Erro ao confirmar estoque:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Falha ao confirmar estoque.'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

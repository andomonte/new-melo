import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';

interface ReservarEstoqueRequest {
  codigo_produto: string;
  armazem_id: number;
  quantidade: number;
  tipo_reserva: 'VENDA' | 'ORDEM_COMPRA' | 'TRANSFERENCIA' | 'MANUTENCAO';
  documento_referencia?: string;
  observacao?: string;
  usuario?: string;
}

interface LiberarReservaRequest {
  codigo_produto: string;
  armazem_id: number;
  quantidade: number;
  documento_referencia?: string;
  motivo?: string;
  usuario?: string;
}

interface ReservaResponse {
  success: boolean;
  message: string;
  reserva: {
    codigo_produto: string;
    armazem_id: number;
    quantidade_reservada: number;
    estoque_disponivel_apos_reserva: number;
    data_reserva: string;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ReservaResponse | { error: string }>
) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.setHeader('Allow', ['POST', 'DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial || 'manaus';

  let client: PoolClient | null = null;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    if (req.method === 'POST') {
      return await processarReserva(req, res, client);
    } else if (req.method === 'DELETE') {
      return await liberarReserva(req, res, client);
    }

  } catch (error) {
    console.error('Erro no sistema de reservas:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Erro interno no sistema de reservas'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

async function processarReserva(
  req: NextApiRequest,
  res: NextApiResponse,
  client: PoolClient
): Promise<void> {
  const {
    codigo_produto,
    armazem_id,
    quantidade,
    tipo_reserva,
    documento_referencia = '',
    observacao = '',
    usuario = 'SISTEMA'
  }: ReservarEstoqueRequest = req.body;

  // Validações
  if (!codigo_produto || !armazem_id || !quantidade || !tipo_reserva) {
    return res.status(400).json({
      error: 'Campos obrigatórios: codigo_produto, armazem_id, quantidade, tipo_reserva'
    });
  }

  if (quantidade <= 0) {
    return res.status(400).json({
      error: 'Quantidade deve ser maior que zero'
    });
  }

  const tiposValidos = ['VENDA', 'ORDEM_COMPRA', 'TRANSFERENCIA', 'MANUTENCAO'];
  if (!tiposValidos.includes(tipo_reserva)) {
    return res.status(400).json({
      error: `Tipo de reserva deve ser um dos: ${tiposValidos.join(', ')}`
    });
  }

  try {
    await client.query('BEGIN');

    // 1. Verificar se produto existe
    const produtoResult = await client.query(`
      SELECT codprod, descr
      FROM dbprod
      WHERE codprod = $1
    `, [codigo_produto]);

    if (produtoResult.rows.length === 0) {
      throw new Error(`Produto ${codigo_produto} não encontrado`);
    }

    const produto = produtoResult.rows[0];

    // 2. Verificar se armazém existe
    const armazemResult = await client.query(`
      SELECT arm_id, arm_descricao
      FROM cad_armazem
      WHERE arm_id = $1
    `, [armazem_id]);

    if (armazemResult.rows.length === 0) {
      throw new Error(`Armazém ${armazem_id} não encontrado`);
    }

    const armazem = armazemResult.rows[0];

    // 3. Verificar estoque atual e disponível
    const estoqueResult = await client.query(`
      SELECT arp_qtest, arp_qtest_reservada, arp_bloqueado
      FROM cad_armazem_produto
      WHERE arp_arm_id = $1 AND arp_codprod = $2
    `, [armazem_id, codigo_produto]);

    if (estoqueResult.rows.length === 0) {
      throw new Error(`Produto ${codigo_produto} não possui estoque no armazém ${armazem.arm_descricao}`);
    }

    const estoque = estoqueResult.rows[0];
    const estoqueDisponivel = estoque.arp_qtest - (estoque.arp_qtest_reservada || 0);

    if (estoque.arp_bloqueado === 'S') {
      throw new Error(`Produto ${codigo_produto} está bloqueado no armazém ${armazem.arm_descricao}`);
    }

    if (estoqueDisponivel < quantidade) {
      throw new Error(`Estoque insuficiente para reserva. Disponível: ${estoqueDisponivel}, Solicitado: ${quantidade}`);
    }

    // 4. Atualizar quantidade reservada
    await client.query(`
      UPDATE cad_armazem_produto
      SET arp_qtest_reservada = COALESCE(arp_qtest_reservada, 0) + $1
      WHERE arp_arm_id = $2 AND arp_codprod = $3
    `, [quantidade, armazem_id, codigo_produto]);

    // 5. Atualizar estoque geral reservado
    await client.query(`
      UPDATE dbprod
      SET qtdreservada = COALESCE(qtdreservada, 0) + $1
      WHERE codprod = $2
    `, [quantidade, codigo_produto]);

    // 6. Registrar movimentação no log
    const dataAtual = new Date().toISOString().split('T')[0];
    const horaAtual = new Date().toTimeString().split(' ')[0];

    await client.query(`
      INSERT INTO dbestoque_movimento (
        codprod, arm_id, deposito, quantidade, tipo_movimento,
        data_registro, hora_registro, usuario, documento, tipo_documento
      ) VALUES (
        $1, $2, 'RESV', $3, 'RS',
        $4, $5, $6, $7, $8
      )
    `, [codigo_produto, armazem_id, quantidade, dataAtual, horaAtual, usuario.substring(0, 40), documento_referencia.substring(0, 40), tipo_reserva.substring(0, 2)]);

    const estoqueDisponivelAposReserva = estoqueDisponivel - quantidade;

    await client.query('COMMIT');

    console.log(`🔒 Reserva criada: ${quantidade} x ${produto.descr} no ${armazem.arm_descricao}`);
    console.log(`   Tipo: ${tipo_reserva}, Documento: ${documento_referencia}`);

    res.status(200).json({
      success: true,
      message: `Reserva realizada com sucesso. ${quantidade} unidades de ${produto.descr} reservadas no ${armazem.arm_descricao}`,
      reserva: {
        codigo_produto,
        armazem_id,
        quantidade_reservada: quantidade,
        estoque_disponivel_apos_reserva: estoqueDisponivelAposReserva,
        data_reserva: dataAtual
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function liberarReserva(
  req: NextApiRequest,
  res: NextApiResponse,
  client: PoolClient
): Promise<void> {
  const {
    codigo_produto,
    armazem_id,
    quantidade,
    documento_referencia = '',
    motivo = 'LIBERACAO_MANUAL',
    usuario = 'SISTEMA'
  }: LiberarReservaRequest = req.body;

  // Validações
  if (!codigo_produto || !armazem_id || !quantidade) {
    return res.status(400).json({
      error: 'Campos obrigatórios: codigo_produto, armazem_id, quantidade'
    });
  }

  if (quantidade <= 0) {
    return res.status(400).json({
      error: 'Quantidade deve ser maior que zero'
    });
  }

  try {
    await client.query('BEGIN');

    // 1. Verificar reserva atual
    const estoqueResult = await client.query(`
      SELECT arp_qtest, arp_qtest_reservada
      FROM cad_armazem_produto
      WHERE arp_arm_id = $1 AND arp_codprod = $2
    `, [armazem_id, codigo_produto]);

    if (estoqueResult.rows.length === 0) {
      throw new Error(`Produto ${codigo_produto} não encontrado no armazém ${armazem_id}`);
    }

    const estoque = estoqueResult.rows[0];
    const quantidadeReservada = estoque.arp_qtest_reservada || 0;

    if (quantidadeReservada < quantidade) {
      throw new Error(`Quantidade reservada insuficiente. Reservado: ${quantidadeReservada}, Liberação solicitada: ${quantidade}`);
    }

    // 2. Liberar reserva do armazém
    await client.query(`
      UPDATE cad_armazem_produto
      SET arp_qtest_reservada = arp_qtest_reservada - $1
      WHERE arp_arm_id = $2 AND arp_codprod = $3
    `, [quantidade, armazem_id, codigo_produto]);

    // 3. Liberar reserva do estoque geral
    await client.query(`
      UPDATE dbprod
      SET qtdreservada = GREATEST(COALESCE(qtdreservada, 0) - $1, 0)
      WHERE codprod = $2
    `, [quantidade, codigo_produto]);

    // 4. Registrar movimentação no log
    const dataAtual = new Date().toISOString().split('T')[0];
    const horaAtual = new Date().toTimeString().split(' ')[0];

    await client.query(`
      INSERT INTO dbestoque_movimento (
        codprod, arm_id, deposito, quantidade, tipo_movimento,
        data_registro, hora_registro, usuario, documento, tipo_documento
      ) VALUES (
        $1, $2, 'LIBR', $3, 'LB',
        $4, $5, $6, $7, $8
      )
    `, [codigo_produto, armazem_id, quantidade, dataAtual, horaAtual, usuario.substring(0, 40), documento_referencia.substring(0, 40), motivo.substring(0, 2)]);

    const estoqueDisponivelAposLiberacao = estoque.arp_qtest - (quantidadeReservada - quantidade);

    await client.query('COMMIT');

    console.log(`🔓 Reserva liberada: ${quantidade} x ${codigo_produto} no armazém ${armazem_id}`);
    console.log(`   Motivo: ${motivo}, Documento: ${documento_referencia}`);

    res.status(200).json({
      success: true,
      message: `Reserva liberada com sucesso. ${quantidade} unidades de ${codigo_produto} liberadas`,
      reserva: {
        codigo_produto,
        armazem_id,
        quantidade_reservada: -quantidade, // Negativo para indicar liberação
        estoque_disponivel_apos_reserva: estoqueDisponivelAposLiberacao,
        data_reserva: dataAtual
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
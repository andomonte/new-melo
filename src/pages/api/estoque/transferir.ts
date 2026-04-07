import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';

interface TransferirEstoqueRequest {
  codigo_produto: string;
  armazem_origem: number;
  armazem_destino: number;
  quantidade: number;
  observacao?: string;
  usuario?: string;
}

interface TransferirEstoqueResponse {
  success: boolean;
  message: string;
  transferencia: {
    id_transferencia: string;
    codigo_produto: string;
    armazem_origem: number;
    armazem_destino: number;
    quantidade: number;
    data_transferencia: string;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TransferirEstoqueResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const {
    codigo_produto,
    armazem_origem,
    armazem_destino,
    quantidade,
    observacao = '',
    usuario = 'SISTEMA'
  }: TransferirEstoqueRequest = req.body;

  // Validações básicas
  if (!codigo_produto || !armazem_origem || !armazem_destino || !quantidade) {
    return res.status(400).json({
      error: 'Campos obrigatórios: codigo_produto, armazem_origem, armazem_destino, quantidade'
    });
  }

  if (quantidade <= 0) {
    return res.status(400).json({
      error: 'Quantidade deve ser maior que zero'
    });
  }

  if (armazem_origem === armazem_destino) {
    return res.status(400).json({
      error: 'Armazém de origem deve ser diferente do armazém de destino'
    });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial || 'manaus';

  let client: PoolClient | null = null;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Iniciar transação
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

    // 2. Verificar se armazéns existem
    const armazensResult = await client.query(`
      SELECT arm_id, arm_descricao
      FROM cad_armazem
      WHERE arm_id IN ($1, $2)
    `, [armazem_origem, armazem_destino]);

    if (armazensResult.rows.length !== 2) {
      throw new Error('Um ou ambos os armazéns não foram encontrados');
    }

    const armazemOrigemInfo = armazensResult.rows.find(a => a.arm_id === armazem_origem);
    const armazemDestinoInfo = armazensResult.rows.find(a => a.arm_id === armazem_destino);

    // 3. Verificar estoque disponível no armazém de origem
    const estoqueOrigemResult = await client.query(`
      SELECT arp_qtest, arp_qtest_reservada, arp_bloqueado
      FROM cad_armazem_produto
      WHERE arp_arm_id = $1 AND arp_codprod = $2
    `, [armazem_origem, codigo_produto]);

    if (estoqueOrigemResult.rows.length === 0) {
      throw new Error(`Produto ${codigo_produto} não possui estoque no armazém ${armazemOrigemInfo?.arm_descricao}`);
    }

    const estoqueOrigem = estoqueOrigemResult.rows[0];
    const estoqueDisponivel = estoqueOrigem.arp_qtest - (estoqueOrigem.arp_qtest_reservada || 0);

    if (estoqueOrigem.arp_bloqueado === 'S') {
      throw new Error(`Produto ${codigo_produto} está bloqueado no armazém ${armazemOrigemInfo?.arm_descricao}`);
    }

    if (estoqueDisponivel < quantidade) {
      throw new Error(`Estoque insuficiente. Disponível: ${estoqueDisponivel}, Solicitado: ${quantidade}`);
    }

    // 4. Gerar ID único para a transferência
    const timestamp = Date.now();
    const idTransferencia = `TRF${timestamp.toString().slice(-8)}`;

    console.log(`🔄 Iniciando transferência ${idTransferencia}: ${quantidade} x ${produto.descr}`);
    console.log(`   De: ${armazemOrigemInfo?.arm_descricao} → Para: ${armazemDestinoInfo?.arm_descricao}`);

    // 5. Reduzir estoque do armazém de origem
    await client.query(`
      UPDATE cad_armazem_produto
      SET arp_qtest = arp_qtest - $1
      WHERE arp_arm_id = $2 AND arp_codprod = $3
    `, [quantidade, armazem_origem, codigo_produto]);

    // 6. Aumentar estoque do armazém de destino (UPSERT)
    await client.query(`
      INSERT INTO cad_armazem_produto (arp_arm_id, arp_codprod, arp_qtest, arp_qtest_reservada, arp_bloqueado)
      VALUES ($1, $2, $3, 0, 'N')
      ON CONFLICT (arp_arm_id, arp_codprod)
      DO UPDATE SET
        arp_qtest = cad_armazem_produto.arp_qtest + $3
    `, [armazem_destino, codigo_produto, quantidade]);

    // 7. Registrar movimentações no log
    const dataAtual = new Date().toISOString().split('T')[0];
    const horaAtual = new Date().toTimeString().split(' ')[0];

    // Saída do armazém origem (usando ON CONFLICT para contornar limitação da PK)
    await client.query(`
      INSERT INTO dbestoque_movimento (
        codprod, arm_id, deposito, quantidade, tipo_movimento,
        data_registro, hora_registro, usuario, documento, tipo_documento
      ) VALUES (
        $1, $2, 'TRAN', $3, 'SA',
        $4, $5, $6, $7, 'TR'
      )
      ON CONFLICT (codprod)
      DO UPDATE SET
        arm_id = $2,
        deposito = 'TRAN',
        quantidade = dbestoque_movimento.quantidade + $3,
        tipo_movimento = 'SA',
        data_registro = $4,
        hora_registro = $5,
        usuario = $6,
        documento = $7,
        tipo_documento = 'TR'
    `, [codigo_produto, armazem_origem, quantidade, dataAtual, horaAtual, usuario.substring(0, 40), idTransferencia.substring(0, 40)]);

    // Log da transferência no console (como a tabela tem limitação de PK, logamos aqui)
    console.log(`📤 Saída registrada: ${quantidade} x ${codigo_produto} do armazém ${armazemOrigemInfo?.arm_descricao}`);

    // 8. Registrar a transferência (se houver tabela específica)
    // Nota: Assumindo que pode existir uma tabela de transferências no futuro

    // Commit da transação
    await client.query('COMMIT');

    console.log(`✅ Transferência ${idTransferencia} concluída com sucesso`);

    res.status(200).json({
      success: true,
      message: `Transferência realizada com sucesso. ${quantidade} unidades de ${produto.descr} transferidas de ${armazemOrigemInfo?.arm_descricao} para ${armazemDestinoInfo?.arm_descricao}`,
      transferencia: {
        id_transferencia: idTransferencia,
        codigo_produto: codigo_produto,
        armazem_origem: armazem_origem,
        armazem_destino: armazem_destino,
        quantidade: quantidade,
        data_transferencia: dataAtual
      }
    });

  } catch (error) {
    // Rollback da transação em caso de erro
    if (client) {
      await client.query('ROLLBACK');
    }

    console.error('Erro na transferência de estoque:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Erro interno na transferência de estoque'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
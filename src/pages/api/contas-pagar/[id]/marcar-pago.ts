import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { marcarTituloPagoOracle, calcularJurosTitulo } from '@/lib/oracleService';
import { parseCookies } from 'nookies';

const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ erro: 'Método não permitido. Use PUT.' });
  }

  try {
    const { id } = req.query;
    const { 
      dt_pgto, 
      valor_pago, 
      obs, 
      banco, 
      forma_pgto, // cod_fpgto - Código da forma de pagamento
      comprovante,
      cod_ccusto,
      valor_juros,
      desconto,
      multa,
      cod_conta,
      nro_cheque, // Número do cheque (se forma_pgto = cheque)
      tp_pgto, // Tipo de pagamento: 'C' = Cheque, 'D' = Dinheiro, 'T' = Transferência, etc
      username // Username pode ser passado no body ou será obtido do cookie
    } = req.body;

    // Capturar username (prioriza o enviado no body, depois cookie, depois padrão)
    const cookies = parseCookies({ req });
    const userName = username || cookies.userName || 'Sistema';

    if (!id) {
      return res.status(400).json({ erro: 'ID da conta a pagar é obrigatório.' });
    }

    // Verificar se a conta existe e está pendente no PostgreSQL
    const checkQuery = `
      SELECT paga, cancel, dt_venc, valor_pgto, tipo, obs
      FROM dbpgto 
      WHERE cod_pgto = $1
    `;
    const checkResult = await pool.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ erro: 'Conta a pagar não encontrada.' });
    }

    const conta = checkResult.rows[0];

    if (conta.cancel === 'S') {
      return res.status(400).json({ erro: 'Não é possível marcar como paga uma conta cancelada.' });
    }

    // REMOVIDO: Não bloquear se já está paga, pois pode ser pagamento parcial adicional
    // Verificar se já está totalmente paga pelo histórico
    const historicoQuery = `
      SELECT COALESCE(SUM(valor_pgto), 0) as total_pago
      FROM db_manaus.dbfpgto
      WHERE cod_pgto = $1
        AND (cancel IS NULL OR cancel != 'S')
    `;
    const historicoResult = await pool.query(historicoQuery, [id]);
    const totalJaPago = parseFloat(historicoResult.rows[0].total_pago || '0');
    const valorOriginal = parseFloat(conta.valor_pgto);
    
    // Verificar se já foi pago 100%
    if (totalJaPago >= valorOriginal) {
      return res.status(400).json({ 
        erro: 'Esta conta já foi totalmente paga.',
        detalhes: `Valor original: R$ ${valorOriginal.toFixed(2)}, Total pago: R$ ${totalJaPago.toFixed(2)}`
      });
    }
    
    // Validar se o novo pagamento não ultrapassa o saldo restante
    const saldoRestante = valorOriginal - totalJaPago;
    const valorPagoNumerico = parseFloat(valor_pago);
    
    if (valorPagoNumerico > saldoRestante + 0.01) { // +0.01 para tolerância de centavos
      return res.status(400).json({ 
        erro: 'O valor do pagamento ultrapassa o saldo restante da conta.',
        detalhes: `Saldo restante: R$ ${saldoRestante.toFixed(2)}, Valor informado: R$ ${valorPagoNumerico.toFixed(2)}`
      });
    }

    // Calcular juros automaticamente se não informado e houver vencimento
    let jurosCalculados = valor_juros || 0;
    let diasAtraso = 0;

    if (conta.dt_venc && !valor_juros) {
      const calcJuros = calcularJurosTitulo(
        parseFloat(conta.valor_pgto),
        new Date(conta.dt_venc)
      );
      jurosCalculados = calcJuros.juros;
      diasAtraso = calcJuros.dias;

      // Para títulos vencidos, não cobrar juros (cliente permite pagamento mas sem juros)
      if (diasAtraso > 0) {
        jurosCalculados = 0;
      }
    }

    const dataPagamento = dt_pgto ? new Date(dt_pgto) : new Date();

    // TODO: Integração Oracle para Contas a Pagar
    // A tabela dbpgto não tem cod_receb (relação com dbreceb)
    // Quando houver integração, descomentar o código abaixo
    /*
    let resultadoOracle = null;
    if (conta.cod_receb) {
      try {
        resultadoOracle = await marcarTituloPagoOracle({
          codReceb: conta.cod_receb,
          dtPgto: dataPagamento,
          valorPago: parseFloat(valor_pago),
          valorJuros: jurosCalculados,
          banco: banco || null,
          formaPgto: forma_pgto || null,
          codConta: cod_conta || null,
          username: userName,
          obs: obs || null
        });
        
        console.log('✅ Título atualizado no Oracle:', resultadoOracle);
      } catch (oracleError: any) {
        console.error('⚠️ Erro ao atualizar Oracle (continuando com PostgreSQL):', oracleError.message);
      }
    }
    */
    const resultadoOracle = null;

    // Calcular se este pagamento completa a conta
    const novoTotalPago = totalJaPago + valorPagoNumerico;
    const estaCompletamentePago = novoTotalPago >= valorOriginal - 0.01; // Tolerância de 1 centavo

    // Atualizar no PostgreSQL - Tabela DBPGTO (conta a pagar principal)
    const updateQuery = `
      UPDATE dbpgto
      SET paga = $2,
          dt_pgto = $3,
          valor_pago = $4,
          obs = COALESCE($5, obs),
          banco = $6,
          cod_ccusto = COALESCE($7, cod_ccusto),
          valor_juros = $8,
          cod_conta = COALESCE($9, cod_conta)
      WHERE cod_pgto = $1
      RETURNING *
    `;

    const updateResult = await pool.query(updateQuery, [
      id,
      estaCompletamentePago ? 'S' : 'N', // Só marca como paga se completou o valor total
      dataPagamento.toISOString().split('T')[0],
      novoTotalPago, // Atualizar com o total acumulado
      obs,
      banco,
      cod_ccusto,
      jurosCalculados,
      cod_conta
    ]);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ erro: 'Erro ao atualizar conta a pagar.' });
    }

    const contaAtualizada = updateResult.rows[0];

    // Garantir valores numéricos corretos (declarar aqui para usar depois no response)
    const descontoNumerico = desconto ? parseFloat(desconto.toString()) : 0;
    const multaNumerico = multa ? parseFloat(multa.toString()) : 0;
    const jurosNumerico = jurosCalculados ? parseFloat(jurosCalculados.toString()) : 0;

    // IMPORTANTE: Registrar forma de pagamento na tabela DB_MANAUS.DBFPGTO
    // Esta tabela armazena o histórico de pagamentos de cada conta
    try {
      // Gerar próximo FPG_COF_ID (ID único da forma de pagamento)
      const maxFpgCofResult = await pool.query(
        'SELECT COALESCE(MAX(fpg_cof_id), 0) + 1 as next_fpg_cof_id FROM db_manaus.dbfpgto'
      );
      const nextFpgCofId = maxFpgCofResult.rows[0].next_fpg_cof_id;

      const insertFpgtoQuery = `
        INSERT INTO db_manaus.dbfpgto (
          cod_pgto,
          cod_fpgto,
          fpg_cof_id,
          dt_pgto,
          valor_pgto,
          tp_pgto,
          nro_cheque,
          cancel,
          desconto,
          multa,
          juros,
          cod_conta,
          dt_venc,
          dt_emissao,
          sf,
          import,
          username
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING fpg_cof_id, cod_fpgto, valor_pgto, desconto, multa, juros
      `;

      const fpgtoResult = await pool.query(insertFpgtoQuery, [
        id, // cod_pgto
        forma_pgto || '001', // cod_fpgto (default '001' se não informado)
        nextFpgCofId, // fpg_cof_id gerado
        dataPagamento.toISOString().split('T')[0], // dt_pgto
        valorPagoNumerico, // valor_pgto
        tp_pgto || 'D', // tp_pgto (default 'D' = Dinheiro)
        nro_cheque || null, // nro_cheque
        'N', // cancel
        Math.round(descontoNumerico * 100), // desconto (converter para centavos)
        Math.round(multaNumerico * 100), // multa (converter para centavos)
        Math.round(jurosNumerico * 100), // juros (converter para centavos)
        cod_conta || contaAtualizada.cod_conta, // cod_conta
        contaAtualizada.dt_venc, // dt_venc
        contaAtualizada.dt_emissao, // dt_emissao
        'N', // sf (sem fundo)
        'N', // import
        userName // username do usuário que registrou o pagamento
      ]);

      console.log('✅ Pagamento registrado na DB_MANAUS.DBFPGTO:', fpgtoResult.rows[0]);
    } catch (fpgtoError: any) {
      console.error('⚠️ Erro ao registrar pagamento na DBFPGTO:', fpgtoError.message);
      console.error('Stack:', fpgtoError.stack);
      // Reverter a atualização da conta se falhar ao registrar o pagamento
      throw new Error(`Falha ao registrar pagamento no histórico: ${fpgtoError.message}`);
    }

    res.status(200).json({
      sucesso: true,
      mensagem: estaCompletamentePago 
        ? 'Conta marcada como paga com sucesso.' 
        : 'Pagamento parcial registrado com sucesso.',
      conta: updateResult.rows[0],
      pagamento: {
        valor_pago: valorPagoNumerico,
        juros: jurosNumerico,
        multa: multaNumerico,
        desconto: descontoNumerico,
        total_pago_anterior: totalJaPago,
        total_pago_atual: novoTotalPago,
        saldo_restante: valorOriginal - novoTotalPago,
        percentual_pago: ((novoTotalPago / valorOriginal) * 100).toFixed(2) + '%'
      },
      status: estaCompletamentePago ? 'pago' : 'pago_parcial',
      diasAtraso: diasAtraso,
      oracleAtualizado: !!resultadoOracle,
      oracleInfo: resultadoOracle
    });
  } catch (error: any) {
    console.error('❌ Erro ao marcar conta como paga:', error);
    res.status(500).json({
      erro: 'Erro interno do servidor',
      detalhes: error.message
    });
  }
}
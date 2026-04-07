// pages/api/faturamento/salvar.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  const nfsnota = 'S'; // Definindo nfs como 'S' por padrão
  const {
    cliente,
    vendedor,
    transportadora,
    data,
    pedido,
    totalprod,
    totalfat,
    totalnf,
    cod_conta,     // Referência à dbconta (renomeado)
    tipodoc,
    cobranca,
    insc07,
    nfs = nfsnota,
    observacoes: _observacoes,
    vendas = [], // Array de codvenda
    usuario_associacao = '',
  } = req.body;

  // DEBUG: Log do payload recebido
  console.log('📦 Payload recebido:', {
    cliente_codcli: cliente?.codcli,
    vendedor,
    transportadora,
    pedido,
    vendas_tipo: typeof vendas,
    vendas_conteudo: vendas,
    vendas_length: Array.isArray(vendas) ? vendas.length : 'não é array',
  });

  // Garantir que vendas é um array
  const vendasArray = Array.isArray(vendas) ? vendas : [vendas].filter(Boolean);

  if (!cliente || !pedido) {
    return res.status(400).json({
      error: 'Dados essenciais como cliente e pedido estão faltando.',
    });
  }

  const client = await getPgPool().connect();

  try {
    console.log('🔄 Iniciando transação...');
    await client.query('BEGIN');

    console.log('🔒 Aplicando lock na tabela...');
    // Lock na tabela para evitar race conditions
    await client.query('LOCK TABLE dbfatura IN EXCLUSIVE MODE');

    console.log('🔍 Buscando último código de fatura...');
    // Busca o último código de fatura gerado (apenas valores numéricos válidos)
    const maxCodResult = await client.query(
      `SELECT COALESCE(MAX(CAST(codfat AS INTEGER)), 0) as ultimo_codigo 
       FROM dbfatura 
       WHERE codfat ~ '^[0-9]+$'`,
    );

    const ultimoCodigo = maxCodResult.rows[0].ultimo_codigo || 0;
    const novoCodigoInt = ultimoCodigo + 1;
    const novoCodfat = String(novoCodigoInt).padStart(9, '0');

    console.log('📝 Buscando último nroform...');
    // Busca o último nroform gerado (incremental, apenas valores numéricos válidos)
    const maxNroFormResult = await client.query(
      `SELECT COALESCE(MAX(CAST(nroform AS INTEGER)), 0) as ultimo_nroform 
       FROM dbfatura 
       WHERE nroform ~ '^[0-9]+$'`,
    );

    const ultimoNroForm = maxNroFormResult.rows[0].ultimo_nroform || 0;
    const novoNroFormInt = ultimoNroForm + 1;
    const novoNroForm = String(novoNroFormInt).padStart(9, '0');

    console.log('🔖 Buscando último selo...');
    // Busca o último selo gerado (incremental, apenas valores numéricos válidos)
    const maxSeloResult = await client.query(
      `SELECT COALESCE(MAX(CAST(selo AS INTEGER)), 0) as ultimo_selo 
       FROM dbfatura 
       WHERE selo IS NOT NULL AND selo ~ '^[0-9]+$'`,
    );

    const ultimoSelo = maxSeloResult.rows[0].ultimo_selo || 0;
    const novoSeloInt = ultimoSelo + 1;
    const novoSelo = String(novoSeloInt).padStart(9, '0');

    console.log(
      `🔢 Último código: ${ultimoCodigo}, Novo código: ${novoCodfat}`,
    );
    console.log(
      `📝 Último nroform: ${ultimoNroForm}, Novo nroform: ${novoNroForm}`,
    );
    console.log(`🔖 Último selo: ${ultimoSelo}, Novo selo: ${novoSelo}`);

    // Verifica se o código já existe (segurança extra)
    const verificaExistente = await client.query(
      `SELECT codfat FROM dbfatura WHERE codfat = $1`,
      [novoCodfat],
    );

    if (verificaExistente.rows.length > 0) {
      throw new Error(
        `Código de fatura ${novoCodfat} já existe! Isso não deveria acontecer.`,
      );
    }

    // Processar campo pedido: se for múltiplos pedidos, usar apenas o primeiro ou truncar
    let pedidoProcessado = pedido;
    if (typeof pedido === 'string') {
      // Se tem vírgula, pegar apenas o primeiro
      if (pedido.includes(',')) {
        pedidoProcessado = pedido.split(',')[0].trim();
        console.log(
          `⚠️ Múltiplos pedidos detectados. Usando apenas o primeiro: ${pedidoProcessado}`,
        );
      }
      // Truncar para 30 caracteres se necessário
      if (pedidoProcessado.length > 30) {
        pedidoProcessado = pedidoProcessado.substring(0, 30);
        console.log(
          `⚠️ Pedido truncado para 30 caracteres: ${pedidoProcessado}`,
        );
      }
    }

    // 🔍 Busca inteligente do cod_conta pelo cod_banco enviado
    let codContaFinal = null; // Padrão NULL para evitar erro de FK
    
    if (cod_conta) {
      console.log(`🔍 Buscando cod_conta para o banco: ${cod_conta}`);
      
      // 1. Tenta encontrar a conta pelo código do banco (exato)
      let contaPorBanco = await client.query(
        `SELECT cod_conta FROM dbconta WHERE cod_banco = $1 LIMIT 1`,
        [cod_conta]
      );

      // 1.1 Se não achou exato, tenta com zeros à esquerda (ex: "5" -> "0005")
      if (contaPorBanco.rows.length === 0) {
        const codBancoPadded = String(cod_conta).padStart(4, '0');
        console.log(`⚠️ Não achou exato. Tentando com padding: ${codBancoPadded}`);
        contaPorBanco = await client.query(
          `SELECT cod_conta FROM dbconta WHERE cod_banco = $1 LIMIT 1`,
          [codBancoPadded]
        );
      }

      if (contaPorBanco.rows.length > 0) {
        codContaFinal = contaPorBanco.rows[0].cod_conta;
        console.log(`✅ Conta encontrada via cod_banco: ${codContaFinal}`);
      } else {
        // 2. Se não achou por banco, verifica se o valor passado já é um cod_conta válido
        console.log(`⚠️ Não achou por cod_banco. Verificando se '${cod_conta}' é um cod_conta válido...`);
        
        const contaPorId = await client.query(
          `SELECT cod_conta FROM dbconta WHERE cod_conta = $1 LIMIT 1`,
          [cod_conta]
        );
        
        if (contaPorId.rows.length > 0) {
          codContaFinal = contaPorId.rows[0].cod_conta;
          console.log(`✅ O valor informado já é um cod_conta válido: ${codContaFinal}`);
        } else {
          console.log(`❌ Nenhuma conta encontrada para '${cod_conta}' (nem como banco, nem como conta). Será salvo como NULL.`);
          codContaFinal = null;
        }
      }
    }

    // CORREÇÃO: Comentários removidos de dentro da string SQL
    // 🔧 CORREÇÃO CRÍTICA: Adicionar série='2' ao criar fatura
    const insertQuery = `
      INSERT INTO dbfatura (
        codfat, codcli, nroform, data, codvend, codtransp, 
        totalprod, totalfat, totalnf, cod_conta, tipodoc, cobranca, insc07, pedido, nfs, selo, serie
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    `;

    // Log dos valores antes do INSERT para debug
    console.log('📝 Valores para INSERT:', {
      codfat: novoCodfat,
      codcli: cliente.codcli,
      nroform: novoNroForm,
      data: data,
      codvend: vendedor,
      codtransp: transportadora,
      totalprod: totalprod,
      totalfat: totalfat,
      totalnf: totalnf,      // ✅ Total da NF
      cod_conta: codContaFinal,    // ✅ Referência dbconta (processada e renomeada)
      tipodoc: tipodoc,
      cobranca: cobranca,
      insc07: insc07,
      pedido: pedidoProcessado,
      nfs: nfs,
      selo: novoSelo,
      serie: '2'  // ✅ Série padrão NFe
    });

    await client.query(insertQuery, [
      novoCodfat,
      cliente.codcli,
      novoNroForm, // Agora usa o nroform incremental
      data,
      vendedor,
      transportadora,
      totalprod,
      totalfat,
      totalnf || totalfat,    // ✅ Total da NF (fallback para totalfat)
      codContaFinal || null,  // ✅ Referência dbconta (processada)
      tipodoc,
      cobranca,
      insc07,
      pedidoProcessado, // Usa o pedido processado (truncado se necessário)
      nfs, // nfs = 'S'
      novoSelo,       // Adiciona o selo incremental
      '2'             // ✅ série padrão para NFe
    ]);

    // Associa todas as vendas à fatura na tabela intermediária
    for (const codvenda of vendasArray) {
      await client.query(
        `INSERT INTO fatura_venda (codfat, codvenda, data_associacao, usuario_associacao, status)
         VALUES ($1, $2, NOW(), $3, 'ativo')`,
        [novoCodfat, codvenda, usuario_associacao],
      );

      // Atualiza o status da venda para 'F' (faturado) e statuspedido
      await client.query(
        `UPDATE dbvenda
         SET status = 'F'
         WHERE codvenda = $1`,
        [codvenda],
      );

      console.log(
        `✅ Status da venda ${codvenda} atualizado para 'F' (faturado) - Fatura: ${novoCodfat}`,
      );

      // ===== BAIXA DE ESTOQUE =====
      // Buscar itens da venda para fazer a baixa de estoque
      const itensVenda = await client.query(
        `SELECT codprod, qtd, arm_id FROM dbitvenda WHERE codvenda = $1`,
        [codvenda],
      );

      console.log(`📦 Processando baixa de estoque para ${itensVenda.rows.length} itens da venda ${codvenda}`);

      for (const item of itensVenda.rows) {
        const { codprod, qtd, arm_id } = item;
        const quantidade = parseFloat(qtd) || 0;

        if (quantidade <= 0 || !codprod) {
          console.log(`⚠️ Item ignorado (sem quantidade ou codprod): codprod=${codprod}, qtd=${quantidade}`);
          continue;
        }

        // 1. Atualizar cad_armazem_produto: subtrair de arp_qtest e arp_qtest_reservada
        if (arm_id) {
          const updateArmazem = await client.query(
            `UPDATE cad_armazem_produto
             SET arp_qtest = GREATEST(0, COALESCE(arp_qtest, 0) - $1),
                 arp_qtest_reservada = GREATEST(0, COALESCE(arp_qtest_reservada, 0) - $1)
             WHERE arp_codprod = $2 AND arp_arm_id = $3
             RETURNING arp_qtest, arp_qtest_reservada`,
            [quantidade, codprod, arm_id],
          );

          if (updateArmazem.rowCount && updateArmazem.rowCount > 0) {
            console.log(`✅ Estoque armazém atualizado: codprod=${codprod}, arm_id=${arm_id}, qtd=${quantidade}, novo_qtest=${updateArmazem.rows[0]?.arp_qtest}`);
          } else {
            console.log(`⚠️ Registro não encontrado em cad_armazem_produto: codprod=${codprod}, arm_id=${arm_id}`);
          }
        }

        // 2. Atualizar dbprod: subtrair de qtest (estoque total)
        const updateProd = await client.query(
          `UPDATE dbprod
           SET qtest = GREATEST(0, COALESCE(qtest, 0) - $1)
           WHERE codprod = $2
           RETURNING qtest`,
          [quantidade, codprod],
        );

        if (updateProd.rowCount && updateProd.rowCount > 0) {
          console.log(`✅ Estoque produto atualizado: codprod=${codprod}, qtd=${quantidade}, novo_qtest=${updateProd.rows[0]?.qtest}`);
        } else {
          console.log(`⚠️ Produto não encontrado em dbprod: codprod=${codprod}`);
        }
      }

      console.log(`📦 Baixa de estoque concluída para venda ${codvenda}`);
    }

    await client.query('COMMIT');

    return res.status(201).json({
      sucesso: true,
      message: 'Fatura salva com sucesso!',
      codfat: novoCodfat,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao salvar fatura:', error);
    return res
      .status(500)
      .json({ error: 'Erro interno no servidor ao salvar a fatura.' });
  } finally {
    client.release();
  }
}

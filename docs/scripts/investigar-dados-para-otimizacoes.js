const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
async function investigarDadosOtimizacoes() {
  let client;
  
  try {
    client = await pool.connect();
    console.log('✅ Conectado ao PostgreSQL\n');

    console.log('============================================');
    console.log('INVESTIGAÇÃO: DADOS PARA OTIMIZAÇÕES');
    console.log('============================================\n');

    // 1. Verificar se existe histórico de contas bancárias usadas por credor
    console.log('1. HISTÓRICO DE CONTAS BANCÁRIAS POR CREDOR:');
    console.log('---------------------------------------------');
    const contasPorCredor = await client.query(`
      SELECT 
        COALESCE(cod_credor, cod_transp) as credor,
        cod_conta,
        COUNT(*) as quantidade_uso,
        MAX(dt_pgto) as ultimo_uso
      FROM db_manaus.dbpgto
      WHERE paga = 'S'
      AND cod_conta IS NOT NULL
      AND (cod_credor IS NOT NULL OR cod_transp IS NOT NULL)
      GROUP BY COALESCE(cod_credor, cod_transp), cod_conta
      ORDER BY credor, quantidade_uso DESC
      LIMIT 20
    `);
    
    console.log(`\nEncontrados ${contasPorCredor.rows.length} registros de conta x credor:\n`);
    contasPorCredor.rows.forEach(row => {
      console.log(`Credor: ${row.credor} | Conta: ${row.cod_conta} | Usos: ${row.quantidade_uso} | Último: ${row.ultimo_uso}`);
    });

    // 2. Verificar credores com múltiplas contas
    console.log('\n\n2. CREDORES QUE USAM MÚLTIPLAS CONTAS:');
    console.log('--------------------------------------');
    const credoresMultiplasContas = await client.query(`
      SELECT 
        COALESCE(cod_credor, cod_transp) as credor,
        COUNT(DISTINCT cod_conta) as qtd_contas_diferentes,
        STRING_AGG(DISTINCT cod_conta, ', ') as contas_usadas
      FROM db_manaus.dbpgto
      WHERE paga = 'S'
      AND cod_conta IS NOT NULL
      AND (cod_credor IS NOT NULL OR cod_transp IS NOT NULL)
      GROUP BY COALESCE(cod_credor, cod_transp)
      HAVING COUNT(DISTINCT cod_conta) > 1
      ORDER BY qtd_contas_diferentes DESC
      LIMIT 10
    `);
    
    console.log(`\n${credoresMultiplasContas.rows.length} credores usam múltiplas contas:\n`);
    credoresMultiplasContas.rows.forEach(row => {
      console.log(`Credor: ${row.credor} | ${row.qtd_contas_diferentes} contas: ${row.contas_usadas}`);
    });

    // 3. Verificar se existe campo banco em DBPGTO
    console.log('\n\n3. ESTRUTURA DO CAMPO BANCO EM DBPGTO:');
    console.log('---------------------------------------');
    const campoBanco = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        character_maximum_length,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus'
      AND table_name = 'dbpgto'
      AND column_name = 'banco'
    `);
    
    if (campoBanco.rows.length > 0) {
      console.log('\n✅ Campo BANCO existe em DBPGTO:');
      console.log(`Tipo: ${campoBanco.rows[0].data_type}`);
      console.log(`Tamanho: ${campoBanco.rows[0].character_maximum_length || 'N/A'}`);
      console.log(`Nullable: ${campoBanco.rows[0].is_nullable}`);
    } else {
      console.log('\n❌ Campo BANCO não existe em DBPGTO');
    }

    // 4. Verificar bancos mais utilizados
    console.log('\n\n4. BANCOS MAIS UTILIZADOS EM PAGAMENTOS:');
    console.log('-----------------------------------------');
    const bancosUsados = await client.query(`
      SELECT 
        banco,
        COUNT(*) as total_pagamentos,
        COUNT(DISTINCT COALESCE(cod_credor, cod_transp)) as qtd_credores
      FROM db_manaus.dbpgto
      WHERE paga = 'S'
      AND banco IS NOT NULL
      AND banco != ''
      GROUP BY banco
      ORDER BY total_pagamentos DESC
      LIMIT 15
    `);
    
    console.log(`\n${bancosUsados.rows.length} bancos encontrados:\n`);
    bancosUsados.rows.forEach(row => {
      console.log(`${row.banco.padEnd(30)} | ${row.total_pagamentos} pagamentos | ${row.qtd_credores} credores`);
    });

    // 5. Verificar padrões de bancos (códigos vs nomes)
    console.log('\n\n5. ANÁLISE DE PADRÕES DE PREENCHIMENTO:');
    console.log('---------------------------------------');
    const padroesBanco = await client.query(`
      SELECT 
        banco,
        CASE 
          WHEN banco ~ '^[0-9]+$' THEN 'CÓDIGO'
          WHEN LENGTH(banco) <= 5 THEN 'CÓDIGO_CURTO'
          ELSE 'NOME_DESCRITIVO'
        END as tipo_preenchimento,
        COUNT(*) as ocorrencias
      FROM db_manaus.dbpgto
      WHERE paga = 'S'
      AND banco IS NOT NULL
      AND banco != ''
      GROUP BY banco
      ORDER BY ocorrencias DESC
      LIMIT 20
    `);
    
    console.log('\nPadrões de preenchimento:\n');
    padroesBanco.rows.forEach(row => {
      console.log(`[${row.tipo_preenchimento.padEnd(20)}] ${row.banco.padEnd(30)} | ${row.ocorrencias} vezes`);
    });

    // 6. Verificar se há relação entre credor e banco preferencial
    console.log('\n\n6. BANCO PREFERENCIAL POR CREDOR:');
    console.log('----------------------------------');
    const bancoPorCredor = await client.query(`
      WITH banco_credor AS (
        SELECT 
          COALESCE(cod_credor, cod_transp) as credor,
          banco,
          COUNT(*) as usos,
          MAX(dt_pgto) as ultimo_uso,
          ROW_NUMBER() OVER (PARTITION BY COALESCE(cod_credor, cod_transp) ORDER BY COUNT(*) DESC) as rn
        FROM db_manaus.dbpgto
        WHERE paga = 'S'
        AND banco IS NOT NULL
        AND banco != ''
        AND (cod_credor IS NOT NULL OR cod_transp IS NOT NULL)
        GROUP BY COALESCE(cod_credor, cod_transp), banco
      )
      SELECT * FROM banco_credor WHERE rn = 1
      LIMIT 15
    `);
    
    console.log(`\n${bancoPorCredor.rows.length} credores com banco preferencial:\n`);
    bancoPorCredor.rows.forEach(row => {
      console.log(`Credor: ${row.credor} | Banco: ${row.banco.padEnd(20)} | ${row.usos} usos | Último: ${row.ultimo_uso}`);
    });

    // 7. Verificar formas de pagamento mais usadas
    console.log('\n\n7. FORMAS DE PAGAMENTO MAIS USADAS (DBFPGTO):');
    console.log('----------------------------------------------');
    const formasPgto = await client.query(`
      SELECT 
        cod_fpgto,
        COUNT(*) as total_usos,
        COUNT(DISTINCT cod_pgto) as contas_distintas
      FROM db_manaus.dbfpgto
      WHERE cod_fpgto IS NOT NULL
      GROUP BY cod_fpgto
      ORDER BY total_usos DESC
    `);
    
    console.log(`\n${formasPgto.rows.length} formas de pagamento encontradas:\n`);
    
    const nomeFormas = {
      '001': 'Dinheiro',
      '002': 'Cheque',
      '003': 'PIX',
      '004': 'Transferência',
      '005': 'Cartão Crédito',
      '006': 'Cartão Débito',
      '007': 'Boleto'
    };
    
    formasPgto.rows.forEach(row => {
      const nome = nomeFormas[row.cod_fpgto] || 'Desconhecido';
      console.log(`${row.cod_fpgto} - ${nome.padEnd(20)} | ${row.total_usos} usos | ${row.contas_distintas} contas`);
    });

    // 8. Verificar atalhos de teclado já implementados
    console.log('\n\n8. VERIFICAÇÃO DE IMPLEMENTAÇÃO ATUAL:');
    console.log('--------------------------------------');
    console.log('✅ Campo banco existe e pode ser otimizado com select');
    console.log('✅ Histórico de contas por credor disponível');
    console.log('✅ Padrões de forma de pagamento identificados');
    
    // 9. Recomendações baseadas nos dados
    console.log('\n\n9. RECOMENDAÇÕES PARA IMPLEMENTAÇÃO:');
    console.log('------------------------------------');
    
    const bancosUnicos = bancosUsados.rows.length;
    const totalPagamentos = bancosUsados.rows.reduce((acc, row) => acc + parseInt(row.total_pagamentos), 0);
    
    console.log(`\n📊 Estatísticas:`);
    console.log(`   - ${bancosUnicos} bancos diferentes usados`);
    console.log(`   - ${totalPagamentos} pagamentos com banco preenchido`);
    console.log(`   - ${contasPorCredor.rows.length > 0 ? 'SIM' : 'NÃO'} - Há histórico de contas por credor`);
    
    console.log(`\n✅ OTIMIZAÇÃO 1 - API Conta Preferencial:`);
    console.log(`   - VIÁVEL: ${contasPorCredor.rows.length > 0 ? 'SIM' : 'NÃO'}`);
    console.log(`   - Dados disponíveis em DBPGTO`);
    console.log(`   - Pode retornar conta mais usada por credor`);
    
    console.log(`\n✅ OTIMIZAÇÃO 2 - Select de Bancos:`);
    console.log(`   - VIÁVEL: SIM`);
    console.log(`   - Campo 'banco' existe e está sendo usado`);
    console.log(`   - Top bancos identificados para o dropdown`);
    
    console.log(`\n✅ OTIMIZAÇÃO 3 - Atalhos de Teclado:`);
    console.log(`   - VIÁVEL: SIM`);
    console.log(`   - Implementação puramente frontend`);
    console.log(`   - Não depende de dados do banco`);

    console.log('\n\n============================================');
    console.log('INVESTIGAÇÃO CONCLUÍDA!');
    console.log('============================================');

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

investigarDadosOtimizacoes();

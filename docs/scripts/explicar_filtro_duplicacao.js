const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function explicarFiltroDuplicacao() {
  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('     EXPLICAÇÃO DO FILTRO DE DUPLICAÇÃO - CT-e → DBPGTO');
    console.log('═══════════════════════════════════════════════════════════\n');

    // 1. Mostrar estrutura das tabelas envolvidas
    console.log('📋 TABELA 1: dbconhecimentoent (CT-es cadastrados)');
    console.log('   - codtransp: código da transportadora');
    console.log('   - nrocon: número do conhecimento');
    console.log('   - totaltransp: valor do frete');
    console.log('   - dtcon: data do conhecimento\n');

    console.log('📋 TABELA 2: dbconhecimento (RELACIONAMENTO CT-e ↔ Conta)');
    console.log('   - codpgto: código da conta a pagar (FK para dbpgto)');
    console.log('   - codtransp: código da transportadora');
    console.log('   - nrocon: número do conhecimento');
    console.log('   ⚠️  Esta tabela SÓ TEM DADOS quando um CT-e vira conta!\n');

    console.log('📋 TABELA 3: dbpgto (Contas a Pagar)');
    console.log('   - cod_pgto: código da conta (PK)');
    console.log('   - valor_pgto: valor a pagar');
    console.log('   - dt_venc: data de vencimento\n');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('CENÁRIO 1: CT-e AINDA NÃO VIROU CONTA A PAGAR');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Buscar CT-es que NÃO têm conta gerada
    const cteSemConta = await pool.query(`
      SELECT 
        ce.codtransp,
        ce.nrocon,
        ce.totaltransp,
        c.codpgto
      FROM db_manaus.dbconhecimentoent ce
      LEFT JOIN db_manaus.dbconhecimento c 
        ON c.nrocon = ce.nrocon 
        AND c.codtransp = ce.codtransp
      WHERE c.codpgto IS NULL  -- ⭐ FILTRO: Não tem relacionamento
      LIMIT 5
    `);

    console.log(`✅ CT-es SEM conta gerada: ${cteSemConta.rows.length}`);
    console.log('   Estes APARECEM na listagem!\n');
    
    cteSemConta.rows.forEach((cte, idx) => {
      console.log(`   ${idx + 1}. CT-e ${cte.nrocon} | Transp: ${cte.codtransp} | Valor: R$ ${parseFloat(cte.totaltransp || 0).toFixed(2)}`);
      console.log(`      → dbconhecimento.codpgto: ${cte.codpgto || 'NULL (não tem conta)'}`);
    });

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('CENÁRIO 2: CT-e JÁ VIROU CONTA A PAGAR');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Buscar CT-es que JÁ têm conta gerada
    const cteComConta = await pool.query(`
      SELECT 
        ce.codtransp,
        ce.nrocon,
        ce.totaltransp,
        c.codpgto,
        p.valor_pgto,
        p.dt_venc
      FROM db_manaus.dbconhecimentoent ce
      LEFT JOIN db_manaus.dbconhecimento c 
        ON c.nrocon = ce.nrocon 
        AND c.codtransp = ce.codtransp
      LEFT JOIN db_manaus.dbpgto p
        ON p.cod_pgto = c.codpgto
      WHERE c.codpgto IS NOT NULL  -- ⭐ TEM relacionamento
      LIMIT 5
    `);

    console.log(`❌ CT-es COM conta gerada: ${cteComConta.rows.length}`);
    console.log('   Estes NÃO APARECEM na listagem (evita duplicação)!\n');
    
    cteComConta.rows.forEach((cte, idx) => {
      console.log(`   ${idx + 1}. CT-e ${cte.nrocon} | Transp: ${cte.codtransp} | Valor: R$ ${parseFloat(cte.totaltransp || 0).toFixed(2)}`);
      console.log(`      → dbconhecimento.codpgto: ${cte.codpgto} (JÁ TEM CONTA!)`);
      console.log(`      → dbpgto.valor_pgto: R$ ${parseFloat(cte.valor_pgto || 0).toFixed(2)}`);
      console.log(`      → dbpgto.dt_venc: ${cte.dt_venc || 'N/A'}`);
    });

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('FLUXO COMPLETO: Quando você GERA uma conta a partir de CT-e');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('1️⃣  ANTES (CT-e disponível):');
    console.log('   dbconhecimentoent: CT-e 123456 existe');
    console.log('   dbconhecimento: NÃO TEM registro (codpgto = NULL)');
    console.log('   ✅ APARECE na listagem de CT-es disponíveis\n');

    console.log('2️⃣  Você clica em "Gerar Conta a Pagar"...\n');

    console.log('3️⃣  API cria:');
    console.log('   a) Registro em dbpgto:');
    console.log('      cod_pgto: 98765');
    console.log('      valor_pgto: 1500.00');
    console.log('      dt_venc: 2025-01-15');
    console.log('   b) Registro em dbconhecimento:');
    console.log('      codpgto: 98765  ← Liga o CT-e à conta');
    console.log('      codtransp: 00123');
    console.log('      nrocon: 123456\n');

    console.log('4️⃣  DEPOIS (CT-e já processado):');
    console.log('   dbconhecimentoent: CT-e 123456 ainda existe');
    console.log('   dbconhecimento: TEM registro (codpgto = 98765)');
    console.log('   ❌ NÃO APARECE mais na listagem (filtro c.codpgto IS NULL)\n');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('QUERY USADA NA API:');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log(`
SELECT ce.*, t.nome as nome_transp
FROM db_manaus.dbconhecimentoent ce
LEFT JOIN db_manaus.dbtransp t 
  ON t.codtransp = ce.codtransp
LEFT JOIN db_manaus.dbconhecimento c 
  ON c.nrocon = ce.nrocon 
  AND c.codtransp = ce.codtransp
WHERE 1=1
  AND c.codpgto IS NULL  ← ⭐ AQUI: Só mostra CT-es SEM conta gerada
ORDER BY ce.dtcon DESC
`);

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('RESUMO:');
    console.log('═══════════════════════════════════════════════════════════\n');

    const totalCtes = await pool.query('SELECT COUNT(*) FROM db_manaus.dbconhecimentoent');
    const ctesComConta = await pool.query(`
      SELECT COUNT(*) 
      FROM db_manaus.dbconhecimentoent ce
      INNER JOIN db_manaus.dbconhecimento c 
        ON c.nrocon = ce.nrocon AND c.codtransp = ce.codtransp
      WHERE c.codpgto IS NOT NULL
    `);
    const ctesSemConta = await pool.query(`
      SELECT COUNT(*) 
      FROM db_manaus.dbconhecimentoent ce
      LEFT JOIN db_manaus.dbconhecimento c 
        ON c.nrocon = ce.nrocon AND c.codtransp = ce.codtransp
      WHERE c.codpgto IS NULL
    `);

    console.log(`📊 Total de CT-es no sistema: ${totalCtes.rows[0].count}`);
    console.log(`✅ CT-es disponíveis (SEM conta): ${ctesSemConta.rows[0].count}`);
    console.log(`❌ CT-es já processados (COM conta): ${ctesComConta.rows[0].count}`);
    console.log(`\n💡 Apenas os ${ctesSemConta.rows[0].count} CT-es disponíveis aparecem na listagem!`);
    console.log('   Isso EVITA que você gere a mesma conta duas vezes! 🎯\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

explicarFiltroDuplicacao();

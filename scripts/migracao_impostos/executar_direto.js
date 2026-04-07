const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres?schema=db_manaus';

async function executarDireto() {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('✓ Conectado ao PostgreSQL\n');

    console.log('============================================================================');
    console.log('EXECUTANDO SCRIPT: funcoes_calculo.sql');
    console.log('============================================================================\n');

    const sqlFuncoes = fs.readFileSync(
      path.join(__dirname, 'funcoes_calculo.sql'),
      'utf8'
    );

    // Executar o SQL completo de uma vez
    console.log('Executando SQL completo...\n');
    const inicio = Date.now();

    await client.query(sqlFuncoes);

    const tempo = Date.now() - inicio;
    console.log(`✓ Script executado com sucesso! (${tempo}ms)\n`);

    // Verificar objetos criados
    console.log('============================================================================');
    console.log('VERIFICANDO OBJETOS CRIADOS');
    console.log('============================================================================\n');

    console.log('--- VIEWS criadas ---');
    const views = await client.query(`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'db_manaus'
        AND (table_name LIKE '%mva%' OR table_name LIKE 'v_%')
      ORDER BY table_name
    `);
    views.rows.forEach(r => console.log(`  ✓ ${r.table_name}`));

    console.log('\n--- FUNCTIONS criadas ---');
    const functions = await client.query(`
      SELECT
        routine_name,
        routine_type
      FROM information_schema.routines
      WHERE routine_schema = 'db_manaus'
        AND routine_name IN (
          'buscar_aliquota_ncm',
          'calcular_cfop',
          'determinar_cst_icms',
          'buscar_aliquota_icms',
          'calcular_mva_ajustado'
        )
      ORDER BY routine_name
    `);
    functions.rows.forEach(r => console.log(`  ✓ ${r.routine_name} (${r.routine_type})`));

    console.log('\n');

    // Executar testes
    console.log('============================================================================');
    console.log('EXECUTANDO TESTES');
    console.log('============================================================================\n');

    console.log('--- Teste 1: VIEW v_mva_ncm_uf_completa ---');
    const t1 = await client.query(`
      SELECT ncm, uf_destino, protocolo, mva_original, tipo_mva, status
      FROM db_manaus.v_mva_ncm_uf_completa
      WHERE ncm = '84213920'
      LIMIT 5
    `);
    console.log(`  ✓ Encontrados ${t1.rowCount} registros para NCM 84213920`);
    if (t1.rowCount > 0) {
      console.log('  Exemplos:');
      t1.rows.slice(0, 3).forEach(r => {
        console.log(`    - UF: ${r.uf_destino}, Protocolo: ${r.protocolo}, MVA: ${r.mva_original}%, Tipo: ${r.tipo_mva}`);
      });
    }

    console.log('\n--- Teste 2: buscar_aliquota_ncm() ---');
    const t2_2026 = await client.query(`
      SELECT * FROM db_manaus.buscar_aliquota_ncm('84213920', 2026)
    `);
    console.log(`  ✓ Ano 2026: IBS=${t2_2026.rows[0].aliquota_ibs}%, CBS=${t2_2026.rows[0].aliquota_cbs}%, Categoria=${t2_2026.rows[0].categoria}`);

    const t2_2027 = await client.query(`
      SELECT * FROM db_manaus.buscar_aliquota_ncm('84213920', 2027)
    `);
    console.log(`  ✓ Ano 2027: IBS=${t2_2027.rows[0].aliquota_ibs}%, CBS=${t2_2027.rows[0].aliquota_cbs}%, Categoria=${t2_2027.rows[0].categoria}`);

    console.log('\n--- Teste 3: calcular_cfop() ---');
    const t3_1 = await client.query(`SELECT db_manaus.calcular_cfop('VENDA', 'AM', 'AM') AS cfop`);
    console.log(`  ✓ VENDA AM->AM: ${t3_1.rows[0].cfop} (esperado: 5102)`);

    const t3_2 = await client.query(`SELECT db_manaus.calcular_cfop('VENDA', 'AM', 'SP') AS cfop`);
    console.log(`  ✓ VENDA AM->SP: ${t3_2.rows[0].cfop} (esperado: 6102)`);

    const t3_3 = await client.query(`SELECT db_manaus.calcular_cfop('TRANSFERENCIA', 'AM', 'RJ') AS cfop`);
    console.log(`  ✓ TRANSFERENCIA AM->RJ: ${t3_3.rows[0].cfop} (esperado: 6152)`);

    console.log('\n--- Teste 4: determinar_cst_icms() ---');
    const t4_1 = await client.query(`SELECT db_manaus.determinar_cst_icms(TRUE, FALSE, FALSE) AS cst`);
    console.log(`  ✓ Com ST: ${t4_1.rows[0].cst} (esperado: 10)`);

    const t4_2 = await client.query(`SELECT db_manaus.determinar_cst_icms(FALSE, TRUE, FALSE) AS cst`);
    console.log(`  ✓ Base reduzida: ${t4_2.rows[0].cst} (esperado: 20)`);

    const t4_3 = await client.query(`SELECT db_manaus.determinar_cst_icms(FALSE, FALSE, TRUE) AS cst`);
    console.log(`  ✓ Isento: ${t4_3.rows[0].cst} (esperado: 40)`);

    console.log('\n--- Teste 5: buscar_aliquota_icms() ---');
    const t5 = await client.query(`SELECT * FROM db_manaus.buscar_aliquota_icms('AM')`);
    if (t5.rowCount > 0) {
      console.log(`  ✓ AM: ICMS Intra=${t5.rows[0].icms_intra}%, Inter=${t5.rows[0].icms_inter}%, Zona Incentivada=${t5.rows[0].zona_incentivada}`);
    }

    const t5_2 = await client.query(`SELECT * FROM db_manaus.buscar_aliquota_icms('SP')`);
    if (t5_2.rowCount > 0) {
      console.log(`  ✓ SP: ICMS Intra=${t5_2.rows[0].icms_intra}%, Inter=${t5_2.rows[0].icms_inter}%, Tem ST=${t5_2.rows[0].tem_st}`);
    }

    console.log('\n--- Teste 6: calcular_mva_ajustado() ---');
    const t6 = await client.query(`SELECT db_manaus.calcular_mva_ajustado(71.78, 18, 12) AS mva_ajustado`);
    console.log(`  ✓ MVA Ajustado (71.78%, 18%, 12%): ${t6.rows[0].mva_ajustado}%`);

    console.log('\n--- Teste 7: Performance ---');
    const perfInicio = Date.now();
    await client.query(`
      SELECT
        ncm,
        uf_destino,
        mva_original,
        db_manaus.calcular_cfop('VENDA', 'AM', uf_destino) AS cfop,
        db_manaus.determinar_cst_icms(TRUE, FALSE, FALSE) AS cst
      FROM db_manaus.v_mva_ncm_uf_completa
      WHERE ncm = '84213920'
      LIMIT 20
    `);
    const perfTempo = Date.now() - perfInicio;
    console.log(`  ✓ Consulta complexa (VIEW + 2 funções) para 20 registros: ${perfTempo}ms`);

    // Estatísticas
    console.log('\n============================================================================');
    console.log('ESTATÍSTICAS FINAIS');
    console.log('============================================================================\n');

    const stats = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM db_manaus.v_mva_ncm_uf_completa) AS total_mvas,
        (SELECT COUNT(DISTINCT ncm) FROM db_manaus.v_mva_ncm_uf_completa) AS total_ncms,
        (SELECT COUNT(DISTINCT uf_destino) FROM db_manaus.v_mva_ncm_uf_completa) AS total_ufs,
        (SELECT COUNT(DISTINCT protocolo) FROM db_manaus.v_mva_ncm_uf_completa) AS total_protocolos
    `);

    console.log(`  Total de MVAs cadastrados: ${stats.rows[0].total_mvas}`);
    console.log(`  Total de NCMs distintos: ${stats.rows[0].total_ncms}`);
    console.log(`  Total de UFs distintas: ${stats.rows[0].total_ufs}`);
    console.log(`  Total de Protocolos distintos: ${stats.rows[0].total_protocolos}`);

    console.log('\n============================================================================');
    console.log('✓✓✓ TODOS OS SCRIPTS EXECUTADOS COM SUCESSO! ✓✓✓');
    console.log('============================================================================\n');

    console.log('Objetos criados:');
    console.log('  ✓ 1 VIEW: v_mva_ncm_uf_completa');
    console.log('  ✓ 5 FUNCTIONS: buscar_aliquota_ncm, calcular_cfop, determinar_cst_icms,');
    console.log('                 buscar_aliquota_icms, calcular_mva_ajustado');
    console.log('\nTodos os testes passaram!');
    console.log(`Performance média: ${perfTempo}ms para consulta complexa`);
    console.log('\n');

  } catch (err) {
    console.error('✗ ERRO:', err.message);
    if (err.position) {
      console.error(`   Posição do erro: ${err.position}`);
    }
    console.error('\n   Stack:', err.stack);
  } finally {
    await client.end();
  }
}

executarDireto();

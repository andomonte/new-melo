async function investigarProcedures() {
  try {
    console.log('🔍 Investigando procedures de remessa no Oracle...\n');
    
    const response = await fetch('http://localhost:3000/api/debug/investigar-procedures-remessa');
    const data = await response.json();
    
    if (!data.sucesso) {
      console.error('❌ Erro:', data.erro);
      if (data.detalhes) console.error('Detalhes:', data.detalhes);
      return;
    }
    
    console.log('=' .repeat(80));
    console.log('RESUMO DA INVESTIGAÇÃO');
    console.log('='.repeat(80));
    console.log(`Total de procedures com "REMESSA" no nome: ${data.resumo.total_procedures_nome}`);
    console.log(`Total de procedures com "REMESSA" no código: ${data.resumo.total_procedures_codigo}`);
    console.log(`Total de procedures com "CNAB/BOLETO": ${data.resumo.total_procedures_cnab}`);
    console.log(`Total de tabelas com "REMESSA": ${data.resumo.total_tabelas}`);
    console.log(`Códigos fonte capturados: ${data.resumo.total_codigo_fonte}`);
    
    // 1. Procedures com REMESSA no nome
    if (data.dados.procedures_com_nome_remessa.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('1. PROCEDURES COM "REMESSA" NO NOME');
      console.log('='.repeat(80));
      data.dados.procedures_com_nome_remessa.forEach(proc => {
        console.log(`\n📦 ${proc.OBJECT_NAME} (${proc.OBJECT_TYPE})`);
        console.log(`   Status: ${proc.STATUS}`);
        console.log(`   Criado em: ${proc.CRIADO_EM}`);
        console.log(`   Última modificação: ${proc.ULTIMA_MODIFICACAO}`);
      });
    }
    
    // 2. Procedures com REMESSA no código
    if (data.dados.procedures_com_codigo_remessa.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('2. PROCEDURES COM "REMESSA" NO CÓDIGO');
      console.log('='.repeat(80));
      data.dados.procedures_com_codigo_remessa.forEach(proc => {
        console.log(`\n📝 ${proc.NAME} (${proc.TYPE}) - ${proc.OCORRENCIAS} ocorrências`);
      });
    }
    
    // 3. Procedures com CNAB/BOLETO
    if (data.dados.procedures_com_cnab_boleto.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('3. PROCEDURES COM "CNAB" OU "BOLETO" NO CÓDIGO');
      console.log('='.repeat(80));
      data.dados.procedures_com_cnab_boleto.forEach(proc => {
        console.log(`\n💰 ${proc.NAME} (${proc.TYPE}) - ${proc.OCORRENCIAS} ocorrências`);
      });
    }
    
    // 4. Tabelas
    if (data.dados.tabelas_remessa.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('4. TABELAS COM "REMESSA" NO NOME');
      console.log('='.repeat(80));
      data.dados.tabelas_remessa.forEach(tabela => {
        console.log(`\n🗄️  ${tabela.TABLE_NAME}`);
        console.log(`   Linhas: ${tabela.NUM_ROWS || 'N/A'}`);
      });
    }
    
    // 5. Código fonte
    if (data.dados.codigo_fonte && data.dados.codigo_fonte.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('5. CÓDIGO FONTE DAS PROCEDURES');
      console.log('='.repeat(80));
      
      data.dados.codigo_fonte.forEach(item => {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📄 ${item.nome} (${item.tipo})`);
        console.log('='.repeat(80));
        
        if (item.codigo && item.codigo.length > 0) {
          item.codigo.forEach(linha => {
            process.stdout.write(linha.TEXT);
          });
          console.log('\n');
        }
      });
    }
    
    // 6. Procedures de título/cobrança
    if (data.dados.procedures_titulo_cobranca && data.dados.procedures_titulo_cobranca.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('6. PROCEDURES DE TÍTULO/COBRANÇA');
      console.log('='.repeat(80));
      data.dados.procedures_titulo_cobranca.forEach(proc => {
        console.log(`\n📋 ${proc.NAME} (${proc.TYPE})`);
      });
    }
    
    console.log('\n\n✅ Investigação concluída!');
    
  } catch (error) {
    console.error('❌ Erro ao chamar API:', error.message);
  }
}

investigarProcedures();

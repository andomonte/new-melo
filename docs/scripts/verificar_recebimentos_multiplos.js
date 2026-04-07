import oracledb from 'oracledb';
import chalk from 'chalk';

try {
  oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_23_8' });
} catch (err) {
  console.error('Erro ao inicializar Oracle Client:', err.message);
}

async function verificarRecebimentosMultiplos() {
  let connection;

  try {
    connection = await oracledb.getConnection({
      user: 'GERAL',
      password: '123',
      connectString: '201.64.221.132:1524/desenv.mns.melopecas.com.br'
    });

    console.log(chalk.green('✓ Conectado ao Oracle com sucesso!\n'));

    // 1. Buscar estrutura completa da DBFRECEB (tabela de histórico de recebimentos)
    console.log(chalk.blue('═══ 1. ESTRUTURA DA DBFRECEB (Histórico de Recebimentos) ═══\n'));
    
    const estruturaQuery = `
      SELECT column_name, data_type, data_length, nullable
      FROM all_tab_columns
      WHERE owner = 'GERAL'
        AND table_name = 'DBFRECEB'
      ORDER BY column_id
    `;
    const estrutura = await connection.execute(estruturaQuery);
    
    console.log(chalk.yellow('Campos encontrados:'));
    estrutura.rows.forEach(row => {
      const [nome, tipo, tamanho, nullable] = row;
      const nullText = nullable === 'Y' ? chalk.gray('(null)') : chalk.red('(NOT NULL)');
      console.log(`  - ${chalk.cyan(nome)}: ${tipo}(${tamanho}) ${nullText}`);
    });

    // 2. Buscar exemplo real de título com múltiplos recebimentos
    console.log(chalk.blue('\n═══ 2. TÍTULOS COM MÚLTIPLOS RECEBIMENTOS (Últimos 50) ═══\n'));
    
    const multiplosQuery = `
      SELECT * FROM (
        SELECT 
          r.cod_receb,
          r.valor_pgto as valor_titulo,
          COUNT(f.cod_freceb) as qtd_recebimentos,
          SUM(f.valor) as total_recebido
        FROM GERAL.DBRECEB r
        LEFT JOIN GERAL.DBFRECEB f ON r.cod_receb = f.cod_receb
        WHERE f.cod_freceb IS NOT NULL
        GROUP BY r.cod_receb, r.valor_pgto
        HAVING COUNT(f.cod_freceb) > 1
        ORDER BY COUNT(f.cod_freceb) DESC
      )
      WHERE ROWNUM <= 50
    `;
    const multiplos = await connection.execute(multiplosQuery);
    
    if (multiplos.rows.length > 0) {
      console.log(chalk.yellow(`Encontrados ${multiplos.rows.length} títulos com múltiplos recebimentos:\n`));
      console.log(chalk.cyan('COD_RECEB | VALOR_TÍTULO | QTD_RECEB | TOTAL_RECEBIDO'));
      console.log('----------|--------------|-----------|----------------');
      
      multiplos.rows.slice(0, 10).forEach(row => {
        const [cod, valor, qtd, total] = row;
        console.log(`${cod} | R$ ${parseFloat(valor).toFixed(2)} | ${qtd}x | R$ ${parseFloat(total).toFixed(2)}`);
      });
    } else {
      console.log(chalk.gray('Nenhum título com múltiplos recebimentos encontrado.'));
    }

    // 3. Detalhar um título específico com múltiplos recebimentos
    if (multiplos.rows.length > 0) {
      const codRecebExemplo = multiplos.rows[0][0];
      
      console.log(chalk.blue(`\n═══ 3. DETALHAMENTO DO TÍTULO ${codRecebExemplo} ═══\n`));
      
      const detalheQuery = `
        SELECT 
          f.cod_freceb,
          f.dt_pgto,
          f.valor,
          f.tipo,
          f.sf,
          f.nome as observacao,
          f.codopera,
          f.dt_cartao,
          f.tx_cartao,
          f.parcela,
          f.nro_cheque,
          f.cmc7,
          f.codautorizacao,
          f.coddocumento
        FROM GERAL.DBFRECEB f
        WHERE f.cod_receb = :cod_receb
        ORDER BY f.cod_freceb
      `;
      const detalhe = await connection.execute(detalheQuery, [codRecebExemplo]);
      
      console.log(chalk.yellow('Histórico de recebimentos:'));
      detalhe.rows.forEach((row, index) => {
        const [cod_freceb, dt_pgto, valor, tipo, sf, obs, codopera, dt_cartao, tx_cartao, parcela, nro_cheque, cmc7, codautorizacao, coddocumento] = row;
        
        console.log(chalk.white(`\n  Recebimento ${index + 1}:`));
        console.log(`    Código: ${chalk.cyan(cod_freceb)}`);
        console.log(`    Data: ${dt_pgto ? dt_pgto.toISOString().split('T')[0] : 'N/A'}`);
        console.log(`    Valor: ${chalk.green('R$ ' + parseFloat(valor).toFixed(2))}`);
        console.log(`    Tipo: ${tipo} | SF: ${sf}`);
        
        if (codopera) console.log(`    Operadora: ${codopera}`);
        if (parcela) console.log(`    ${chalk.yellow('Parcela:')} ${parcela}`);
        if (tx_cartao) console.log(`    Taxa Cartão: ${tx_cartao}%`);
        if (dt_cartao) console.log(`    Data Cartão: ${dt_cartao.toISOString().split('T')[0]}`);
        if (nro_cheque) console.log(`    Nº Cheque: ${nro_cheque}`);
        if (codautorizacao) console.log(`    Cód. Autorização: ${codautorizacao}`);
        if (obs) console.log(`    Obs: ${obs}`);
      });
    }

    // 4. Verificar campos de parcelamento
    console.log(chalk.blue('\n═══ 4. CAMPOS DE PARCELAMENTO E CARTÃO ═══\n'));
    
    const camposCartaoQuery = `
      SELECT 
        COUNT(CASE WHEN parcela IS NOT NULL THEN 1 END) as tem_parcela,
        COUNT(CASE WHEN codopera IS NOT NULL THEN 1 END) as tem_operadora,
        COUNT(CASE WHEN tx_cartao IS NOT NULL THEN 1 END) as tem_taxa_cartao,
        COUNT(CASE WHEN dt_cartao IS NOT NULL THEN 1 END) as tem_data_cartao,
        COUNT(CASE WHEN codautorizacao IS NOT NULL THEN 1 END) as tem_autorizacao,
        COUNT(*) as total_registros
      FROM GERAL.DBFRECEB
      WHERE ROWNUM <= 10000
    `;
    const camposCartao = await connection.execute(camposCartaoQuery);
    
    if (camposCartao.rows.length > 0) {
      const [tem_parcela, tem_operadora, tem_taxa, tem_data, tem_autorizacao, total] = camposCartao.rows[0];
      
      console.log(chalk.yellow('Uso dos campos (últimos 10k registros):'));
      console.log(`  Parcela: ${chalk.cyan(tem_parcela)} (${((tem_parcela/total)*100).toFixed(1)}%)`);
      console.log(`  Operadora: ${chalk.cyan(tem_operadora)} (${((tem_operadora/total)*100).toFixed(1)}%)`);
      console.log(`  Taxa Cartão: ${chalk.cyan(tem_taxa)} (${((tem_taxa/total)*100).toFixed(1)}%)`);
      console.log(`  Data Cartão: ${chalk.cyan(tem_data)} (${((tem_data/total)*100).toFixed(1)}%)`);
      console.log(`  Autorização: ${chalk.cyan(tem_autorizacao)} (${((tem_autorizacao/total)*100).toFixed(1)}%)`);
    }

    // 5. Verificar se existe controle de "baixa parcial"
    console.log(chalk.blue('\n═══ 5. ANÁLISE: RECEBIMENTOS PARCIAIS ═══\n'));
    
    const parciaisQuery = `
      SELECT 
        COUNT(*) as total_titulos_parciais,
        AVG(percent_recebido) as media_percent_recebido
      FROM (
        SELECT 
          r.cod_receb,
          (SUM(f.valor) / r.valor_pgto * 100) as percent_recebido
        FROM GERAL.DBRECEB r
        JOIN GERAL.DBFRECEB f ON r.cod_receb = f.cod_receb
        WHERE r.valor_pgto > 0
          AND ROWNUM <= 1000
        GROUP BY r.cod_receb, r.valor_pgto
        HAVING SUM(f.valor) < r.valor_pgto
          AND SUM(f.valor) > 0
      )
    `;
    const parciais = await connection.execute(parciaisQuery);
    
    if (parciais.rows.length > 0 && parciais.rows[0][0] > 0) {
      const [total, media] = parciais.rows[0];
      console.log(chalk.yellow('Recebimentos parciais detectados:'));
      console.log(`  Total de títulos com recebimento parcial: ${chalk.cyan(total)}`);
      console.log(`  Média de % recebido: ${chalk.cyan(parseFloat(media).toFixed(2) + '%')}`);
      console.log(chalk.green('\n  ✓ Sistema SUPORTA recebimentos parciais múltiplos!'));
    } else {
      console.log(chalk.gray('Nenhum recebimento parcial detectado nos últimos registros.'));
    }

    console.log(chalk.green('\n✅ Análise concluída!\n'));

  } catch (err) {
    console.error(chalk.red('❌ Erro:'), err.message);
    console.error(err.stack);
  } finally {
    if (connection) {
      await connection.close();
      console.log(chalk.gray('Conexão fechada.'));
    }
  }
}

verificarRecebimentosMultiplos();

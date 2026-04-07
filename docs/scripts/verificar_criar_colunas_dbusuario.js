import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function verificarCriarColunas() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    console.log('='.repeat(80));
    console.log('VERIFICAÇÃO E CRIAÇÃO DE COLUNAS NA TABELA DBUSUARIO');
    console.log('='.repeat(80));
    console.log('\n');
    
    // 1. Verificar se a tabela existe
    const tabelaExiste = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'db_manaus' 
        AND table_name = 'dbusuario'
      );
    `);
    
    if (!tabelaExiste.rows[0].exists) {
      console.log('❌ Tabela db_manaus.dbusuario não existe!');
      console.log('Por favor, crie a tabela primeiro.');
      process.exit(1);
    }
    
    console.log('✓ Tabela db_manaus.dbusuario encontrada\n');
    
    // 2. Consultar colunas existentes
    console.log('Consultando estrutura atual da tabela...\n');
    
    const colunasAtuais = await pool.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'db_manaus' 
        AND table_name = 'dbusuario'
      ORDER BY ordinal_position
    `);
    
    console.log('Colunas existentes na tabela db_manaus.dbusuario:');
    console.log('-'.repeat(80));
    
    const colunasExistentesMap = new Map();
    
    colunasAtuais.rows.forEach(col => {
      colunasExistentesMap.set(col.column_name.toLowerCase(), col);
      const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      console.log(`${col.column_name.padEnd(25)} ${col.data_type}${length.padEnd(15)} ${nullable}`);
    });
    
    console.log('\nTotal de colunas existentes:', colunasAtuais.rows.length);
    console.log('\n');
    
    // 3. Definir colunas que devem existir
    const colunasDesejadas = [
      {
        nome: 'codusr',
        tipo: 'VARCHAR(20)',
        descricao: 'Chave primária (ID do usuário)',
        nullable: false
      },
      {
        nome: 'stusr',
        tipo: 'CHAR(1)',
        descricao: 'Status de conexão (T para conectado, F para offline)',
        nullable: true,
        default: "'F'"
      },
      {
        nome: 'ip_logado',
        tipo: 'VARCHAR(50)',
        descricao: 'Rastreabilidade de onde o usuário acessou',
        nullable: true
      },
      {
        nome: 'bloqueado',
        tipo: 'CHAR(1)',
        descricao: 'Flag de bloqueio (T/F)',
        nullable: true,
        default: "'F'"
      },
      {
        nome: 'data_ini_bloq',
        tipo: 'TIMESTAMP',
        descricao: 'Data início do bloqueio',
        nullable: true
      },
      {
        nome: 'data_fim_bloq',
        tipo: 'TIMESTAMP',
        descricao: 'Data fim do bloqueio',
        nullable: true
      }
    ];
    
    // 4. Verificar quais colunas faltam
    console.log('Verificando colunas necessárias...\n');
    console.log('-'.repeat(80));
    
    const colunasFaltantes = [];
    
    for (const coluna of colunasDesejadas) {
      const existe = colunasExistentesMap.has(coluna.nome.toLowerCase());
      
      if (existe) {
        console.log(`✓ ${coluna.nome.padEnd(20)} - ${coluna.descricao}`);
      } else {
        console.log(`✗ ${coluna.nome.padEnd(20)} - ${coluna.descricao} [FALTANDO]`);
        colunasFaltantes.push(coluna);
      }
    }
    
    console.log('\n');
    
    // 5. Criar colunas faltantes
    if (colunasFaltantes.length === 0) {
      console.log('✓ Todas as colunas necessárias já existem!');
      console.log('\n');
      process.exit(0);
    }
    
    console.log('='.repeat(80));
    console.log(`CRIANDO ${colunasFaltantes.length} COLUNA(S) FALTANTE(S)`);
    console.log('='.repeat(80));
    console.log('\n');
    
    for (const coluna of colunasFaltantes) {
      try {
        const nullable = coluna.nullable ? 'NULL' : 'NOT NULL';
        const defaultValue = coluna.default ? `DEFAULT ${coluna.default}` : '';
        
        const sql = `
          ALTER TABLE db_manaus.dbusuario 
          ADD COLUMN ${coluna.nome} ${coluna.tipo} ${defaultValue} ${nullable}
        `;
        
        console.log(`Criando coluna: ${coluna.nome}`);
        console.log(`SQL: ${sql.trim()}`);
        
        await pool.query(sql);
        
        console.log(`✓ Coluna ${coluna.nome} criada com sucesso!`);
        console.log(`  Descrição: ${coluna.descricao}`);
        console.log(`  Tipo: ${coluna.tipo}`);
        console.log('\n');
        
      } catch (error) {
        console.error(`❌ Erro ao criar coluna ${coluna.nome}:`, error.message);
        console.log('\n');
      }
    }
    
    // 6. Verificar estrutura final
    console.log('='.repeat(80));
    console.log('ESTRUTURA FINAL DA TABELA');
    console.log('='.repeat(80));
    console.log('\n');
    
    const estruturaFinal = await pool.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'db_manaus' 
        AND table_name = 'dbusuario'
      ORDER BY ordinal_position
    `);
    
    estruturaFinal.rows.forEach(col => {
      const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
      console.log(`${col.column_name.padEnd(25)} ${col.data_type}${length.padEnd(15)} ${nullable}${defaultVal}`);
    });
    
    console.log('\nTotal de colunas:', estruturaFinal.rows.length);
    console.log('\n✓ Processo concluído com sucesso!');
    console.log('='.repeat(80));
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Erro ao executar script:', error);
    console.error('\nDetalhes:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verificarCriarColunas();

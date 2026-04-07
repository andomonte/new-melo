import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import { Pool } from 'pg';

const dbUrl = process.env.DATABASE_URL_MANAUS || process.env.DATABASE_URL_DEFAULT;
const pool = new Pool({ connectionString: dbUrl, max: 2 });

async function main() {
  const client = await pool.connect();

  try {
    console.log('Criando tabela sugestoes_compra...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS sugestoes_compra (
        id SERIAL PRIMARY KEY,
        produto_cod VARCHAR(50) NOT NULL,
        produto_descricao VARCHAR(255),
        quantidade_sugerida NUMERIC(15,3) DEFAULT 1,
        data_sugestao TIMESTAMP DEFAULT NOW(),
        data_necessidade DATE,
        usuario_cod VARCHAR(50),
        usuario_nome VARCHAR(255),
        observacao TEXT,
        status VARCHAR(50) DEFAULT 'PENDENTE',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('Tabela sugestoes_compra criada com sucesso!');

    // Criar índice para busca por produto
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sugestoes_compra_produto
      ON sugestoes_compra(produto_cod)
    `);

    console.log('Índice criado!');

    // Verificar estrutura
    const r = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'sugestoes_compra'
      ORDER BY ordinal_position
    `);

    console.log('\nEstrutura da tabela:');
    r.rows.forEach(row => console.log(`  ${row.column_name} (${row.data_type})`));

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);

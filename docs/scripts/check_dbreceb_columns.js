import { Pool } from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const getPgPool = () => new Pool({ connectionString: process.env.DATABASE_URL });

export async function checkColumns() {
  const pool = getPgPool();

  const tables = [
    {
      schema: 'db_manaus',
      table: 'dbfreceb',
      expected: [
        'cod_freceb','cod_receb','codopera','dt_cartao','tx_cartao','nro_cheque','nome','cod_bc',
        'valor','tipo','sf','cxgeral','dt_pgto','dt_venc','dt_emissao','fre_cof_id',
        'cmc7','id_autenticacao','codusr','cod_conta','parcela','coddocumento','codautorizacao'
      ]
    },
    {
      schema: 'db_manaus',
      table: 'dbprereceb',
      expected: ['cod_receb','dt_pgto','valor_rec','cod_conta','rec']
    },
    {
      schema: 'db_manaus',
      table: 'dbreceb',
      expected: [
        'cod_receb','nro_doc','cod_fat','codcli','valor_pgto','valor_rec','dt_emissao',
        'dt_venc','dt_pgto','venc_ant','rec','cancel','tipo','forma_fat','cod_conta','bradesco','nro_banco'
      ]
    }
  ];

  try {
    for (const t of tables) {
      console.log(`\n=== Verificando ${t.schema}.${t.table} ===`);

      const colsRes = await pool.query(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`,
        [t.schema, t.table]
      );

      if (!colsRes.rows.length) {
        console.warn(`Tabela ${t.schema}.${t.table} não encontrada ou sem colunas.`);
        continue;
      }

      const existing = colsRes.rows.map(r => r.column_name);
      console.log('Colunas existentes:', existing);

      // Mostrar tipos também
      console.log('Colunas (name:type):', colsRes.rows.map(r => `${r.column_name}:${r.data_type}`).join(', '));

      // Sample rows
      try {
        const sample = await pool.query(`SELECT * FROM ${t.schema}.${t.table} LIMIT 5`);
        console.log(`Sample ${t.table}:`, sample.rows);
      } catch (e) {
        console.warn(`Não foi possível buscar linhas de amostra para ${t.schema}.${t.table}:`, e.message);
      }

      // Verificar colunas esperadas
      const lowerExisting = new Set(existing.map(c => c.toLowerCase()));
      const missing = t.expected.filter(exp => !lowerExisting.has(String(exp).toLowerCase()));
      const presentExpected = t.expected.filter(exp => lowerExisting.has(String(exp).toLowerCase()));

      if (missing.length) {
        console.warn('Colunas esperadas ausentes:', missing);
      } else {
        console.log('Todas as colunas esperadas foram encontradas.');
      }

      // Mostrar colunas extra (present but not in expected list)
      const expectedLower = new Set(t.expected.map(e => String(e).toLowerCase()));
      const extras = existing.filter(c => !expectedLower.has(c.toLowerCase()));
      if (extras.length) {
        console.log('Colunas extras (existentes mas não esperadas):', extras);
      }
    }
  } catch (error) {
    console.error('Erro ao verificar colunas:', error);
  } finally {
    await (await getPgPool()).end();
  }
}

// Executa quando chamado diretamente
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  checkColumns();
}

export default checkColumns;

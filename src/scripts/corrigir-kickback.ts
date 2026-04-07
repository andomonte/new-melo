import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import { Pool } from 'pg';

const dbUrl = process.env.DATABASE_URL_MANAUS || process.env.DATABASE_URL_DEFAULT;
const pool = new Pool({ connectionString: dbUrl, max: 2 });

async function main() {
  const client = await pool.connect();
  try {
    // Preço do cliente tipo 1 é R$ 66.80
    // Vou criar kickback com 20% de desconto = R$ 53.44
    const novoPrecoKickback = 66.80 * 0.80;

    await client.query(
      `UPDATE dbprecokb SET dscbalcao45 = $1 WHERE btrim(codprod::text) = $2`,
      [novoPrecoKickback, '119842']
    );

    // Verificar
    const result = await client.query(
      `SELECT dscbalcao45 FROM dbprecokb WHERE btrim(codprod::text) = $1`,
      ['119842']
    );

    console.log('Preço kickback atualizado para: R$', Number(result.rows[0].dscbalcao45).toFixed(2));
    console.log('(20% de desconto sobre R$ 66.80)');
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(console.error);

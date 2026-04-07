/**
 * Script para verificar os preços corretos por tipo de cliente
 *
 * Executar com: npx tsx src/scripts/verificar-precos.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { Pool, PoolClient } from 'pg';

const dbUrl = process.env.DATABASE_URL_MANAUS || process.env.DATABASE_URL_DEFAULT;
const pool = new Pool({ connectionString: dbUrl, max: 2 });

async function main() {
  const client = await pool.connect();

  try {
    // Produtos de teste
    const codprod1 = '412503';  // produto com promoção
    const codprod2 = '119842';  // produto com kickback

    // Cliente de teste
    const codcli = '34902';

    console.log('\n' + '='.repeat(70));
    console.log(' VERIFICAÇÃO DE PREÇOS POR TIPO DE CLIENTE');
    console.log('='.repeat(70));

    // 1. Buscar info do cliente
    const clienteResult = await client.query(`
      SELECT codcli, nome, prvenda, COALESCE(kickback, 0) as kickback
      FROM dbclien
      WHERE codcli = $1
    `, [codcli]);

    if (clienteResult.rows.length === 0) {
      console.log(`Cliente ${codcli} não encontrado!`);
      return;
    }

    const cliente = clienteResult.rows[0];
    console.log(`\nCliente: ${cliente.codcli} - ${cliente.nome}`);
    console.log(`Tipo Preço (prvenda): ${cliente.prvenda}`);
    console.log(`Kickback habilitado: ${cliente.kickback == 1 ? 'SIM' : 'NÃO'}`);

    // 2. Buscar todos os preços do produto 1
    console.log('\n' + '-'.repeat(70));
    console.log(`PRODUTO 1: ${codprod1}`);
    console.log('-'.repeat(70));

    const precos1 = await client.query(`
      SELECT
        fp."CODPROD",
        fp."TIPOPRECO",
        fp."PRECOVENDA"
      FROM dbformacaoprvenda fp
      WHERE btrim(fp."CODPROD"::text) = $1
      ORDER BY fp."TIPOPRECO"::integer
    `, [codprod1]);

    console.log('\nPreços por tipo de cliente:');
    for (const p of precos1.rows) {
      const marcador = p.TIPOPRECO == cliente.prvenda ? ' <-- PREÇO DESTE CLIENTE' : '';
      console.log(`  Tipo ${p.TIPOPRECO}: R$ ${Number(p.PRECOVENDA).toFixed(2)}${marcador}`);
    }

    // 3. Buscar promoção ativa
    const promo1 = await client.query(`
      SELECT dpi.valor_desconto_item, dpi.tipo_desconto_item, dp.nome_promocao
      FROM dbpromocao_item dpi
      JOIN dbpromocao dp ON dpi.id_promocao = dp.id_promocao
      WHERE dp.ativa = TRUE
        AND CURRENT_TIMESTAMP BETWEEN dp.data_inicio AND dp.data_fim
        AND dpi.codprod = $1
      LIMIT 1
    `, [codprod1]);

    if (promo1.rows.length > 0) {
      const promo = promo1.rows[0];
      console.log(`\nPromoção ativa: ${promo.nome_promocao}`);
      console.log(`  Desconto: ${promo.valor_desconto_item}% (${promo.tipo_desconto_item})`);

      // Calcular preço com promoção
      const precoCliente = precos1.rows.find(p => p.TIPOPRECO == cliente.prvenda);
      if (precoCliente) {
        const precoOriginal = Number(precoCliente.PRECOVENDA);
        const precoPromo = precoOriginal * (1 - Number(promo.valor_desconto_item) / 100);
        console.log(`  Preço original: R$ ${precoOriginal.toFixed(2)}`);
        console.log(`  Preço com promoção: R$ ${precoPromo.toFixed(2)}`);
      }
    } else {
      console.log('\nNenhuma promoção ativa para este produto.');
    }

    // 4. Buscar preços do produto 2
    console.log('\n' + '-'.repeat(70));
    console.log(`PRODUTO 2: ${codprod2}`);
    console.log('-'.repeat(70));

    const precos2 = await client.query(`
      SELECT
        fp."CODPROD",
        fp."TIPOPRECO",
        fp."PRECOVENDA"
      FROM dbformacaoprvenda fp
      WHERE btrim(fp."CODPROD"::text) = $1
      ORDER BY fp."TIPOPRECO"::integer
    `, [codprod2]);

    console.log('\nPreços por tipo de cliente:');
    for (const p of precos2.rows) {
      const marcador = p.TIPOPRECO == cliente.prvenda ? ' <-- PREÇO DESTE CLIENTE' : '';
      console.log(`  Tipo ${p.TIPOPRECO}: R$ ${Number(p.PRECOVENDA).toFixed(2)}${marcador}`);
    }

    // 5. Buscar preço kickback
    const kickback2 = await client.query(`
      SELECT dscbalcao45 as preco_kickback
      FROM dbprecokb
      WHERE btrim(codprod::text) = $1
        AND dscbalcao45 IS NOT NULL AND dscbalcao45 > 0
    `, [codprod2]);

    if (kickback2.rows.length > 0) {
      const kb = kickback2.rows[0];
      console.log(`\nPreço Kickback: R$ ${Number(kb.preco_kickback).toFixed(2)}`);

      const precoCliente = precos2.rows.find(p => p.TIPOPRECO == cliente.prvenda);
      if (precoCliente) {
        console.log(`  Preço original cliente: R$ ${Number(precoCliente.PRECOVENDA).toFixed(2)}`);
        console.log(`  Preço kickback: R$ ${Number(kb.preco_kickback).toFixed(2)}`);
      }
    } else {
      console.log('\nNenhum preço kickback cadastrado para este produto.');
    }

    console.log('\n' + '='.repeat(70));

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);

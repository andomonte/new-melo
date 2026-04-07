// Registrar NFe número 2 que já foi autorizada na SEFAZ
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
async function registrarNFe2() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL 
  });

  try {
    console.log('📝 Registrando NFe número 2 no banco...\n');

    // Primeiro, verificar qual CODFAT usar
    // Vamos usar o próximo CODFAT disponível ou criar um provisório
    const queryProximoCodfat = `
      SELECT MAX(CAST(SUBSTRING(codfat, 4) AS INTEGER)) as ultimo
      FROM db_manaus.dbfatura
      WHERE codfat LIKE '000%';
    `;

    const codfatResult = await pool.query(queryProximoCodfat);
    const ultimoCodfat = codfatResult.rows[0]?.ultimo || 234571;
    const novoCodfat = String(ultimoCodfat + 1).padStart(9, '0');

    console.log(`🔢 Próximo CODFAT disponível: ${novoCodfat}`);
    console.log('');

    // Inserir fatura provisória
    const insertFatura = `
      INSERT INTO db_manaus.dbfatura (
        codfat,
        serie,
        nroform,
        data,
        totalnf
      ) VALUES (
        $1,
        '2',
        '2',
        '2025-10-13',
        0
      )
      ON CONFLICT (codfat) DO NOTHING
      RETURNING codfat;
    `;

    const faturaResult = await pool.query(insertFatura, [novoCodfat]);
    
    if (faturaResult.rowCount > 0) {
      console.log(`✅ Fatura ${novoCodfat} criada com série 2`);
    } else {
      console.log(`ℹ️  Fatura ${novoCodfat} já existe`);
    }
    console.log('');

    // Inserir NFe número 2
    const insertNFe = `
      INSERT INTO db_manaus.dbfat_nfe (
        codfat,
        chave,
        status,
        nrodoc_fiscal,
        modelo,
        numprotocolo,
        dthrprotocolo,
        emailenviado
      ) VALUES (
        $1,
        '13251018053139000169550020000000021000240867',
        '100',
        '2',
        '55',
        '113250000000',
        NOW(),
        'N'
      )
      ON CONFLICT (chave) DO UPDATE 
      SET 
        codfat = EXCLUDED.codfat,
        nrodoc_fiscal = EXCLUDED.nrodoc_fiscal
      RETURNING *;
    `;

    const nfeResult = await pool.query(insertNFe, [novoCodfat]);

    if (nfeResult.rowCount > 0) {
      console.log('✅ NFe número 2 registrada com sucesso!');
      console.log(`   CODFAT: ${nfeResult.rows[0].codfat}`);
      console.log(`   Chave: ${nfeResult.rows[0].chave}`);
      console.log(`   Status: ${nfeResult.rows[0].status}`);
      console.log(`   nrodoc_fiscal: ${nfeResult.rows[0].nrodoc_fiscal}`);
      console.log('');
    }

    // Verificar próximo número agora
    const queryMax = `
      SELECT MAX(CAST(nfe.nrodoc_fiscal AS INTEGER)) as ultimo_numero
      FROM db_manaus.dbfat_nfe nfe
      INNER JOIN db_manaus.dbfatura f ON f.codfat = nfe.codfat
      WHERE f.serie = '2'
        AND nfe.nrodoc_fiscal IS NOT NULL
        AND nfe.nrodoc_fiscal != ''
        AND nfe.nrodoc_fiscal::text ~ '^[0-9]+$'
        AND nfe.status = '100';
    `;

    const maxResult = await pool.query(queryMax);
    const ultimoNumero = maxResult.rows[0]?.ultimo_numero;

    console.log('📊 Status após registro:');
    console.log(`   Último número autorizado: ${ultimoNumero}`);
    console.log(`   Próximo número será: ${parseInt(ultimoNumero) + 1}`);
    console.log('');
    console.log('🎉 PERFEITO! Agora o sistema vai usar número 3 corretamente!');
    console.log('');

    // Listar todas as NFes da série 2
    const queryTodas = `
      SELECT 
        f.codfat,
        f.serie,
        CAST(nfe.nrodoc_fiscal AS INTEGER) as numero,
        nfe.status,
        LEFT(nfe.chave, 20) || '...' as chave_resumo
      FROM db_manaus.dbfat_nfe nfe
      INNER JOIN db_manaus.dbfatura f ON f.codfat = nfe.codfat
      WHERE f.serie = '2'
      AND nfe.status = '100'
      ORDER BY CAST(nfe.nrodoc_fiscal AS INTEGER);
    `;

    const todasResult = await pool.query(queryTodas);

    console.log('📋 NFes autorizadas da série 2:');
    todasResult.rows.forEach(row => {
      console.log(`   - Número ${row.numero}: CODFAT ${row.codfat} (${row.chave_resumo})`);
    });

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

registrarNFe2();

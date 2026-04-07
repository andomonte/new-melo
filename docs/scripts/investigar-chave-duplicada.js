const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function investigarChaveDuplicada() {
  const client = await pool.connect();
  
  try {
    console.log('\n🔍 INVESTIGAÇÃO DE DUPLICIDADE DE CHAVE NFe\n');
    console.log('=' .repeat(80));
    
    // 1. Chave rejeitada pela SEFAZ
    const chaveRejeitada = '13251018053139000169550020965038311383102010';
    console.log('\n📋 CHAVE REJEITADA PELA SEFAZ:');
    console.log(`Chave: ${chaveRejeitada}`);
    
    // Decodificar a chave
    const uf = chaveRejeitada.substring(0, 2);
    const aamm = chaveRejeitada.substring(2, 6);
    const cnpj = chaveRejeitada.substring(6, 20);
    const mod = chaveRejeitada.substring(20, 22);
    const serie = chaveRejeitada.substring(22, 25);
    const numero = chaveRejeitada.substring(25, 34);
    const tpEmis = chaveRejeitada.substring(34, 35);
    const cNF = chaveRejeitada.substring(35, 43);
    const dv = chaveRejeitada.substring(43, 44);
    
    console.log('\n🔑 DECODIFICAÇÃO DA CHAVE:');
    console.log(`  UF: ${uf} (Amazonas = 13)`);
    console.log(`  AAMM: ${aamm} (Ano/Mês)`);
    console.log(`  CNPJ: ${cnpj}`);
    console.log(`  Modelo: ${mod} (55 = NFe)`);
    console.log(`  Série: ${serie}`);
    console.log(`  Número: ${numero} (${parseInt(numero)})`);
    console.log(`  Tipo Emissão: ${tpEmis}`);
    console.log(`  Código NFe: ${cNF}`);
    console.log(`  DV: ${dv}`);
    
    // 2. Buscar todas as NFes da série 2
    console.log('\n\n📊 TODAS AS NFes DA SÉRIE 2 NO BANCO:');
    console.log('=' .repeat(80));
    
    const queryNFes = `
      SELECT 
        nfe.codfat,
        nfe.nrodoc_fiscal,
        nfe.chave,
        nfe.status,
        f.serie,
        f.data,
        f.codcli
      FROM db_manaus.dbfat_nfe nfe
      INNER JOIN db_manaus.dbfatura f ON f.codfat = nfe.codfat
      WHERE f.serie = '2'
      ORDER BY nfe.nrodoc_fiscal::integer ASC
    `;
    
    const nfesResult = await client.query(queryNFes);
    
    if (nfesResult.rows.length === 0) {
      console.log('❌ Nenhuma NFe encontrada na série 2');
    } else {
      console.log(`✅ Encontradas ${nfesResult.rows.length} NFes na série 2:\n`);
      
      nfesResult.rows.forEach(nfe => {
        console.log(`Fatura: ${nfe.codfat} | Número: ${nfe.nrodoc_fiscal} | Status: ${nfe.status}`);
        if (nfe.chave) {
          const nfeNumero = nfe.chave.substring(25, 34);
          const nfeSerie = nfe.chave.substring(22, 25);
          const nfeCNF = nfe.chave.substring(35, 43);
          console.log(`  Chave: ${nfe.chave}`);
          console.log(`  Série na chave: ${nfeSerie} | Número na chave: ${parseInt(nfeNumero)} | cNF: ${nfeCNF}`);
        } else {
          console.log(`  ⚠️  Sem chave registrada`);
        }
        console.log('');
      });
    }
    
    // 3. Verificar se há chave duplicada no banco
    console.log('\n🔎 VERIFICANDO DUPLICAÇÃO DE CHAVE NO BANCO:');
    console.log('=' .repeat(80));
    
    const queryDuplicadas = `
      SELECT chave, COUNT(*) as total
      FROM db_manaus.dbfat_nfe
      WHERE chave IS NOT NULL AND chave != ''
      GROUP BY chave
      HAVING COUNT(*) > 1
    `;
    
    const duplicadasResult = await client.query(queryDuplicadas);
    
    if (duplicadasResult.rows.length > 0) {
      console.log(`❌ ENCONTRADAS ${duplicadasResult.rows.length} CHAVES DUPLICADAS:\n`);
      duplicadasResult.rows.forEach(dup => {
        console.log(`Chave: ${dup.chave} - Repetida ${dup.total} vezes`);
      });
    } else {
      console.log('✅ Não há chaves duplicadas no banco local');
    }
    
    // 4. Buscar a chave específica rejeitada
    console.log('\n\n🎯 BUSCANDO CHAVE ESPECÍFICA REJEITADA:');
    console.log('=' .repeat(80));
    
    const queryChaveEspecifica = `
      SELECT 
        nfe.*,
        f.serie,
        f.data,
        f.codcli
      FROM db_manaus.dbfat_nfe nfe
      INNER JOIN db_manaus.dbfatura f ON f.codfat = nfe.codfat
      WHERE nfe.chave = $1
    `;
    
    const chaveResult = await client.query(queryChaveEspecifica, [chaveRejeitada]);
    
    if (chaveResult.rows.length > 0) {
      console.log(`❌ CHAVE JÁ EXISTE NO BANCO (${chaveResult.rows.length}x):\n`);
      chaveResult.rows.forEach(nfe => {
        console.log(`Fatura: ${nfe.codfat}`);
        console.log(`Número Fiscal: ${nfe.nrodoc_fiscal}`);
        console.log(`Status: ${nfe.status}`);
        console.log(`Série: ${nfe.serie}`);
        console.log(`Data: ${nfe.data}`);
        console.log('');
      });
    } else {
      console.log('✅ Chave rejeitada NÃO existe no banco local');
      console.log('⚠️  Isso significa que a SEFAZ está rejeitando por duplicidade em outro lugar!');
    }
    
    // 5. Analisar padrão de geração de cNF
    console.log('\n\n🔢 ANÁLISE DO CÓDIGO NFe (cNF):');
    console.log('=' .repeat(80));
    
    const nfesComChave = nfesResult.rows.filter(n => n.chave);
    if (nfesComChave.length > 0) {
      console.log('\nCódigos NFe (cNF) utilizados:\n');
      nfesComChave.forEach(nfe => {
        const cNFUsado = nfe.chave.substring(35, 43);
        console.log(`Número ${nfe.nrodoc_fiscal.padStart(9, '0')} - cNF: ${cNFUsado}`);
      });
      
      // Verificar se há cNF duplicados
      const cNFs = nfesComChave.map(n => n.chave.substring(35, 43));
      const cNFsDuplicados = cNFs.filter((item, index) => cNFs.indexOf(item) !== index);
      
      if (cNFsDuplicados.length > 0) {
        console.log('\n❌ cNFs DUPLICADOS ENCONTRADOS:');
        [...new Set(cNFsDuplicados)].forEach(cnf => {
          console.log(`  cNF ${cnf} aparece múltiplas vezes`);
        });
      } else {
        console.log('\n✅ Todos os cNFs são únicos');
      }
    }
    
    // 6. Verificar último número utilizado
    console.log('\n\n📈 ÚLTIMO NÚMERO UTILIZADO:');
    console.log('=' .repeat(80));
    
    const queryUltimoNumero = `
      SELECT 
        MAX(CAST(nfe.nrodoc_fiscal AS INTEGER)) as ultimo_numero,
        COUNT(*) as total_nfes
      FROM db_manaus.dbfat_nfe nfe
      INNER JOIN db_manaus.dbfatura f ON f.codfat = nfe.codfat
      WHERE f.serie = '2'
        AND nfe.status = '100'
    `;
    
    const ultimoResult = await client.query(queryUltimoNumero);
    const ultimo = ultimoResult.rows[0];
    
    console.log(`\nÚltimo número autorizado: ${ultimo.ultimo_numero || 'N/A'}`);
    console.log(`Total de NFes autorizadas: ${ultimo.total_nfes}`);
    console.log(`Próximo número deveria ser: ${(ultimo.ultimo_numero || 0) + 1}`);
    
    console.log('\n\n💡 RECOMENDAÇÕES:');
    console.log('=' .repeat(80));
    console.log('1. O problema de duplicidade está na geração da chave de acesso');
    console.log('2. O cNF (código numérico) pode estar sendo reutilizado');
    console.log('3. Verifique o arquivo que gera a chave NFe (provavelmente em emitir.ts)');
    console.log('4. O cNF deve ser único e aleatório para cada NFe');
    console.log('5. Considere usar: Math.floor(Math.random() * 99999999).toString().padStart(8, "0")');
    
  } catch (error) {
    console.error('\n❌ Erro na investigação:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

investigarChaveDuplicada();

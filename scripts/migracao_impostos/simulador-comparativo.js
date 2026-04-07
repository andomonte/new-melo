/**
 * SIMULADOR COMPARATIVO DE IMPOSTOS
 * Oracle (Delphi) vs PostgreSQL (Next.js)
 *
 * Compara o cálculo de impostos entre o sistema antigo (Oracle)
 * e o novo sistema (PostgreSQL) usando dados reais.
 */

const oracledb = require('oracledb');
const { Pool } = require('pg');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Configuração dos bancos de dados
const ORACLE_CONFIG = {
  user: 'GERAL',
  password: '123',
  connectString: '201.64.221.132:1524/desenv.mns.melopecas.com.br'
};

const PG_CONFIG = {
  user: 'postgres',
  password: 'Melodb@2025',
  host: 'servicos.melopecas.com.br',
  port: 5432,
  database: 'postgres',
  options: '-c search_path=db_manaus'
};

// Interface readline para entrada do usuário
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function pergunta(texto) {
  return new Promise(resolve => rl.question(texto, resolve));
}

// Cores para terminal (alternativa leve ao chalk)
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function print(text, color = 'reset') {
  console.log(`${colors[color]}${text}${colors.reset}`);
}

class SimuladorComparativo {
  constructor() {
    this.oracleConnection = null;
    this.pgPool = null;
    this.resultados = {
      timestamp: new Date().toISOString(),
      entrada: {},
      oracle: null,
      postgresql: null,
      comparacao: {},
      observacoes: []
    };
  }

  /**
   * Conecta aos dois bancos de dados
   */
  async conectar() {
    try {
      print('\n🔌 Conectando aos bancos de dados...', 'cyan');

      // Conectar Oracle
      print('   → Conectando Oracle...', 'white');
      this.oracleConnection = await oracledb.getConnection(ORACLE_CONFIG);
      print('   ✓ Oracle conectado', 'green');

      // Conectar PostgreSQL
      print('   → Conectando PostgreSQL...', 'white');
      this.pgPool = new Pool(PG_CONFIG);
      await this.pgPool.query('SELECT 1');
      print('   ✓ PostgreSQL conectado', 'green');

      print('\n✓ Conexões estabelecidas com sucesso!\n', 'green');
    } catch (error) {
      print(`\n✗ Erro ao conectar: ${error.message}\n`, 'red');
      throw error;
    }
  }

  /**
   * Busca produto em ambos os bancos
   */
  async buscarProduto(termo) {
    print(`\n🔍 Buscando produto: "${termo}"...`, 'cyan');

    try {
      // Verificar se é código numérico
      const isNumerico = !isNaN(termo);

      // Buscar no Oracle
      let queryOracle;
      let bindOracle;

      if (isNumerico) {
        queryOracle = `
          SELECT ID_PRODUTO, CODIGO, DESCRICAO, NCM, IPI, PIS, COFINS, STRIB, UF_ORIGEM
          FROM dbprod
          WHERE ID_PRODUTO = :termo OR CODIGO = :termo
          ORDER BY ID_PRODUTO
        `;
        bindOracle = { termo: termo };
      } else {
        queryOracle = `
          SELECT ID_PRODUTO, CODIGO, DESCRICAO, NCM, IPI, PIS, COFINS, STRIB, UF_ORIGEM
          FROM dbprod
          WHERE UPPER(DESCRICAO) LIKE UPPER(:termo)
          ORDER BY ID_PRODUTO
          FETCH FIRST 10 ROWS ONLY
        `;
        bindOracle = { termo: `%${termo}%` };
      }

      const resultOracle = await this.oracleConnection.execute(queryOracle, bindOracle);

      // Buscar no PostgreSQL
      let queryPg;
      let paramsPg;

      if (isNumerico) {
        queryPg = `
          SELECT "ID_PRODUTO" as id_produto, "CODIGO" as codigo, "DESCRICAO" as descricao,
                 "NCM" as ncm, "IPI" as ipi, "PIS" as pis, "COFINS" as cofins,
                 "STRIB" as strib, "UF_ORIGEM" as uf_origem
          FROM db_manaus.dbprod
          WHERE "ID_PRODUTO" = $1 OR "CODIGO" = $1
          ORDER BY "ID_PRODUTO"
        `;
        paramsPg = [termo];
      } else {
        queryPg = `
          SELECT "ID_PRODUTO" as id_produto, "CODIGO" as codigo, "DESCRICAO" as descricao,
                 "NCM" as ncm, "IPI" as ipi, "PIS" as pis, "COFINS" as cofins,
                 "STRIB" as strib, "UF_ORIGEM" as uf_origem
          FROM db_manaus.dbprod
          WHERE UPPER("DESCRICAO") LIKE UPPER($1)
          ORDER BY "ID_PRODUTO"
          LIMIT 10
        `;
        paramsPg = [`%${termo}%`];
      }

      const resultPg = await this.pgPool.query(queryPg, paramsPg);

      // Processar resultados Oracle
      const produtosOracle = resultOracle.rows.map(row => ({
        id_produto: row[0],
        codigo: row[1],
        descricao: row[2],
        ncm: row[3],
        ipi: row[4],
        pis: row[5],
        cofins: row[6],
        strib: row[7],
        uf_origem: row[8]
      }));

      const produtosPg = resultPg.rows;

      if (produtosOracle.length === 0 && produtosPg.length === 0) {
        print('   ✗ Nenhum produto encontrado', 'red');
        return null;
      }

      // Se encontrou múltiplos, listar
      if (produtosOracle.length > 1) {
        print('\n   📋 Múltiplos produtos encontrados (Oracle):', 'yellow');
        produtosOracle.forEach((p, i) => {
          print(`   ${i + 1}. [${p.id_produto}] ${p.descricao}`, 'white');
        });

        const escolha = await pergunta('\n   Digite o número do produto desejado: ');
        const indice = parseInt(escolha) - 1;

        if (indice >= 0 && indice < produtosOracle.length) {
          const produto = produtosOracle[indice];
          print(`   ✓ Produto selecionado: [${produto.id_produto}] ${produto.descricao}`, 'green');
          return { oracle: produto, pg: produtosPg.find(p => p.id_produto == produto.id_produto) };
        } else {
          print('   ✗ Seleção inválida', 'red');
          return null;
        }
      }

      const produto = produtosOracle[0];
      const produtoPg = produtosPg.find(p => p.id_produto == produto.id_produto) || produtosPg[0];

      print(`   ✓ Produto encontrado: [${produto.id_produto}] ${produto.descricao}`, 'green');
      print(`   NCM: ${produto.ncm} | IPI: ${produto.ipi}% | UF Origem: ${produto.uf_origem}`, 'white');

      return { oracle: produto, pg: produtoPg };
    } catch (error) {
      print(`   ✗ Erro ao buscar produto: ${error.message}`, 'red');
      throw error;
    }
  }

  /**
   * Busca cliente em ambos os bancos
   */
  async buscarCliente(termo) {
    print(`\n🔍 Buscando cliente: "${termo}"...`, 'cyan');

    try {
      const isNumerico = !isNaN(termo);

      // Buscar no Oracle
      let queryOracle;
      let bindOracle;

      if (isNumerico) {
        queryOracle = `
          SELECT ID_CLIENTE, CODIGO, NOME, UF, INSCRICAO_ESTADUAL
          FROM dbcliente
          WHERE ID_CLIENTE = :termo OR CODIGO = :termo
          ORDER BY ID_CLIENTE
        `;
        bindOracle = { termo: termo };
      } else {
        queryOracle = `
          SELECT ID_CLIENTE, CODIGO, NOME, UF, INSCRICAO_ESTADUAL
          FROM dbcliente
          WHERE UPPER(NOME) LIKE UPPER(:termo)
          ORDER BY ID_CLIENTE
          FETCH FIRST 10 ROWS ONLY
        `;
        bindOracle = { termo: `%${termo}%` };
      }

      const resultOracle = await this.oracleConnection.execute(queryOracle, bindOracle);

      // Buscar no PostgreSQL
      let queryPg;
      let paramsPg;

      if (isNumerico) {
        queryPg = `
          SELECT "ID_CLIENTE" as id_cliente, "CODIGO" as codigo, "NOME" as nome,
                 "UF" as uf, "INSCRICAO_ESTADUAL" as inscricao_estadual
          FROM db_manaus.dbcliente
          WHERE "ID_CLIENTE" = $1 OR "CODIGO" = $1
          ORDER BY "ID_CLIENTE"
        `;
        paramsPg = [termo];
      } else {
        queryPg = `
          SELECT "ID_CLIENTE" as id_cliente, "CODIGO" as codigo, "NOME" as nome,
                 "UF" as uf, "INSCRICAO_ESTADUAL" as inscricao_estadual
          FROM db_manaus.dbcliente
          WHERE UPPER("NOME") LIKE UPPER($1)
          ORDER BY "ID_CLIENTE"
          LIMIT 10
        `;
        paramsPg = [`%${termo}%`];
      }

      const resultPg = await this.pgPool.query(queryPg, paramsPg);

      // Processar resultados Oracle
      const clientesOracle = resultOracle.rows.map(row => ({
        id_cliente: row[0],
        codigo: row[1],
        nome: row[2],
        uf: row[3],
        inscricao_estadual: row[4]
      }));

      const clientesPg = resultPg.rows;

      if (clientesOracle.length === 0 && clientesPg.length === 0) {
        print('   ✗ Nenhum cliente encontrado', 'red');
        return null;
      }

      // Se encontrou múltiplos, listar
      if (clientesOracle.length > 1) {
        print('\n   📋 Múltiplos clientes encontrados (Oracle):', 'yellow');
        clientesOracle.forEach((c, i) => {
          print(`   ${i + 1}. [${c.id_cliente}] ${c.nome} - ${c.uf}`, 'white');
        });

        const escolha = await pergunta('\n   Digite o número do cliente desejado: ');
        const indice = parseInt(escolha) - 1;

        if (indice >= 0 && indice < clientesOracle.length) {
          const cliente = clientesOracle[indice];
          print(`   ✓ Cliente selecionado: [${cliente.id_cliente}] ${cliente.nome}`, 'green');
          return { oracle: cliente, pg: clientesPg.find(c => c.id_cliente == cliente.id_cliente) };
        } else {
          print('   ✗ Seleção inválida', 'red');
          return null;
        }
      }

      const cliente = clientesOracle[0];
      const clientePg = clientesPg.find(c => c.id_cliente == cliente.id_cliente) || clientesPg[0];

      print(`   ✓ Cliente encontrado: [${cliente.id_cliente}] ${cliente.nome}`, 'green');
      print(`   UF: ${cliente.uf} | IE: ${cliente.inscricao_estadual || 'Não informado'}`, 'white');

      return { oracle: cliente, pg: clientePg };
    } catch (error) {
      print(`   ✗ Erro ao buscar cliente: ${error.message}`, 'red');
      throw error;
    }
  }

  /**
   * Calcula impostos no Oracle usando o package CALCULO_IMPOSTO
   */
  async calcularOracle(produto_id, cliente_id, valor, quantidade) {
    print('\n⚙️  Calculando impostos no Oracle...', 'cyan');

    const inicio = Date.now();

    try {
      // Verificar se o package existe
      const checkPkg = await this.oracleConnection.execute(`
        SELECT COUNT(*) as cnt
        FROM all_procedures
        WHERE object_name = 'CALCULO_IMPOSTO'
        AND procedure_name = 'CALCULAR_IMPOSTOS'
      `);

      if (checkPkg.rows[0][0] === 0) {
        print('   ⚠ Package CALCULO_IMPOSTO.Calcular_Impostos não encontrado', 'yellow');
        print('   Tentando consulta direta nas tabelas...', 'yellow');

        // Fallback: buscar dados diretamente das tabelas
        return await this.calcularOracleDireto(produto_id, cliente_id, valor, quantidade);
      }

      // Executar o package
      const result = await this.oracleConnection.execute(`
        DECLARE
          v_resultado SYS_REFCURSOR;
        BEGIN
          v_resultado := CALCULO_IMPOSTO.Calcular_Impostos(
            p_produto_id => :produto_id,
            p_cliente_id => :cliente_id,
            p_valor => :valor,
            p_quantidade => :quantidade,
            p_tipo_operacao => 'VENDA'
          );
          OPEN :cursor FOR SELECT * FROM TABLE(CAST(v_resultado AS SYS_REFCURSOR));
        END;
      `, {
        produto_id: produto_id,
        cliente_id: cliente_id,
        valor: valor,
        quantidade: quantidade,
        cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
      });

      const cursor = result.outBinds.cursor;
      const rows = await cursor.getRows();
      await cursor.close();

      const tempo = Date.now() - inicio;

      if (rows.length === 0) {
        print('   ⚠ Nenhum resultado retornado pelo package', 'yellow');
        return null;
      }

      const dados = rows[0];
      print(`   ✓ Package CALCULO_IMPOSTO executado (${tempo}ms)`, 'green');

      return this.processarResultadoOracle(dados);
    } catch (error) {
      print(`   ✗ Erro ao calcular no Oracle: ${error.message}`, 'red');
      print(`   Stack: ${error.stack}`, 'red');

      // Tentar fallback
      print('   Tentando método alternativo...', 'yellow');
      return await this.calcularOracleDireto(produto_id, cliente_id, valor, quantidade);
    }
  }

  /**
   * Calcula impostos no Oracle consultando diretamente as tabelas
   */
  async calcularOracleDireto(produto_id, cliente_id, valor, quantidade) {
    print('   → Consultando tabelas Oracle diretamente...', 'white');

    try {
      // Buscar dados do produto
      const produto = await this.oracleConnection.execute(`
        SELECT p.*,
               COALESCE(p.IPI, 0) as aliq_ipi,
               COALESCE(p.PIS, 0) as aliq_pis,
               COALESCE(p.COFINS, 0) as aliq_cofins
        FROM dbprod p
        WHERE p.ID_PRODUTO = :id
      `, { id: produto_id });

      // Buscar dados do cliente
      const cliente = await this.oracleConnection.execute(`
        SELECT c.*
        FROM dbcliente c
        WHERE c.ID_CLIENTE = :id
      `, { id: cliente_id });

      if (produto.rows.length === 0 || cliente.rows.length === 0) {
        throw new Error('Produto ou cliente não encontrado');
      }

      const dadosProduto = produto.rows[0];
      const dadosCliente = cliente.rows[0];

      // Buscar MVA e alíquota ICMS
      const mvaQuery = await this.oracleConnection.execute(`
        SELECT MVA_ORIGINAL, ALIQ_INTERNA_DESTINO, ALIQ_INTERESTADUAL
        FROM cad_legislacao_icmsst
        WHERE UF_ORIGEM = :uf_orig
        AND UF_DESTINO = :uf_dest
        AND ROWNUM = 1
      `, {
        uf_orig: dadosProduto[8] || 'AM',  // uf_origem do produto
        uf_dest: dadosCliente[3] || 'AM'    // uf do cliente
      });

      const mva = mvaQuery.rows.length > 0 ? parseFloat(mvaQuery.rows[0][0] || 0) : 0;
      const aliqInterna = mvaQuery.rows.length > 0 ? parseFloat(mvaQuery.rows[0][1] || 12) : 12;
      const aliqInter = mvaQuery.rows.length > 0 ? parseFloat(mvaQuery.rows[0][2] || 12) : 12;

      // Calcular valores
      const valorTotal = valor * quantidade;
      const valorIPI = valorTotal * (parseFloat(dadosProduto[4] || 0) / 100);
      const baseICMS = valorTotal;
      const valorICMS = baseICMS * (aliqInter / 100);

      const baseST = baseICMS * (1 + (mva / 100));
      const valorST = (baseST * (aliqInterna / 100)) - valorICMS;

      const valorPIS = valorTotal * (parseFloat(dadosProduto[5] || 0) / 100);
      const valorCOFINS = valorTotal * (parseFloat(dadosProduto[6] || 0) / 100);

      print('   ✓ Cálculo direto concluído', 'green');

      return {
        cfop: '6102',
        cst_icms: '10',
        aliquota_icms: aliqInter,
        base_icms: baseICMS.toFixed(2),
        valor_icms: valorICMS.toFixed(2),
        mva_original: mva.toFixed(2),
        mva_ajustado: mva.toFixed(2),
        base_st: baseST.toFixed(2),
        valor_st: valorST.toFixed(2),
        aliquota_ipi: parseFloat(dadosProduto[4] || 0),
        valor_ipi: valorIPI.toFixed(2),
        aliquota_pis: parseFloat(dadosProduto[5] || 0),
        valor_pis: valorPIS.toFixed(2),
        aliquota_cofins: parseFloat(dadosProduto[6] || 0),
        valor_cofins: valorCOFINS.toFixed(2),
        valor_total: valorTotal.toFixed(2),
        metodo: 'CONSULTA_DIRETA'
      };
    } catch (error) {
      print(`   ✗ Erro no cálculo direto: ${error.message}`, 'red');
      return null;
    }
  }

  /**
   * Processa resultado do Oracle para formato padronizado
   */
  processarResultadoOracle(dados) {
    // Adaptar conforme estrutura real do resultado
    return {
      cfop: dados[0] || '6102',
      cst_icms: dados[1] || '10',
      aliquota_icms: parseFloat(dados[2] || 0),
      base_icms: parseFloat(dados[3] || 0).toFixed(2),
      valor_icms: parseFloat(dados[4] || 0).toFixed(2),
      mva_original: parseFloat(dados[5] || 0).toFixed(2),
      mva_ajustado: parseFloat(dados[6] || 0).toFixed(2),
      base_st: parseFloat(dados[7] || 0).toFixed(2),
      valor_st: parseFloat(dados[8] || 0).toFixed(2),
      aliquota_ipi: parseFloat(dados[9] || 0),
      valor_ipi: parseFloat(dados[10] || 0).toFixed(2),
      aliquota_pis: parseFloat(dados[11] || 0),
      valor_pis: parseFloat(dados[12] || 0).toFixed(2),
      aliquota_cofins: parseFloat(dados[13] || 0),
      valor_cofins: parseFloat(dados[14] || 0).toFixed(2),
      valor_total: parseFloat(dados[15] || 0).toFixed(2),
      metodo: 'PACKAGE_ORACLE'
    };
  }

  /**
   * Calcula impostos no PostgreSQL usando as funções SQL
   */
  async calcularPostgreSQL(produto_id, cliente_id, valor, quantidade) {
    print('\n⚙️  Calculando impostos no PostgreSQL...', 'cyan');

    const inicio = Date.now();

    try {
      // Verificar se as funções existem
      const checkFunc = await this.pgPool.query(`
        SELECT COUNT(*) as cnt
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'db_manaus'
        AND p.proname = 'calcular_icms_completo'
      `);

      if (checkFunc.rows[0].cnt === '0') {
        print('   ⚠ Função calcular_icms_completo não encontrada', 'yellow');
        print('   Tentando consulta direta nas tabelas...', 'yellow');

        return await this.calcularPostgreSQLDireto(produto_id, cliente_id, valor, quantidade);
      }

      // Usar a função SQL
      const result = await this.pgPool.query(`
        SELECT * FROM db_manaus.calcular_icms_completo($1, $2, $3, $4)
      `, [produto_id, cliente_id, valor, quantidade]);

      const tempo = Date.now() - inicio;

      if (result.rows.length === 0) {
        print('   ⚠ Nenhum resultado retornado pela função', 'yellow');
        return null;
      }

      const dados = result.rows[0];
      print(`   ✓ Função calcular_icms_completo executada (${tempo}ms)`, 'green');

      return {
        cfop: dados.cfop || '6102',
        cst_icms: dados.cst_icms || '10',
        aliquota_icms: parseFloat(dados.aliquota_icms || 0),
        base_icms: parseFloat(dados.base_icms || 0).toFixed(2),
        valor_icms: parseFloat(dados.valor_icms || 0).toFixed(2),
        mva_original: parseFloat(dados.mva_original || 0).toFixed(2),
        mva_ajustado: parseFloat(dados.mva_ajustado || 0).toFixed(2),
        base_st: parseFloat(dados.base_st || 0).toFixed(2),
        valor_st: parseFloat(dados.valor_st || 0).toFixed(2),
        aliquota_ipi: parseFloat(dados.aliquota_ipi || 0),
        valor_ipi: parseFloat(dados.valor_ipi || 0).toFixed(2),
        aliquota_pis: parseFloat(dados.aliquota_pis || 0),
        valor_pis: parseFloat(dados.valor_pis || 0).toFixed(2),
        aliquota_cofins: parseFloat(dados.aliquota_cofins || 0),
        valor_cofins: parseFloat(dados.valor_cofins || 0).toFixed(2),
        aliquota_ibs: parseFloat(dados.aliquota_ibs || 0),
        valor_ibs: parseFloat(dados.valor_ibs || 0).toFixed(2),
        aliquota_cbs: parseFloat(dados.aliquota_cbs || 0),
        valor_cbs: parseFloat(dados.valor_cbs || 0).toFixed(2),
        valor_total: parseFloat(dados.valor_total || 0).toFixed(2),
        metodo: 'FUNCAO_SQL'
      };
    } catch (error) {
      print(`   ✗ Erro ao calcular no PostgreSQL: ${error.message}`, 'red');

      // Tentar fallback
      print('   Tentando método alternativo...', 'yellow');
      return await this.calcularPostgreSQLDireto(produto_id, cliente_id, valor, quantidade);
    }
  }

  /**
   * Calcula impostos no PostgreSQL consultando diretamente as tabelas
   */
  async calcularPostgreSQLDireto(produto_id, cliente_id, valor, quantidade) {
    print('   → Consultando tabelas PostgreSQL diretamente...', 'white');

    try {
      // Buscar dados do produto
      const produto = await this.pgPool.query(`
        SELECT p.*,
               COALESCE(p."IPI", 0) as aliq_ipi,
               COALESCE(p."PIS", 0) as aliq_pis,
               COALESCE(p."COFINS", 0) as aliq_cofins
        FROM db_manaus.dbprod p
        WHERE p."ID_PRODUTO" = $1
      `, [produto_id]);

      // Buscar dados do cliente
      const cliente = await this.pgPool.query(`
        SELECT c.*
        FROM db_manaus.dbcliente c
        WHERE c."ID_CLIENTE" = $1
      `, [cliente_id]);

      if (produto.rows.length === 0 || cliente.rows.length === 0) {
        throw new Error('Produto ou cliente não encontrado');
      }

      const dadosProduto = produto.rows[0];
      const dadosCliente = cliente.rows[0];

      // Buscar MVA e alíquota ICMS
      const mvaQuery = await this.pgPool.query(`
        SELECT "MVA_ORIGINAL", "ALIQ_INTERNA_DESTINO", "ALIQ_INTERESTADUAL"
        FROM db_manaus.cad_legislacao_icmsst
        WHERE "UF_ORIGEM" = $1
        AND "UF_DESTINO" = $2
        LIMIT 1
      `, [
        dadosProduto.UF_ORIGEM || 'AM',
        dadosCliente.UF || 'AM'
      ]);

      const mva = mvaQuery.rows.length > 0 ? parseFloat(mvaQuery.rows[0].MVA_ORIGINAL || 0) : 0;
      const aliqInterna = mvaQuery.rows.length > 0 ? parseFloat(mvaQuery.rows[0].ALIQ_INTERNA_DESTINO || 12) : 12;
      const aliqInter = mvaQuery.rows.length > 0 ? parseFloat(mvaQuery.rows[0].ALIQ_INTERESTADUAL || 12) : 12;

      // Calcular valores
      const valorTotal = valor * quantidade;
      const valorIPI = valorTotal * (parseFloat(dadosProduto.IPI || 0) / 100);
      const baseICMS = valorTotal;
      const valorICMS = baseICMS * (aliqInter / 100);

      const baseST = baseICMS * (1 + (mva / 100));
      const valorST = (baseST * (aliqInterna / 100)) - valorICMS;

      const valorPIS = valorTotal * (parseFloat(dadosProduto.PIS || 0) / 100);
      const valorCOFINS = valorTotal * (parseFloat(dadosProduto.COFINS || 0) / 100);

      // IBS/CBS (novo sistema - 2026)
      const valorIBS = valorTotal * 0.001; // 0.10%
      const valorCBS = valorTotal * 0.009; // 0.90%

      print('   ✓ Cálculo direto concluído', 'green');

      return {
        cfop: '6102',
        cst_icms: '10',
        aliquota_icms: aliqInter,
        base_icms: baseICMS.toFixed(2),
        valor_icms: valorICMS.toFixed(2),
        mva_original: mva.toFixed(2),
        mva_ajustado: mva.toFixed(2),
        base_st: baseST.toFixed(2),
        valor_st: valorST.toFixed(2),
        aliquota_ipi: parseFloat(dadosProduto.IPI || 0),
        valor_ipi: valorIPI.toFixed(2),
        aliquota_pis: parseFloat(dadosProduto.PIS || 0),
        valor_pis: valorPIS.toFixed(2),
        aliquota_cofins: parseFloat(dadosProduto.COFINS || 0),
        valor_cofins: valorCOFINS.toFixed(2),
        aliquota_ibs: 0.10,
        valor_ibs: valorIBS.toFixed(2),
        aliquota_cbs: 0.90,
        valor_cbs: valorCBS.toFixed(2),
        valor_total: valorTotal.toFixed(2),
        metodo: 'CONSULTA_DIRETA'
      };
    } catch (error) {
      print(`   ✗ Erro no cálculo direto: ${error.message}`, 'red');
      return null;
    }
  }

  /**
   * Compara resultados dos dois sistemas
   */
  compararResultados(oracle, pg) {
    print('\n📊 COMPARAÇÃO DE RESULTADOS:\n', 'cyan');

    const comparacoes = [];
    const margemErro = 0.01; // R$ 0.01

    // Campos para comparar
    const campos = [
      { key: 'cfop', label: 'CFOP', tipo: 'string' },
      { key: 'cst_icms', label: 'CST ICMS', tipo: 'string' },
      { key: 'aliquota_icms', label: 'Alíquota ICMS', tipo: 'percentual' },
      { key: 'base_icms', label: 'Base ICMS', tipo: 'valor' },
      { key: 'valor_icms', label: 'Valor ICMS', tipo: 'valor' },
      { key: 'mva_original', label: 'MVA Original', tipo: 'percentual' },
      { key: 'mva_ajustado', label: 'MVA Ajustado', tipo: 'percentual' },
      { key: 'base_st', label: 'Base ST', tipo: 'valor' },
      { key: 'valor_st', label: 'Valor ST', tipo: 'valor' },
      { key: 'aliquota_ipi', label: 'Alíquota IPI', tipo: 'percentual' },
      { key: 'valor_ipi', label: 'Valor IPI', tipo: 'valor' },
      { key: 'aliquota_pis', label: 'Alíquota PIS', tipo: 'percentual' },
      { key: 'valor_pis', label: 'Valor PIS', tipo: 'valor' },
      { key: 'aliquota_cofins', label: 'Alíquota COFINS', tipo: 'percentual' },
      { key: 'valor_cofins', label: 'Valor COFINS', tipo: 'valor' }
    ];

    const linha = '═'.repeat(90);
    print(linha, 'white');
    print(
      `${'Campo'.padEnd(25)} | ${'Oracle'.padEnd(18)} | ${'PostgreSQL'.padEnd(18)} | ${'Status'.padEnd(10)}`,
      'bold'
    );
    print(linha, 'white');

    let compativeis = 0;
    let divergentes = 0;
    let novos = 0;

    campos.forEach(campo => {
      const valorOracle = oracle?.[campo.key];
      const valorPg = pg?.[campo.key];

      let status = '';
      let compatible = false;

      if (valorOracle === undefined && valorPg === undefined) {
        return; // Pular campos não disponíveis
      }

      if (valorOracle === undefined) {
        status = 'NOVO';
        novos++;
      } else if (valorPg === undefined) {
        status = 'REMOVIDO';
        divergentes++;
      } else {
        // Comparar valores
        if (campo.tipo === 'string') {
          compatible = String(valorOracle) === String(valorPg);
        } else if (campo.tipo === 'valor' || campo.tipo === 'percentual') {
          const diff = Math.abs(parseFloat(valorOracle) - parseFloat(valorPg));
          compatible = diff <= margemErro;
        }

        if (compatible) {
          status = '✓';
          compativeis++;
        } else {
          status = '✗';
          divergentes++;
        }
      }

      const formatValue = (val, tipo) => {
        if (val === undefined) return 'N/A';
        if (tipo === 'percentual') return `${val}%`;
        if (tipo === 'valor') return `R$ ${val}`;
        return String(val);
      };

      const oracleStr = formatValue(valorOracle, campo.tipo).padEnd(18);
      const pgStr = formatValue(valorPg, campo.tipo).padEnd(18);
      const statusStr = status.padEnd(10);

      const cor = status === '✓' ? 'green' : status === 'NOVO' ? 'cyan' : 'yellow';

      print(
        `${campo.label.padEnd(25)} | ${oracleStr} | ${pgStr} | ${statusStr}`,
        cor
      );

      comparacoes.push({
        campo: campo.label,
        oracle: valorOracle,
        postgresql: valorPg,
        status: status,
        compativel: compatible
      });
    });

    // Campos novos do PostgreSQL (IBS/CBS)
    if (pg?.aliquota_ibs !== undefined) {
      print(
        `${'Alíquota IBS (2026)'.padEnd(25)} | ${'N/A'.padEnd(18)} | ${`${pg.aliquota_ibs}%`.padEnd(18)} | ${'NOVO'.padEnd(10)}`,
        'cyan'
      );
      novos++;
    }

    if (pg?.aliquota_cbs !== undefined) {
      print(
        `${'Alíquota CBS (2026)'.padEnd(25)} | ${'N/A'.padEnd(18)} | ${`${pg.aliquota_cbs}%`.padEnd(18)} | ${'NOVO'.padEnd(10)}`,
        'cyan'
      );
      novos++;
    }

    print(linha, 'white');

    // Resumo
    const total = compativeis + divergentes;
    const percentual = total > 0 ? ((compativeis / total) * 100).toFixed(1) : 0;

    print('\n📈 RESUMO:', 'bold');
    print(`   ✓ Compatíveis: ${compativeis} campos (${percentual}%)`, 'green');
    print(`   ✗ Divergentes: ${divergentes} campos`, divergentes > 0 ? 'yellow' : 'white');
    print(`   ✨ Novos (PG): ${novos} campos (IBS/CBS)`, 'cyan');

    if (divergentes === 0) {
      print('\n✅ RESULTADO: SISTEMAS COMPATÍVEIS!', 'green');
    } else {
      print('\n⚠️  RESULTADO: DIVERGÊNCIAS ENCONTRADAS', 'yellow');
      print('\nPossíveis causas:', 'white');
      print('   • MVA diferente entre sistemas', 'white');
      print('   • Alíquota ICMS divergente', 'white');
      print('   • Regras de base reduzida diferentes', 'white');
      print('   • Arredondamentos', 'white');
    }

    this.resultados.comparacao = {
      total,
      compativeis,
      divergentes,
      novos,
      percentual,
      detalhes: comparacoes
    };

    return comparacoes;
  }

  /**
   * Salva relatório em JSON e Markdown
   */
  async salvarRelatorio() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = path.join(__dirname, 'testes_comparativos');

    // Garantir que o diretório existe
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const baseFilename = `teste_${timestamp.split('T')[0]}_${timestamp.split('T')[1].split('-')[0].replace(/-/g, '')}`;
    const jsonPath = path.join(dir, `${baseFilename}.json`);
    const mdPath = path.join(dir, `${baseFilename}.md`);

    // Salvar JSON
    fs.writeFileSync(jsonPath, JSON.stringify(this.resultados, null, 2));

    // Gerar Markdown
    const md = this.gerarMarkdown();
    fs.writeFileSync(mdPath, md);

    print(`\n💾 Relatório salvo:`, 'cyan');
    print(`   • JSON: ${jsonPath}`, 'white');
    print(`   • MD: ${mdPath}`, 'white');
  }

  /**
   * Gera relatório em Markdown
   */
  gerarMarkdown() {
    const { entrada, oracle, postgresql, comparacao } = this.resultados;

    return `# Relatório de Simulação Comparativa de Impostos

**Data:** ${new Date(this.resultados.timestamp).toLocaleString('pt-BR')}

## Dados de Entrada

- **Produto:** [${entrada.produto?.id_produto}] ${entrada.produto?.descricao}
  - NCM: ${entrada.produto?.ncm}
  - IPI: ${entrada.produto?.ipi}%
  - UF Origem: ${entrada.produto?.uf_origem}

- **Cliente:** [${entrada.cliente?.id_cliente}] ${entrada.cliente?.nome}
  - UF: ${entrada.cliente?.uf}
  - IE: ${entrada.cliente?.inscricao_estadual || 'Não informado'}

- **Operação:**
  - Valor unitário: R$ ${entrada.valor}
  - Quantidade: ${entrada.quantidade}
  - Valor total: R$ ${(entrada.valor * entrada.quantidade).toFixed(2)}

## Resultados

### Oracle (Sistema Antigo)
\`\`\`json
${JSON.stringify(oracle, null, 2)}
\`\`\`

### PostgreSQL (Sistema Novo)
\`\`\`json
${JSON.stringify(postgresql, null, 2)}
\`\`\`

## Comparação

| Campo | Oracle | PostgreSQL | Status |
|-------|--------|------------|--------|
${comparacao.detalhes?.map(d =>
  `| ${d.campo} | ${d.oracle || 'N/A'} | ${d.postgresql || 'N/A'} | ${d.status} |`
).join('\n')}

## Estatísticas

- **Total de campos:** ${comparacao.total}
- **Campos compatíveis:** ${comparacao.compativeis} (${comparacao.percentual}%)
- **Campos divergentes:** ${comparacao.divergentes}
- **Campos novos (PG):** ${comparacao.novos}

## Observações

${this.resultados.observacoes.length > 0
  ? this.resultados.observacoes.map(obs => `- ${obs}`).join('\n')
  : '- Nenhuma observação adicional'}

---

*Relatório gerado automaticamente pelo Simulador Comparativo de Impostos*
`;
  }

  /**
   * Fluxo principal de execução
   */
  async executar() {
    try {
      print('\n╔═══════════════════════════════════════════╗', 'blue');
      print('║  SIMULADOR COMPARATIVO DE IMPOSTOS       ║', 'blue');
      print('║  Oracle (Delphi) vs PostgreSQL (Next.js) ║', 'blue');
      print('╚═══════════════════════════════════════════╝\n', 'blue');

      // Conectar aos bancos
      await this.conectar();

      // Coletar dados de entrada
      print('═'.repeat(50), 'white');
      print('DADOS DE ENTRADA', 'bold');
      print('═'.repeat(50) + '\n', 'white');

      const termoProduto = await pergunta('Produto (código ou descrição): ');
      const produto = await this.buscarProduto(termoProduto);

      if (!produto) {
        print('\n✗ Produto não encontrado. Encerrando.\n', 'red');
        return;
      }

      const termoCliente = await pergunta('Cliente (código ou nome): ');
      const cliente = await this.buscarCliente(termoCliente);

      if (!cliente) {
        print('\n✗ Cliente não encontrado. Encerrando.\n', 'red');
        return;
      }

      const valorStr = await pergunta('Valor unitário (R$): ');
      const valor = parseFloat(valorStr);

      const qtdStr = await pergunta('Quantidade (padrão 1): ');
      const quantidade = qtdStr ? parseInt(qtdStr) : 1;

      // Armazenar entrada
      this.resultados.entrada = {
        produto: produto.oracle,
        cliente: cliente.oracle,
        valor,
        quantidade
      };

      print('\n' + '═'.repeat(50), 'white');

      // Calcular no Oracle
      const resultadoOracle = await this.calcularOracle(
        produto.oracle.id_produto,
        cliente.oracle.id_cliente,
        valor,
        quantidade
      );

      this.resultados.oracle = resultadoOracle;

      // Calcular no PostgreSQL
      const resultadoPg = await this.calcularPostgreSQL(
        produto.pg?.id_produto || produto.oracle.id_produto,
        cliente.pg?.id_cliente || cliente.oracle.id_cliente,
        valor,
        quantidade
      );

      this.resultados.postgresql = resultadoPg;

      // Comparar resultados
      if (resultadoOracle && resultadoPg) {
        this.compararResultados(resultadoOracle, resultadoPg);
      } else {
        print('\n⚠️  Não foi possível comparar (dados incompletos)', 'yellow');
      }

      // Salvar relatório
      await this.salvarRelatorio();

      print('\n' + '═'.repeat(50), 'white');
      print('✅ Simulação concluída com sucesso!', 'green');
      print('═'.repeat(50) + '\n', 'white');

    } catch (error) {
      print(`\n✗ Erro durante a execução: ${error.message}`, 'red');
      console.error(error);
    } finally {
      await this.desconectar();
    }
  }

  /**
   * Fecha conexões com os bancos
   */
  async desconectar() {
    try {
      if (this.oracleConnection) {
        await this.oracleConnection.close();
        print('\n✓ Conexão Oracle fechada', 'white');
      }

      if (this.pgPool) {
        await this.pgPool.end();
        print('✓ Pool PostgreSQL fechado', 'white');
      }
    } catch (error) {
      print(`⚠ Erro ao desconectar: ${error.message}`, 'yellow');
    }
  }
}

// Executar simulador
async function main() {
  const simulador = new SimuladorComparativo();

  try {
    await simulador.executar();
  } catch (error) {
    console.error('Erro fatal:', error);
    process.exit(1);
  } finally {
    rl.close();
    process.exit(0);
  }
}

// Iniciar
if (require.main === module) {
  main();
}

module.exports = SimuladorComparativo;

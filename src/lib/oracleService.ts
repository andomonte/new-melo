// lib/oracleService.ts
import oracledb from 'oracledb';

const instantClientPath = 'C:\\oracle\\instantclient_23_8';

// Inicializar Oracle Client em modo Thick
let oracleInitialized = false;

function initializeOracleClient() {
  if (oracleInitialized) {
    return;
  }

  try {
    process.env.PATH = instantClientPath + ';' + process.env.PATH;
    oracledb.initOracleClient({
      libDir: instantClientPath,
    });
    oracleInitialized = true;
    console.log('✅ Oracle Instant Client inicializado em modo Thick');
  } catch (err: any) {
    if (err.message.includes('already been initialized')) {
      oracleInitialized = true;
      console.log('✅ Oracle Instant Client já está em modo Thick');
    } else {
      console.error('❌ Erro ao inicializar Oracle Client:', err.message);
      throw err;
    }
  }
}

// Pool de conexões Oracle
let oraclePool: any = null;

export async function getOraclePool() {
  // Garantir inicialização do client
  initializeOracleClient();

  if (oraclePool) {
    return oraclePool;
  }

  try {
    const connectString = `${process.env.ORACLE_HOST}:${process.env.ORACLE_PORT}/${process.env.ORACLE_SERVICE}`;

    oraclePool = await oracledb.createPool({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: connectString,
      poolMin: 2,
      poolMax: 10,
      poolIncrement: 2,
      poolTimeout: 60,
    });

    console.log('✅ Pool de conexões Oracle criado');
    return oraclePool;
  } catch (err) {
    console.error('❌ Erro ao criar pool Oracle:', err);
    throw err;
  }
}

export async function getOracleConnection() {
  const pool = await getOraclePool();
  return pool.getConnection();
}

export async function closeOraclePool() {
  if (oraclePool) {
    await oraclePool.close(10);
    oraclePool = null;
    console.log('✅ Pool de conexões Oracle fechado');
  }
}

// ==================== FUNÇÕES DE TÍTULOS E PAGAMENTOS ====================

/**
 * Calcula juros de um título baseado na taxa e dias de atraso
 * Fórmula Oracle: (txJuros / 3000) * valor_pgto * dias
 */
export function calcularJurosTitulo(
  valorPgto: number,
  dtVenc: Date,
  txJuros: number = 8
): { dias: number; juros: number } {
  const hoje = new Date();
  const vencimento = new Date(dtVenc);
  
  // Calcula dias de atraso (apenas se vencido)
  const dias = vencimento < hoje 
    ? Math.floor((hoje.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  
  // Taxa ao dia = txJuros / 3000
  const txDia = txJuros / 3000;
  const juros = dias > 0 ? valorPgto * dias * txDia : 0;
  
  return { dias, juros: Math.round(juros * 100) / 100 };
}

/**
 * Carrega títulos de uma fatura (Oracle CARREGA_TITULOS)
 */
export async function carregarTitulosFatura(codFat: string) {
  const connection = await getOracleConnection();
  
  try {
    const result = await connection.execute(
      `BEGIN CARREGA_TITULOS(:vParam, :cursor); END;`,
      {
        vParam: codFat,
        cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
      }
    );
    
    const cursor = result.outBinds.cursor as any;
    const rows = await cursor.getRows();
    await cursor.close();
    
    return rows;
  } finally {
    await connection.close();
  }
}

/**
 * Consulta títulos de um cliente com cálculo de juros (Oracle CLIENTE_TITULO)
 * 
 * @param codCli - Código do cliente
 * @param tipo - Tipo de consulta:
 *   '1' = Títulos atrasados com juros
 *   '2' = Títulos em dia
 *   '3' = Vencimentos agrupados por mês
 *   '4' = Histórico de vendas (últimos 3 meses)
 *   '5' = Histórico de prazo médio
 *   '6' = Títulos a vencer
 * @param txJuros - Taxa de juros (padrão 8%)
 */
export async function consultarTitulosCliente(
  codCli: string,
  tipo: '1' | '2' | '3' | '4' | '5' | '6',
  txJuros: number = 8
) {
  const connection = await getOracleConnection();
  
  try {
    const result = await connection.execute(
      `BEGIN CLIENTE_TITULO(:tipo, :txjuros, :codcli, :cursor); END;`,
      {
        tipo: tipo,
        txjuros: txJuros,
        codcli: codCli,
        cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
      }
    );
    
    const cursor = result.outBinds.cursor as any;
    const rows = await cursor.getRows();
    await cursor.close();
    
    return rows;
  } finally {
    await connection.close();
  }
}

/**
 * Libera títulos de restrição (Oracle LIBERA_TITULOS)
 * 
 * @param codigo - Código da fatura ou grupo
 * @param tipo - '1' = por fatura, '2' = por grupo
 * @param username - Nome do usuário
 */
export async function liberarTitulos(
  codigo: string,
  tipo: '1' | '2',
  username: string
) {
  const connection = await getOracleConnection();
  
  try {
    await connection.execute(
      `BEGIN LIBERA_TITULOS(:codigo, :username, :tipo); END;`,
      {
        codigo: codigo,
        username: username,
        tipo: tipo
      },
      { autoCommit: true }
    );
    
    return { sucesso: true };
  } finally {
    await connection.close();
  }
}

/**
 * Calcula valor total recebido de um título até uma data (Oracle RECEB_TOTAL_TITULO)
 */
export async function calcularTotalRecebidoTitulo(
  codReceb: string,
  dataLimite: Date
) {
  const connection = await getOracleConnection();
  
  try {
    const result = await connection.execute(
      `BEGIN RECEB_TOTAL_TITULO(:codReceb, :dataLimite, :valor); END;`,
      {
        codReceb: codReceb,
        dataLimite: dataLimite,
        valor: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
      }
    );
    
    return result.outBinds.valor as number;
  } finally {
    await connection.close();
  }
}

/**
 * Marca um título como pago com integração Oracle
 * Registra no DBFRECEB e atualiza DBRECEB
 */
export async function marcarTituloPagoOracle(dados: {
  codReceb: string;
  dtPgto: Date;
  valorPago: number;
  valorJuros?: number;
  banco?: string;
  formaPgto?: string;
  codConta?: string;
  username: string;
  obs?: string;
}) {
  const connection = await getOracleConnection();
  
  try {
    // Inicia transação
    const {
      codReceb,
      dtPgto,
      valorPago,
      valorJuros = 0,
      banco,
      formaPgto,
      codConta,
      username,
      obs
    } = dados;

    // Buscar valor atual recebido e valor total
    const tituloQuery = await connection.execute(
      `SELECT valor_pgto, valor_rec FROM DBRECEB WHERE cod_receb = :codReceb`,
      { codReceb }
    );

    if (tituloQuery.rows && tituloQuery.rows.length > 0) {
      const [valorTotal, valorRecebido] = tituloQuery.rows[0] as [number, number];
      const novoValorRecebido = (valorRecebido || 0) + valorPago + valorJuros;
      const totalmentePago = novoValorRecebido >= valorTotal ? 'S' : 'N';

      // Atualizar DBRECEB
      await connection.execute(
        `UPDATE DBRECEB 
         SET dt_pgto = :dtPgto,
             valor_rec = :valorRec,
             rec = :rec,
             nro_banco = :banco,
             forma_fat = :formaPgto,
             cod_conta = :codConta
         WHERE cod_receb = :codReceb`,
        {
          dtPgto,
          valorRec: novoValorRecebido,
          rec: totalmentePago,
          banco: banco || null,
          formaPgto: formaPgto || null,
          codConta: codConta || null,
          codReceb
        }
      );

      // Registrar movimento de pagamento em DBFRECEB
      await connection.execute(
        `INSERT INTO DBFRECEB (cod_receb, dt_pgto, valor, tipo, obs)
         VALUES (:codReceb, :dtPgto, :valorPago, '01', :obs)`,
        {
          codReceb,
          dtPgto,
          valorPago,
          obs: obs || 'Pagamento registrado via sistema'
        }
      );

      // Se houver juros, registrar separadamente
      if (valorJuros > 0) {
        await connection.execute(
          `INSERT INTO DBFRECEB (cod_receb, dt_pgto, valor, tipo, obs)
           VALUES (:codReceb, :dtPgto, :valorJuros, '02', 'Juros de atraso')`,
          {
            codReceb,
            dtPgto,
            valorJuros
          }
        );
      }

      // Buscar código do usuário e registrar auditoria
      const userQuery = await connection.execute(
        `SELECT codusr FROM DBUSUARIO WHERE nomeusr = :username`,
        { username }
      );

      if (userQuery.rows && userQuery.rows.length > 0) {
        const codusr = userQuery.rows[0] as [number];
        await connection.execute(
          `BEGIN Usuario.inc_acao_usr(:codusr, 'MARCAR_PAGO', 'DBRECEB', :detalhes); END;`,
          {
            codusr: codusr[0],
            detalhes: `COD:${codReceb} VALOR:${valorPago}`
          }
        );
      }

      // Commit da transação
      await connection.commit();

      return {
        sucesso: true,
        totalmentePago,
        valorTotalRecebido: novoValorRecebido
      };
    } else {
      throw new Error('Título não encontrado no Oracle');
    }
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.close();
  }
}

/**
 * Mapeamento de código de conta para banco
 * Baseado na lógica da procedure SAV_UPDATE_TITULOS
 */
export function mapearContaParaBanco(codConta: string): number {
  const mapeamento: Record<string, number> = {
    '0003': 2, // BRADESCO
    '0006': 2, // BRADESCO
    '0007': 1, // BANCO DO BRASIL
    '0008': 1, // BANCO DO BRASIL
    '0104': 3, // ITAÚ
    '0106': 3, // ITAÚ
    '0124': 5, // RURAL
    '0133': 4, // REAL
  };

  return mapeamento[codConta] || 100; // 100 = outros
}

/**
 * Obter nome do banco pelo código
 */
export function obterNomeBanco(codigoBanco: number): string {
  const bancos: Record<number, string> = {
    1: 'Banco do Brasil',
    2: 'Bradesco',
    3: 'Itaú',
    4: 'Real',
    5: 'Rural',
    100: 'Outros'
  };

  return bancos[codigoBanco] || 'Desconhecido';
}

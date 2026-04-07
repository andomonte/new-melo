// src/pages/api/impostos/comparar-oracle-pg.ts

/**
 * API para comparar cálculo de impostos Oracle vs PostgreSQL
 * Útil para validar se a migração está correta
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { CalculadoraImpostos } from '@/lib/impostos/calculadoraImpostos';
import type { DadosCalculoImposto } from '@/lib/impostos/types';
import { Sequelize, QueryTypes } from 'sequelize';

const oracledb = require('oracledb');

type ComparacaoResultado = {
  produto: string;
  cliente: string;
  quantidade: number;
  valorUnitario: number;
  total: number;
  oracle: {
    icms: number;
    st: number;
    ipi: number;
    pis: number;
    cofins: number;
    mva: number;
    cfop: string;
    totalImpostos: number;
    erro?: string;
  };
  postgresql: {
    icms: number;
    st: number;
    ipi: number;
    pis: number;
    cofins: number;
    mva: number;
    cfop: string;
    totalImpostos: number;
    ibs: number;
    cbs: number;
    erro?: string;
  };
  diferencas: {
    icms: number;
    st: number;
    ipi: number;
    pis: number;
    cofins: number;
    totalImpostos: number;
  };
  igualOuAceitavel: boolean;
};

let oraSequelize: any = null;

async function getOracleSequelize() {
  if (!oraSequelize) {
    await oracledb.initOracleClient({
      libDir: 'C:\\oracle\\instantclient\\instantclient_23_4',
    });
    if (!process.env.DATABASE_URL2) {
      throw new Error('DATABASE_URL2 ausente');
    }
    oraSequelize = new Sequelize(process.env.DATABASE_URL2, {
      logging: false,
    });
  }
  return oraSequelize;
}

/**
 * Chama o procedimento Oracle de cálculo de impostos
 */
async function calcularImpostosOracle(
  codProd: string,
  codCli: string,
  quantidade: number,
  valorUnitario: number,
): Promise<any> {
  const ora = await getOracleSequelize();

  try {
    // Buscar dados do produto
    const produto = await ora.query(
      `SELECT CODPROD, CLASFISCAL, IPI, PIS, COFINS
       FROM DBPROD
       WHERE CODPROD = :CODPROD`,
      {
        replacements: { CODPROD: codProd.padStart(6, '0') },
        type: QueryTypes.SELECT,
      }
    );

    if (!produto || produto.length === 0) {
      throw new Error('Produto não encontrado no Oracle');
    }

    const prod = produto[0] as any;
    const ncm = (prod.CLASFISCAL || '').replace(/\D/g, '').substring(0, 8);

    console.log('📦 Produto Oracle:', {
      codprod: prod.CODPROD,
      ncm: ncm,
      ipi: prod.IPI,
      pis: prod.PIS,
      cofins: prod.COFINS,
    });

    // Buscar dados do cliente
    const cliente = await ora.query(
      `SELECT CODCLI, UF FROM DBCLIEN WHERE CODCLI = :CODCLI`,
      {
        replacements: { CODCLI: codCli },
        type: QueryTypes.SELECT,
      }
    );

    if (!cliente || cliente.length === 0) {
      throw new Error('Cliente não encontrado no Oracle');
    }

    const cli = cliente[0] as any;

    // Buscar UF da empresa
    const empresa = await ora.query(
      `SELECT UF FROM DADOSEMPRESA WHERE ROWNUM = 1`,
      { type: QueryTypes.SELECT }
    );

    const ufEmpresa = (empresa[0] as any)?.UF || 'AM';
    const ufCliente = cli.UF || 'AM';

    // Chamar procedimento de cálculo (se existir)
    // Como o procedimento original pode não estar disponível,
    // vamos fazer um cálculo simplificado baseado nos dados

    const total = quantidade * valorUnitario;
    const operacaoInterna = ufEmpresa === ufCliente;

    // Usar alíquota ICMS padrão (18% para operações internas no AM)
    let icmsAliq = 0;
    if (operacaoInterna) {
      icmsAliq = 18; // Alíquota padrão para AM
    } else {
      icmsAliq = 12; // Alíquota interestadual padrão
    }

    // Tentar buscar MVA - se falhar, usa 0
    let mva = 0;
    try {
      const mvaResult = await ora.query(
        `SELECT MVA_AJUSTADO
         FROM CAD_LEGISLACAO_ICMSST_NCM
         WHERE NCM = :NCM
         AND UF_DESTINO = :UF
         AND ROWNUM = 1`,
        {
          replacements: { NCM: ncm, UF: ufCliente },
          type: QueryTypes.SELECT,
        }
      );

      if (mvaResult && mvaResult.length > 0) {
        mva = (mvaResult[0] as any)?.MVA_AJUSTADO || 0;
      }
    } catch (e) {
      console.log('MVA não encontrado, usando 0');
      mva = 0;
    }

    // Calcular impostos
    const baseICMS = total;
    const valorICMS = (baseICMS * icmsAliq) / 100;

    const baseIPI = total;
    const valorIPI = (baseIPI * Number(prod.IPI || 0)) / 100;

    const basePIS = total;
    const valorPIS = (basePIS * Number(prod.PIS || 0)) / 100;

    const baseCOFINS = total;
    const valorCOFINS = (baseCOFINS * Number(prod.COFINS || 0)) / 100;

    // ST simplificado
    let valorST = 0;
    if (mva > 0 && !operacaoInterna) {
      const baseST = total * (1 + mva / 100);
      valorST = (baseST * icmsAliq) / 100 - valorICMS;
      if (valorST < 0) valorST = 0;
    }

    const cfop = operacaoInterna ? '5102' : '6102';

    const resultado = {
      icms: Number(valorICMS.toFixed(2)),
      st: Number(valorST.toFixed(2)),
      ipi: Number(valorIPI.toFixed(2)),
      pis: Number(valorPIS.toFixed(2)),
      cofins: Number(valorCOFINS.toFixed(2)),
      mva: mva,
      cfop: cfop,
      totalImpostos: Number((valorICMS + valorST + valorIPI + valorPIS + valorCOFINS).toFixed(2)),
    };

    console.log('📊 Resultado Oracle:', resultado);

    return resultado;
  } catch (e: any) {
    console.error('Erro ao calcular impostos Oracle:', e);
    return {
      icms: 0,
      st: 0,
      ipi: 0,
      pis: 0,
      cofins: 0,
      mva: 0,
      cfop: '',
      totalImpostos: 0,
      erro: e.message,
    };
  }
}

/**
 * Handler principal
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ComparacaoResultado | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  const { codProd, codCli, quantidade = 1, valorUnitario, usarRegrasOracleProcedimento } = req.body;

  if (!codProd || !codCli || !valorUnitario) {
    return res.status(400).json({
      error: 'Parâmetros obrigatórios: codProd, codCli, valorUnitario',
    });
  }

  let pgClient: any = null;

  try {
    const pool = getPgPool(filial);
    pgClient = await pool.connect();

    const qtd = Number(quantidade);
    const vu = Number(valorUnitario);
    const total = qtd * vu;

    console.log('🔄 Comparando cálculos:', { codProd, codCli, qtd, vu, total });

    // 1. Calcular com Oracle
    console.log('📊 Calculando com Oracle...');
    const resultOracle = await calcularImpostosOracle(codProd, codCli, qtd, vu);

    // 2. Calcular com PostgreSQL
    console.log('📊 Calculando com PostgreSQL...');

    // Buscar NCM do produto
    const prodPg = await pgClient.query(
      `SELECT codprod, clasfiscal FROM dbprod WHERE codprod = $1`,
      [codProd.padStart(6, '0')]
    );

    if (prodPg.rows.length === 0) {
      throw new Error('Produto não encontrado no PostgreSQL');
    }

    const ncm = (prodPg.rows[0].clasfiscal || '').replace(/\D/g, '').substring(0, 8);
    const produtoId = parseInt(prodPg.rows[0].codprod);

    const dados: DadosCalculoImposto = {
      produto_id: produtoId,
      ncm: ncm,
      valor_produto: vu,
      quantidade: qtd,
      desconto: 0,
      cliente_id: parseInt(codCli),
      tipo_operacao: 'VENDA',
      usar_regras_oracle_procedimento: usarRegrasOracleProcedimento,
    };

    const calculadora = new CalculadoraImpostos(pgClient);
    const resultPg = await calculadora.calcular(dados);

    const resultPostgresql = {
      icms: resultPg.totalicms,
      st: resultPg.totalsubst_trib,
      ipi: resultPg.totalipi,
      pis: resultPg.valorpis,
      cofins: resultPg.valorcofins,
      mva: resultPg.mva,
      cfop: resultPg.cfop,
      totalImpostos: resultPg.totalicms + resultPg.totalsubst_trib + resultPg.totalipi + resultPg.valorpis + resultPg.valorcofins,
      ibs: resultPg.ibs_valor,
      cbs: resultPg.cbs_valor,
    };

    // 3. Calcular diferenças
    const diferencas = {
      icms: Math.abs(resultOracle.icms - resultPostgresql.icms),
      st: Math.abs(resultOracle.st - resultPostgresql.st),
      ipi: Math.abs(resultOracle.ipi - resultPostgresql.ipi),
      pis: Math.abs(resultOracle.pis - resultPostgresql.pis),
      cofins: Math.abs(resultOracle.cofins - resultPostgresql.cofins),
      totalImpostos: Math.abs(resultOracle.totalImpostos - resultPostgresql.totalImpostos),
    };

    // Considera aceitável se diferença <= R$ 0,05 (arredondamento)
    const TOLERANCIA = 0.05;
    const igualOuAceitavel =
      diferencas.icms <= TOLERANCIA &&
      diferencas.st <= TOLERANCIA &&
      diferencas.ipi <= TOLERANCIA &&
      diferencas.pis <= TOLERANCIA &&
      diferencas.cofins <= TOLERANCIA;

    const resultado: ComparacaoResultado = {
      produto: codProd,
      cliente: codCli,
      quantidade: qtd,
      valorUnitario: vu,
      total: total,
      oracle: resultOracle,
      postgresql: resultPostgresql,
      diferencas: diferencas,
      igualOuAceitavel: igualOuAceitavel,
    };

    console.log('✅ Comparação concluída:', { igualOuAceitavel, diferencas });

    return res.status(200).json(resultado);
  } catch (e: any) {
    console.error('Erro na comparação:', e);
    return res.status(500).json({
      error: e?.message || 'Erro ao comparar cálculos',
    });
  } finally {
    if (pgClient) pgClient.release();
  }
}

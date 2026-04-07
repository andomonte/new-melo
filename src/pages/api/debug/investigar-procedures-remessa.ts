import type { NextApiRequest, NextApiResponse } from 'next';
import { Sequelize, QueryTypes } from 'sequelize';

let _oraSequelize: Sequelize | null = null;

function getOracleSequelize(): Sequelize {
  if (_oraSequelize) return _oraSequelize;

  if (!process.env.DATABASE_URL2) {
    throw new Error('DATABASE_URL2 ausente para Oracle.');
  }

  _oraSequelize = new Sequelize(process.env.DATABASE_URL2, {
    logging: false,
    dialect: 'oracle',
  });

  return _oraSequelize;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  try {
    const sequelize = getOracleSequelize();
    
    const resultado: any = {
      procedures_com_nome_remessa: [],
      procedures_com_codigo_remessa: [],
      procedures_com_cnab_boleto: [],
      tabelas_remessa: [],
      codigo_fonte: []
    };

    // 1. Procedures com REMESSA no nome
    const proceduresNome = await sequelize.query(`
      SELECT 
        object_name,
        object_type,
        status,
        TO_CHAR(created, 'DD/MM/YYYY HH24:MI:SS') as criado_em,
        TO_CHAR(last_ddl_time, 'DD/MM/YYYY HH24:MI:SS') as ultima_modificacao
      FROM all_objects
      WHERE object_type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE')
        AND UPPER(object_name) LIKE '%REMESSA%'
        AND owner = 'GERAL'
      ORDER BY object_name
    `, { type: QueryTypes.SELECT });

    resultado.procedures_com_nome_remessa = proceduresNome;

    // 2. Procedures com REMESSA no código
    const proceduresCodigo = await sequelize.query(`
      SELECT DISTINCT
        name,
        type,
        COUNT(*) as ocorrencias
      FROM all_source
      WHERE UPPER(text) LIKE '%REMESSA%'
        AND owner = 'GERAL'
        AND type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE', 'PACKAGE BODY')
      GROUP BY name, type
      ORDER BY name
    `, { type: QueryTypes.SELECT });

    resultado.procedures_com_codigo_remessa = proceduresCodigo;

    // 3. Procedures com CNAB/BOLETO
    const proceduresCNAB = await sequelize.query(`
      SELECT DISTINCT
        name,
        type,
        COUNT(*) as ocorrencias
      FROM all_source
      WHERE (UPPER(text) LIKE '%CNAB%' OR UPPER(text) LIKE '%BOLETO%')
        AND owner = 'GERAL'
        AND type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE', 'PACKAGE BODY')
      GROUP BY name, type
      ORDER BY name
    `, { type: QueryTypes.SELECT });

    resultado.procedures_com_cnab_boleto = proceduresCNAB;

    // 4. Tabelas com REMESSA
    const tabelasRemessa = await sequelize.query(`
      SELECT 
        table_name,
        num_rows
      FROM all_tables
      WHERE UPPER(table_name) LIKE '%REMESSA%'
        AND owner = 'GERAL'
      ORDER BY table_name
    `, { type: QueryTypes.SELECT });

    resultado.tabelas_remessa = tabelasRemessa;

    // 5. Pegar código fonte das primeiras 3 procedures encontradas
    if (proceduresCodigo.length > 0) {
      for (let i = 0; i < Math.min(3, proceduresCodigo.length); i++) {
        const proc: any = proceduresCodigo[i];
        
        const codigoFonte = await sequelize.query(`
          SELECT 
            line,
            text
          FROM all_source
          WHERE name = :procName
            AND owner = 'GERAL'
          ORDER BY line
        `, {
          replacements: { procName: proc.name },
          type: QueryTypes.SELECT
        });

        resultado.codigo_fonte.push({
          nome: proc.name,
          tipo: proc.type,
          codigo: codigoFonte
        });
      }
    }

    // 6. Buscar também por procedures de título/boleto/cobrança
    const proceduresTitulo = await sequelize.query(`
      SELECT DISTINCT
        name,
        type
      FROM all_source
      WHERE (
          UPPER(text) LIKE '%TITULO%' OR 
          UPPER(text) LIKE '%COBRANCA%'
        )
        AND owner = 'GERAL'
        AND type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE')
      ORDER BY name
    `, { type: QueryTypes.SELECT });

    resultado.procedures_titulo_cobranca = proceduresTitulo;

    return res.status(200).json({
      sucesso: true,
      dados: resultado,
      resumo: {
        total_procedures_nome: proceduresNome.length,
        total_procedures_codigo: proceduresCodigo.length,
        total_procedures_cnab: proceduresCNAB.length,
        total_tabelas: tabelasRemessa.length,
        total_codigo_fonte: resultado.codigo_fonte.length
      }
    });

  } catch (error: any) {
    console.error('Erro ao investigar procedures:', error);
    return res.status(500).json({
      erro: 'Erro ao investigar procedures de remessa',
      detalhes: error.message
    });
  }
}

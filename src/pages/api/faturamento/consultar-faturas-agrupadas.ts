import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function consultarFaturasAgrupadas(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res
      .status(405)
      .json({ error: `Método ${req.method} não permitido` });
  }

  const { grupo_id, codigo_gp, incluir_detalhes = 'true' } = req.query;

  if (!grupo_id && !codigo_gp) {
    return res.status(400).json({
      error: 'É necessário fornecer grupo_id ou codigo_gp',
    });
  }

  try {
    const client = await getPgPool().connect();

    let query = '';
    let params: any[] = [];

    // Verificar se a tabela grupo_pagamento_fatura existe
    let hasRelationshipTable = false;
    try {
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'grupo_pagamento_fatura'
        );
      `);
      hasRelationshipTable = tableCheck.rows[0].exists;
    } catch (e) {
      console.warn('Erro ao verificar tabela grupo_pagamento_fatura:', e);
    }

    if (hasRelationshipTable && grupo_id) {
      // Consulta usando a tabela de relacionamento por ID do grupo
      query = `
        SELECT 
          f.*,
          ${
            incluir_detalhes === 'true'
              ? `
          c.nome AS cliente_nome,
          v.nome AS nome_vendedor,
          t.nome AS nome_transportadora,
          gpf.grupo_pagamento_id,
          gp.data_criacao AS data_criacao_grupo
          `
              : 'gpf.grupo_pagamento_id'
          }
        FROM grupo_pagamento_fatura gpf
        JOIN dbfatura f ON gpf.fatura_id = f.codfat
        ${
          incluir_detalhes === 'true'
            ? `
        LEFT JOIN dbclien c ON f.codcli = c.codcli
        LEFT JOIN dbvend v ON f.codvend = v.codvend
        LEFT JOIN dbtransp t ON f.codtransp = t.codtransp
        LEFT JOIN grupo_pagamento gp ON gpf.grupo_pagamento_id = gp.id
        `
            : ''
        }
        WHERE gpf.grupo_pagamento_id = $1
        ORDER BY f.data DESC, f.codfat
      `;
      params = [grupo_id];
    } else if (hasRelationshipTable && codigo_gp) {
      // Consulta usando a tabela de relacionamento por código do grupo
      query = `
        SELECT 
          f.*,
          ${
            incluir_detalhes === 'true'
              ? `
          c.nome AS cliente_nome,
          v.nome AS nome_vendedor,
          t.nome AS nome_transportadora,
          gpf.grupo_pagamento_id,
          gp.data_criacao AS data_criacao_grupo
          `
              : 'gpf.grupo_pagamento_id'
          }
        FROM grupo_pagamento_fatura gpf
        JOIN dbfatura f ON gpf.fatura_id = f.codfat
        ${
          incluir_detalhes === 'true'
            ? `
        LEFT JOIN dbclien c ON f.codcli = c.codcli
        LEFT JOIN dbvend v ON f.codvend = v.codvend
        LEFT JOIN dbtransp t ON f.codtransp = t.codtransp
        LEFT JOIN grupo_pagamento gp ON gpf.grupo_pagamento_id = gp.id
        `
            : ''
        }
        WHERE gp.codigo_gp = $1 OR gpf.grupo_pagamento_id = $1
        ORDER BY f.data DESC, f.codfat
      `;
      params = [codigo_gp];
    } else {
      // Fallback: consulta usando apenas a coluna codgp da dbfatura
      query = `
        SELECT 
          f.*,
          ${
            incluir_detalhes === 'true'
              ? `
          c.nome AS cliente_nome,
          v.nome AS nome_vendedor,
          t.nome AS nome_transportadora
          `
              : ''
          }
        FROM dbfatura f
        ${
          incluir_detalhes === 'true'
            ? `
        LEFT JOIN dbclien c ON f.codcli = c.codcli
        LEFT JOIN dbvend v ON f.codvend = v.codvend
        LEFT JOIN dbtransp t ON f.codtransp = t.codtransp
        `
            : ''
        }
        WHERE f.codgp = $1 AND f.agp = 'S'
        ORDER BY f.data DESC, f.codfat
      `;
      params = [codigo_gp];
    }

    const result = await client.query(query, params);
    client.release();

    // Estatísticas do grupo
    const faturas = result.rows;
    const totalFaturas = faturas.length;
    const valorTotal = faturas.reduce((sum, fatura) => {
      return sum + parseFloat(fatura.totalnf || 0);
    }, 0);

    const estatisticas = {
      total_faturas: totalFaturas,
      valor_total: valorTotal,
      metodo_consulta: hasRelationshipTable
        ? 'tabela_relacionamento'
        : 'coluna_codgp',
      grupo_id: grupo_id || null,
      codigo_gp: codigo_gp || faturas[0]?.codgp || null,
    };

    res.status(200).json({
      faturas,
      estatisticas,
      meta: {
        incluir_detalhes: incluir_detalhes === 'true',
        tem_tabela_relacionamento: hasRelationshipTable,
      },
    });
  } catch (err) {
    console.error('Erro ao consultar faturas agrupadas:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
}

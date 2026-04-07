import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { codgp } = req.query;

  if (!codgp) {
    return res
      .status(400)
      .json({ error: 'Código do grupo de pagamento é obrigatório.' });
  }

  // Convert codgp to integer if it's a string
  let codgpValue: number;
  if (typeof codgp === 'string') {
    const parsed = parseInt(codgp, 10);
    if (isNaN(parsed)) {
      return res
        .status(400)
        .json({ error: 'Código do grupo de pagamento inválido.' });
    }
    codgpValue = parsed;
  } else if (typeof codgp === 'number') {
    codgpValue = codgp;
  } else {
    return res
      .status(400)
      .json({ error: 'Código do grupo de pagamento inválido.' });
  }

  try {
    const client = await getPgPool().connect();

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

    let query = '';
    const params = [codgpValue];

    if (hasRelationshipTable) {
      // Tentar primeiro com a tabela de relacionamento
      query = `
        SELECT
          f.*,
          c.nome AS cliente_nome,
          v.nome AS nome_vendedor,
          t.nome AS nome_transportadora,
          gpf.grupo_pagamento_id,
          gp.data_criacao AS data_criacao_grupo,
          'tabela_relacionamento' AS metodo_consulta
        FROM grupo_pagamento_fatura gpf
        JOIN dbfatura f ON gpf.fatura_id = f.codfat
        LEFT JOIN dbclien c ON f.codcli = c.codcli
        LEFT JOIN dbvend v ON f.codvend = v.codvend
        LEFT JOIN dbtransp t ON f.codtransp = t.codtransp
        LEFT JOIN grupo_pagamento gp ON gpf.grupo_pagamento_id = gp.id
        WHERE gp.codigo_gp = $1 OR gpf.grupo_pagamento_id = $1
        ORDER BY f.data DESC, f.codfat
      `;

      const relationshipResult = await client.query(query, params);

      if (relationshipResult.rows.length > 0) {
        client.release();
        return res.status(200).json({
          faturas: relationshipResult.rows,
          metodo: 'tabela_relacionamento',
        });
      }
    }

    // Fallback: usar a consulta original com codgp
    query = `
      SELECT
        f.*,
        c.nome AS cliente_nome,
        v.nome AS nome_vendedor,
        t.nome AS nome_transportadora,
        CASE
          WHEN f.codgp IS NOT NULL THEN f.codgp
          ELSE NULL
        END AS grupo_pagamento,
        'coluna_codgp' AS metodo_consulta
      FROM dbfatura f
      LEFT JOIN dbclien c ON f.codcli = c.codcli
      LEFT JOIN dbvend v ON f.codvend = v.codvend
      LEFT JOIN dbtransp t ON f.codtransp = t.codtransp
      WHERE f.codgp = $1 AND f.agp = 'S'
      ORDER BY f.data DESC
    `;

    const result = await client.query(query, params);
    client.release();

    return res.status(200).json({
      faturas: result.rows,
      metodo: hasRelationshipTable ? 'codgp_fallback' : 'coluna_codgp',
    });
  } catch (error) {
    console.error('Erro ao buscar detalhes do grupo de pagamento:', error);
    return res
      .status(500)
      .json({ error: 'Erro ao buscar detalhes do grupo de pagamento.' });
  }
}

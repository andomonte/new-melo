import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function diagnosticarEstrutura(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res
      .status(405)
      .json({ error: `Método ${req.method} não permitido` });
  }

  try {
    const client = await getPgPool().connect();

    const diagnostico: any = {
      estrutura_grupo_pagamento_fatura: null,
      estrutura_dbfatura_codfat: null,
      dados_grupo_pagamento_fatura: [],
      exemplos_codfat: [],
      inconsistencias: [],
    };

    // 1. Verificar estrutura da tabela grupo_pagamento_fatura
    try {
      const estruturaGPF = await client.query(`
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'grupo_pagamento_fatura'
        ORDER BY ordinal_position
      `);
      diagnostico.estrutura_grupo_pagamento_fatura = estruturaGPF.rows;
    } catch (e: any) {
      diagnostico.estrutura_grupo_pagamento_fatura = { erro: e.message };
    }

    // 2. Verificar estrutura da coluna codfat na dbfatura
    try {
      const estruturaCodfat = await client.query(`
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'dbfatura'
        AND column_name = 'codfat'
      `);
      diagnostico.estrutura_dbfatura_codfat = estruturaCodfat.rows[0] || null;
    } catch (e: any) {
      diagnostico.estrutura_dbfatura_codfat = { erro: e.message };
    }

    // 3. Verificar dados existentes na grupo_pagamento_fatura
    try {
      const dadosGPF = await client.query(`
        SELECT 
          id,
          grupo_pagamento_id,
          fatura_id,
          pg_typeof(fatura_id) as tipo_fatura_id,
          length(fatura_id::text) as tamanho_fatura_id
        FROM grupo_pagamento_fatura 
        LIMIT 10
      `);
      diagnostico.dados_grupo_pagamento_fatura = dadosGPF.rows;
    } catch (e: any) {
      diagnostico.dados_grupo_pagamento_fatura = { erro: e.message };
    }

    // 4. Exemplos de codfat da dbfatura
    try {
      const exemploCodfat = await client.query(`
        SELECT 
          codfat,
          pg_typeof(codfat) as tipo_codfat,
          length(codfat) as tamanho_codfat
        FROM dbfatura 
        WHERE codfat IS NOT NULL 
        ORDER BY codfat DESC
        LIMIT 5
      `);
      diagnostico.exemplos_codfat = exemploCodfat.rows;
    } catch (e: any) {
      diagnostico.exemplos_codfat = { erro: e.message };
    }

    // 5. Verificar inconsistências se ambas as tabelas existem
    try {
      if (
        Array.isArray(diagnostico.dados_grupo_pagamento_fatura) &&
        diagnostico.dados_grupo_pagamento_fatura.length > 0
      ) {
        const inconsistencias = await client.query(`
          SELECT 
            'fatura_id_nao_existe_em_dbfatura' as tipo_inconsistencia,
            gpf.fatura_id,
            COUNT(*) as quantidade
          FROM grupo_pagamento_fatura gpf
          LEFT JOIN dbfatura f ON gpf.fatura_id::text = f.codfat
          WHERE f.codfat IS NULL
          GROUP BY gpf.fatura_id
          
          UNION ALL
          
          SELECT 
            'fatura_id_tipo_incompativel' as tipo_inconsistencia,
            gpf.fatura_id,
            1 as quantidade
          FROM grupo_pagamento_fatura gpf
          WHERE NOT (gpf.fatura_id ~ '^[A-Za-z0-9]+$')
          LIMIT 10
        `);
        diagnostico.inconsistencias = inconsistencias.rows;
      }
    } catch (e: any) {
      diagnostico.inconsistencias = { erro: e.message };
    }

    client.release();

    // 6. Análise e recomendações
    const analise = {
      problema_identificado: false,
      descricao_problema: '',
      solucao_recomendada: '',
      estrutura_correta: false,
    };

    // Verificar se fatura_id está como INTEGER quando deveria ser VARCHAR
    const colunaTipoIncorreto = Array.isArray(
      diagnostico.estrutura_grupo_pagamento_fatura,
    )
      ? diagnostico.estrutura_grupo_pagamento_fatura.find(
          (col: any) =>
            col.column_name === 'fatura_id' && col.data_type === 'integer',
        )
      : null;

    if (colunaTipoIncorreto) {
      analise.problema_identificado = true;
      analise.descricao_problema =
        'A coluna fatura_id está definida como INTEGER, mas deveria ser VARCHAR(9) para corresponder ao codfat da tabela dbfatura';
      analise.solucao_recomendada =
        'Execute o script de correção: scripts/corrigir_fatura_id_tipo.sql';
    } else {
      analise.estrutura_correta = true;
    }

    res.status(200).json({
      diagnostico,
      analise,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Erro no diagnóstico:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
}

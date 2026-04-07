import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

interface IndiceInfo {
  indexname: string;
  indexdef: string;
}

interface ColunaInfo {
  column_name: string;
  data_type: string;
  character_maximum_length: number | null;
  is_nullable: string;
}

interface VerificacaoBanco {
  tabela_dbfatura: {
    existe: boolean;
    coluna_codgp: boolean;
    coluna_agp: boolean;
    indices: IndiceInfo[];
  };
  tabela_grupo_pagamento: {
    existe: boolean;
    estrutura: ColunaInfo[];
  };
  tabela_grupo_pagamento_fatura: {
    existe: boolean;
    estrutura: ColunaInfo[];
  };
  problemas: string[];
  acoes_recomendadas: string[];
}

export default async function verificarEstruturaBanco(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res
      .status(405)
      .json({ error: `Método ${req.method} não permitido` });
  }

  const { acao = 'verificar' } = req.method === 'POST' ? req.body : req.query;

  try {
    const client = await getPgPool().connect();

    const verificacao: VerificacaoBanco = {
      tabela_dbfatura: {
        existe: false,
        coluna_codgp: false,
        coluna_agp: false,
        indices: [],
      },
      tabela_grupo_pagamento: {
        existe: false,
        estrutura: [],
      },
      tabela_grupo_pagamento_fatura: {
        existe: false,
        estrutura: [],
      },
      problemas: [],
      acoes_recomendadas: [],
    };

    // 1. Verificar tabela dbfatura e suas colunas
    try {
      const dbfaturaCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'dbfatura'
        ) as existe_tabela,
        EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'dbfatura' AND column_name = 'codgp'
        ) as existe_codgp,
        EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'dbfatura' AND column_name = 'agp'
        ) as existe_agp
      `);

      const result = dbfaturaCheck.rows[0];
      verificacao.tabela_dbfatura.existe = result.existe_tabela;
      verificacao.tabela_dbfatura.coluna_codgp = result.existe_codgp;
      verificacao.tabela_dbfatura.coluna_agp = result.existe_agp;

      if (!result.existe_codgp) {
        verificacao.problemas.push(
          'Coluna codgp não existe na tabela dbfatura',
        );
        verificacao.acoes_recomendadas.push(
          'Execute: scripts/verificar_criar_colunas_agrupamento.sql',
        );
      }

      if (!result.existe_agp) {
        verificacao.problemas.push('Coluna agp não existe na tabela dbfatura');
        verificacao.acoes_recomendadas.push(
          'Execute: scripts/verificar_criar_colunas_agrupamento.sql',
        );
      }
    } catch (e: any) {
      verificacao.problemas.push(`Erro ao verificar dbfatura: ${e.message}`);
    }

    // 2. Verificar índices da dbfatura
    try {
      const indicesResult = await client.query(`
        SELECT indexname, indexdef
        FROM pg_indexes 
        WHERE tablename = 'dbfatura' 
        AND (indexdef LIKE '%codgp%' OR indexdef LIKE '%agp%')
      `);
      verificacao.tabela_dbfatura.indices = indicesResult.rows;
    } catch (e: any) {
      console.warn('Erro ao verificar índices:', e.message);
    }

    // 3. Verificar tabela grupo_pagamento
    try {
      const grupoPagamentoCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'grupo_pagamento'
        )
      `);
      verificacao.tabela_grupo_pagamento.existe =
        grupoPagamentoCheck.rows[0].exists;

      if (verificacao.tabela_grupo_pagamento.existe) {
        const estruturaResult = await client.query(`
          SELECT column_name, data_type, character_maximum_length, is_nullable
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'grupo_pagamento'
          ORDER BY ordinal_position
        `);
        verificacao.tabela_grupo_pagamento.estrutura = estruturaResult.rows;
      } else {
        verificacao.acoes_recomendadas.push(
          'Execute: scripts/criar_tabelas_agrupamento.sql',
        );
      }
    } catch (e: any) {
      verificacao.problemas.push(
        `Erro ao verificar grupo_pagamento: ${e.message}`,
      );
    }

    // 4. Verificar tabela grupo_pagamento_fatura
    try {
      const grupoFaturaCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'grupo_pagamento_fatura'
        )
      `);
      verificacao.tabela_grupo_pagamento_fatura.existe =
        grupoFaturaCheck.rows[0].exists;

      if (verificacao.tabela_grupo_pagamento_fatura.existe) {
        const estruturaResult = await client.query(`
          SELECT column_name, data_type, character_maximum_length, is_nullable
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'grupo_pagamento_fatura'
          ORDER BY ordinal_position
        `);
        verificacao.tabela_grupo_pagamento_fatura.estrutura =
          estruturaResult.rows;

        // Verificar se fatura_id tem o tipo correto
        const faturaIdCol = estruturaResult.rows.find(
          (col) => col.column_name === 'fatura_id',
        );
        if (faturaIdCol && faturaIdCol.data_type === 'integer') {
          verificacao.problemas.push(
            'Coluna fatura_id tem tipo incorreto (integer ao invés de varchar)',
          );
          verificacao.acoes_recomendadas.push(
            'Execute: scripts/corrigir_fatura_id_tipo.sql',
          );
        }
      } else {
        verificacao.acoes_recomendadas.push(
          'Execute: scripts/criar_apenas_grupo_pagamento_fatura.sql',
        );
      }
    } catch (e: any) {
      verificacao.problemas.push(
        `Erro ao verificar grupo_pagamento_fatura: ${e.message}`,
      );
    }

    // 5. Se ação for 'corrigir', tentar corrigir problemas automaticamente
    if (acao === 'corrigir' && req.method === 'POST') {
      const correcoes = [];

      // Corrigir colunas faltantes na dbfatura
      if (!verificacao.tabela_dbfatura.coluna_codgp) {
        try {
          await client.query('ALTER TABLE dbfatura ADD COLUMN codgp INTEGER');
          await client.query(
            'CREATE INDEX IF NOT EXISTS idx_dbfatura_codgp ON dbfatura(codgp)',
          );
          correcoes.push('Coluna codgp criada na tabela dbfatura');
        } catch (e: any) {
          correcoes.push(`Erro ao criar coluna codgp: ${e.message}`);
        }
      }

      if (!verificacao.tabela_dbfatura.coluna_agp) {
        try {
          await client.query(
            "ALTER TABLE dbfatura ADD COLUMN agp VARCHAR(1) DEFAULT 'N'",
          );
          correcoes.push('Coluna agp criada na tabela dbfatura');
        } catch (e: any) {
          correcoes.push(`Erro ao criar coluna agp: ${e.message}`);
        }
      }

      client.release();
      return res.status(200).json({
        verificacao,
        correcoes,
        timestamp: new Date().toISOString(),
      });
    }

    client.release();

    // Análise final
    const analise = {
      estrutura_completa: verificacao.problemas.length === 0,
      sistema_funcional:
        verificacao.tabela_dbfatura.coluna_codgp &&
        verificacao.tabela_dbfatura.coluna_agp,
      total_problemas: verificacao.problemas.length,
      pronto_para_agrupamento:
        verificacao.tabela_dbfatura.coluna_codgp &&
        verificacao.tabela_dbfatura.coluna_agp,
    };

    res.status(200).json({
      verificacao,
      analise,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Erro na verificação da estrutura:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
}

import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function sincronizarAgrupamentos(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res
      .status(405)
      .json({ error: `Método ${req.method} não permitido` });
  }

  const { acao = 'verificar' } = req.body;

  try {
    const client = await getPgPool().connect();

    // Verificar se as tabelas existem
    const tablesCheck = await client.query(`
      SELECT 
        (SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'grupo_pagamento'
        )) as tem_grupo_pagamento,
        (SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'grupo_pagamento_fatura'
        )) as tem_grupo_pagamento_fatura,
        (SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'dbfatura' AND column_name = 'codgp'
        )) as tem_coluna_codgp
    `);

    const {
      tem_grupo_pagamento,
      tem_grupo_pagamento_fatura,
      tem_coluna_codgp,
    } = tablesCheck.rows[0];

    if (acao === 'verificar') {
      // Apenas verificar o estado atual
      const estatisticas: any = {
        estrutura: {
          tem_grupo_pagamento,
          tem_grupo_pagamento_fatura,
          tem_coluna_codgp,
        },
        dados: {},
      };

      if (tem_coluna_codgp) {
        // Contar faturas agrupadas pela coluna codgp
        const faturasCodegp = await client.query(`
          SELECT 
            COUNT(*) as total_faturas_agrupadas,
            COUNT(DISTINCT codgp) as total_grupos_distintos
          FROM dbfatura 
          WHERE codgp IS NOT NULL AND agp = 'S'
        `);

        estatisticas.dados.por_coluna_codgp = faturasCodegp.rows[0];
      }

      if (tem_grupo_pagamento_fatura) {
        // Contar faturas agrupadas pela tabela de relacionamento
        const faturasRelacionamento = await client.query(`
          SELECT 
            COUNT(*) as total_faturas_agrupadas,
            COUNT(DISTINCT grupo_pagamento_id) as total_grupos_distintos
          FROM grupo_pagamento_fatura
        `);

        estatisticas.dados.por_tabela_relacionamento =
          faturasRelacionamento.rows[0];
      }

      if (tem_coluna_codgp && tem_grupo_pagamento_fatura) {
        // Comparar inconsistências
        const inconsistencias = await client.query(`
          -- Faturas que estão em codgp mas não na tabela de relacionamento
          SELECT 'codgp_sem_relacionamento' as tipo, COUNT(*) as quantidade
          FROM dbfatura f
          WHERE f.codgp IS NOT NULL AND f.agp = 'S'
            AND NOT EXISTS (
              SELECT 1 FROM grupo_pagamento_fatura gpf 
              WHERE gpf.fatura_id = f.codfat
            )
          
          UNION ALL
          
          -- Faturas que estão na tabela de relacionamento mas não em codgp
          SELECT 'relacionamento_sem_codgp' as tipo, COUNT(*) as quantidade
          FROM grupo_pagamento_fatura gpf
          JOIN dbfatura f ON gpf.fatura_id = f.codfat
          WHERE f.codgp IS NULL OR f.agp != 'S'
        `);

        estatisticas.dados.inconsistencias = inconsistencias.rows;
      }

      client.release();
      return res.status(200).json(estatisticas);
    }

    if (acao === 'sincronizar') {
      if (!tem_grupo_pagamento_fatura) {
        client.release();
        return res.status(400).json({
          error:
            'Tabela grupo_pagamento_fatura não existe. Execute o script de criação primeiro.',
        });
      }

      await client.query('BEGIN');

      const relatorioSincronizacao = {
        grupos_criados: 0,
        relacionamentos_criados: 0,
        relacionamentos_removidos: 0,
        faturas_atualizadas: 0,
      };

      if (tem_grupo_pagamento && tem_coluna_codgp) {
        // Sincronizar da coluna codgp para a tabela de relacionamento

        // 1. Criar grupos que não existem
        const gruposCriados = await client.query(`
          INSERT INTO grupo_pagamento (codigo_gp, cliente_id, data_criacao, status, usuario_criacao)
          SELECT DISTINCT 
            f.codgp,
            f.codcli,
            MIN(f.data) as data_criacao,
            'ATIVO',
            'sincronização'
          FROM dbfatura f 
          WHERE f.codgp IS NOT NULL 
            AND f.agp = 'S'
            AND NOT EXISTS (SELECT 1 FROM grupo_pagamento gp WHERE gp.codigo_gp = f.codgp)
          GROUP BY f.codgp, f.codcli
          RETURNING codigo_gp
        `);
        relatorioSincronizacao.grupos_criados = gruposCriados.rows.length;

        // 2. Criar relacionamentos que não existem
        const relacionamentosCriados = await client.query(`
          INSERT INTO grupo_pagamento_fatura (grupo_pagamento_id, fatura_id, data_inclusao, usuario_inclusao)
          SELECT DISTINCT 
            gp.id,
            f.codfat,
            NOW(),
            'sincronização'
          FROM dbfatura f
          JOIN grupo_pagamento gp ON gp.codigo_gp = f.codgp
          WHERE f.codgp IS NOT NULL 
            AND f.agp = 'S'
            AND NOT EXISTS (
              SELECT 1 FROM grupo_pagamento_fatura gpf 
              WHERE gpf.grupo_pagamento_id = gp.id 
              AND gpf.fatura_id = f.codfat
            )
          RETURNING fatura_id
        `);
        relatorioSincronizacao.relacionamentos_criados =
          relacionamentosCriados.rows.length;

        // 3. Remover relacionamentos órfãos
        const relacionamentosRemovidos = await client.query(`
          DELETE FROM grupo_pagamento_fatura gpf
          WHERE NOT EXISTS (
            SELECT 1 FROM dbfatura f 
            WHERE f.codfat = gpf.fatura_id 
            AND f.codgp IS NOT NULL 
            AND f.agp = 'S'
          )
          RETURNING fatura_id
        `);
        relatorioSincronizacao.relacionamentos_removidos =
          relacionamentosRemovidos.rows.length;
      }

      await client.query('COMMIT');
      client.release();

      return res.status(200).json({
        message: 'Sincronização concluída com sucesso',
        relatorio: relatorioSincronizacao,
      });
    }

    client.release();
    return res
      .status(400)
      .json({
        error: 'Ação não reconhecida. Use "verificar" ou "sincronizar".',
      });
  } catch (err) {
    console.error('Erro na sincronização de agrupamentos:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
}

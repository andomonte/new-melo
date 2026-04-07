import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  switch (req.method) {
    case 'POST':
      return criarGrupoPagamento(req, res);
    case 'GET':
      return listarGruposPagamento(req, res);
    case 'PUT':
      return atualizarGrupoPagamento(req, res);
    default:
      res.setHeader('Allow', ['POST', 'GET', 'PUT']);
      return res
        .status(405)
        .json({ error: `Método ${req.method} não permitido` });
  }
}

// Criar um novo grupo de pagamento
async function criarGrupoPagamento(req: NextApiRequest, res: NextApiResponse) {
  const { codfats, codcli } = req.body;

  if (!codfats || !Array.isArray(codfats) || codfats.length === 0) {
    return res.status(400).json({ error: 'Lista de faturas é obrigatória.' });
  }

  if (!codcli) {
    return res.status(400).json({ error: 'Código do cliente é obrigatório.' });
  }

  const client = await getPgPool().connect();

  try {
    await client.query('BEGIN');

    // Verificar se todas as faturas pertencem ao mesmo cliente
    const faturasQuery = `
      SELECT codfat, codcli, cobranca
      FROM dbfatura
      WHERE codfat = ANY($1)
    `;
    const faturasResult = await client.query(faturasQuery, [codfats]);

    if (faturasResult.rows.length !== codfats.length) {
      await client.query('ROLLBACK');
      return res
        .status(400)
        .json({ error: 'Uma ou mais faturas não foram encontradas.' });
    }

    // Verificar se todas as faturas pertencem ao mesmo cliente
    const clientes = [...new Set(faturasResult.rows.map((f) => f.codcli))];
    if (clientes.length > 1 || clientes[0] !== codcli) {
      await client.query('ROLLBACK');
      return res
        .status(400)
        .json({ error: 'Todas as faturas devem pertencer ao mesmo cliente.' });
    }

    // Verificar se alguma fatura já tem cobrança gerada e foi paga ou está no banco
    const faturasComCobranca = faturasResult.rows.filter(
      (f) => f.cobranca === 'S',
    );
    if (faturasComCobranca.length > 0) {
      // Verificar se as cobranças foram pagas ou estão no banco
      const codfatsComCobranca = faturasComCobranca.map((f) => f.codfat);
      const cobrancasQuery = `
        SELECT cod_fat, cod_receb, dt_pgto
        FROM dbreceb
        WHERE cod_fat = ANY($1) AND cancel = 'N'
      `;
      const cobrancasResult = await client.query(cobrancasQuery, [
        codfatsComCobranca,
      ]);

      const cobrancasPagas = cobrancasResult.rows.filter(
        (c) => c.dt_pgto !== null,
      );
      if (cobrancasPagas.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Não é possível agrupar faturas com cobranças já pagas.',
        });
      }
    }

    // Cancelar cobranças existentes se necessário
    for (const fatura of faturasComCobranca) {
      await client.query(
        `UPDATE dbfatura SET cobranca = 'N' WHERE codfat = $1`,
        [fatura.codfat],
      );

      await client.query(
        `UPDATE dbreceb SET cancel = 'S' WHERE cod_fat = $1 AND cancel = 'N'`,
        [fatura.codfat],
      );
    }

    // Criar novo grupo de pagamento com numeração sequencial
    const gpQuery = `
      SELECT COALESCE(MAX(codgp), 0) + 1 as next_gp
      FROM dbfatura
      WHERE codgp IS NOT NULL
    `;
    const gpResult = await client.query(gpQuery);
    const nextGpNumber = gpResult.rows[0].next_gp;
    const novoCodgp = nextGpNumber;

    // Calcular valor total das faturas para a cobrança agrupada
    const totalQuery = `
      SELECT SUM(total) as valor_total
      FROM dbfatura
      WHERE codfat = ANY($1)
    `;
    const totalResult = await client.query(totalQuery, [codfats]);
    const valorTotalGrupo = totalResult.rows[0].valor_total || 0;

    // Associar as faturas ao novo grupo de pagamento
    await client.query(
      `UPDATE dbfatura SET codgp = $1, agp = 'S' WHERE codfat = ANY($2)`,
      [novoCodgp, codfats],
    );

    // INSERIR REGISTRO NA TABELA grupo_pagamento (se existir)
    let grupoId = null;
    try {
      const grupoResult = await client.query(
        `INSERT INTO grupo_pagamento (codigo_gp, cliente_id, data_criacao, status, usuario_criacao) VALUES ($1, $2, NOW(), 'ATIVO', 'sistema') RETURNING id`,
        [novoCodgp, codcli],
      );
      grupoId = grupoResult.rows[0].id;
      console.log(
        'Registro criado na tabela grupo_pagamento:',
        grupoResult.rows[0],
      );
    } catch (err) {
      // Se a tabela grupo_pagamento não existir ou houver erro, continua normalmente
      console.warn('Não foi possível inserir na tabela grupo_pagamento:', err);
    }

    // INSERIR REGISTROS NA TABELA grupo_pagamento_fatura (tabela de relacionamento)
    try {
      for (const codfat of codfats) {
        await client.query(
          `INSERT INTO grupo_pagamento_fatura (grupo_pagamento_id, fatura_id) VALUES ($1, $2)`,
          [grupoId || novoCodgp, codfat],
        );
      }
      console.log(
        `Relacionamentos criados na tabela grupo_pagamento_fatura para ${codfats.length} faturas`,
      );
    } catch (err) {
      // Se a tabela grupo_pagamento_fatura não existir, continua normalmente
      console.warn(
        'Não foi possível inserir na tabela grupo_pagamento_fatura:',
        err,
      );
    }

    // CRIAR COBRANÇA AUTOMATICA PARA O GRUPO
    try {
      // Criar uma entrada na dbfatura para o grupo (registro de cobrança)
      const codfatGrupo = `GP${novoCodgp.toString().padStart(7, '0')}`;

      await client.query(
        `INSERT INTO dbfatura (
          codfat, codcli, total, cobranca, frmfat, 
          data, codgp, agp, obs
        ) VALUES ($1, $2, $3, 'S', 'B', NOW(), $4, 'S', $5)`,
        [
          codfatGrupo,
          codcli,
          valorTotalGrupo,
          novoCodgp,
          `Cobrança agrupada - Faturas: ${codfats.join(', ')}`,
        ],
      );

      // Gerar cobrança no dbreceb
      const { rows } = await client.query(
        `SELECT nextval('seq_cod_receb') as next_id`,
      );
      const nextId = rows[0].next_id;
      const codReceb = nextId.toString().padStart(9, '0');

      // Vencimento padrão: 30 dias a partir de hoje
      const dataVencimento = new Date();
      dataVencimento.setDate(dataVencimento.getDate() + 30);

      await client.query(
        `INSERT INTO dbreceb (
          cod_receb, codcli, cod_fat, dt_venc, valor_pgto, 
          nro_doc, forma_fat, banco
        ) VALUES ($1, $2, $3, $4, $5, $6, 'B', 1)`,
        [
          codReceb,
          codcli,
          codfatGrupo,
          dataVencimento.toISOString().split('T')[0], // YYYY-MM-DD
          valorTotalGrupo,
          `GRUPO-${novoCodgp}`,
        ],
      );

      console.log(`✅ Cobrança automática criada para o grupo ${novoCodgp}:`, {
        codfatGrupo,
        codReceb,
        valorTotal: valorTotalGrupo,
        vencimento: dataVencimento.toISOString().split('T')[0],
      });
    } catch (err) {
      console.warn('⚠️ Erro ao criar cobrança automática para o grupo:', err);
      // Não falha o processo, apenas registra o erro
    }

    await client.query('COMMIT');

    return res.status(200).json({
      message: 'Grupo de pagamento criado com sucesso.',
      codgp: novoCodgp,
      faturasAtualizadas: codfats,
      cobrancaGerada: {
        codfatGrupo: `GP${novoCodgp.toString().padStart(7, '0')}`,
        valorTotal: valorTotalGrupo,
        vencimento: (() => {
          const dataVenc = new Date();
          dataVenc.setDate(dataVenc.getDate() + 30);
          return dataVenc.toISOString().split('T')[0];
        })(),
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao criar grupo de pagamento:', error);
    return res.status(500).json({ error: 'Erro ao criar grupo de pagamento.' });
  } finally {
    client.release();
  }
}

// Listar grupos de pagamento
async function listarGruposPagamento(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { codcli } = req.query;

  try {
    const client = await getPgPool().connect();

    let query = `
      SELECT DISTINCT codgp
      FROM dbfatura
      WHERE codgp IS NOT NULL AND agp = 'S'
    `;
    const params: any[] = [];

    if (codcli && typeof codcli === 'string') {
      query += ` AND codcli = $1`;
      params.push(codcli);
    }

    query += ` ORDER BY codgp`;

    const result = await client.query(query, params);
    client.release();

    return res.status(200).json({ grupos: result.rows });
  } catch (error) {
    console.error('Erro ao listar grupos de pagamento:', error);
    return res
      .status(500)
      .json({ error: 'Erro ao listar grupos de pagamento.' });
  }
}

// Atualizar grupo de pagamento (adicionar/remover faturas)
async function atualizarGrupoPagamento(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { codgp, adicionarFaturas, removerFaturas } = req.body;

  if (!codgp) {
    return res
      .status(400)
      .json({ error: 'Código do grupo de pagamento é obrigatório.' });
  }

  const client = await getPgPool().connect();

  try {
    await client.query('BEGIN');

    // Adicionar faturas ao grupo
    if (
      adicionarFaturas &&
      Array.isArray(adicionarFaturas) &&
      adicionarFaturas.length > 0
    ) {
      // Verificar se as faturas pertencem ao mesmo cliente do grupo
      const faturasQuery = `
        SELECT codfat, codcli, cobranca
        FROM dbfatura
        WHERE codfat = ANY($1)
      `;
      const faturasResult = await client.query(faturasQuery, [
        adicionarFaturas,
      ]);

      if (faturasResult.rows.length !== adicionarFaturas.length) {
        await client.query('ROLLBACK');
        return res
          .status(400)
          .json({ error: 'Uma ou mais faturas não foram encontradas.' });
      }

      // Verificar se alguma fatura já tem cobrança gerada e foi paga
      const faturasComCobranca = faturasResult.rows.filter(
        (f) => f.cobranca === 'S',
      );
      if (faturasComCobranca.length > 0) {
        const codfatsComCobranca = faturasComCobranca.map((f) => f.codfat);
        const cobrancasQuery = `
          SELECT cod_fat, dt_pgto
          FROM dbreceb
          WHERE cod_fat = ANY($1) AND cancel = 'N' AND dt_pgto IS NOT NULL
        `;
        const cobrancasResult = await client.query(cobrancasQuery, [
          codfatsComCobranca,
        ]);

        if (cobrancasResult.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: 'Não é possível adicionar faturas com cobranças já pagas.',
          });
        }
      }

      // Cancelar cobranças existentes se necessário
      for (const fatura of faturasComCobranca) {
        await client.query(
          `UPDATE dbfatura SET cobranca = 'N' WHERE codfat = $1`,
          [fatura.codfat],
        );

        await client.query(
          `UPDATE dbreceb SET cancel = 'S' WHERE cod_fat = $1 AND cancel = 'N'`,
          [fatura.codfat],
        );
      }

      // Associar as faturas ao grupo
      await client.query(
        `UPDATE dbfatura SET codgp = $1, agp = 'S' WHERE codfat = ANY($2)`,
        [codgp, adicionarFaturas],
      );

      // INSERIR REGISTROS NA TABELA grupo_pagamento_fatura (tabela de relacionamento)
      try {
        // Buscar o ID do grupo_pagamento se existir
        let grupoId = null;
        try {
          const grupoResult = await client.query(
            `SELECT id FROM grupo_pagamento WHERE codigo_gp = $1 LIMIT 1`,
            [codgp],
          );
          if (grupoResult.rows.length > 0) {
            grupoId = grupoResult.rows[0].id;
          }
        } catch (err) {
          console.warn('Não foi possível buscar grupo_pagamento:', err);
        }

        // Inserir os relacionamentos
        for (const codfat of adicionarFaturas) {
          await client.query(
            `INSERT INTO grupo_pagamento_fatura (grupo_pagamento_id, fatura_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [grupoId || codgp, codfat],
          );
        }
        console.log(
          `Relacionamentos adicionados na tabela grupo_pagamento_fatura para ${adicionarFaturas.length} faturas`,
        );
      } catch (err) {
        console.warn(
          'Não foi possível inserir na tabela grupo_pagamento_fatura:',
          err,
        );
      }
    }

    // Remover faturas do grupo
    if (
      removerFaturas &&
      Array.isArray(removerFaturas) &&
      removerFaturas.length > 0
    ) {
      await client.query(
        `UPDATE dbfatura SET codgp = NULL, agp = 'N' WHERE codfat = ANY($1)`,
        [removerFaturas],
      );

      // REMOVER REGISTROS DA TABELA grupo_pagamento_fatura (tabela de relacionamento)
      try {
        for (const codfat of removerFaturas) {
          await client.query(
            `DELETE FROM grupo_pagamento_fatura WHERE fatura_id = $1`,
            [codfat],
          );
        }
        console.log(
          `Relacionamentos removidos da tabela grupo_pagamento_fatura para ${removerFaturas.length} faturas`,
        );
      } catch (err) {
        console.warn(
          'Não foi possível remover da tabela grupo_pagamento_fatura:',
          err,
        );
      }
    }

    await client.query('COMMIT');

    return res.status(200).json({
      message: 'Grupo de pagamento atualizado com sucesso.',
      codgp,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao atualizar grupo de pagamento:', error);
    return res
      .status(500)
      .json({ error: 'Erro ao atualizar grupo de pagamento.' });
  } finally {
    client.release();
  }
}

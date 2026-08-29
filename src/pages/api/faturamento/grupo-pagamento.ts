import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { inserirCobrancaGP } from '@/lib/faturamento/inserirCobrancaGP';

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
// cobranca_dados (opcional): { banco, tipofat, parcelas:[{vencimento,valor,dias}] } — a
// cobrança do grupo configurada na tela. Sem ele, o grupo é criado sem títulos (raro).
async function criarGrupoPagamento(req: NextApiRequest, res: NextApiResponse) {
  const { codfats, codcli, cobranca_dados } = req.body;

  if (!codfats || !Array.isArray(codfats) || codfats.length === 0) {
    return res.status(400).json({ error: 'Lista de faturas é obrigatória.' });
  }

  if (!codcli) {
    return res.status(400).json({ error: 'Código do cliente é obrigatório.' });
  }

  // REGRA (fiel ao Delphi "Gerar Cobrança Posterior"): a cobrança é dirigida pelos prazos
  // → sem parcela, não há título (CALCULAR_PARCELAS conta dbpzfataux). Se a intenção é
  // gerar cobrança (cobranca_dados presente), exige ao menos uma parcela — senão criaria
  // um GP com cobranca='S' e ZERO títulos (estado quebrado).
  if (cobranca_dados != null) {
    const parcelasCob = Array.isArray(cobranca_dados.parcelas)
      ? cobranca_dados.parcelas
      : [];
    if (parcelasCob.length === 0) {
      return res.status(400).json({
        error:
          'Gere ao menos uma parcela para a cobrança (informe intervalo + quantidade e clique em "Gerar parcelas").',
      });
    }
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

    // ===== Numeração da GP (fiel ao Delphi MAX(codgp)+1, SEM colidir com o migrado) =====
    // O histórico Oracle no dbreceb.codgp vai até ~663748. Numeramos ACIMA do maior codgp
    // entre dbgpfatura, dbreceb e dbfatura para nunca reusar um grupo migrado.
    const gpMax = await client.query(
      `SELECT (GREATEST(
         COALESCE((SELECT MAX(codgp) FROM dbgpfatura), 0),
         COALESCE((SELECT MAX(codgp) FROM dbreceb  WHERE codgp IS NOT NULL), 0),
         COALESCE((SELECT MAX(codgp) FROM dbfatura WHERE codgp IS NOT NULL), 0)
       )::bigint + 1) AS next_gp`,
    );
    const novoCodgp = Number(gpMax.rows[0].next_gp);

    // Cabeçalho do grupo (dbgpfatura) — igual ao AGRUPAMENTO.GPFATURA_INCLUIR.
    await client.query(
      `INSERT INTO dbgpfatura (codgp, codcli, dtagrupamento, dtatualizacao)
       VALUES ($1, $2, NOW(), NOW())`,
      [novoCodgp, codcli],
    );

    // Cancela a cobrança INDIVIDUAL de cada fatura (TCOBRANCA.COBRANCA_CANCELAR_FAT):
    // títulos abertos → cancel='S'; remove os prazos antigos da fatura (PRAZO_DELETAR_FAT).
    await client.query(
      `UPDATE dbreceb SET cancel = 'S'
        WHERE cod_fat = ANY($1) AND cancel = 'N' AND dt_pgto IS NULL AND COALESCE(rec,'N') <> 'S'`,
      [codfats],
    );
    await client.query(`DELETE FROM dbpzfat WHERE codfat = ANY($1)`, [codfats]);

    // Vincula os membros ao grupo (dbfatura.codgp/agp='S'); a cobrança passa a ser do grupo.
    await client.query(
      `UPDATE dbfatura SET codgp = $1, agp = 'S', cobranca = 'S' WHERE codfat = ANY($2)`,
      [novoCodgp, codfats],
    );

    // ===== Cobrança do GRUPO (dbreceb.codgp + dbpzfat) — fiel ao TCOBRANCA =====
    // Títulos com codgp, cod_fat=NULL, tipo='G', nosso número por banco; prazos em dbpzfat.
    let parcelasGeradas = 0;
    if (cobranca_dados && Array.isArray(cobranca_dados.parcelas) && cobranca_dados.parcelas.length > 0) {
      await inserirCobrancaGP(client, {
        codgp: novoCodgp,
        codcli,
        banco: cobranca_dados.banco,
        tipofat: cobranca_dados.tipofat,
        parcelas: cobranca_dados.parcelas,
        codfatsMembros: codfats,
      });
      parcelasGeradas = cobranca_dados.parcelas.length;
    }

    // Tabelas auxiliares do web (não fazem parte do modelo Delphi) — best-effort.
    try {
      const gr = await client.query(
        `INSERT INTO grupo_pagamento (codigo_gp, cliente_id, data_criacao, status, usuario_criacao)
         VALUES ($1, $2, NOW(), 'ATIVO', 'sistema') RETURNING id`,
        [novoCodgp, codcli],
      );
      const grupoId = gr.rows[0].id;
      for (const codfat of codfats) {
        await client.query(
          `INSERT INTO grupo_pagamento_fatura (grupo_pagamento_id, fatura_id) VALUES ($1, $2)`,
          [grupoId, codfat],
        );
      }
    } catch (err) {
      console.warn('grupo_pagamento (web-only) não gravado:', err);
    }

    await client.query('COMMIT');

    return res.status(200).json({
      message: 'Grupo de pagamento criado com sucesso.',
      codgp: novoCodgp,
      faturasAtualizadas: codfats,
      parcelasGeradas,
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

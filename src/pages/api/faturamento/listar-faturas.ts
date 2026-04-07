import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const operadoresSQL: Record<string, string> = {
  igual: '=',
  diferente: '!=',
  contém: 'ILIKE',
  começa: 'ILIKE',
  termina: 'ILIKE',
  maior: '>',
  menor: '<',
  maior_igual: '>=',
  menor_igual: '<=',
};

const colunasValidas = [
  'codfat',
  'nroform',
  'cliente_nome',
  'totalnf',
  'data',
  'codvend',
  'codtransp',
  'cancel',
  'cobranca',
  'nfs',
  'codgp',
  'grupo_pagamento',
  'nfe_status',
  'mensagem_rejeicao',
  'denegada',
  'motivocancelamento',
];

export default async function listarFaturas(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const page = parseInt(req.query.page as string) || 1;
  const perPage = parseInt(req.query.perPage as string) || 10;
  const filtrosRaw = req.query.filtros;

  console.log('🔍 API listar-faturas - Parâmetros recebidos:', {
    page,
    perPage,
    filtrosRaw,
  });

  let filtros: {
    campo: string;
    tipo: string;
    valor: string;
    global?: boolean;
  }[] = [];

  try {
    if (typeof filtrosRaw === 'string') {
      const parsed = JSON.parse(filtrosRaw);
      if (Array.isArray(parsed)) filtros = parsed;
    }
  } catch {
    return res.status(400).json({ error: 'Formato de filtros inválido.' });
  }

  console.log('📊 Filtros parseados:', filtros);

  const filtrosValidos = filtros.filter(
    ({ campo, tipo }) => campo && tipo && colunasValidas.includes(campo),
  );

  console.log('✅ Filtros válidos:', filtrosValidos);

  const clausulasAND: string[] = [];
  const clausulasOR: string[] = [];
  const values: any[] = [];

  filtrosValidos.forEach(({ campo, tipo, valor, global }) => {
    console.log(
      `🔍 Processando filtro: campo=${campo}, tipo=${tipo}, valor=${valor}, global=${global}`,
    );

    // Pular filtros de grupo_pagamento se a coluna não existir
    if (campo === 'grupo_pagamento') {
      // Esta verificação será feita mais tarde, quando soubermos se a coluna existe
      console.log('⏭️ Pulando filtro grupo_pagamento para processar depois');
      return;
    }

    const index = values.length + 1;
    let coluna = 'f.' + campo;
    if (campo === 'cliente_nome') coluna = "CONCAT(c.codcli, '-', c.nome)";
    // Campos que vêm do JOIN com dbfat_nfe
    if (campo === 'nfe_status') coluna = 'nfe.status';
    if (campo === 'mensagem_rejeicao') coluna = 'nfe.motivo';
    if (campo === 'denegada') coluna = 'f.denegada';
    if (campo === 'motivocancelamento') coluna = 'nfe.motivocancelamento';

    let expressao = '';

    // Tratamento especial para campo data
    if (campo === 'data') {
      if (tipo === 'igual') {
        expressao = `DATE(f.data) = DATE($${index})`;
        values.push(valor);
      } else if (tipo === 'maior_igual') {
        expressao = `DATE(f.data) >= DATE($${index})`;
        values.push(valor);
      } else if (tipo === 'menor_igual') {
        expressao = `DATE(f.data) <= DATE($${index})`;
        values.push(valor);
      } else if (tipo === 'maior') {
        expressao = `DATE(f.data) > DATE($${index})`;
        values.push(valor);
      } else if (tipo === 'menor') {
        expressao = `DATE(f.data) < DATE($${index})`;
        values.push(valor);
      } else if (tipo === 'contém') {
        expressao = `TO_CHAR(f.data, 'DD/MM/YYYY') LIKE $${index}`;
        values.push(`%${valor}%`);
      }
    } else if (tipo === 'nulo') {
      expressao = `${coluna} IS NULL`;
    } else if (tipo === 'nao_nulo') {
      expressao = `${coluna} IS NOT NULL`;
    } else if (['contém', 'começa', 'termina'].includes(tipo)) {
      let val = valor;
      if (tipo === 'contém') val = `%${valor}%`;
      if (tipo === 'começa') val = `${valor}%`;
      if (tipo === 'termina') val = `%${valor}`;

      expressao = `${coluna} ILIKE $${index}`;
      values.push(val);
    } else if (operadoresSQL[tipo]) {
      const valorCorrigido = valor;
      if (campo === 'nfs' && valor !== 'S' && valor !== 'N') {
        console.log(`❌ Valor inválido para NFS: ${valor}, pulando filtro`);
        return;
      }

      expressao = `${coluna} ${operadoresSQL[tipo]} $${index}`;
      values.push(valorCorrigido);
    }

    if (expressao) {
      console.log(`✅ Expressão criada: ${expressao}`);
      if (global) {
        clausulasOR.push(expressao);
      } else {
        clausulasAND.push(expressao);
      }
    } else {
      console.log(
        `❌ Nenhuma expressão criada para: campo=${campo}, tipo=${tipo}, valor=${valor}`,
      );
    }
  });

  const offset = (page - 1) * perPage;

  try {
    const client = await getPgPool().connect();

    // Verificar se a tabela grupo_pagamento existe
    let hasGrupoPagamentoTable = false;
    let hasCodgpColumn = false;

    try {
      const tableCheckQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'grupo_pagamento'
        );
      `;
      const tableCheckResult = await client.query(tableCheckQuery);
      hasGrupoPagamentoTable = tableCheckResult.rows[0].exists;
    } catch (e) {
      console.warn('Erro ao verificar tabela grupo_pagamento:', e);
      hasGrupoPagamentoTable = false;
    }

    try {
      const columnCheckQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'db_manaus' 
          AND table_name = 'dbfatura'
          AND column_name = 'codgp'
        );
      `;
      const columnCheckResult = await client.query(columnCheckQuery);
      hasCodgpColumn = columnCheckResult.rows[0].exists;

      if (!hasCodgpColumn) {
        console.warn(
          '⚠️ IMPORTANTE: Coluna codgp não encontrada na tabela db_manaus.dbfatura. Execute o script: scripts/verificar_criar_colunas_agrupamento.sql',
        );
      }
    } catch (e) {
      console.warn('Erro ao verificar coluna codgp:', e);
      hasCodgpColumn = false;
    }

    // Processar filtros de grupo_pagamento se a coluna existir
    console.log(
      '🔍 Verificando filtros de grupo_pagamento, hasCodgpColumn:',
      hasCodgpColumn,
    );
    if (hasCodgpColumn) {
      const filtrosGrupo = filtrosValidos.filter(
        (f) => f.campo === 'grupo_pagamento',
      );
      console.log('📊 Filtros de grupo encontrados:', filtrosGrupo);

      filtrosGrupo.forEach(({ campo, tipo, valor, global }) => {
        console.log(
          `🔍 Processando filtro grupo: campo=${campo}, tipo=${tipo}, valor=${valor}, global=${global}`,
        );

        const index = values.length + 1;
        const _coluna = 'f.codgp';
        let expressao = '';

        if (tipo === 'nulo') {
          expressao = `f.codgp IS NULL`;
        } else if (tipo === 'nao_nulo') {
          expressao = `f.codgp IS NOT NULL`;
        } else if (['contém', 'começa', 'termina'].includes(tipo)) {
          if (valor === '' || valor === null || valor === undefined) {
            console.log('⏭️ Valor vazio para filtro de grupo, pulando');
            return;
          }
          let val = valor;
          if (tipo === 'contém') val = `%${valor}%`;
          if (tipo === 'começa') val = `${valor}%`;
          if (tipo === 'termina') val = `%${valor}`;
          expressao = `f.codgp::text ILIKE $${index}`;
          values.push(val);
        } else if (operadoresSQL[tipo]) {
          const valorCorrigido = valor;
          if (
            valorCorrigido === '' ||
            valorCorrigido === null ||
            valorCorrigido === undefined
          ) {
            console.log('⏭️ Valor vazio para operador SQL de grupo, pulando');
            return;
          }
          expressao = `f.codgp ${operadoresSQL[tipo]} $${index}`;
          values.push(valorCorrigido);
        }

        if (expressao) {
          console.log(`✅ Expressão de grupo criada: ${expressao}`);
          if (global) {
            clausulasOR.push(expressao);
          } else {
            clausulasAND.push(expressao);
          }
        } else {
          console.log(
            `❌ Nenhuma expressão de grupo criada para: campo=${campo}, tipo=${tipo}, valor=${valor}`,
          );
        }
      });
    } else {
      console.log(
        '❌ Coluna codgp não encontrada, filtros de grupo_pagamento ignorados',
      );
    }

    // Construir WHERE final após processar todos os filtross
    let where = '';
    const filtroClienteValido = `(c.nome IS NOT NULL AND c.nome <> '' AND f.nroform IS NOT NULL AND f.nroform <> '')`;
    const partes = [filtroClienteValido];

    if (clausulasAND.length) partes.push(`(${clausulasAND.join(' AND ')})`);
    if (clausulasOR.length) partes.push(`(${clausulasOR.join(' OR ')})`);

    if (partes.length) {
      where = `WHERE ${partes.join(' AND ')}`;
    }

  

    const totalQuery = `
      SELECT COUNT(*) FROM db_manaus.dbfatura f
      LEFT JOIN db_manaus.dbclien c ON f.codcli = c.codcli
      LEFT JOIN db_manaus.dbvend v ON f.codvend = v.codvend
      LEFT JOIN db_manaus.dbtransp t ON f.codtransp = t.codtransp
      LEFT JOIN db_manaus.dbfat_nfe nfe ON f.codfat = nfe.codfat
      ${where}
    `;
    const totalResult = await client.query(totalQuery, values);
    const total = parseInt(totalResult.rows[0].count, 10);

    const dataQuery = `
      SELECT
        f.*,
        COALESCE(f.totalnf, f.totalfat, f.totalprod, 0) AS totalnf,
        c.nome AS cliente_nome,
        v.nome AS nome_vendedor,
        t.nome AS nome_transportadora,
        nfe.status AS nfe_status,
        nfe.dthrcancelamento,
        nfe.motivocancelamento,
        nfe.numcancelamento,
        nfe.chave AS nfe_chave,
        nfe.numprotocolo AS nfe_protocolo,
        nfe.motivo AS nfe_motivo,
        CASE 
          WHEN nfe.status IS NOT NULL AND nfe.status != '100' THEN nfe.motivo
          ELSE NULL
        END AS mensagem_rejeicao
        ${
          hasCodgpColumn
            ? `,
        f.codgp AS grupo_pagamento
        ${
          hasGrupoPagamentoTable
            ? `,
        gp.data_criacao AS data_criacao_grupo,
        gp.total_faturas AS total_faturas_grupo
        `
            : ', NULL AS data_criacao_grupo, NULL AS total_faturas_grupo'
        }
        `
            : ', NULL AS grupo_pagamento, NULL AS total_faturas_grupo, NULL AS data_criacao_grupo'
        }
      FROM db_manaus.dbfatura f
      LEFT JOIN db_manaus.dbclien c ON f.codcli = c.codcli
      LEFT JOIN db_manaus.dbvend v ON f.codvend = v.codvend
      LEFT JOIN db_manaus.dbtransp t ON f.codtransp = t.codtransp
      LEFT JOIN db_manaus.dbfat_nfe nfe ON f.codfat = nfe.codfat
      ${hasCodgpColumn && hasGrupoPagamentoTable ? 'LEFT JOIN grupo_pagamento gp ON f.codgp = gp.codigo_gp' : ''}
      ${where}
      ORDER BY f.data DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;
    const faturasResult = await client.query(dataQuery, [
      ...values,
      perPage,
      offset,
    ]);

    client.release();

    res.status(200).json({
      faturas: faturasResult.rows,
      meta: {
        currentPage: page,
        perPage,
        total,
        lastPage: Math.ceil(total / perPage),
      },
    });
  } catch (err) {
    console.error('Erro ao listar faturas:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
}

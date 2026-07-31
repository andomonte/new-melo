import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

// Mapeamento das colunas para filtros
const filtroParaColunaSQL: Record<string, string> = {
  // Campos de requisição
  requisicao: "(CAST(r.req_id AS TEXT) || '/' || CAST(r.req_versao AS TEXT))",
  versao: 'r.req_versao',
  dataRequisicao: 'r.req_data',
  statusRequisicao: 'r.req_status',
  observacao: 'r.req_observacao',
  condPagto: 'r.req_cond_pagto',
  condicoesPagamento: 'r.req_cond_pagto',
  situacao: 'r.req_situacao',
  previsaoChegada: 'r.req_previsao_chegada',

  // Campos de fornecedor
  fornecedorCodigo: 'r.req_cod_credor',
  fornecedorNome: 'f.nome',
  fornecedorCompleto: "(COALESCE(CAST(f.cod_credor AS TEXT), '') || ' - ' || COALESCE(f.nome, ''))",
  fornecedorCpfCnpj: 'f.cpf_cgc',

  // Campos de comprador
  compradorCodigo: 'r.req_codcomprador',
  compradorNome: 'c.nome',
  compradorCompleto: "(COALESCE(CAST(c.codcomprador AS TEXT), '') || ' - ' || COALESCE(c.nome, ''))",

  // Campos de ordem de compra
  ordemCompra: 'o.orc_id',
  statusOrdem: 'o.orc_status',
  dataOrdem: 'o.orc_data',
  valorTotal: 'COALESCE((SELECT SUM(itr_quantidade * itr_pr_unitario) FROM db_manaus.cmp_it_requisicao WHERE itr_req_id = r.req_id), 0)',

  // Cliente / Vendedor (venda casada) e Usuário que cadastrou
  cliente: 'cli.nome',
  vendedor: 'v.nome',
  usuario: 'usr.nomeusr',
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { page = 1, perPage = 25, filtros = [], ordenacao = null } = req.body;
  const offset = (Number(page) - 1) * Number(perPage);
  const limit = Number(perPage);
  
  console.log('🔍 API buscaRequisicoes - Filtros recebidos:', JSON.stringify(filtros, null, 2));

  // O grid (DataTablePadrao) envia o `campo` em minúsculas (header.toLowerCase()).
  // Aqui normalizamos de volta para a chave canônica (camelCase) do mapa de
  // colunas, para que o lookup e os checks downstream (data/número/status)
  // funcionem. Sem isso, o filtro é ignorado.
  const campoCanonicoPorLower: Record<string, string> = {};
  Object.keys(filtroParaColunaSQL).forEach((k) => {
    campoCanonicoPorLower[k.toLowerCase()] = k;
  });
  filtros.forEach((f: { campo: string; tipo: string; valor: string }) => {
    const canon = campoCanonicoPorLower[String(f.campo).toLowerCase()];
    if (canon) f.campo = canon;
  });

  // Ordenação server-side (todas as páginas). A coluna é validada pelo mapa
  // (whitelist) para evitar SQL injection; direção só ASC/DESC.
  let orderByClause = 'ORDER BY r.req_data DESC, r.req_id DESC';
  if (ordenacao?.campo) {
    const canonSort = campoCanonicoPorLower[String(ordenacao.campo).toLowerCase()];
    const colSort = canonSort ? filtroParaColunaSQL[canonSort] : undefined;
    if (colSort) {
      const dir = String(ordenacao.direcao).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      orderByClause = `ORDER BY ${colSort} ${dir} NULLS LAST, r.req_id DESC`;
    }
  }

  // Bypass temporário para debug - remover depois
  if (filtros.length === 0) {
    console.log('ℹ️ Nenhum filtro - usando query simples');
  }

  const params: any[] = [];
  const whereGroups: string[] = [];

  // Rótulos dos status (o banco guarda CÓDIGO; a tela mostra o RÓTULO).
  // Usado para traduzir o texto digitado no filtro → código(s).
  const rotulosStatus: Record<string, Record<string, string>> = {
    statusRequisicao: { P: 'Pendente', A: 'Aprovada', R: 'Reprovada', C: 'Cancelada', S: 'Submetida', E: 'Em Análise', F: 'Finalizada' },
    statusOrdem: { P: 'Pendente', A: 'Aberta', F: 'Finalizada', C: 'Cancelada' },
  };

  // Filtro multi-termo por coluna, estilo Delphi/produtos:
  //   ESPAÇO = E (todas as palavras)   ex.: "robert bosch" -> tem ROBERT E BOSCH
  //   ';'    = OU (qualquer grupo)     ex.: "bosch;marelli" -> BOSCH OU MARELLI
  //   Combinável: "robert bosch;marelli" = (ROBERT E BOSCH) OU MARELLI
  // `exprTexto` é a expressão SQL de texto (coluna, CAST(...), TO_CHAR(...));
  // `wrap` monta o padrão ILIKE (contém/começa/termina). Retorna a condição
  // já pronta (com os placeholders) ou null se não há termos.
  const montarMultiTermo = (
    exprTexto: string,
    valorRaw: string,
    wrap: (t: string) => string,
  ): string | null => {
    const grupos = String(valorRaw)
      .split(';')
      .map((g) =>
        g
          .trim()
          .split(/\s+/)
          .map((t) => t.replace(/^%+|%+$/g, '').trim())
          .filter(Boolean),
      )
      .filter((g) => g.length > 0);
    if (grupos.length === 0) return null;
    const orConds = grupos.map((termos) => {
      const andConds = termos.map((t) => {
        params.push(wrap(t));
        return `${exprTexto} ILIKE $${params.length}`;
      });
      return andConds.length > 1 ? `(${andConds.join(' AND ')})` : andConds[0];
    });
    return orConds.length > 1 ? `(${orConds.join(' OR ')})` : orConds[0];
  };

  // Agrupa filtros pelo campo
  const filtrosAgrupados: Record<string, { tipo: string; valor: string }[]> = {};

  filtros.forEach((filtro: { campo: string; tipo: string; valor: string }) => {
    if (!filtrosAgrupados[filtro.campo]) {
      filtrosAgrupados[filtro.campo] = [];
    }
    
    // Mapear valores de status de texto para código
    let valorFinal = filtro.valor;
    if (filtro.campo === 'statusRequisicao') {
      const statusMap: Record<string, string> = {
        'PENDENTE': 'P',
        'Pendente': 'P', 
        'SUBMETIDA': 'S',
        'Submetida': 'S',
        'APROVADA': 'A',
        'Aprovada': 'A',
        'REJEITADA': 'R',
        'Rejeitada': 'R',
        'R': 'R', // Manter códigos existentes
        'P': 'P',
        'S': 'S', 
        'A': 'A'
      };
      valorFinal = statusMap[filtro.valor] || filtro.valor;
      console.log(`🔄 Status mapping: "${filtro.valor}" → "${valorFinal}"`);
    }
    
    // Converter datas do formato brasileiro para ISO (exceto para operadores de busca textual)
    const operadoresTextuais = ['contém', 'começa', 'termina'];
    const camposData = ['dataRequisicao', 'previsaoChegada', 'dataOrdem'];
    
    if (camposData.includes(filtro.campo) && filtro.valor && !operadoresTextuais.includes(filtro.tipo)) {
      // Se está no formato DD/MM/YYYY ou DD/MM/YYYY HH:mm:ss
      if (filtro.valor.includes('/')) {
        try {
          const [datePart, timePart] = filtro.valor.split(' ');
          const partes = datePart.split('/');
          
          // Tratar datas parciais para operador igual
          if (filtro.tipo === 'igual') {
            if (partes.length === 2) {
              // DD/MM - usar operador contém ao invés
              filtro.tipo = 'contém';
              valorFinal = filtro.valor;
              console.log(`📅 Date partial - converting igual to contém: "${filtro.valor}"`);
            } else if (partes.length === 3) {
              // DD/MM/YYYY completo
              const [dia, mes, ano] = partes;
              if (dia && mes && ano) {
                valorFinal = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
                if (timePart) {
                  valorFinal += ` ${timePart}`;
                }
                console.log(`📅 Date conversion: "${filtro.valor}" → "${valorFinal}"`);
              }
            }
          } else {
            // Para outros operadores, converter normalmente se data completa
            const [dia, mes, ano] = partes;
            if (dia && mes && ano) {
              valorFinal = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
              if (timePart) {
                valorFinal += ` ${timePart}`;
              }
              console.log(`📅 Date conversion: "${filtro.valor}" → "${valorFinal}"`);
            }
          }
        } catch (error) {
          console.log(`⚠️ Date conversion failed for: "${filtro.valor}"`);
        }
      }
    }
    
    filtrosAgrupados[filtro.campo].push({
      tipo: filtro.tipo,
      valor: valorFinal,
    });
  });

  // Para cada campo agrupado
  Object.entries(filtrosAgrupados).forEach(([campo, filtrosDoCampo]) => {
    const coluna = filtroParaColunaSQL[campo];
    if (!coluna) {
      console.log(`⚠️ Campo de filtro não encontrado: ${campo}`);
      return;
    }

    // Colunas de status: traduz o texto digitado (rótulo completo/parcial ou
    // o próprio código) para o(s) código(s) e filtra por igualdade (IN).
    // Vale para statusRequisicao e statusOrdem — corrige o filtro rápido.
    if (rotulosStatus[campo]) {
      const labels = rotulosStatus[campo];
      const codigos = new Set<string>();
      let temValor = false;
      filtrosDoCampo.forEach((f) => {
        String(f.valor || '')
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((termo) => {
            temValor = true;
            const up = termo.toUpperCase();
            if (labels[up]) {
              codigos.add(up); // digitou o código (ex.: "C")
            } else {
              Object.entries(labels).forEach(([code, label]) => {
                if (label.toUpperCase().includes(up)) codigos.add(code); // rótulo (ex.: "canc")
              });
            }
          });
      });
      if (temValor) {
        if (codigos.size > 0) {
          const ph = [...codigos].map((code) => {
            params.push(code);
            return `$${params.length}`;
          });
          whereGroups.push(`(${coluna} IN (${ph.join(', ')}))`);
        } else {
          // Texto não corresponde a nenhum status → sem resultados (claro p/ o usuário).
          whereGroups.push(`(${coluna} = '__SEM_MATCH__')`);
        }
      }
      return; // status tratado; não cai no processamento genérico
    }

    const filtrosCampoSQL: string[] = [];

    filtrosDoCampo.forEach((filtro) => {
      let operador = 'ILIKE';
      let valor = '';
      
      // Determinar o tipo do campo
      const isCampoData = ['dataRequisicao', 'previsaoChegada'].includes(campo);
      const isCampoNumerico = ['versao', 'ordemCompra', 'situacao', 'valorTotal'].includes(campo);
      const isCampoConcatenado = ['fornecedorCompleto', 'compradorCompleto', 'requisicao'].includes(campo);

      switch (filtro.tipo) {
        case 'igual':
          if (isCampoData) {
            operador = 'DATE(COLUMN) =';
            valor = String(filtro.valor);
          } else if (isCampoConcatenado) {
            operador = 'COLUMN ILIKE';
            valor = String(filtro.valor);
          } else {
            operador = '=';
            valor = String(filtro.valor);
          }
          break;
        case 'diferente':
          operador = '<>';
          valor = String(filtro.valor);
          break;
        case 'maior':
          operador = '>';
          valor = String(filtro.valor);
          break;
        case 'maior_igual':
          operador = '>=';
          valor = String(filtro.valor);
          break;
        case 'menor':
          operador = '<';
          valor = String(filtro.valor);
          break;
        case 'menor_igual':
          operador = '<=';
          valor = String(filtro.valor);
          break;
        case 'contém':
        case 'começa':
        case 'termina': {
          // Expressão de texto a comparar, conforme o tipo do campo.
          const exprTexto = isCampoData
            ? `TO_CHAR(${coluna}, 'DD/MM/YYYY HH24:MI:SS')`
            : isCampoNumerico
              ? `CAST(${coluna} AS TEXT)`
              : coluna;
          const wrap =
            filtro.tipo === 'contém'
              ? (t: string) => `%${t}%`
              : filtro.tipo === 'começa'
                ? (t: string) => `${t}%`
                : (t: string) => `%${t}`;
          const cond = montarMultiTermo(exprTexto, String(filtro.valor), wrap);
          if (cond) filtrosCampoSQL.push(cond);
          return;
        }
        case 'nulo':
          filtrosCampoSQL.push(`${coluna} IS NULL`);
          return;
        case 'nao_nulo':
          filtrosCampoSQL.push(`${coluna} IS NOT NULL`);
          return;
        default:
          return;
      }

      // Tratar operadores especiais que precisam substituir COLUMN
      if (operador.includes('COLUMN')) {
        const queryFinal = operador.replace(/COLUMN/g, coluna);
        filtrosCampoSQL.push(`${queryFinal} $${params.length + 1}`);
      } else {
        filtrosCampoSQL.push(`${coluna} ${operador} $${params.length + 1}`);
      }
      params.push(valor);
    });

    // Junta todos os filtros do mesmo campo com OR
    if (filtrosCampoSQL.length > 0) {
      whereGroups.push(`(${filtrosCampoSQL.join(' OR ')})`);
    }
  });

  const whereString = whereGroups.length > 0 ? `WHERE ${whereGroups.join(' AND ')}` : '';

  let client;
  try {
    client = await pool.connect();

    console.log('🚀 Executando query com WHERE:', whereString);
    console.log('🚀 Parâmetros:', params);

    // Query principal com JOINs para dados relacionados
    const query = `
      SELECT
        r.req_id as id,
        r.req_versao as versao,
        r.req_id as requisicao,
        r.req_data as "dataRequisicao",
        r.req_status as "statusRequisicao",
        r.req_observacao as observacao,
        r.req_tipo as "tipoSigla",
        COALESCE((SELECT tr.ret_descricao FROM db_manaus.cmp_requisicao_tipo tr WHERE tr.ret_id = r.req_tipo LIMIT 1), r.req_tipo) as tipo,
        ue.unm_nome as "localEntrega",
        ud.unm_nome as "destino",
        r.req_cond_pagto as "condPagto",
        COALESCE(r.req_situacao, 0) as situacao,
        r.req_previsao_chegada as "previsaoChegada",
        r.req_cod_credor as "fornecedorCodigo",
        CAST(f.cod_credor AS TEXT) as "fornecedorCodigoReal",
        f.nome as "fornecedorNome",
        f.cpf_cgc as "fornecedorCpfCnpj",
        COALESCE(
          CASE 
            WHEN f.nome IS NOT NULL AND f.nome != '' THEN f.cod_credor || ' - ' || f.nome
            WHEN r.req_cod_credor IS NOT NULL AND r.req_cod_credor != '' THEN r.req_cod_credor || ' - (Fornecedor não encontrado)'
            ELSE ''
          END, ''
        ) as "fornecedorCompleto",
        r.req_codcomprador as "compradorCodigo",
        CAST(c.codcomprador AS TEXT) as "compradorCodigoReal",
        c.nome as "compradorNome",
        COALESCE(
          CASE 
            WHEN c.nome IS NOT NULL AND c.nome != '' THEN r.req_codcomprador || ' - ' || c.nome
            WHEN r.req_codcomprador IS NOT NULL AND r.req_codcomprador != '' THEN r.req_codcomprador || ' - (Comprador não encontrado)'
            ELSE ''
          END, ''
        ) as "compradorCompleto",
        COALESCE(o.orc_id::text, '0') as "ordemCompra",
        o.orc_status as "statusOrdem",
        o.orc_data as "dataOrdem",
        cli.nome as "cliente",
        v.nome as "vendedor",
        usr.nomeusr as "usuario",
        COALESCE((
          SELECT SUM(itr_quantidade * itr_pr_unitario)
          FROM db_manaus.cmp_it_requisicao
          WHERE itr_req_id = r.req_id
        ), 0) as "valorTotal"
      FROM db_manaus.cmp_requisicao r
      LEFT JOIN db_manaus.dbcredor f ON r.req_cod_credor = f.cod_credor
      LEFT JOIN db_manaus.dbcompradores c ON r.req_codcomprador = c.codcomprador
      LEFT JOIN db_manaus.cad_unidade_melo ue ON r.req_unm_id_entrega = ue.unm_id
      LEFT JOIN db_manaus.cad_unidade_melo ud ON r.req_unm_id_destino = ud.unm_id
      LEFT JOIN db_manaus.dbusuario usr ON r.req_codusr = usr.codusr
      LEFT JOIN db_manaus.cmp_venda_casada vc ON (r.req_id = vc.vec_req_id AND r.req_versao = vc.vec_req_versao)
      LEFT JOIN db_manaus.dbclien cli ON vc.vec_codcli = cli.codcli
      LEFT JOIN db_manaus.dbvend v ON vc.vec_codvend = v.codvend
      LEFT JOIN (
        SELECT DISTINCT ON (orc_req_id, orc_req_versao)
               orc_req_id, orc_req_versao, orc_id, orc_status, orc_data
        FROM db_manaus.cmp_ordem_compra
        ORDER BY orc_req_id, orc_req_versao, orc_id DESC
      ) o ON (r.req_id = o.orc_req_id AND r.req_versao = o.orc_req_versao)
      ${whereString}
      ${orderByClause}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    console.log('DEBUG - Query com filtros:', query);
    console.log('DEBUG - Parâmetros:', params);

    const result = await client.query(query, params);

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM db_manaus.cmp_requisicao r
      LEFT JOIN db_manaus.dbcredor f ON r.req_cod_credor = f.cod_credor
      LEFT JOIN db_manaus.dbcompradores c ON r.req_codcomprador = c.codcomprador
      LEFT JOIN db_manaus.dbusuario usr ON r.req_codusr = usr.codusr
      LEFT JOIN db_manaus.cmp_venda_casada vc ON (r.req_id = vc.vec_req_id AND r.req_versao = vc.vec_req_versao)
      LEFT JOIN db_manaus.dbclien cli ON vc.vec_codcli = cli.codcli
      LEFT JOIN db_manaus.dbvend v ON vc.vec_codvend = v.codvend
      LEFT JOIN (
        SELECT DISTINCT ON (orc_req_id, orc_req_versao)
               orc_req_id, orc_req_versao, orc_id, orc_status, orc_data
        FROM db_manaus.cmp_ordem_compra
        ORDER BY orc_req_id, orc_req_versao, orc_id DESC
      ) o ON (r.req_id = o.orc_req_id AND r.req_versao = o.orc_req_versao)
      ${whereString}
    `;

    const countResult = await client.query(countQuery, params.slice(0, -2)); // Remove limit e offset
    const total = parseInt(countResult.rows[0].total) || 0;

    client.release();

    const meta = {
      total,
      currentPage: Number(page),
      lastPage: Math.ceil(total / Number(perPage)),
      perPage: Number(perPage),
    };

    // Mapear dados para incluir campos completos
    const requisicoesCompletas = result.rows.map(row => ({
      // Dados básicos da requisição
      id: row.id,
      versao: row.versao,
      requisicao: row.requisicao,
      dataRequisicao: row.dataRequisicao,
      statusRequisicao: row.statusRequisicao,
      observacao: row.observacao,
      tipo: row.tipo,
      tipoSigla: row.tipoSigla,
      localEntrega: row.localEntrega,
      destino: row.destino,
      condPagto: row.condPagto,
      condicoesPagamento: row.condPagto, // Alias para compatibilidade
      situacao: row.situacao,
      previsaoChegada: row.previsaoChegada,
      ordemCompra: row.ordemCompra,
      statusOrdem: row.statusOrdem,
      dataOrdem: row.dataOrdem,
      valorTotal: row.valorTotal,
      cliente: row.cliente,
      vendedor: row.vendedor,
      usuario: row.usuario,

      // Dados do fornecedor
      fornecedorCodigo: row.fornecedorCodigoReal || row.fornecedorCodigo,
      fornecedorNome: row.fornecedorNome,
      fornecedorCompleto: row.fornecedorCompleto || '',
      fornecedorCpfCnpj: row.fornecedorCpfCnpj,
      
      // Dados do comprador
      compradorCodigo: row.compradorCodigoReal || row.compradorCodigo,
      compradorNome: row.compradorNome,
      compradorCompleto: row.compradorCompleto || '',
    }));

    console.log('DEBUG - Resultado filtros:', {
      totalItems: requisicoesCompletas.length,
      totalGeral: total,
      meta
    });

    return res.status(200).json({
      success: true,
      data: requisicoesCompletas,
      meta,
    });

  } catch (error) {
    if (client) {
      client.release();
    }
    console.error('❌ Erro ao buscar requisições com filtros:', error);
    console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'No stack');
    console.error('❌ Query details:', { whereString, params });
    return res.status(500).json({ 
      success: false,
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
      query: process.env.NODE_ENV === 'development' ? whereString : undefined
    });
  }
}
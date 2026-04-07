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
  valorTotal: 'COALESCE((SELECT SUM(itr_quantidade * itr_pr_unitario) FROM db_manaus.cmp_it_requisicao WHERE itr_req_id = r.req_id), 0)'
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { page = 1, perPage = 25, filtros = [] } = req.body;
  const offset = (Number(page) - 1) * Number(perPage);
  const limit = Number(perPage);
  
  console.log('🔍 API buscaRequisicoes - Filtros recebidos:', JSON.stringify(filtros, null, 2));

  // Bypass temporário para debug - remover depois
  if (filtros.length === 0) {
    console.log('ℹ️ Nenhum filtro - usando query simples');
  }

  const params: any[] = [];
  const whereGroups: string[] = [];

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
          if (isCampoData) {
            operador = 'TO_CHAR(COLUMN, \'DD/MM/YYYY HH24:MI:SS\') ILIKE';
            valor = `%${String(filtro.valor)}%`;
          } else if (isCampoNumerico) {
            operador = 'CAST(COLUMN AS TEXT) ILIKE';
            valor = `%${String(filtro.valor)}%`;
          } else if (isCampoConcatenado) {
            operador = 'COLUMN ILIKE';
            valor = `%${String(filtro.valor)}%`;
          } else {
            operador = 'ILIKE';
            valor = `%${String(filtro.valor)}%`;
          }
          break;
        case 'começa':
          if (isCampoData) {
            operador = 'TO_CHAR(COLUMN, \'DD/MM/YYYY HH24:MI:SS\') ILIKE';
            valor = `${String(filtro.valor)}%`;
          } else if (isCampoNumerico) {
            operador = 'CAST(COLUMN AS TEXT) ILIKE';
            valor = `${String(filtro.valor)}%`;
          } else if (isCampoConcatenado) {
            operador = 'COLUMN ILIKE';
            valor = `${String(filtro.valor)}%`;
          } else {
            operador = 'ILIKE';
            valor = `${String(filtro.valor)}%`;
          }
          break;
        case 'termina':
          if (isCampoData) {
            operador = 'TO_CHAR(COLUMN, \'DD/MM/YYYY HH24:MI:SS\') ILIKE';
            valor = `%${String(filtro.valor)}`;
          } else if (isCampoNumerico) {
            operador = 'CAST(COLUMN AS TEXT) ILIKE';
            valor = `%${String(filtro.valor)}`;
          } else if (isCampoConcatenado) {
            operador = 'COLUMN ILIKE';
            valor = `%${String(filtro.valor)}`;
          } else {
            operador = 'ILIKE';
            valor = `%${String(filtro.valor)}`;
          }
          break;
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
        r.req_id_composto as id,
        r.req_versao as versao,
        r.req_id as requisicao,
        r.req_data as "dataRequisicao",
        r.req_status as "statusRequisicao",
        r.req_observacao as observacao,
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
        COALESCE((
          SELECT SUM(itr_quantidade * itr_pr_unitario)
          FROM db_manaus.cmp_it_requisicao
          WHERE itr_req_id = r.req_id
        ), 0) as "valorTotal"
      FROM db_manaus.cmp_requisicao r
      LEFT JOIN db_manaus.dbcredor f ON r.req_cod_credor = f.cod_credor
      LEFT JOIN db_manaus.dbcompradores c ON r.req_codcomprador = c.codcomprador
      LEFT JOIN db_manaus.cmp_ordem_compra o ON r.req_id = o.orc_req_id AND r.req_versao = o.orc_req_versao
      ${whereString}
      ORDER BY r.req_data DESC, r.req_id DESC
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
      LEFT JOIN db_manaus.cmp_ordem_compra o ON r.req_id = o.orc_req_id AND r.req_versao = o.orc_req_versao
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
      condPagto: row.condPagto,
      condicoesPagamento: row.condPagto, // Alias para compatibilidade
      situacao: row.situacao,
      previsaoChegada: row.previsaoChegada,
      ordemCompra: row.ordemCompra,
      valorTotal: row.valorTotal,
      
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
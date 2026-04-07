import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

// Mapeamento das colunas para filtros de ordens
// IMPORTANTE: usar apenas campos que existem na tabela real ou usar aliases da query
const filtroParaColunaSQL: Record<string, string> = {
  ordem: 'o.orc_id',
  requisicao: 'o.orc_req_id',
  dataOrdem: 'o.orc_data',
  statusOrdem: 'o.orc_status',
  statusRequisicao: 'r.req_status',
  fornecedorNome: 'f.nome',
  fornecedor_completo: "(CAST(f.cod_credor AS TEXT) || ' - ' || f.nome)", // Campo concatenado
  compradorNome: 'c.nome',
  comprador_completo: "(CAST(c.codcomprador AS TEXT) || ' - ' || c.nome)", // Campo concatenado
  // Campos da ordem de compra
  valorTotal: 'o.orc_valor_total',
  observacao: 'o.orc_observacao',
  previsaoChegada: 'o.orc_previsao_chegada',
  localEntrega: 'ue.unm_nome',
  localDestino: 'ud.unm_nome',
  prazoEntrega: 'prazo_entrega',
  fornecedorCod: 'o.orc_fornecedor_cod',
  dataFinalizacao: 'o.orc_data_finalizacao',
  usuarioResponsavel: 'o.orc_usuario_responsavel',
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

  const params: any[] = [];
  const whereGroups: string[] = [];

  // Agrupa filtros pelo campo
  const filtrosAgrupados: Record<string, { tipo: string; valor: string }[]> = {};

  filtros.forEach((filtro: { campo: string; tipo: string; valor: string }) => {
    if (!filtrosAgrupados[filtro.campo]) {
      filtrosAgrupados[filtro.campo] = [];
    }
    filtrosAgrupados[filtro.campo].push({
      tipo: filtro.tipo,
      valor: filtro.valor,
    });
  });

  // Para cada campo agrupado
  Object.entries(filtrosAgrupados).forEach(([campo, filtrosDoCampo]) => {
    const coluna = filtroParaColunaSQL[campo];
    if (!coluna) return;

    // Identificar tipos de campo
    const camposData = ['dataOrdem', 'dataFinalizacao', 'previsaoChegada', 'prazoEntrega'];
    const camposNumerico = ['ordem', 'valorTotal'];
    const operadoresTextuais = ['contém', 'começa', 'termina'];
    
    const isCampoData = camposData.includes(campo);
    const isCampoNumerico = camposNumerico.includes(campo);

    const filtrosCampoSQL: string[] = [];

    filtrosDoCampo.forEach((filtro) => {
      let operador = 'ILIKE';
      let valor: any = filtro.valor;

      // Converter DD/MM/YYYY para YYYY-MM-DD para campos de data (apenas operadores não-textuais)
      if (isCampoData && filtro.valor && !operadoresTextuais.includes(filtro.tipo)) {
        const dateValue = String(filtro.valor).trim();
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateValue)) {
          // Formato DD/MM/YYYY -> YYYY-MM-DD
          const [day, month, year] = dateValue.split('/');
          valor = `${year}-${month}-${day}`;
        } else if (/^\d{2}\/\d{2}$/.test(dateValue)) {
          // Formato DD/MM -> usar ano atual
          const currentYear = new Date().getFullYear();
          const [day, month] = dateValue.split('/');
          valor = `${currentYear}-${month}-${day}`;
        }
      }

      switch (filtro.tipo) {
        case 'igual':
          if (isCampoData && operadoresTextuais.includes('igual')) {
            operador = 'TO_CHAR(COLUMN, \'DD/MM/YYYY\') ILIKE';
            valor = `%${String(filtro.valor)}%`;
          } else {
            operador = '=';
            valor = String(valor);
          }
          break;
        case 'diferente':
          operador = '<>';
          valor = String(valor);
          break;
        case 'maior':
          operador = '>';
          valor = String(valor);
          break;
        case 'maior_igual':
          operador = '>=';
          valor = String(valor);
          break;
        case 'menor':
          operador = '<';
          valor = String(valor);
          break;
        case 'menor_igual':
          operador = '<=';
          valor = String(valor);
          break;
        case 'contém':
          if (isCampoData) {
            operador = 'TO_CHAR(COLUMN, \'DD/MM/YYYY\') ILIKE';
            valor = `%${String(filtro.valor)}%`;
          } else if (isCampoNumerico) {
            operador = 'CAST(COLUMN AS TEXT) ILIKE';
            valor = `%${String(filtro.valor)}%`;
          } else {
            operador = 'ILIKE';
            valor = `%${String(filtro.valor)}%`;
          }
          break;
        case 'começa':
          if (isCampoData) {
            operador = 'TO_CHAR(COLUMN, \'DD/MM/YYYY\') ILIKE';
            valor = `${String(filtro.valor)}%`;
          } else if (isCampoNumerico) {
            operador = 'CAST(COLUMN AS TEXT) ILIKE';
            valor = `${String(filtro.valor)}%`;
          } else {
            operador = 'ILIKE';
            valor = `${String(filtro.valor)}%`;
          }
          break;
        case 'termina':
          if (isCampoData) {
            operador = 'TO_CHAR(COLUMN, \'DD/MM/YYYY\') ILIKE';
            valor = `%${String(filtro.valor)}`;
          } else if (isCampoNumerico) {
            operador = 'CAST(COLUMN AS TEXT) ILIKE';
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

    // Query principal com JOINs para dados relacionados
    const query = `
      SELECT
        o.orc_id,
        o.orc_req_id,
        o.orc_req_versao,
        o.orc_data,
        o.orc_status,
        o.orc_valor_total,
        o.orc_observacao,
        o.orc_previsao_chegada,
        o.orc_usuario_responsavel,
        o.orc_pagamento_configurado,
        o.orc_banco,
        o.orc_tipo_documento,
        o.orc_valor_entrada,
        r.req_id_composto,
        r.req_status,
        r.req_previsao_chegada,
        CAST(f.cod_credor AS TEXT) as fornecedor_codigo,
        f.nome as fornecedor_nome,
        f.cpf_cgc as fornecedor_cpf_cnpj,
        COALESCE(f.cod_credor || ' - ' || f.nome, '') as fornecedor_completo,
        CAST(c.codcomprador AS TEXT) as comprador_codigo,
        c.nome as comprador_nome,
        COALESCE(r.req_codcomprador || ' - ' || c.nome, '') as comprador_completo,
        ue.unm_nome as local_entrega,
        ud.unm_nome as local_destino,
        CASE
          WHEN COALESCE(o.orc_previsao_chegada, r.req_previsao_chegada) IS NOT NULL
          THEN EXTRACT(DAY FROM (COALESCE(o.orc_previsao_chegada, r.req_previsao_chegada) - o.orc_data))::INTEGER
          ELSE NULL
        END as prazo_entrega
      FROM db_manaus.cmp_ordem_compra o
      LEFT JOIN db_manaus.cmp_requisicao r ON o.orc_req_id = r.req_id AND o.orc_req_versao = r.req_versao
      LEFT JOIN db_manaus.dbcredor f ON r.req_cod_credor = f.cod_credor
      LEFT JOIN db_manaus.dbcompradores c ON r.req_codcomprador = c.codcomprador
      LEFT JOIN db_manaus.cad_unidade_melo ue ON COALESCE(o.orc_unm_id_entrega, r.req_unm_id_entrega) = ue.unm_id
      LEFT JOIN db_manaus.cad_unidade_melo ud ON COALESCE(o.orc_unm_id_destino, r.req_unm_id_destino) = ud.unm_id
      ${whereString}
      ORDER BY o.orc_data DESC, o.orc_id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    console.log('DEBUG - Query ordens com filtros:', query);
    console.log('DEBUG - Parâmetros ordens:', params);

    const result = await client.query(query, params);

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM db_manaus.cmp_ordem_compra o
      LEFT JOIN db_manaus.cmp_requisicao r ON o.orc_req_id = r.req_id AND o.orc_req_versao = r.req_versao
      LEFT JOIN db_manaus.dbcredor f ON r.req_cod_credor = f.cod_credor
      LEFT JOIN db_manaus.dbcompradores c ON r.req_codcomprador = c.codcomprador
      LEFT JOIN db_manaus.cad_unidade_melo ue ON COALESCE(o.orc_unm_id_entrega, r.req_unm_id_entrega) = ue.unm_id
      LEFT JOIN db_manaus.cad_unidade_melo ud ON COALESCE(o.orc_unm_id_destino, r.req_unm_id_destino) = ud.unm_id
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
    const ordensCompletas = result.rows.map(ordem => ({
      // Dados da ordem
      orc_id: ordem.orc_id,
      orc_req_id: ordem.orc_req_id,
      orc_req_versao: ordem.orc_req_versao,
      orc_data: ordem.orc_data,
      orc_status: ordem.orc_status,
      orc_valor_total: ordem.orc_valor_total,
      orc_observacao: ordem.orc_observacao,
      orc_previsao_chegada: ordem.orc_previsao_chegada,
      orc_usuario_responsavel: ordem.orc_usuario_responsavel,

      // Dados herdados da requisição
      req_id_composto: ordem.req_id_composto || `${ordem.orc_req_id}`,
      req_status: ordem.req_status || 'ÓRFÃ',
      req_previsao_chegada: ordem.req_previsao_chegada,
      observacao: ordem.req_observacao || `Ordem órfã de ${ordem.orc_data?.toISOString().split('T')[0] || 'data desconhecida'} - requisição ${ordem.orc_req_id} não encontrada`,

      // Concatenar código + nome do fornecedor (com fallback consistente)
      fornecedor_codigo: ordem.fornecedor_codigo,
      fornecedor_nome: ordem.fornecedor_nome,
      fornecedor_completo: (ordem.fornecedor_codigo && ordem.fornecedor_nome) ?
        `${ordem.fornecedor_codigo} - ${ordem.fornecedor_nome}` :
        `📋 Dados perdidos (Req: ${ordem.orc_req_id})`,
      fornecedor_cpf_cnpj: ordem.fornecedor_cpf_cnpj,

      // Concatenar código + nome do comprador (com fallback consistente)
      comprador_codigo: ordem.comprador_codigo,
      comprador_nome: ordem.comprador_nome,
      comprador_completo: (ordem.comprador_codigo && ordem.comprador_nome) ?
        `${ordem.comprador_codigo} - ${ordem.comprador_nome}` :
        `📋 Dados perdidos (Req: ${ordem.orc_req_id})`,

      // Locais de entrega e destino
      local_entrega: ordem.local_entrega || '',
      local_destino: ordem.local_destino || '',
      prazo_entrega: ordem.prazo_entrega || null,
    }));

    console.log('DEBUG - Resultado filtros ordens:', {
      totalItems: ordensCompletas.length,
      totalGeral: total,
      meta
    });

    return res.status(200).json({
      success: true,
      data: ordensCompletas,
      meta,
    });

  } catch (error) {
    if (client) {
      client.release();
    }
    console.error('Erro ao buscar ordens com filtros:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}
import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
  }

  try {
    const {
      page = 1,
      limit = 20,
      status,
      data_inicio,
      data_fim,
      cliente,
      vendedor,
      operadora,
      conta,
      tipo,
      com_atraso,
      cod_receb,
      nro_doc,
      nro_nf,
      nro_dup,
      banco,
      codfat,
      cod_fat,
      valor_min,
      valor_max,
      search
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Construir filtros WHERE
    let whereClause = '';
    const params: any[] = [];
    let paramIndex = 1;

    const statusFilter = status as string | undefined;

    // Filtro por período de vencimento
    if (data_inicio) {
      whereClause += ` AND r.dt_venc >= $${paramIndex}`;
      params.push(data_inicio);
      paramIndex++;
    }

    if (data_fim) {
      whereClause += ` AND r.dt_venc <= $${paramIndex}`;
      params.push(data_fim);
      paramIndex++;
    }

    // Filtro por cliente (aceita código ou nome)
    if (cliente) {
      whereClause += ` AND (CAST(r.codcli AS TEXT) LIKE $${paramIndex} OR UPPER(c.nome) LIKE UPPER($${paramIndex + 1}))`;
      params.push(`%${cliente}%`);
      params.push(`%${cliente}%`);
      paramIndex += 2;
    }

    // Filtro por vendedor
    if (vendedor) {
      whereClause += ` AND r.codvend = $${paramIndex}`;
      params.push(vendedor);
      paramIndex++;
    }

    // Filtro por conta financeira
    if (conta) {
      whereClause += ` AND r.rec_cof_id = $${paramIndex}`;
      params.push(conta);
      paramIndex++;
    }

    // Filtro por tipo
    if (tipo) {
      whereClause += ` AND r.tipo = $${paramIndex}`;
      params.push(tipo);
      paramIndex++;
    }

    // Filtro por código do recebimento (busca parcial — ignora zeros à esquerda)
    if (cod_receb) {
      whereClause += ` AND CAST(r.cod_receb AS TEXT) LIKE $${paramIndex}`;
      params.push(`%${cod_receb}%`);
      paramIndex++;
    }

    // Filtro por número do documento
    if (nro_doc) {
      whereClause += ` AND r.nro_doc LIKE $${paramIndex}`;
      params.push(`%${nro_doc}%`);
      paramIndex++;
    }

    // Filtro por número de NF - removido (campo não existe em dbreceb)
    // if (nro_nf) {
    //   whereClause += ` AND r.nro_nf LIKE $${paramIndex}`;
    //   params.push(`%${nro_nf}%`);
    //   paramIndex++;
    // }

    // Filtro por número de duplicata - removido (campo não existe em dbreceb)
    // if (nro_dup) {
    //   whereClause += ` AND r.nro_dup LIKE $${paramIndex}`;
    //   params.push(`%${nro_dup}%`);
    //   paramIndex++;
    // }

    // Filtro por banco
    if (banco) {
      whereClause += ` AND r.banco LIKE $${paramIndex}`;
      params.push(`%${banco}%`);
      paramIndex++;
    }

    // Filtro por código de fatura (aceita 'codfat' ou 'cod_fat')
    const filtroFatura = codfat || cod_fat;
    if (filtroFatura) {
      whereClause += ` AND r.cod_fat LIKE $${paramIndex}`;
      params.push(`%${filtroFatura}%`);
      paramIndex++;
    }

    // Filtro por valor mínimo
    if (valor_min) {
      whereClause += ` AND r.valor_rec >= $${paramIndex}`;
      params.push(parseFloat(valor_min as string));
      paramIndex++;
    }

    // Filtro por valor máximo
    if (valor_max) {
      whereClause += ` AND r.valor_rec <= $${paramIndex}`;
      params.push(parseFloat(valor_max as string));
      paramIndex++;
    }

    // Busca geral (título, cliente por nome ou código, documento)
    if (search) {
      whereClause += ` AND (
        CAST(r.cod_receb AS TEXT) LIKE $${paramIndex}
        OR UPPER(c.nome) LIKE UPPER($${paramIndex + 1})
        OR r.nro_doc LIKE $${paramIndex + 2}
        OR CAST(r.codcli AS TEXT) LIKE $${paramIndex + 3}
      )`;
      params.push(`%${search}%`);
      params.push(`%${search}%`);
      params.push(`%${search}%`);
      params.push(`%${search}%`);
      paramIndex += 4;
    }

    // ---- Filtros avançados por coluna (server-side, com operadores) ----
    // Recebe JSON [{campo, tipo, valor}] do FiltroDinamico. Whitelist campo→SQL (chave crua OU
    // rótulo do datatable em minúsculas) evita SQL injection; os valores são sempre parametrizados.
    // 'status' NÃO entra aqui — vai pelo statusFilter (é um CASE calculado). obs/parcela/juros não
    // são colunas filtráveis (obs não existe em dbreceb; parcela/juros são calculadas).
    const FILTRO_COLS: Record<string, { sql: string; tipo: 'texto' | 'numero' | 'data' }> = {
      cod_receb: { sql: 'CAST(r.cod_receb AS TEXT)', tipo: 'texto' },
      'número título': { sql: 'CAST(r.cod_receb AS TEXT)', tipo: 'texto' },
      nome_cliente: { sql: 'c.nome', tipo: 'texto' },
      cliente: { sql: 'c.nome', tipo: 'texto' },
      dt_emissao: { sql: 'r.dt_emissao', tipo: 'data' },
      'emissão': { sql: 'r.dt_emissao', tipo: 'data' },
      dt_venc: { sql: 'r.dt_venc', tipo: 'data' },
      vencimento: { sql: 'r.dt_venc', tipo: 'data' },
      dt_pgto: { sql: 'r.dt_pgto', tipo: 'data' },
      pagamento: { sql: 'r.dt_pgto', tipo: 'data' },
      valor_original: { sql: 'COALESCE(r.valor_pgto,0)', tipo: 'numero' },
      'valor original': { sql: 'COALESCE(r.valor_pgto,0)', tipo: 'numero' },
      valor_recebido: { sql: 'COALESCE(r.valor_rec,0)', tipo: 'numero' },
      'valor recebido': { sql: 'COALESCE(r.valor_rec,0)', tipo: 'numero' },
      nro_doc: { sql: 'r.nro_doc', tipo: 'texto' },
      'nº documento': { sql: 'r.nro_doc', tipo: 'texto' },
      cod_fat: { sql: 'CAST(r.cod_fat AS TEXT)', tipo: 'texto' },
      fatura: { sql: 'CAST(r.cod_fat AS TEXT)', tipo: 'texto' },
      banco: { sql: 'r.banco', tipo: 'texto' },
      descricao_conta: { sql: 'cf.cof_descricao', tipo: 'texto' },
      'conta financeira': { sql: 'cf.cof_descricao', tipo: 'texto' },
    };
    const opComparador = (op: string) =>
      op === 'maior' ? '>' : op === 'maior_igual' ? '>=' : op === 'menor' ? '<'
      : op === 'menor_igual' ? '<=' : op === 'diferente' ? '<>' : '=';
    const normalizarData = (v: string) => {
      const m = v.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/); // DD/MM/YYYY → YYYY-MM-DD
      return m ? `${m[3]}-${m[2]}-${m[1]}` : v.trim();
    };
    if (req.query.filtros_avancados) {
      let lista: { campo: string; tipo: string; valor: string }[] = [];
      try { lista = JSON.parse(String(req.query.filtros_avancados)); } catch { lista = []; }
      for (const f of Array.isArray(lista) ? lista : []) {
        const col = FILTRO_COLS[String(f?.campo || '').toLowerCase().trim()];
        if (!col) continue;
        const op = String(f?.tipo || 'contém');
        if (op === 'nulo') { whereClause += ` AND ${col.sql} IS NULL`; continue; }
        if (op === 'nao_nulo') { whereClause += ` AND ${col.sql} IS NOT NULL`; continue; }
        const valor = String(f?.valor ?? '').trim();
        if (!valor) continue;

        if (col.tipo === 'texto') {
          const ph = `$${paramIndex}`;
          if (op === 'igual') { whereClause += ` AND UPPER(${col.sql}) = UPPER(${ph})`; params.push(valor); }
          else if (op === 'diferente') { whereClause += ` AND (${col.sql} IS NULL OR UPPER(${col.sql}) <> UPPER(${ph}))`; params.push(valor); }
          else if (op === 'começa') { whereClause += ` AND ${col.sql} ILIKE ${ph}`; params.push(`${valor}%`); }
          else if (op === 'termina') { whereClause += ` AND ${col.sql} ILIKE ${ph}`; params.push(`%${valor}`); }
          else { whereClause += ` AND ${col.sql} ILIKE ${ph}`; params.push(`%${valor}%`); } // contém (default)
          paramIndex++;
        } else if (col.tipo === 'numero') {
          const num = parseFloat(valor.replace(/\./g, '').replace(',', '.'));
          const ph = `$${paramIndex}`;
          if (!Number.isFinite(num)) { whereClause += ` AND CAST(${col.sql} AS TEXT) ILIKE ${ph}`; params.push(`%${valor}%`); }
          else { whereClause += ` AND ${col.sql} ${opComparador(op)} ${ph}`; params.push(num); }
          paramIndex++;
        } else { // data
          const ph = `$${paramIndex}`;
          if (op === 'contém') { whereClause += ` AND to_char(${col.sql},'DD/MM/YYYY') ILIKE ${ph}`; params.push(`%${valor}%`); }
          else { whereClause += ` AND ${col.sql}::date ${opComparador(op)} ${ph}::date`; params.push(normalizarData(valor)); }
          paramIndex++;
        }
      }
    }

    // Query principal com cálculo de status baseado nos campos do PostgreSQL
    const query = `
      WITH contas_com_status AS (
        SELECT
          r.cod_receb as id,
          r.rec_cof_id,
          cf.cof_descricao as descricao_conta,
          r.codcli,
          c.nome as nome_cliente,
          r.dt_venc,
          r.dt_pgto,
          r.dt_emissao,
          r.valor_pgto as valor_original,
          COALESCE(r.valor_rec, 0) as valor_recebido,
          -- Saldo aberto do PRINCIPAL = valor_pgto - (valor_rec - juros_recebido). valor_rec inclui
          -- o juros (fiel ao Oracle); no parcial-com-juros o juros abatido primeiro deixa este residual.
          GREATEST(COALESCE(r.valor_pgto,0) - (COALESCE(r.valor_rec,0) - jr.juros_rec), 0) as valor_aberto,
          jr.juros_rec as juros_recebido,
          r.nro_doc,
          r.tipo,
          r.rec,
          r.cancel,
          r.banco,
          r.nro_banco,
          r.nro_docbanco,
          r.bradesco,
          r.forma_fat,
          r.cod_fat,
          r.cod_venda,
          r.grupo_pagamento_id,
          CASE
            WHEN r.cancel = 'S' THEN 'cancelado'
            -- Quitado: rec='S' OU o PRINCIPAL recebido (valor_rec - juros) já cobre o título.
            -- valor_rec inclui o juros (fiel ao Oracle CAIXA); sem descontar, o parcial-com-juros vira 'recebido'.
            WHEN r.rec = 'S' OR (COALESCE(r.valor_rec, 0) > 0 AND (COALESCE(r.valor_rec, 0) - jr.juros_rec) >= COALESCE(r.valor_pgto, 0)) THEN 'recebido'
            -- Parcial: recebeu algo mas ainda não cobriu o total (baixa em cascata deixa rec='N').
            WHEN COALESCE(r.valor_rec, 0) > 0 THEN 'recebido_parcial'
            WHEN r.dt_venc < CURRENT_DATE THEN 'vencido'
            ELSE 'pendente'
          END as status,
          CASE
            WHEN r.dt_venc < CURRENT_DATE AND (r.rec IS NULL OR r.rec != 'S')
            THEN CURRENT_DATE - r.dt_venc
            ELSE 0
          END as dias_atraso,
          -- Parcela X/N: títulos da MESMA fatura (cod_fat) são as parcelas; o nº da parcela
          -- vem da ordem por vencimento (o nro_doc traz o sufixo A/B/C…). Títulos avulsos
          -- (sem cod_fat) ficam 1/1 (partição própria pelo cod_receb).
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(r.cod_fat, 'AV' || CAST(r.cod_receb AS TEXT))
            ORDER BY r.dt_venc, r.nro_doc, r.cod_receb
          ) AS parcela_num,
          COUNT(*) OVER (
            PARTITION BY COALESCE(r.cod_fat, 'AV' || CAST(r.cod_receb AS TEXT))
          ) AS parcela_total
        FROM dbreceb r
        LEFT JOIN dbclien c ON c.codcli = r.codcli
        LEFT JOIN cad_conta_financeira cf ON cf.cof_id = r.rec_cof_id
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(fr.valor), 0) AS juros_rec FROM dbfreceb fr
           WHERE fr.cod_receb = r.cod_receb
             AND fr.tipo IN ('18','20','21','22','23','25','26','43') AND fr.sf <> 'C'
        ) jr ON TRUE
        WHERE 1=1 ${whereClause}
      )
      SELECT * FROM contas_com_status
      WHERE 1=1
      ${statusFilter ? `AND status = '${statusFilter}'` : ''}
      ${com_atraso === 'true' ? 'AND dias_atraso > 0' : ''}
      ORDER BY
        CASE status
          WHEN 'pendente' THEN 1
          WHEN 'vencido' THEN 2
          WHEN 'recebido_parcial' THEN 3
          WHEN 'recebido' THEN 4
          WHEN 'cancelado' THEN 5
          ELSE 6
        END,
        dt_venc ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(parseInt(limit as string), offset);

    const result = await pool.query(query, params);

    // Query de contagem total com o mesmo filtro de status
    const countQuery = `
      WITH contas_com_status AS (
        SELECT
          r.cod_receb,
          CASE
            WHEN r.cancel = 'S' THEN 'cancelado'
            -- Quitado: rec='S' OU o PRINCIPAL recebido (valor_rec - juros) já cobre o título.
            -- valor_rec inclui o juros (fiel ao Oracle CAIXA); sem descontar, o parcial-com-juros vira 'recebido'.
            WHEN r.rec = 'S' OR (COALESCE(r.valor_rec, 0) > 0 AND (COALESCE(r.valor_rec, 0) - jr.juros_rec) >= COALESCE(r.valor_pgto, 0)) THEN 'recebido'
            -- Parcial: recebeu algo mas ainda não cobriu o total (baixa em cascata deixa rec='N').
            WHEN COALESCE(r.valor_rec, 0) > 0 THEN 'recebido_parcial'
            WHEN r.dt_venc < CURRENT_DATE THEN 'vencido'
            ELSE 'pendente'
          END as status,
          CASE
            WHEN r.dt_venc < CURRENT_DATE AND (r.rec IS NULL OR r.rec != 'S')
            THEN CURRENT_DATE - r.dt_venc
            ELSE 0
          END as dias_atraso
        FROM dbreceb r
        LEFT JOIN dbclien c ON c.codcli = r.codcli
        LEFT JOIN cad_conta_financeira cf ON cf.cof_id = r.rec_cof_id
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(fr.valor), 0) AS juros_rec FROM dbfreceb fr
           WHERE fr.cod_receb = r.cod_receb
             AND fr.tipo IN ('18','20','21','22','23','25','26','43') AND fr.sf <> 'C'
        ) jr ON TRUE
        WHERE 1=1 ${whereClause}
      )
      SELECT COUNT(*) as total
      FROM contas_com_status
      WHERE 1=1
      ${statusFilter ? `AND status = '${statusFilter}'` : ''}
      ${com_atraso === 'true' ? 'AND dias_atraso > 0' : ''}
    `;

    const countParams = params.slice(0, -2); // Remove limit e offset
    const countResult = await pool.query(countQuery, countParams);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / parseInt(limit as string));

    // Formatar dados de resposta - MOSTRAR CADA PARCELA INDIVIDUALMENTE.
    // Parcela X/N vem das window functions (por cod_fat) — sem query por linha.
    const contasFormatadas = result.rows.map(row => {
      const parcela_total = parseInt(row.parcela_total || 1);
      const parcela_num = parseInt(row.parcela_num || 1);
      const parcela_atual = `${parcela_num}/${parcela_total}`; // ex.: "1/6"
      const qtd_parcelas = parcela_total;

      return {
        id: row.id,
        cod_receb: row.id,
        rec_cof_id: row.rec_cof_id,
        descricao_conta: row.descricao_conta,
        codcli: row.codcli,
        nome_cliente: row.nome_cliente,
        dt_venc: row.dt_venc,
        dt_pgto: row.dt_pgto,
        dt_emissao: row.dt_emissao,
        valor_original: parseFloat(row.valor_original || 0),
        valor_recebido: parseFloat(row.valor_recebido || 0),
        nro_doc: row.nro_doc,
        tipo: row.tipo,
        rec: row.rec,
        cancel: row.cancel,
        banco: row.banco,
        nro_banco: row.nro_banco,
        nro_docbanco: row.nro_docbanco,
        bradesco: row.bradesco,
        forma_fat: row.forma_fat,
        cod_fat: row.cod_fat,
        cod_venda: row.cod_venda,
        grupo_pagamento_id: row.grupo_pagamento_id,
        status: row.status,
        dias_atraso: parseInt(row.dias_atraso || 0),
        parcela_atual: parcela_atual, // Formato: "1/6", "2/6"
        parcela_num: parcela_num,
        qtd_parcelas: qtd_parcelas,
        eh_parcelada: parcela_total > 1 // Fatura com mais de 1 título = parcelada
      };
    });

    // Calcular resumo (usando valor_pgto como valor original a receber)
    const resumoQuery = `
      SELECT
        SUM(CASE WHEN status = 'pendente' THEN valor_pgto ELSE 0 END) as total_pendente,
        SUM(CASE WHEN status = 'recebido' THEN valor_pgto ELSE 0 END) as total_recebido,
        SUM(CASE WHEN status = 'vencido' THEN valor_pgto ELSE 0 END) as total_vencido,
        COUNT(CASE WHEN status = 'pendente' THEN 1 END) as qtd_pendente,
        COUNT(CASE WHEN status = 'vencido' THEN 1 END) as qtd_vencida
      FROM (
        SELECT
          r.valor_pgto,
          CASE
            WHEN r.cancel = 'S' THEN 'cancelado'
            WHEN r.rec = 'S' AND COALESCE(r.valor_rec, 0) >= COALESCE(r.valor_pgto, 0) THEN 'recebido'
            WHEN r.rec = 'S' AND COALESCE(r.valor_rec, 0) > 0 THEN 'recebido_parcial'
            WHEN r.dt_venc < CURRENT_DATE THEN 'vencido'
            ELSE 'pendente'
          END as status
        FROM dbreceb r
        WHERE r.cancel IS NULL OR r.cancel != 'S'
      ) as contas
    `;

    const resumoResult = await pool.query(resumoQuery);
    const resumo = resumoResult.rows[0];

    return res.status(200).json({
      contas_receber: contasFormatadas,
      paginacao: {
        pagina: parseInt(page as string),
        limite: parseInt(limit as string),
        total,
        totalPaginas: totalPages,
      },
      resumo: {
        total_a_receber: parseFloat(resumo.total_pendente || 0) + parseFloat(resumo.total_vencido || 0),
        total_recebido: parseFloat(resumo.total_recebido || 0),
        total_vencido: parseFloat(resumo.total_vencido || 0),
        total_pendente: parseFloat(resumo.total_pendente || 0),
        qtd_pendente: parseInt(resumo.qtd_pendente || 0),
        qtd_vencida: parseInt(resumo.qtd_vencida || 0),
      }
    });

  } catch (error) {
    console.error('Erro ao consultar contas a receber:', error);
    return res.status(500).json({
      erro: 'Erro interno do servidor',
      detalhes: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}

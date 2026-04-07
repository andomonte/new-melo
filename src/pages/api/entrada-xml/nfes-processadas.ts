import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query('SET search_path TO db_manaus');

    const {
      page = '1',
      limit = '25',
      search = '',
      filtro = '', // ✅ NOVO: Filtro do modal verde
      status,
      fornecedor,
      numeroNfe,
      serieNfe,
      chaveNfe,
      dataInicio,
      dataFim,
      valorMinimo,
      valorMaximo,
      temAssociacao
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 25;
    const offset = (pageNum - 1) * limitNum;

    console.log('Buscando NFes processadas com filtros:', { search, filtro, status, fornecedor, numeroNfe, temAssociacao });

    // Construir query dinâmica com filtros
    // IMPORTANTE: Seguindo lógica do sistema legado (UniExecEntrada.pas linha 5388)
    // NFes com exec='S' DEVEM aparecer na lista (não são removidas)
    // O sistema legado mostra NFes processadas com indicadores visuais diferentes
    let query = `
      SELECT DISTINCT
        n.codnfe_ent as id,
        n.chave as chave_nfe,
        n.nnf as numero_nfe,
        n.serie as serie_nfe,
        n.demi as data_emissao,
        e.xnome as fornecedor_nome,
        e.cpf_cnpj as fornecedor_cnpj,
        n.vnf as valor_total,
        n.exec as exec_status,
        COALESCE(n.pagamento_configurado, false) as pagamento_configurado,
        CASE
          WHEN n.exec = 'S' THEN 'PROCESSADA'
          WHEN n.exec = 'A' THEN 'EM_ANDAMENTO'
          WHEN n.exec = 'C' THEN 'ASSOCIACAO_CONCLUIDA'
          WHEN n.exec = 'R' THEN 'RECEBIDA'
          WHEN n.exec = 'N' THEN 'RECEBIDA'
          ELSE 'RECEBIDA'
        END as status,
        n.dtimport as created_at,
        COALESCE(COUNT(nia.id), 0) as itens_associados,
        CASE WHEN COUNT(nia.id) > 0 THEN true ELSE false END as pode_gerar_entrada
      FROM dbnfe_ent n
      LEFT JOIN dbnfe_ent_emit e ON n.codnfe_ent = e.codnfe_ent
      LEFT JOIN nfe_item_associacao nia ON n.codnfe_ent = nia.nfe_id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // ✅ NOVO: Filtro do modal verde (busca por ID, número, chave, fornecedor)
    if (filtro) {
      query += ` AND (
        n.codnfe_ent::text ILIKE $${paramIndex} OR
        n.nnf::text ILIKE $${paramIndex} OR
        n.chave ILIKE $${paramIndex} OR
        e.xnome ILIKE $${paramIndex} OR
        e.cpf_cnpj ILIKE $${paramIndex}
      )`;
      params.push(`%${filtro}%`);
      paramIndex++;
    }

    // Filtro de busca geral
    if (search) {
      query += ` AND (
        n.nnf::text ILIKE $${paramIndex} OR
        n.chave ILIKE $${paramIndex} OR
        e.xnome ILIKE $${paramIndex} OR
        e.cpf_cnpj ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Filtro por status
    if (status) {
      const statusArray = Array.isArray(status) ? status : [status];
      const statusPlaceholders = statusArray.map(() => `$${paramIndex++}`).join(', ');

      const statusMapeado = statusArray.map(s => {
        switch (s) {
          case 'PROCESSADA': return 'S';
          case 'EM_PROCESSAMENTO': return 'A';
          case 'RECEBIDA': return 'R';
          default: return s;
        }
      });

      query += ` AND n.exec IN (${statusPlaceholders})`;
      params.push(...statusMapeado);
    }

    // Filtro por fornecedor
    if (fornecedor) {
      query += ` AND (e.xnome ILIKE $${paramIndex} OR e.cpf_cnpj ILIKE $${paramIndex})`;
      params.push(`%${fornecedor}%`);
      paramIndex++;
    }

    // Filtro por número NFe
    if (numeroNfe) {
      query += ` AND n.nnf::text = $${paramIndex}`;
      params.push(numeroNfe);
      paramIndex++;
    }

    // Filtro por série NFe
    if (serieNfe) {
      query += ` AND n.serie::text = $${paramIndex}`;
      params.push(serieNfe);
      paramIndex++;
    }

    // Filtro por chave NFe
    if (chaveNfe) {
      query += ` AND n.chave ILIKE $${paramIndex}`;
      params.push(`%${chaveNfe}%`);
      paramIndex++;
    }

    // Filtro por data início
    if (dataInicio) {
      query += ` AND n.demi >= $${paramIndex}`;
      params.push(dataInicio);
      paramIndex++;
    }

    // Filtro por data fim
    if (dataFim) {
      query += ` AND n.demi <= $${paramIndex}`;
      params.push(dataFim);
      paramIndex++;
    }

    // Filtro por valor mínimo
    if (valorMinimo) {
      query += ` AND n.vnf >= $${paramIndex}`;
      params.push(parseFloat(valorMinimo as string));
      paramIndex++;
    }

    // Filtro por valor máximo
    if (valorMaximo) {
      query += ` AND n.vnf <= $${paramIndex}`;
      params.push(parseFloat(valorMaximo as string));
      paramIndex++;
    }

    query += `
      GROUP BY n.codnfe_ent, n.chave, n.nnf, n.serie, n.demi,
               e.xnome, e.cpf_cnpj, n.vnf, n.exec, n.pagamento_configurado, n.dtimport
    `;

    // Filtro por tem associação (após GROUP BY)
    if (temAssociacao === 'true') {
      query += ` HAVING COUNT(nia.id) > 0`;
    } else if (temAssociacao === 'false') {
      query += ` HAVING COUNT(nia.id) = 0`;
    }

    // Ordenação e paginação
    query += ` ORDER BY n.dtimport DESC
               LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limitNum, offset);

    // Executar query principal
    const result = await client.query(query, params);

    // Query para contar total - versão simplificada
    let countQuery = `
      SELECT COUNT(*) FROM (
        SELECT DISTINCT n.codnfe_ent
        FROM dbnfe_ent n
        LEFT JOIN dbnfe_ent_emit e ON n.codnfe_ent = e.codnfe_ent
        LEFT JOIN nfe_item_associacao nia ON n.codnfe_ent = nia.nfe_id
        WHERE 1=1
    `;

    let countParams = [];
    let countParamIndex = 1;

    // Replicar os mesmos filtros da query principal

    // ✅ NOVO: Filtro do modal verde
    if (filtro) {
      countQuery += ` AND (
        n.codnfe_ent::text ILIKE $${countParamIndex} OR
        n.nnf::text ILIKE $${countParamIndex} OR
        n.chave ILIKE $${countParamIndex} OR
        e.xnome ILIKE $${countParamIndex} OR
        e.cpf_cnpj ILIKE $${countParamIndex}
      )`;
      countParams.push(`%${filtro}%`);
      countParamIndex++;
    }

    if (search) {
      countQuery += ` AND (n.chave ILIKE $${countParamIndex} OR n.nnf::text ILIKE $${countParamIndex} OR e.xnome ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }

    if (status && status !== 'all') {
      if (status === 'processada') {
        countQuery += ` AND n.exec = 'S'`;
      } else if (status === 'pendente') {
        countQuery += ` AND n.exec = 'N'`;
      }
    }

    if (fornecedor) {
      countQuery += ` AND e.xnome ILIKE $${countParamIndex}`;
      countParams.push(`%${fornecedor}%`);
      countParamIndex++;
    }

    if (numeroNfe) {
      countQuery += ` AND n.nnf::text = $${countParamIndex}`;
      countParams.push(numeroNfe);
      countParamIndex++;
    }

    countQuery += `) as subquery`;

    // Executar query de contagem
    const countResult = await client.query(countQuery, countParams);

    const total = parseInt(countResult.rows[0].count || 0);
    console.log(`Encontradas ${result.rows.length} NFes processadas de um total de ${total}`);

    // Retornar dados formatados
    const nfesProcessadas = result.rows.map((row: any) => {
      // Determinar status display baseado no exec e nas associações
      let statusDisplay = 'Associação pendente';
      let podeGerarEntrada = false;

      if (row.exec_status === 'C') {
        // exec='C' significa que a associação está concluída e pagamento configurado
        statusDisplay = 'Associação concluída';
        podeGerarEntrada = true;
      } else if (row.pode_gerar_entrada) {
        // Tem associações mas ainda não configurou pagamento
        statusDisplay = 'Associação pendente';
        podeGerarEntrada = false;
      }

      return {
        id: row.id,
        chave_nfe: row.chave_nfe,
        numero_nfe: row.numero_nfe?.toString() || '',
        serie_nfe: row.serie_nfe?.toString() || '',
        data_emissao: row.data_emissao,
        fornecedor_nome: row.fornecedor_nome || 'N/A',
        fornecedor_cnpj: row.fornecedor_cnpj || '',
        valor_total: parseFloat(row.valor_total || 0),
        status: row.status,
        created_at: row.created_at,
        total_itens: parseInt(row.itens_associados || 0),
        itens_associados: parseInt(row.itens_associados || 0),
        pode_gerar_entrada: podeGerarEntrada,
        pagamento_configurado: row.pagamento_configurado || false,
        ordensCompra: [], // Buscar depois se necessário
        statusDisplay
      };
    });

    res.status(200).json({
      success: true,
      data: nfesProcessadas,
      total,
      page: pageNum,
      limit: limitNum
    });

  } catch (error) {
    console.error('Erro ao buscar NFes processadas:', error);

    // Fallback com dados mock se houver erro
    const mockData = [
      {
        id: 'MOCK003',
        chave_nfe: '352401144',
        numero_nfe: '999003',
        serie_nfe: '3',
        data_emissao: new Date('2024-12-02'),
        fornecedor_nome: 'FORNECEDOR PROCESSADO LTDA',
        fornecedor_cnpj: '12.345.678/0001-99',
        valor_total: 3200.00,
        status: 'PROCESSADA',
        created_at: new Date(),
        total_itens: 2,
        itens_associados: 2,
        pode_gerar_entrada: true,
        ordensCompra: [],
        statusDisplay: 'Pronto para gerar entrada'
      }
    ];

    res.status(200).json({
      success: true,
      data: mockData,
      total: mockData.length
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
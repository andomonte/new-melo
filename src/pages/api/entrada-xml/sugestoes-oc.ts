import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';

interface ItemNFe {
  codigo_produto: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
}

interface SugestaoOC {
  orc_id: number;
  req_id_composto: string;
  fornecedor_nome: string;
  fornecedor_cnpj: string;
  data_ordem: string;
  data_requisicao: string;
  valor_total: number;
  status: string;

  // Métricas de matching
  score_total: number;
  score_fornecedor: number;
  score_produtos: number;
  score_quantidade: number;
  score_data: number;

  // Detalhes do match
  produtos_comum: number;
  produtos_total_nfe: number;
  percentual_match_produtos: number;
  similaridade_quantidade: number;
  dias_diferenca: number;

  // Alertas e divergências
  alertas: string[];

  // Itens da OC que fazem match
  itens_match: Array<{
    codprod: string;
    referencia: string;
    descricao: string;
    quantidade_oc: number;
    quantidade_nfe: number;
    quantidade_disponivel: number;
    valor_unitario_oc: number;
    valor_unitario_nfe: number;
    diferenca_preco_percentual: number;
    diferenca_quantidade_percentual: number;
  }>;
}

interface SugestoesRequest {
  fornecedor_cnpj: string;
  itens_nfe: ItemNFe[];
  data_nfe?: string;
}

interface SugestoesResponse {
  success: boolean;
  data?: {
    sugestoes: SugestaoOC[];
    total_ocs_analisadas: number;
    criterios_utilizados: string[];
  };
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SugestoesResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { fornecedor_cnpj, itens_nfe, data_nfe }: SugestoesRequest = req.body;

  if (!fornecedor_cnpj || !itens_nfe || itens_nfe.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'CNPJ do fornecedor e itens da NFe são obrigatórios'
    });
  }

  let client;

  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();
    await client.query('SET search_path TO db_manaus');

    console.log('🔍 Iniciando busca de sugestões inteligentes para fornecedor:', fornecedor_cnpj);
    console.log('📦 Quantidade de itens na NFe:', itens_nfe.length);

    // Limpar CNPJ para comparação
    const cnpjLimpo = fornecedor_cnpj.replace(/[^0-9]/g, '');

    // Buscar todas as OCs ativas do fornecedor
    const ocsQuery = `
      SELECT DISTINCT
        o.orc_id,
        COALESCE(r.req_id_composto, o.orc_id::text) as req_id_composto,
        COALESCE(c.nome, c.razao, 'FORNECEDOR NÃO INFORMADO') as fornecedor_nome,
        c.cpf_cgc as fornecedor_cnpj,
        o.orc_data as data_ordem,
        r.req_data as data_requisicao,
        r.req_status as status_requisicao,
        o.orc_status as status_ordem
      FROM cmp_ordem_compra o
      INNER JOIN cmp_requisicao r
        ON o.orc_req_id = r.req_id
        AND o.orc_req_versao = r.req_versao
      LEFT JOIN dbcredor c
        ON r.req_cod_credor = c.cod_credor
      WHERE o.orc_status = 'A'
        AND REPLACE(REPLACE(REPLACE(c.cpf_cgc, '.', ''), '-', ''), '/', '') = $1
      ORDER BY o.orc_data DESC
      LIMIT 100
    `;

    const ocsResult = await client.query(ocsQuery, [cnpjLimpo]);
    console.log(`✅ Encontradas ${ocsResult.rows.length} OCs ativas do fornecedor`);

    if (ocsResult.rows.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          sugestoes: [],
          total_ocs_analisadas: 0,
          criterios_utilizados: ['fornecedor_cnpj']
        },
        message: 'Nenhuma ordem de compra ativa encontrada para este fornecedor'
      });
    }

    // Para cada OC, buscar itens e calcular score
    // 🚀 OTIMIZAÇÃO: Buscar TODOS os itens de TODAS as OCs de uma vez (elimina N+1 queries)
    const ocIds = ocsResult.rows.map(oc => oc.orc_id);

    const allItensQuery = `
      SELECT
        o.orc_id,
        ri.itr_codprod as codprod,
        COALESCE(p.descr, p.descricao, 'PRODUTO SEM DESCRIÇÃO') as descricao,
        COALESCE(p.ref, '') as ref_fabricante,
        ri.itr_quantidade as quantidade_oc,
        COALESCE(ri.itr_quantidade_atendida, 0) as quantidade_atendida,
        (ri.itr_quantidade - COALESCE(ri.itr_quantidade_atendida, 0)) as quantidade_disponivel,
        ri.itr_pr_unitario as valor_unitario_oc,
        COALESCE(p.marca, 'SEM MARCA') as marca
      FROM cmp_ordem_compra o
      INNER JOIN cmp_it_requisicao ri
        ON o.orc_req_id = ri.itr_req_id
        AND o.orc_req_versao = ri.itr_req_versao
      LEFT JOIN dbprod p ON ri.itr_codprod = p.codprod
      WHERE o.orc_id = ANY($1)
        AND (ri.itr_quantidade - COALESCE(ri.itr_quantidade_atendida, 0)) > 0
    `;

    const allItensResult = await client.query(allItensQuery, [ocIds]);

    // Agrupar itens por OC para acesso O(1)
    const itensPorOC: Record<number, any[]> = {};
    for (const item of allItensResult.rows) {
      if (!itensPorOC[item.orc_id]) {
        itensPorOC[item.orc_id] = [];
      }
      itensPorOC[item.orc_id].push(item);
    }

    console.log(`🚀 Otimização: Buscados itens de ${ocIds.length} OCs em 1 query ao invés de ${ocIds.length} queries!`);

    const sugestoes: SugestaoOC[] = [];
    const dataNFe = data_nfe ? new Date(data_nfe) : new Date();

    for (const oc of ocsResult.rows) {
      // Buscar itens da OC do cache em memória
      const itensOC = itensPorOC[oc.orc_id] || [];

      if (itensOC.length === 0) {
        continue; // Pular OCs sem itens disponíveis
      }

      // Calcular matching entre itens da NFe e itens da OC
      const itens_match: SugestaoOC['itens_match'] = [];
      let produtos_comum = 0;
      let soma_diferenca_quantidade = 0;
      let soma_diferenca_preco = 0;
      let alertas: string[] = [];

      for (const itemNFe of itens_nfe) {
        // 1. Tentar match por codigo interno
        let itemOC = itensOC.find(i => i.codprod === itemNFe.codigo_produto);

        // 2. Se nao achou, tentar por referencia do fabricante
        if (!itemOC && itemNFe.codigo_produto) {
          const codNormalizado = itemNFe.codigo_produto.trim().toUpperCase();
          itemOC = itensOC.find(i => {
            const refNormalizada = (i.ref_fabricante || '').trim().toUpperCase();
            return refNormalizada && refNormalizada === codNormalizado;
          });
        }

        if (itemOC) {
          produtos_comum++;

          const quantidade_disponivel = parseFloat(itemOC.quantidade_disponivel);
          const quantidade_nfe = itemNFe.quantidade;
          const valor_unitario_oc = parseFloat(itemOC.valor_unitario_oc);
          const valor_unitario_nfe = itemNFe.valor_unitario;

          // Calcular diferenças percentuais
          const diferenca_quantidade_percentual = quantidade_disponivel > 0
            ? Math.abs((quantidade_nfe - quantidade_disponivel) / quantidade_disponivel) * 100
            : 100;

          const diferenca_preco_percentual = valor_unitario_oc > 0
            ? Math.abs((valor_unitario_nfe - valor_unitario_oc) / valor_unitario_oc) * 100
            : 100;

          soma_diferenca_quantidade += diferenca_quantidade_percentual;
          soma_diferenca_preco += diferenca_preco_percentual;

          itens_match.push({
            codprod: itemOC.codprod,
            referencia: itemOC.ref_fabricante || itemOC.codprod,
            descricao: itemOC.descricao,
            quantidade_oc: parseFloat(itemOC.quantidade_oc),
            quantidade_nfe,
            quantidade_disponivel,
            valor_unitario_oc,
            valor_unitario_nfe,
            diferenca_preco_percentual: Math.round(diferenca_preco_percentual * 100) / 100,
            diferenca_quantidade_percentual: Math.round(diferenca_quantidade_percentual * 100) / 100
          });

          // Alertas de divergências
          if (diferenca_quantidade_percentual > 50) {
            alertas.push(`Produto ${itemOC.codprod}: grande diferença de quantidade (${diferenca_quantidade_percentual.toFixed(1)}%)`);
          }

          if (diferenca_preco_percentual > 20) {
            alertas.push(`Produto ${itemOC.codprod}: diferença de preço significativa (${diferenca_preco_percentual.toFixed(1)}%)`);
          }

          if (quantidade_nfe > quantidade_disponivel) {
            alertas.push(`Produto ${itemOC.codprod}: quantidade NFe (${quantidade_nfe}) maior que disponível (${quantidade_disponivel})`);
          }
        }
      }

      // Calcular scores individuais
      const percentual_match_produtos = (produtos_comum / itens_nfe.length) * 100;
      const score_produtos = Math.round(percentual_match_produtos); // 0-100 pontos

      // Score de quantidade: quanto menor a diferença, maior o score
      const media_diferenca_quantidade = produtos_comum > 0
        ? soma_diferenca_quantidade / produtos_comum
        : 100;
      const score_quantidade = Math.max(0, Math.round(100 - media_diferenca_quantidade)); // 0-100 pontos

      // Score de data: quanto mais próxima, maior o score
      const dataOC = new Date(oc.data_requisicao || oc.data_ordem);
      const dias_diferenca = Math.abs(Math.floor((dataNFe.getTime() - dataOC.getTime()) / (1000 * 60 * 60 * 24)));
      const score_data = Math.max(0, Math.round(100 - (dias_diferenca / 30) * 100)); // 0-100 pontos (diminui 100 pontos a cada 30 dias)

      // Score de fornecedor (sempre 100 porque já filtrou por fornecedor)
      const score_fornecedor = 100;

      // Score total ponderado
      // Pesos: produtos (40%), quantidade (25%), data (20%), fornecedor (15%)
      const score_total = Math.round(
        (score_produtos * 0.40) +
        (score_quantidade * 0.25) +
        (score_data * 0.20) +
        (score_fornecedor * 0.15)
      );

      // Calcular valor total da OC
      const valor_total = itensOC.reduce((sum, item) =>
        sum + (parseFloat(item.quantidade_oc) * parseFloat(item.valor_unitario_oc)), 0
      );

      // Alertas adicionais
      if (produtos_comum === 0) {
        alertas.push('Nenhum produto da NFe encontrado nesta OC');
      } else if (percentual_match_produtos < 50) {
        alertas.push(`Apenas ${percentual_match_produtos.toFixed(1)}% dos produtos da NFe estão nesta OC`);
      }

      if (dias_diferenca > 60) {
        alertas.push(`OC com ${dias_diferenca} dias de diferença da NFe`);
      }

      // Similaridade de quantidade (métrica adicional)
      const similaridade_quantidade = Math.max(0, 100 - media_diferenca_quantidade);

      sugestoes.push({
        orc_id: oc.orc_id,
        req_id_composto: oc.req_id_composto,
        fornecedor_nome: oc.fornecedor_nome,
        fornecedor_cnpj: oc.fornecedor_cnpj,
        data_ordem: oc.data_ordem,
        data_requisicao: oc.data_requisicao,
        valor_total: Math.round(valor_total * 100) / 100,
        status: oc.status_ordem,

        score_total,
        score_fornecedor,
        score_produtos,
        score_quantidade,
        score_data,

        produtos_comum,
        produtos_total_nfe: itens_nfe.length,
        percentual_match_produtos: Math.round(percentual_match_produtos * 100) / 100,
        similaridade_quantidade: Math.round(similaridade_quantidade * 100) / 100,
        dias_diferenca,

        alertas,
        itens_match
      });
    }

    // Ordenar por score total (maior primeiro)
    sugestoes.sort((a, b) => b.score_total - a.score_total);

    // Limitar a 10 melhores sugestões
    const melhoresSugestoes = sugestoes.slice(0, 10);

    console.log(`🎯 Geradas ${melhoresSugestoes.length} sugestões de ${ocsResult.rows.length} OCs analisadas`);
    if (melhoresSugestoes.length > 0) {
      console.log(`🏆 Melhor sugestão: OC ${melhoresSugestoes[0].orc_id} com score ${melhoresSugestoes[0].score_total}`);
    }

    return res.status(200).json({
      success: true,
      data: {
        sugestoes: melhoresSugestoes,
        total_ocs_analisadas: ocsResult.rows.length,
        criterios_utilizados: [
          'fornecedor_cnpj (15%)',
          'produtos_comum (40%)',
          'similaridade_quantidade (25%)',
          'proximidade_data (20%)'
        ]
      }
    });

  } catch (error) {
    console.error('❌ Erro ao gerar sugestões de OC:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao gerar sugestões de ordens de compra',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

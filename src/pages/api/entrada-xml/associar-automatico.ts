import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

interface ItemNFeInput {
  nItem: string;
  cProd: string;
  xProd: string;
  qCom: number;
  vUnCom: number;
}

interface AssociacaoResultado {
  nfeItemId: string;
  produtoId: string;
  produtoDescricao: string;
  status: 'associated' | 'partial' | 'not_found';
  pedidos: Array<{
    pedidoId: string;
    quantidade: number;
    valorUnitario: number;
  }>;
}

interface AssociarAutomaticoResponse {
  success: boolean;
  associacoes: AssociacaoResultado[];
  stats: {
    total: number;
    associados: number;
    parciais: number;
    nao_associados: number;
  };
  message?: string;
}

/**
 * Calcula similaridade entre duas descrições (0-100)
 */
function calcularSimilaridade(descricao1: string, descricao2: string): number {
  if (!descricao1 || !descricao2) return 0;

  const normalizar = (str: string) => {
    return str
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const texto1 = normalizar(descricao1);
  const texto2 = normalizar(descricao2);

  const extrairPalavras = (texto: string) => {
    return texto.split(' ')
      .filter(p => p.length >= 2)
      .filter(p => !/^\d{1,2}$/.test(p))
      .filter(p => !['DE', 'DA', 'DO', 'COM', 'SEM', 'PARA', 'POR', 'EM', 'NA', 'NO', 'AS', 'OS', 'UM', 'UMA'].includes(p));
  };

  const palavras1 = extrairPalavras(texto1);
  const palavras2 = extrairPalavras(texto2);

  if (palavras1.length === 0 || palavras2.length === 0) return 0;

  let matches = 0;
  let matchesParciais = 0;

  for (const p1 of palavras1) {
    for (const p2 of palavras2) {
      if (p1 === p2) {
        matches++;
        break;
      } else if (p1.includes(p2) || p2.includes(p1)) {
        matchesParciais += 0.5;
        break;
      }
    }
  }

  const totalMatches = matches + matchesParciais;
  const menorArray = Math.min(palavras1.length, palavras2.length);
  const score = (totalMatches / menorArray) * 100;

  return Math.min(100, Math.round(score));
}

const THRESHOLD_SIMILARIDADE_AUTO = 50; // Threshold mais alto para modo automático

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AssociarAutomaticoResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { nfeId, itens, cnpjEmitente } = req.body as {
    nfeId: string;
    itens: ItemNFeInput[];
    cnpjEmitente: string;
  };

  if (!nfeId || !itens || !cnpjEmitente) {
    return res.status(400).json({
      error: 'nfeId, itens e cnpjEmitente são obrigatórios'
    });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query('SET search_path TO db_manaus');

    const cnpjLimpo = cnpjEmitente.replace(/[^0-9]/g, '');
    console.log('🤖 [Auto] Iniciando associação automática para NFe:', nfeId);
    console.log('🤖 [Auto] CNPJ fornecedor:', cnpjLimpo);
    console.log('🤖 [Auto] Total de itens NFe:', itens.length);

    // 1. Buscar código do fornecedor (cod_credor) pelo CNPJ
    const credorResult = await client.query(`
      SELECT cod_credor
      FROM dbcredor
      WHERE cpf_cgc = $1
      LIMIT 1
    `, [cnpjLimpo]);

    const codCredor = credorResult.rows.length > 0 ? credorResult.rows[0].cod_credor : null;
    console.log('🤖 [Auto] Código credor:', codCredor);

    // 2. Buscar TODAS as OCs ativas do fornecedor, ordenadas por data ASC (mais antiga primeiro)
    const ordensResult = await client.query(`
      SELECT DISTINCT
        o.orc_id,
        o.orc_req_id as req_id,
        o.orc_req_versao as req_versao,
        o.orc_data as data_ordem,
        c.cpf_cgc as fornecedor_cnpj
      FROM cmp_ordem_compra o
      INNER JOIN cmp_requisicao r
        ON o.orc_req_id = r.req_id
        AND o.orc_req_versao = r.req_versao
      LEFT JOIN dbcredor c
        ON r.req_cod_credor = c.cod_credor
      WHERE o.orc_status = 'A'
        AND REPLACE(REPLACE(REPLACE(c.cpf_cgc, '.', ''), '-', ''), '/', '') = $1
      ORDER BY o.orc_data ASC, o.orc_id ASC
    `, [cnpjLimpo]);

    if (ordensResult.rows.length === 0) {
      return res.status(200).json({
        success: true,
        associacoes: itens.map(item => ({
          nfeItemId: item.nItem,
          produtoId: '',
          produtoDescricao: item.xProd,
          status: 'not_found' as const,
          pedidos: []
        })),
        stats: {
          total: itens.length,
          associados: 0,
          parciais: 0,
          nao_associados: itens.length
        },
        message: 'Nenhuma OC ativa encontrada para este fornecedor'
      });
    }

    console.log('🤖 [Auto] OCs encontradas:', ordensResult.rows.length);

    // 3. Buscar todos os itens de todas as OCs com quantidade disponível
    const ocIds = ordensResult.rows.map((o: any) => o.orc_id);
    const itensOCResult = await client.query(`
      SELECT
        o.orc_id,
        o.orc_data as data_ordem,
        ri.itr_codprod as codprod,
        COALESCE(p.descr, 'PRODUTO SEM DESCRICAO') as descricao,
        COALESCE(p.ref, '') as ref_fabricante,
        ri.itr_quantidade as quantidade_oc,
        COALESCE(ri.itr_quantidade_atendida, 0) as quantidade_atendida,
        (ri.itr_quantidade - COALESCE(ri.itr_quantidade_atendida, 0)) as quantidade_disponivel,
        COALESCE(ri.itr_pr_unitario, 0) as valor_unitario
      FROM cmp_ordem_compra o
      INNER JOIN cmp_it_requisicao ri
        ON o.orc_req_id = ri.itr_req_id
        AND o.orc_req_versao = ri.itr_req_versao
      LEFT JOIN dbprod p ON ri.itr_codprod = p.codprod
      WHERE o.orc_id = ANY($1)
        AND (ri.itr_quantidade - COALESCE(ri.itr_quantidade_atendida, 0)) > 0
      ORDER BY o.orc_data ASC, o.orc_id ASC
    `, [ocIds]);

    // Agrupar itens por OC (mantendo ordem por data ASC)
    const itensPorOC: Record<number, any[]> = {};
    for (const item of itensOCResult.rows) {
      if (!itensPorOC[item.orc_id]) {
        itensPorOC[item.orc_id] = [];
      }
      itensPorOC[item.orc_id].push(item);
    }

    // Track de quantidade disponível restante por OC/produto
    // Chave: "orc_id|codprod", Valor: quantidade restante
    const qtdDisponivel = new Map<string, number>();
    for (const item of itensOCResult.rows) {
      const key = `${item.orc_id}|${item.codprod}`;
      qtdDisponivel.set(key, parseFloat(item.quantidade_disponivel));
    }

    // 4. Para cada item da NFe, tentar encontrar produto e alocar em OCs
    const associacoes: AssociacaoResultado[] = [];

    for (const itemNFe of itens) {
      console.log(`🤖 [Auto] Processando item ${itemNFe.nItem}: ${itemNFe.xProd}`);

      // 4a. Tentar encontrar o produto no sistema
      let produtoEncontrado: { codprod: string; descricao: string } | null = null;

      // Estratégia 1: Match por codprod direto (cProd da NFe = codprod)
      for (const ocId of ocIds) {
        const itensOC = itensPorOC[ocId] || [];
        const matchDireto = itensOC.find((i: any) => i.codprod === itemNFe.cProd);
        if (matchDireto) {
          produtoEncontrado = { codprod: matchDireto.codprod, descricao: matchDireto.descricao };
          break;
        }
      }

      // Estratégia 2: Match por referência do fabricante (cProd da NFe = ref na OC)
      if (!produtoEncontrado && itemNFe.cProd) {
        const cProdNorm = itemNFe.cProd.trim().toUpperCase();
        for (const ocId of ocIds) {
          const itensOC = itensPorOC[ocId] || [];
          const matchRef = itensOC.find((i: any) => {
            const ref = (i.ref_fabricante || '').trim().toUpperCase();
            return ref && ref === cProdNorm;
          });
          if (matchRef) {
            produtoEncontrado = { codprod: matchRef.codprod, descricao: matchRef.descricao };
            break;
          }
        }
      }

      // Estratégia 3: Sugestão inteligente via dbref_fabrica (mesmo que sugerir-produto.ts)
      if (!produtoEncontrado && codCredor && itemNFe.cProd) {
        const refResult = await client.query(`
          SELECT
            p.codprod,
            p.descr as descricao
          FROM dbref_fabrica rf
          INNER JOIN dbprod_ref_fabrica prf ON rf.cod_id = prf.cod_id
          INNER JOIN dbprod p ON prf.codprod = p.codprod
          WHERE rf.referencia = $1
            AND rf.codcredor = $2
            AND p.inf NOT IN ('D')
            AND p.excluido <> 1
          ORDER BY p.codprod
          LIMIT 1
        `, [itemNFe.cProd, codCredor]);

        if (refResult.rows.length > 0) {
          produtoEncontrado = {
            codprod: refResult.rows[0].codprod,
            descricao: refResult.rows[0].descricao
          };
          console.log(`🤖 [Auto] Item ${itemNFe.nItem}: Sugestão inteligente encontrou ${produtoEncontrado.codprod}`);
        }
      }

      // Estratégia 4: Similaridade de descrição (threshold mais alto para evitar erros)
      if (!produtoEncontrado && itemNFe.xProd) {
        let melhorScore = 0;
        let melhorMatch: any = null;

        for (const ocId of ocIds) {
          const itensOC = itensPorOC[ocId] || [];
          for (const itemOC of itensOC) {
            const key = `${ocId}|${itemOC.codprod}`;
            const qtdRest = qtdDisponivel.get(key) || 0;
            if (qtdRest <= 0) continue;

            const score = calcularSimilaridade(itemNFe.xProd, itemOC.descricao);
            if (score > melhorScore && score >= THRESHOLD_SIMILARIDADE_AUTO) {
              melhorScore = score;
              melhorMatch = itemOC;
            }
          }
        }

        if (melhorMatch) {
          produtoEncontrado = { codprod: melhorMatch.codprod, descricao: melhorMatch.descricao };
          console.log(`🤖 [Auto] Item ${itemNFe.nItem}: Match por similaridade (${melhorScore}%) → ${produtoEncontrado.codprod}`);
        }
      }

      if (!produtoEncontrado) {
        console.log(`🤖 [Auto] Item ${itemNFe.nItem}: Produto não encontrado`);
        associacoes.push({
          nfeItemId: itemNFe.nItem,
          produtoId: '',
          produtoDescricao: itemNFe.xProd,
          status: 'not_found',
          pedidos: []
        });
        continue;
      }

      // 4b. Alocar quantidade nas OCs da mais antiga para a mais nova
      let qtdRestante = itemNFe.qCom;
      const pedidosAlocados: AssociacaoResultado['pedidos'] = [];

      // Percorrer OCs em ordem de data ASC (já vem ordenado)
      for (const ordem of ordensResult.rows) {
        if (qtdRestante <= 0) break;

        const key = `${ordem.orc_id}|${produtoEncontrado.codprod}`;
        const disponivelNaOC = qtdDisponivel.get(key) || 0;

        if (disponivelNaOC <= 0) continue;

        // Quanto alocar nesta OC
        const alocar = Math.min(qtdRestante, disponivelNaOC);

        // Buscar valor unitário desta OC para este produto
        const itemOC = (itensPorOC[ordem.orc_id] || []).find(
          (i: any) => i.codprod === produtoEncontrado!.codprod
        );
        const valorUnit = itemOC ? parseFloat(itemOC.valor_unitario) : itemNFe.vUnCom;

        pedidosAlocados.push({
          pedidoId: ordem.orc_id.toString(),
          quantidade: alocar,
          valorUnitario: valorUnit
        });

        // Atualizar quantidade disponível
        qtdDisponivel.set(key, disponivelNaOC - alocar);
        qtdRestante -= alocar;

        console.log(`🤖 [Auto] Item ${itemNFe.nItem}: Alocou ${alocar} na OC ${ordem.orc_id} (restante: ${qtdRestante})`);
      }

      if (pedidosAlocados.length === 0) {
        // Produto encontrado mas sem OC com quantidade disponível
        associacoes.push({
          nfeItemId: itemNFe.nItem,
          produtoId: produtoEncontrado.codprod,
          produtoDescricao: produtoEncontrado.descricao,
          status: 'not_found',
          pedidos: []
        });
      } else if (qtdRestante > 0) {
        // Associação parcial (não conseguiu alocar tudo)
        associacoes.push({
          nfeItemId: itemNFe.nItem,
          produtoId: produtoEncontrado.codprod,
          produtoDescricao: produtoEncontrado.descricao,
          status: 'partial',
          pedidos: pedidosAlocados
        });
      } else {
        // Associação completa
        associacoes.push({
          nfeItemId: itemNFe.nItem,
          produtoId: produtoEncontrado.codprod,
          produtoDescricao: produtoEncontrado.descricao,
          status: 'associated',
          pedidos: pedidosAlocados
        });
      }
    }

    // 5. Calcular stats
    const stats = {
      total: itens.length,
      associados: associacoes.filter(a => a.status === 'associated').length,
      parciais: associacoes.filter(a => a.status === 'partial').length,
      nao_associados: associacoes.filter(a => a.status === 'not_found').length
    };

    console.log('🤖 [Auto] Resultado:', stats);

    return res.status(200).json({
      success: true,
      associacoes,
      stats
    });

  } catch (error) {
    console.error('🤖 [Auto] Erro na associação automática:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Erro na associação automática'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

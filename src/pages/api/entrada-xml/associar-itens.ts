import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';
import { registrarHistoricoNfe } from '@/lib/nfe/historicoNfeHelper';

interface ItemAssociation {
  pedidoId: string;
  quantidade: number;
  valorUnitario: number;
}

interface AssociatedItem {
  nfeItemId: string;
  produtoId: string;
  associacoes: ItemAssociation[];
  meianota: boolean;
  precoReal?: number;
  precoUnitarioNF?: number;   // ⭐ Preço unitário da Nota Fiscal (quantidade sempre = quantidade do pedido)
  rateio?: string;
  criterioRateio?: string;
  centroCusto?: string;
  // 🧠 APRENDIZADO INTELIGENTE
  referenciaNFe?: string;  // cProd do item na NFe (código do fornecedor)
  codMarca?: string;        // marca do produto associado
}

interface AssociarItensRequest {
  nfeId: string;
  associatedItems: AssociatedItem[];
  userId?: string;
  userName?: string;
}

interface AssociarItensResponse {
  success: boolean;
  message: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AssociarItensResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { nfeId, associatedItems, userId, userName }: AssociarItensRequest = req.body;

  console.log('🔍 DEBUG - Dados recebidos no endpoint associar-itens:');
  console.log('   nfeId:', nfeId);
  console.log('   associatedItems count:', associatedItems?.length);
  console.log('   associatedItems:', JSON.stringify(associatedItems, null, 2));

  if (!nfeId || !associatedItems || associatedItems.length === 0) {
    return res.status(400).json({
      error: 'NFE ID e itens associados são obrigatórios'
    });
  }

  let client;

  try {
    client = await pool.connect();
    console.log('✅ Conexão com banco estabelecida');

    // Iniciar transação
    await client.query('BEGIN');

    // Para NFes de teste, usar ID 1 (que existe na tabela nfe_entrada)
    let nfeIdFinal: string;
    let isTestMode = false;
    let fornecedorNFe: string | null = null;

    // Verificar se é um NFe de teste
    if (typeof nfeId === 'string' && (nfeId.startsWith('MOCK') || nfeId.startsWith('99'))) {
      console.log(`NFe de teste detectada: ${nfeId}, usando ID 1 para testes`);
      isTestMode = true;
      nfeIdFinal = '1'; // Usar ID 1 que existe na tabela nfe_entrada
    } else {
      // Para NFes reais do Oracle
      console.log(`NFe real detectada: ${nfeId}`);
      isTestMode = false;
      nfeIdFinal = nfeId; // Usar o ID real como string
    }

    // 🔒 MELHORIA 1: Buscar fornecedor da NFe para validação
    if (!isTestMode) {
      const nfeResult = await client.query(`
        SELECT fornecedor_id
        FROM db_manaus.nfe_entrada
        WHERE numero_nf = $1
        LIMIT 1
      `, [nfeIdFinal]);

      if (nfeResult.rows.length > 0) {
        fornecedorNFe = nfeResult.rows[0].fornecedor_id;
        console.log(`📋 Fornecedor da NFe ${nfeId}: ${fornecedorNFe}`);
      } else {
        console.log(`⚠️ NFe ${nfeId} não encontrada na tabela nfe_entrada`);
      }
    }

    // REMOVIDO: Código que resetava flag de pagamento das ordens
    // Motivo: Configuração de pagamento agora é feita POR NFe, não por ordem
    // O pagamento antecipado (parcela 0) continua vinculado à ordem e não precisa ser resetado

    // Limpar associações anteriores
    await client.query(`
      DELETE FROM db_manaus.nfe_item_associacao WHERE nfe_id = $1
    `, [nfeIdFinal]);

    await client.query(`
      DELETE FROM db_manaus.nfe_item_pedido_associacao WHERE nfe_id = $1
    `, [nfeIdFinal]);

    // 🔒 PRÉ-VALIDAÇÃO: Agrupar quantidades por OC/Produto para validar SOMA TOTAL
    // Isso evita que múltiplos itens da NFe para o mesmo produto excedam a quantidade disponível na OC
    const qtdPorOCProduto = new Map<string, { solicitada: number; produtos: string[] }>();

    for (const item of associatedItems) {
      for (const assoc of item.associacoes) {
        // Ignorar para pedidos de teste
        if (assoc.pedidoId.toString().startsWith('99') ||
            assoc.pedidoId.toString().startsWith('FB') ||
            assoc.pedidoId.toString().startsWith('fallback')) {
          continue;
        }
        const key = `${assoc.pedidoId}|${item.produtoId}`;
        const atual = qtdPorOCProduto.get(key) || { solicitada: 0, produtos: [] };
        atual.solicitada += assoc.quantidade;
        atual.produtos.push(item.nfeItemId);
        qtdPorOCProduto.set(key, atual);
      }
    }

    // Validar totais por OC/Produto
    for (const [key, info] of qtdPorOCProduto) {
      const [pedidoId, produtoId] = key.split('|');

      // Buscar quantidade disponível na OC
      const validacaoResult = await client.query(`
        SELECT
          (ri.itr_quantidade - COALESCE(ri.itr_quantidade_atendida, 0)) as quantidade_disponivel
        FROM db_manaus.cmp_ordem_compra o
        INNER JOIN db_manaus.cmp_requisicao r
          ON o.orc_req_id = r.req_id
          AND o.orc_req_versao = r.req_versao
        INNER JOIN db_manaus.cmp_it_requisicao ri
          ON r.req_id = ri.itr_req_id
          AND r.req_versao = ri.itr_req_versao
          AND ri.itr_codprod = $2
        WHERE o.orc_id = $1
      `, [pedidoId, produtoId]);

      if (validacaoResult.rows.length > 0) {
        const qtdDisponivel = parseFloat(validacaoResult.rows[0].quantidade_disponivel);
        if (info.solicitada > qtdDisponivel) {
          throw new Error(
            `❌ QUANTIDADE TOTAL EXCEDE DISPONÍVEL!\n\n` +
            `OC: ${pedidoId}\n` +
            `Produto: ${produtoId}\n\n` +
            `Quantidade disponível na OC: ${qtdDisponivel}\n` +
            `Soma das associações: ${info.solicitada}\n` +
            `(${info.produtos.length} item(ns) da NFe usando este produto)\n\n` +
            `A NFe tem itens divididos que totalizam mais que a OC permite.\n` +
            `Por favor, ajuste as quantidades ou associe a outra OC.`
          );
        }
      }
    }

    console.log('✅ Pré-validação de quantidades totais: OK');

    // Inserir novas associações
    for (const item of associatedItems) {
      console.log('Processando item:', item);

      // 🔒 VALIDAÇÃO: Verificar se todas as OCs/Requisições estão ATIVAS antes de associar
      for (const assoc of item.associacoes) {
        // Ignorar validação para pedidos de teste/fallback
        if (assoc.pedidoId.toString().startsWith('99') ||
            assoc.pedidoId.toString().startsWith('FB') ||
            assoc.pedidoId.toString().startsWith('fallback')) {
          continue;
        }

        // 🔧 Buscar códigos sinônimos do produto (ex: 414182 e 001620 são o mesmo produto)
        const codigosSinonimosResult = await client.query(`
          SELECT DISTINCT codprod
          FROM db_manaus.dbprod
          WHERE descr = (
            SELECT descr FROM db_manaus.dbprod WHERE codprod = $1 LIMIT 1
          )
        `, [item.produtoId]);

        const codigosSinonimos = codigosSinonimosResult.rows.map(row => row.codprod);

        if (codigosSinonimos.length === 0) {
          // Se não encontrou produto no banco, adicionar o próprio código
          codigosSinonimos.push(item.produtoId);
        }

        console.log(`🔍 Códigos sinônimos encontrados para ${item.produtoId}:`, codigosSinonimos);

        const validacaoOC = await client.query(`
          SELECT
            o.orc_id,
            o.orc_status,
            r.req_status,
            r.req_cod_credor as fornecedor_oc,
            ri.itr_quantidade as quantidade,
            ri.itr_codprod as codigo_produto_na_oc,
            COALESCE(ri.itr_quantidade_atendida, 0) as quantidade_atendida,
            (ri.itr_quantidade - COALESCE(ri.itr_quantidade_atendida, 0)) as quantidade_disponivel
          FROM db_manaus.cmp_ordem_compra o
          INNER JOIN db_manaus.cmp_requisicao r
            ON o.orc_req_id = r.req_id
            AND o.orc_req_versao = r.req_versao
          INNER JOIN db_manaus.cmp_it_requisicao ri
            ON r.req_id = ri.itr_req_id
            AND r.req_versao = ri.itr_req_versao
            AND ri.itr_codprod = ANY($2::text[])
          WHERE o.orc_id = $1
        `, [assoc.pedidoId, codigosSinonimos]);

        if (validacaoOC.rows.length === 0) {
          throw new Error(`Ordem de compra ${assoc.pedidoId} não encontrada ou produto ${item.produtoId} não está nesta OC`);
        }

        const oc = validacaoOC.rows[0];

        // Validar status da OC
        if (oc.orc_status !== 'A') {
          throw new Error(`Ordem de compra ${assoc.pedidoId} não está ATIVA (status: ${oc.orc_status}). Não é possível associar.`);
        }

        // 🔒 MELHORIA 1: Validar fornecedor (NFe vs OC) - AGORA BLOQUEANDO!
        if (!isTestMode && fornecedorNFe && oc.fornecedor_oc) {
          if (fornecedorNFe !== oc.fornecedor_oc) {
            console.error(`❌ ERRO: Fornecedor divergente! NFe: ${fornecedorNFe}, OC: ${oc.fornecedor_oc}`);
            // Agora bloqueando associações com fornecedores divergentes
            throw new Error(`Fornecedor da NFe (${fornecedorNFe}) diferente do fornecedor da OC ${assoc.pedidoId} (${oc.fornecedor_oc}). Associação bloqueada por segurança.`);
          }
        }

        // Validar quantidade disponível (calculado: itr_quantidade - itr_quantidade_atendida)
        const qtdDisponivel = parseFloat(oc.quantidade_disponivel);
        if (qtdDisponivel < assoc.quantidade) {
          throw new Error(`Quantidade insuficiente na OC ${assoc.pedidoId} para produto ${item.produtoId}. Disponível: ${qtdDisponivel}, Solicitado: ${assoc.quantidade}`);
        }

        // 🔒 MELHORIA 4: Alertar divergências de preço (> 5% tolerância - registra no banco automaticamente via trigger)
        if (item.precoReal && assoc.valorUnitario) {
          const diferencaPercentual = Math.abs((item.precoReal - assoc.valorUnitario) / assoc.valorUnitario * 100);

          if (diferencaPercentual > 20) {
            // Divergência CRÍTICA - bloquear
            console.error(`🚨 DIVERGÊNCIA CRÍTICA: Produto ${item.produtoId} na OC ${assoc.pedidoId}`);
            console.error(`   Preço NFe: R$ ${item.precoReal.toFixed(2)}`);
            console.error(`   Preço OC: R$ ${assoc.valorUnitario.toFixed(2)}`);
            console.error(`   Diferença: ${diferencaPercentual.toFixed(1)}%`);

            throw new Error(`Divergência de preço crítica (${diferencaPercentual.toFixed(1)}%) para produto ${item.produtoId}. Associação bloqueada. Entre em contato com o fornecedor.`);
          } else if (diferencaPercentual > 10) {
            // Divergência ALTA - avisar mas permitir
            console.warn(`⚠️ ALERTA ALTO: Divergência de preço para produto ${item.produtoId}`);
            console.warn(`   Diferença: ${diferencaPercentual.toFixed(1)}% - Será registrada para análise`);
          }

          // Divergências > 5% são registradas automaticamente pelo trigger do banco
        }

        console.log(`✅ OC ${assoc.pedidoId} validada: Status=${oc.orc_status}, Disponível=${qtdDisponivel}`);
      }

      // Calcular quantidade e valor total das associações
      const quantidadeTotal = item.associacoes.reduce((sum, assoc) => sum + assoc.quantidade, 0);
      const valorUnitarioMedio = item.associacoes.length > 0
        ? item.associacoes.reduce((sum, assoc) => sum + assoc.valorUnitario, 0) / item.associacoes.length
        : 0;

      // Para modo teste, usar IDs válidos que existem no banco
      let nfeItemIdFinal = parseInt(item.nfeItemId);
      let produtoIdFinal = item.produtoId;

      console.log('produtoIdFinal recebido:', produtoIdFinal);

      if (isTestMode) {
        // Para teste, usar ID genérico para nfe_item mas manter produto real
        nfeItemIdFinal = 1; // Existe na tabela nfe_itens
        // Manter produtoIdFinal como fornecido para preservar produto real
      }

      // Inserir o item principal
      console.log('Inserindo item principal:', {
        nfeIdFinal,
        nfeItemIdFinal,
        produtoIdFinal,
        quantidadeTotal,
        valorUnitarioMedio,
        status: isTestMode ? 'ASSOCIADO_TESTE' : 'ASSOCIADO'
      });

      const itemResult = await client.query(`
        INSERT INTO db_manaus.nfe_item_associacao (
          nfe_id,
          nfe_item_id,
          produto_cod,
          quantidade_associada,
          valor_unitario,
          status,
          meia_nota,
          preco_real,
          preco_unitario_nf,
          rateio,
          criterio_rateio,
          centro_custo,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        RETURNING id
      `, [
        nfeIdFinal,
        nfeItemIdFinal,
        produtoIdFinal,
        quantidadeTotal,
        valorUnitarioMedio,
        isTestMode ? 'ASSOCIADO_TESTE' : 'ASSOCIADO',
        item.meianota || false,
        item.precoReal || null,
        item.meianota ? (item.precoUnitarioNF || null) : null,   // ⭐ Só salva preço se meia_nota = true
        item.rateio || 'N',
        item.criterioRateio || null,
        item.centroCusto || null
      ]);

      const associacaoId = itemResult.rows[0].id;

      // Inserir associações com pedidos
      for (const assoc of item.associacoes) {
        console.log('Inserindo pedido associação:', {
          associacaoId,
          nfeIdFinal,
          pedidoId: assoc.pedidoId,
          quantidade: assoc.quantidade,
          valorUnitario: assoc.valorUnitario
        });

        await client.query(`
          INSERT INTO db_manaus.nfe_item_pedido_associacao (
            nfe_associacao_id,
            nfe_id,
            req_id,
            quantidade,
            valor_unitario,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, NOW())
        `, [
          associacaoId,
          nfeIdFinal,
          assoc.pedidoId,
          assoc.quantidade,
          assoc.valorUnitario
        ]);

        // 🔒 NÃO ATUALIZAR itr_quantidade_atendida AQUI!
        // Motivo: Quantidade atendida só deve ser incrementada quando a ENTRADA for GERADA
        // Se atualizar aqui, quando gerar-entrada.ts rodar, vai incrementar novamente (duplo desconto!)
        // A atualização acontece em /api/entrada-xml/gerar-entrada.ts linhas 224-232
      }
    }

    // ✅ NOVO FLUXO: Atualizar exec='C' (ASSOCIADA) quando concluir associações
    // exec: 'N' = Recebida, 'C' = Associada, 'S' = Entrada Gerada (processada)
    // IMPORTANTE: Usar nfeId ORIGINAL para UPDATE, não nfeIdFinal (que é '1' para testes)
    await client.query(`
      UPDATE db_manaus.dbnfe_ent
      SET exec = 'C'
      WHERE codnfe_ent = $1
    `, [nfeId]);

    console.log(`✅ NFe ${nfeId} marcada como ASSOCIADA (exec='C')`);

    // Registrar historico de conclusao de associacao
    if (userId && userName) {
      await client.query('SET search_path TO db_manaus');
      await registrarHistoricoNfe(client, {
        codNfeEnt: parseInt(nfeId),
        tipoAcao: 'ASSOCIACAO_CONCLUIDA',
        previousStatus: 'A',
        newStatus: 'C',
        userId,
        userName,
        comments: {
          tipo: 'ASSOCIACAO_CONCLUIDA',
          descricao: `Associacao concluida: ${associatedItems.length} item(ns)`,
          totalItens: associatedItems.length
        }
      });
      console.log(`✅ Historico registrado para usuario ${userName}`);
    }

    console.log(`Associação de itens concluída para NFe ${nfeId} -> ID ${nfeIdFinal} (Modo: ${isTestMode ? 'TESTE' : 'REAL'}): ${associatedItems.length} itens associados`);

    // Commit da transação principal (associações)
    await client.query('COMMIT');

    // 🧠 APRENDIZADO INTELIGENTE: Executar APÓS o commit para não afetar a transação principal
    // Se falhar, a associação já foi salva com sucesso
    try {
      console.log('🧠 Iniciando aprendizado inteligente (pós-commit)...');

      // Buscar código do fornecedor da NFe (cod_credor com 5 dígitos)
      const nfeDataResult = await client.query(`
        SELECT c.cod_credor
        FROM db_manaus.dbnfe_ent nfe
        LEFT JOIN db_manaus.dbnfe_ent_emit emit ON nfe.codnfe_ent = emit.codnfe_ent
        LEFT JOIN db_manaus.dbcredor c ON (
          emit.cpf_cnpj = c.cpf_cgc OR
          UPPER(TRIM(emit.xnome)) = UPPER(TRIM(c.nome))
        )
        WHERE nfe.codnfe_ent = $1
        LIMIT 1
      `, [nfeId]);

      const codCredor = nfeDataResult.rows.length > 0 ? nfeDataResult.rows[0].cod_credor : null;

      if (codCredor) {
        console.log(`   Fornecedor da NFe: ${codCredor}`);

        for (const item of associatedItems) {
          if (item.referenciaNFe && item.produtoId) {
            try {
              console.log(`   🔍 Processando aprendizado para produto ${item.produtoId}, ref: ${item.referenciaNFe}`);

              // Buscar código da marca do produto
              let codMarcaProduto = item.codMarca;

              // Se a marca veio como nome (ex: "BALDWIN") ao invés de código, buscar o código
              if (codMarcaProduto && codMarcaProduto.length > 5) {
                const marcaResult = await client.query(
                  'SELECT codmarca FROM db_manaus.dbmarcas WHERE UPPER(descr) = UPPER($1) LIMIT 1',
                  [codMarcaProduto]
                );
                if (marcaResult.rows.length > 0) {
                  codMarcaProduto = marcaResult.rows[0].codmarca;
                  console.log(`   🔄 Converteu marca "${item.codMarca}" -> código "${codMarcaProduto}"`);
                } else {
                  // Marca não existe na tabela dbmarcas - pular aprendizado para este item
                  console.log(`   ⚠️ Marca "${item.codMarca}" não existe na tabela dbmarcas - pulando aprendizado`);
                  continue;
                }
              }

              // Se não foi informada, buscar do produto
              if (!codMarcaProduto) {
                const prodResult = await client.query(
                  'SELECT codmarca FROM db_manaus.dbprod WHERE codprod = $1',
                  [item.produtoId]
                );
                if (prodResult.rows.length > 0) {
                  codMarcaProduto = prodResult.rows[0].codmarca;
                }
              }

              // Verificar se a marca existe na tabela dbmarcas antes de inserir
              if (codMarcaProduto) {
                const marcaExiste = await client.query(
                  'SELECT 1 FROM db_manaus.dbmarcas WHERE codmarca = $1',
                  [codMarcaProduto]
                );
                if (marcaExiste.rows.length === 0) {
                  console.log(`   ⚠️ Marca "${codMarcaProduto}" não existe na tabela dbmarcas - pulando aprendizado`);
                  continue;
                }
              }

              // Verificar se já existe essa combinação
              let codId: number;
              const checkRef = await client.query(`
                SELECT cod_id
                FROM db_manaus.dbref_fabrica
                WHERE referencia = $1
                  AND codcredor = $2
                  AND codmarca = $3
              `, [item.referenciaNFe, codCredor, codMarcaProduto || '']);

              if (checkRef.rows.length > 0) {
                codId = checkRef.rows[0].cod_id;
                console.log(`   ✅ Referência já existe (cod_id=${codId})`);
              } else {
                // Criar nova referência
                const maxIdResult = await client.query(
                  'SELECT COALESCE(MAX(cod_id), 0) + 1 as next_id FROM db_manaus.dbref_fabrica'
                );
                codId = maxIdResult.rows[0].next_id;

                await client.query(`
                  INSERT INTO db_manaus.dbref_fabrica (cod_id, codmarca, referencia, codcredor)
                  VALUES ($1, $2, $3, $4)
                `, [codId, codMarcaProduto || '', item.referenciaNFe, codCredor]);

                console.log(`   🧠 Nova referência aprendida: ${item.referenciaNFe} (cod_id=${codId})`);
              }

              // Verificar se já existe o relacionamento produto-referência
              const checkProdRef = await client.query(`
                SELECT 1
                FROM db_manaus.dbprod_ref_fabrica
                WHERE codprod = $1 AND cod_id = $2
              `, [item.produtoId, codId]);

              if (checkProdRef.rows.length === 0) {
                await client.query(`
                  INSERT INTO db_manaus.dbprod_ref_fabrica (codprod, cod_id)
                  VALUES ($1, $2)
                `, [item.produtoId, codId]);

                console.log(`   🧠 Aprendizado salvo: próximas NFes com "${item.referenciaNFe}" sugerirão "${item.produtoId}"`);
              } else {
                console.log(`   ✅ Relacionamento produto-referência já existe`);
              }
            } catch (learnError) {
              // Erro de item específico - continuar com próximo item
              console.error(`   ⚠️ Erro ao salvar aprendizado para item ${item.produtoId}:`, learnError);
            }
          } else {
            console.log(`   ⚠️ Item sem referenciaNFe ou produtoId - pulando aprendizado`);
          }
        }
      } else {
        console.log('   ⚠️ Fornecedor não encontrado - pulando aprendizado');
      }
    } catch (learnError) {
      // Erro geral no aprendizado - não afeta a associação que já foi commitada
      console.error('⚠️ Erro no aprendizado inteligente (não crítico, associação já salva):', learnError);
    }

    res.status(200).json({
      success: true,
      message: 'Itens associados com sucesso!'
    });
  } catch (err) {
    // Rollback da transação em caso de erro
    if (client) {
      await client.query('ROLLBACK');
    }

    console.error('❌ Erro ao associar itens da NFe:', err);
    console.error('❌ Stack trace:', err instanceof Error ? err.stack : 'No stack trace');

    res.status(500).json({
      success: false,
      error: 'Falha ao associar itens da NFe.',
      message: err instanceof Error ? err.message : 'Erro desconhecido',
      details: process.env.NODE_ENV === 'development' ? (err instanceof Error ? err.stack : String(err)) : undefined
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
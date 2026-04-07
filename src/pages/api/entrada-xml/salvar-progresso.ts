import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';
import { registrarHistoricoNfe } from '@/lib/nfe/historicoNfeHelper';

interface ItemAssociation {
  pedidoId: string;
  quantidade: number;
  valorUnitario: number;
}

interface ItemProgresso {
  nfeItemId: string;
  produtoId: string;
  associacoes: ItemAssociation[];
  status: 'pending' | 'associated' | 'partial' | 'error';
  meianota?: boolean;
  precoReal?: number;
  rateio?: string;
  criterioRateio?: string;
  centroCusto?: string;
  // Dados para aprendizado inteligente
  referenciaNFe?: string;  // cProd da NFe
  codMarca?: string;       // marca do produto
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { nfeId, items, userId, userName }: { nfeId: string; items: ItemProgresso[]; userId?: string; userName?: string } = req.body;

  if (!nfeId || !items || !Array.isArray(items)) {
    return res.status(400).json({
      error: 'NFe ID e items são obrigatórios'
    });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    console.log(`💾 Salvando progresso para NFe ${nfeId} com ${items.length} items`);

    // Buscar dados da NFe (fornecedor) para aprendizado
    const nfeDataResult = await client.query(`
      SELECT emit.cpf_cnpj as cod_credor_cnpj
      FROM db_manaus.dbnfe_ent nfe
      INNER JOIN db_manaus.dbnfe_ent_emit emit ON nfe.codnfe_ent = emit.codnfe_ent
      WHERE nfe.codnfe_ent = $1
    `, [nfeId]);

    let codCredor: string | null = null;
    if (nfeDataResult.rows.length > 0) {
      const cnpj = nfeDataResult.rows[0].cod_credor_cnpj;
      // Buscar código do credor pelo CNPJ
      const credorResult = await client.query(
        'SELECT cod_credor FROM db_manaus.dbcredor WHERE cpf_cgc = $1',
        [cnpj]
      );
      if (credorResult.rows.length > 0) {
        codCredor = credorResult.rows[0].cod_credor;
      }
    }

    // Limpar associações antigas para esta NFe
    await client.query(
      `DELETE FROM db_manaus.nfe_item_associacao WHERE nfe_id = $1`,
      [nfeId]
    );

    await client.query(
      `DELETE FROM db_manaus.nfe_item_pedido_associacao WHERE nfe_id = $1`,
      [nfeId]
    );

    // Para cada item da NFe
    for (const item of items) {
      if (item.status === 'associated' || item.status === 'partial') {
        // Calcular quantidade total associada
        const quantidadeTotal = item.associacoes.reduce((sum, a) => sum + a.quantidade, 0);

        // Salvar associação principal
        const assocResult = await client.query(`
          INSERT INTO db_manaus.nfe_item_associacao (
            nfe_id,
            nfe_item_id,
            produto_cod,
            quantidade_associada,
            valor_unitario,
            status,
            meia_nota,
            preco_real,
            rateio,
            criterio_rateio,
            centro_custo,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
          RETURNING id
        `, [
          nfeId,
          parseInt(item.nfeItemId), // Converter para integer
          item.produtoId,
          quantidadeTotal, // Quantidade associada
          item.associacoes[0]?.valorUnitario || 0,
          item.status === 'associated' ? 'ASSOCIADO' : 'PARCIAL',
          item.meianota || false,
          item.precoReal || null,
          item.rateio || 'N',
          item.criterioRateio || null,
          item.centroCusto || null
        ]);

        const associacaoId = assocResult.rows[0].id;

        // Salvar cada associação com pedido/ordem
        for (const assoc of item.associacoes) {
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
            nfeId,
            assoc.pedidoId,
            assoc.quantidade,
            assoc.valorUnitario
          ]);

          console.log(`  ✅ Associado item ${item.nfeItemId} → produto ${item.produtoId} → pedido ${assoc.pedidoId} (qtd: ${assoc.quantidade})`);
        }

        // 🧠 APRENDIZADO INTELIGENTE: Salvar na dbref_fabrica para próximas NFes
        // NOTA: Usar SAVEPOINT para isolar erros de FK (marca inexistente, etc)
        if (codCredor && item.referenciaNFe && item.produtoId) {
          try {
            // Criar savepoint para isolar possíveis erros de FK
            await client.query('SAVEPOINT aprendizado');

            // Truncar valores para os limites do banco
            // dbref_fabrica: codmarca varchar(5), referencia varchar(30), codcredor varchar(5)
            const codCredorTruncado = codCredor.substring(0, 5);
            const referenciaTruncada = item.referenciaNFe.substring(0, 30);

            // Buscar marca do produto se não foi informada
            let marcaProduto = item.codMarca;
            if (!marcaProduto) {
              const prodResult = await client.query(
                'SELECT codmarca FROM db_manaus.dbprod WHERE codprod = $1',
                [item.produtoId]
              );
              if (prodResult.rows.length > 0) {
                marcaProduto = prodResult.rows[0].codmarca;
              }
            }
            // Truncar marca também
            const marcaTruncada = (marcaProduto || '').substring(0, 5);

            // Verificar se a marca existe na tabela dbmarcas (FK constraint)
            if (marcaTruncada) {
              const marcaExists = await client.query(
                'SELECT 1 FROM db_manaus.dbmarcas WHERE codmarca = $1',
                [marcaTruncada]
              );
              if (marcaExists.rows.length === 0) {
                // Marca não existe, pular aprendizado para este item
                console.log(`  ⚠️ Marca "${marcaTruncada}" não existe em dbmarcas - pulando aprendizado`);
                await client.query('RELEASE SAVEPOINT aprendizado');
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
            `, [referenciaTruncada, codCredorTruncado, marcaTruncada]);

            if (checkRef.rows.length > 0) {
              codId = checkRef.rows[0].cod_id;
            } else {
              // Criar nova referência
              const maxIdResult = await client.query(
                'SELECT COALESCE(MAX(cod_id), 0) + 1 as next_id FROM db_manaus.dbref_fabrica'
              );
              codId = maxIdResult.rows[0].next_id;

              await client.query(`
                INSERT INTO db_manaus.dbref_fabrica (cod_id, codmarca, referencia, codcredor)
                VALUES ($1, $2, $3, $4)
              `, [codId, marcaTruncada, referenciaTruncada, codCredorTruncado]);

              console.log(`  🧠 Nova referência aprendida: ${referenciaTruncada} (cod_id=${codId})`);
            }

            // Verificar se já existe o relacionamento
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

              console.log(`  🧠 Aprendizado salvo: próximas NFes com "${referenciaTruncada}" sugerirão "${item.produtoId}"`);
            }

            // Liberar savepoint se tudo ok
            await client.query('RELEASE SAVEPOINT aprendizado');
          } catch (learnError) {
            // Rollback apenas do savepoint, não da transação principal
            await client.query('ROLLBACK TO SAVEPOINT aprendizado');
            console.error('⚠️ Erro ao salvar aprendizado (não crítico):', learnError);
          }
        }
      }
    }

    // ✅ Marcar NFe como 'A' (em Andamento/progresso salvo)
    // exec: 'N' = Recebida, 'A' = Em Andamento (progresso salvo), 'C' = Associada, 'S' = Entrada Gerada
    await client.query(`
      UPDATE db_manaus.dbnfe_ent
      SET exec = 'A'
      WHERE codnfe_ent = $1
    `, [nfeId]);

    console.log(`✅ NFe ${nfeId} marcada como EM_ANDAMENTO (exec='A')`);

    // Registrar histórico de associação
    const itensAssociados = items.filter(i => i.status === 'associated' || i.status === 'partial').length;
    if (userId && userName && itensAssociados > 0) {
      await client.query('SET search_path TO db_manaus');
      await registrarHistoricoNfe(client, {
        codNfeEnt: parseInt(nfeId),
        tipoAcao: 'ASSOCIACAO_ITEM',
        previousStatus: 'R',
        newStatus: 'A',
        userId,
        userName,
        comments: {
          tipo: 'ASSOCIACAO_ITEM',
          descricao: `${itensAssociados} item(ns) associado(s)`,
          itensAssociados,
          totalItens: items.length
        }
      });
    }

    await client.query('COMMIT');

    // Verificar status geral
    const statusCheck = await client.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'ASSOCIADO' THEN 1 ELSE 0 END) as associados,
        SUM(CASE WHEN status = 'PARCIAL' THEN 1 ELSE 0 END) as parciais
      FROM db_manaus.nfe_item_associacao
      WHERE nfe_id = $1
    `, [nfeId]);

    const stats = statusCheck.rows[0];

    return res.status(200).json({
      success: true,
      message: `Progresso salvo com sucesso!`,
      stats: {
        total: parseInt(stats.total),
        associados: parseInt(stats.associados),
        parciais: parseInt(stats.parciais),
        pendentes: items.filter(i => i.status === 'pending').length
      }
    });

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('❌ Erro ao salvar progresso:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao salvar progresso',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
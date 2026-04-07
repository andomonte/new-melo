/**
 * Endpoint para alocar um item especifico
 * PUT /api/entrada/alocacao/alocar-item
 *
 * Body:
 * - entradaItemId: ID do item na tabela entrada_itens
 * - qtdAlocada: quantidade a alocar
 * - armId: ID do armazem de destino
 * - matricula: matricula do operador
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';

// Formato antigo (backward compatibility)
interface AlocarItemRequestLegacy {
  entradaItemId: number;
  qtdAlocada: number;
  armId: number;
  matricula: string;
}

// Nova distribuição por armazém
interface AlocacaoDistribuicao {
  arm_id: number;
  qtd: number;
  localizacao?: string; // Localização física (ex: "P1/35 D 1")
}

// Novo formato com múltiplas alocações
interface AlocarItemRequestNew {
  entradaItemId: number;
  alocacoes: AlocacaoDistribuicao[];
  matricula: string;
}

type AlocarItemRequest = AlocarItemRequestLegacy | AlocarItemRequestNew;

interface AlocarItemResponse {
  success: boolean;
  message: string;
}

// Verificar se o operador esta ativo na alocacao desta entrada
// Retorna tambem o numero_entrada para usar nas queries de alocacao
const CHECK_OPERADOR_QUERY = `
  SELECT op.id as operacao_id, op.arm_id, e.id as entrada_id, e.numero_entrada
  FROM entrada_operacoes op
  INNER JOIN entrada_itens ei ON ei.entrada_id = op.entrada_id
  INNER JOIN entradas_estoque e ON e.id = op.entrada_id
  WHERE ei.id = $1
    AND op.alocador_matricula = $2
    AND op.status = 'EM_ALOCACAO'
`;

// Buscar dados do item
// Nota: dbitent_armazem usa codent (numero_entrada) e codprod
const GET_ITEM_QUERY = `
  SELECT
    ei.id,
    ei.entrada_id,
    ei.produto_cod,
    ei.quantidade,
    ei.req_id,
    e.numero_entrada,
    COALESCE(eir.qtd_recebida, ei.quantidade) as qtd_recebida,
    COALESCE(aloc.qtd_alocada, 0) as qtd_ja_alocada
  FROM entrada_itens ei
  INNER JOIN entradas_estoque e ON e.id = ei.entrada_id
  LEFT JOIN entrada_itens_recebimento eir ON eir.entrada_item_id = ei.id
  LEFT JOIN (
    SELECT codprod, codent, SUM(qtd) as qtd_alocada
    FROM dbitent_armazem
    GROUP BY codprod, codent
  ) aloc ON aloc.codprod = ei.produto_cod AND aloc.codent = e.numero_entrada
  WHERE ei.id = $1
`;

// Inserir registro de alocacao (SEM localizacao - coluna é opcional)
// Nota: dbitent_armazem usa codent (numero_entrada), codprod, codreq
// Cada alocacao cria um novo registro (permite alocar mesmo produto em armazens diferentes)
const INSERT_ALOCACAO_QUERY = `
  INSERT INTO dbitent_armazem (
    codent,
    codprod,
    codreq,
    arm_id,
    qtd
  )
  VALUES ($1, $2, $3, $4, $5)
`;

// Query para atualizar localização (só funciona se coluna existir)
const UPDATE_LOCALIZACAO_QUERY = `
  UPDATE dbitent_armazem
  SET localizacao = $1
  WHERE codent = $2 AND codprod = $3 AND arm_id = $4
`;

// Deletar alocações anteriores do item (para permitir redistribuição)
const DELETE_ALOCACOES_ANTERIORES_QUERY = `
  DELETE FROM dbitent_armazem
  WHERE codent = $1 AND codprod = $2
`;

// Helper para verificar se é formato novo
function isNewFormat(body: AlocarItemRequest): body is AlocarItemRequestNew {
  return 'alocacoes' in body && Array.isArray(body.alocacoes);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AlocarItemResponse | { error: string }>,
) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  const body = req.body as AlocarItemRequest;

  // Normalizar para novo formato
  let entradaItemId: number;
  let alocacoes: AlocacaoDistribuicao[];
  let matricula: string;

  if (isNewFormat(body)) {
    // Novo formato: múltiplas alocações
    entradaItemId = body.entradaItemId;
    alocacoes = body.alocacoes;
    matricula = body.matricula;
  } else {
    // Formato legacy: converter para novo
    entradaItemId = body.entradaItemId;
    matricula = body.matricula;
    alocacoes = [{
      arm_id: body.armId,
      qtd: body.qtdAlocada,
      localizacao: undefined,
    }];
  }

  // Validações básicas
  if (!entradaItemId || !matricula) {
    return res.status(400).json({
      error: 'entradaItemId e matricula sao obrigatorios',
    });
  }

  if (!alocacoes || alocacoes.length === 0) {
    return res.status(400).json({
      error: 'Pelo menos uma alocacao e obrigatoria',
    });
  }

  // Filtrar alocações com quantidade > 0
  const alocacoesValidas = alocacoes.filter(a => a.qtd > 0);
  if (alocacoesValidas.length === 0) {
    return res.status(400).json({
      error: 'Pelo menos uma alocacao deve ter quantidade maior que zero',
    });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS';

  const pool = getPgPool(filial);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    // Verificar se operador esta ativo na alocacao
    const checkResult = await client.query(CHECK_OPERADOR_QUERY, [entradaItemId, matricula]);
    if (checkResult.rows.length === 0) {
      return res.status(403).json({
        error: 'Voce nao esta autorizado a alocar este item ou nao esta em alocacao ativa',
      });
    }

    // Buscar dados do item (inclui numero_entrada e req_id)
    const itemResult = await client.query(GET_ITEM_QUERY, [entradaItemId]);
    if (itemResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Item nao encontrado',
      });
    }

    const item = itemResult.rows[0];
    const qtdRecebida = parseFloat(item.qtd_recebida);

    // Calcular soma das novas alocações
    const somaAlocacoes = alocacoesValidas.reduce((acc, a) => acc + a.qtd, 0);

    // Validar: soma das alocações deve ser <= quantidade recebida
    if (somaAlocacoes > qtdRecebida) {
      return res.status(400).json({
        error: `Soma das alocacoes (${somaAlocacoes}) excede a quantidade recebida (${qtdRecebida})`,
      });
    }

    // Iniciar transação
    await client.query('BEGIN');

    try {
      // Deletar alocações anteriores do item (permite redistribuição)
      await client.query(DELETE_ALOCACOES_ANTERIORES_QUERY, [
        item.numero_entrada,
        item.produto_cod,
      ]);

      // Inserir novas alocações
      for (const aloc of alocacoesValidas) {
        await client.query(INSERT_ALOCACAO_QUERY, [
          item.numero_entrada,      // codent
          item.produto_cod,         // codprod
          item.req_id || null,      // codreq
          aloc.arm_id,              // arm_id
          aloc.qtd,                 // qtd
        ]);

        // Tentar atualizar localização (só funciona se coluna existir)
        if (aloc.localizacao) {
          try {
            await client.query(UPDATE_LOCALIZACAO_QUERY, [
              aloc.localizacao,
              item.numero_entrada,
              item.produto_cod,
              aloc.arm_id,
            ]);
          } catch {
            // Coluna localizacao não existe ainda - ignorar
          }
        }
      }

      await client.query('COMMIT');

      console.log('Item alocado (multiplas):', {
        entradaItemId,
        numeroEntrada: item.numero_entrada,
        produto: item.produto_cod,
        alocacoes: alocacoesValidas,
        matricula,
        filial,
      });

      return res.status(200).json({
        success: true,
        message: `Item alocado em ${alocacoesValidas.length} armazem(ns) com sucesso`,
      });
    } catch (insertError) {
      await client.query('ROLLBACK');
      throw insertError;
    }
  } catch (error) {
    console.error('Erro ao alocar item:', error);

    return res.status(500).json({
      error: 'Erro ao alocar item',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

// pages/api/promocoes/save.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { ItemPromocao } from '@/data/promocoes/promocoes';
import { getPgPool } from '@/lib/pgClient'; // Importe sua função getPgPool

// ✨ DEFINIÇÕES DE INTERFACES PARA O PAYLOAD DO REQ.BODY
// Estas interfaces refletem as Promocao e ProdutoCarrinhoTemp do frontend,
// adaptadas para o contexto do backend (ex: datas como strings, 'criado_por' obrigatório, etc.).
interface PromocaoPayload {
  id_promocao?: number; // Opcional para novas criações (backend pode usar 0 ou ausência)
  nome_promocao: string;
  descricao_promocao: string | null;
  data_inicio: string; // Virá como string do frontend (ex: "YYYY-MM-DDTHH:mm")
  data_fim: string; // Virá como string do frontend
  tipo_promocao: 'PROD' | 'GRUPO';
  valor_desconto: number;
  tipo_desconto: 'PERC' | 'VALO' | 'PREF';
  qtde_minima_ativacao: number;
  qtde_maxima_total: number | null;
  qtde_maxima_por_cliente: number | null;
  ativa: boolean;
  criado_por: string; // Confirmado que vem do payload
  observacoes: string | null;
  // 'criado_em' não é esperado no payload, é gerado pelo BD.
  // 'itens_promocao' não é esperado no payload da Promocao, mas sim como array 'itens' separado.
}

interface SalvarPromocaoRequest {
  promocao: PromocaoPayload;
  itens?: ItemPromocao[]; // Agora com o tipo oficial
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo; // Obtém a filial do cookie

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let client: PoolClient | undefined; // Declara client fora do try/catch para garantir liberação
  // ✨ Tipagem explícita para o corpo da requisição
  const { promocao, itens } = req.body as SalvarPromocaoRequest;

  // 'criado_por' vem do payload da promoção, conforme sua instrução.
  // A validação de 'criadoPor' já está incluída na validação básica abaixo.

  // Validação básica dos dados recebidos
  if (
    !promocao ||
    !promocao.nome_promocao ||
    !promocao.data_inicio ||
    !promocao.data_fim ||
    !promocao.tipo_promocao ||
    promocao.valor_desconto === undefined ||
    promocao.tipo_desconto === undefined ||
    promocao.qtde_minima_ativacao === undefined ||
    promocao.ativa === undefined ||
    !promocao.criado_por
  ) {
    // ✨ Verifica se criado_por está presente
    return res
      .status(400)
      .json({ message: 'Dados da promoção incompletos ou inválidos.' });
  }

  // Validação de itens baseada no tipo_promocao
  if (promocao.tipo_promocao === 'PROD' && (!itens || itens.length === 0)) {
    return res.status(400).json({
      message:
        'Promoções do tipo "PROD" requerem pelo menos um item associado.',
    });
  }

  // Para promoções de grupo, se houver itens, deve ser exatamente 1 item (o grupo em si).
  // Se a lógica for permitir 0 itens para grupo, ajuste o `itens.length === 0` abaixo.
  if (
    promocao.tipo_promocao === 'GRUPO' &&
    itens &&
    (itens.length === 0 || itens.length > 1)
  ) {
    return res.status(400).json({
      message:
        'Promoções do tipo "GRUPO" devem ter 0 ou 1 item associado (o próprio grupo).',
    });
  }

  try {
    const pool = getPgPool(filial); // Obtém o pool de conexão para a filial
    client = await pool.connect(); // Obtém uma conexão do pool

    await client.query('BEGIN'); // INICIA A TRANSAÇÃO: Tudo a partir daqui será atômico.

    let currentPromocaoId: number; // Para armazenar o ID da promoção (existente ou recém-criado)

    if (promocao.id_promocao && promocao.id_promocao !== 0) {
      // --- É uma ATUALIZAÇÃO de Promoção Existente ---

      // 1. Atualiza a entrada na tabela 'dbpromocao'
      const updatePromocaoQuery = `
        UPDATE dbpromocao
        SET
          nome_promocao = $1,
          descricao_promocao = $2,
          data_inicio = $3,
          data_fim = $4,
          tipo_promocao = $5,
          valor_desconto = $6,
          tipo_desconto = $7,
          qtde_minima_ativacao = $8,
          qtde_maxima_total = $9,
          qtde_maxima_por_cliente = $10,
          ativa = $11,
          criado_por = $12,
          observacoes = $13
        WHERE id_promocao = $14
        RETURNING id_promocao; -- Retorna apenas o ID
      `;
      const updateValues = [
        promocao.nome_promocao,
        promocao.descricao_promocao,
        new Date(promocao.data_inicio), // Converte para Date
        new Date(promocao.data_fim), // Converte para Date
        promocao.tipo_promocao,
        promocao.valor_desconto,
        promocao.tipo_desconto,
        promocao.qtde_minima_ativacao,
        promocao.qtde_maxima_total,
        promocao.qtde_maxima_por_cliente,
        promocao.ativa,
        promocao.criado_por, // Usa o valor que veio do frontend
        promocao.observacoes,
        promocao.id_promocao, // ID para a cláusula WHERE
      ];
      const updateResult = await client.query(
        updatePromocaoQuery,
        updateValues,
      );
      currentPromocaoId = updateResult.rows[0].id_promocao;

      // 2. Deleta todos os itens antigos associados a esta promoção
      await client.query(
        'DELETE FROM dbpromocao_item WHERE id_promocao = $1;',
        [currentPromocaoId],
      );
    } else {
      // --- É uma NOVA CRIAÇÃO de Promoção ---

      // 1. Insere a nova entrada na tabela 'dbpromocao'
      const insertPromocaoQuery = `
        INSERT INTO dbpromocao (
          nome_promocao, descricao_promocao, data_inicio, data_fim,
          tipo_promocao, valor_desconto, tipo_desconto, qtde_minima_ativacao,
          qtde_maxima_total, qtde_maxima_por_cliente, ativa, criado_por, observacoes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id_promocao; -- Retorna apenas o ID gerado automaticamente
      `;
      const insertValues = [
        promocao.nome_promocao,
        promocao.descricao_promocao,
        new Date(promocao.data_inicio), // Converte para Date
        new Date(promocao.data_fim), // Converte para Date
        promocao.tipo_promocao,
        promocao.valor_desconto,
        promocao.tipo_desconto,
        promocao.qtde_minima_ativacao,
        promocao.qtde_maxima_total,
        promocao.qtde_maxima_por_cliente,
        promocao.ativa,
        promocao.criado_por, // Usa o valor que veio do frontend
        promocao.observacoes,
      ];
      const insertResult = await client.query(
        insertPromocaoQuery,
        insertValues,
      );
      currentPromocaoId = insertResult.rows[0].id_promocao; // Pega o ID gerado
    }

    // 2. Insere os novos itens da promoção (para ambos, criação e atualização)
    if (itens && itens.length > 0) {
      // Constrói a lista de valores para a inserção em lote
      // 1. Atualiza os placeholders (9 colunas)
      const valuesPlaceholders = itens
        .map((_, index) => {
          const offset = index * 9;
          return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${
            offset + 4
          }, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${
            offset + 9
          })`;
        })
        .join(',');

      // 2. Atualiza os valores enviados para o INSERT
      const itemValues = itens.flatMap((item: ItemPromocao) => [
        currentPromocaoId,
        promocao.tipo_promocao === 'PROD' ? item.codprod : null,
        promocao.tipo_promocao === 'GRUPO' ? item.codprod : null,
        item.valor_desconto_item,
        item.tipo_desconto_item,
        item.qtde_minima_item,
        item.qtde_maxima_item,
        item.qtd_total_item ?? null, // ✅ NOVO CAMPO
        item.origem ?? null, // ✅ NOVO CAMPO
      ]);

      // 3. Atualiza o SQL INSERT
      const insertItemsQuery = `
  INSERT INTO dbpromocao_item (
    id_promocao, codprod, codgpp,
    valor_desconto_item, tipo_desconto_item,
    qtde_minima_item, qtde_maxima_item,
    qtd_total_item, origem
  )
  VALUES ${valuesPlaceholders};
`;

      await client.query(insertItemsQuery, itemValues);
    }

    await client.query('COMMIT'); // COMMITA A TRANSAÇÃO: Se chegou aqui, tudo deu certo.

    // Após o commit, faz uma consulta final para retornar a promoção completa com seus itens.
    // Isso garante que o frontend receba todos os dados (incluindo IDs gerados).
    const fullPromocaoResult = await client.query(
      `SELECT
         p.*,
         COALESCE(
           (SELECT JSON_AGG(
             jsonb_build_object(
               'id_promocao_item', pi.id_promocao_item,
               'id_promocao', pi.id_promocao,
               'codigo', COALESCE(pi.codprod, pi.codgpp),
               'valor_desconto_item', pi.valor_desconto_item,
               'tipo_desconto_item', pi.tipo_desconto_item,
               'qtde_minima_item', pi.qtde_minima_item
               -- Adicione outros campos de dbpromocao_item conforme necessário para o frontend
               -- Se precisar de descrição de produto/grupo, JOIN dbprod/dbgpprod aqui
             )
           ) FROM dbpromocao_item pi
           WHERE pi.id_promocao = p.id_promocao),
           '[]'::json
         ) AS itens_promocao
       FROM dbpromocao p
       WHERE p.id_promocao = $1;
      `,
      [currentPromocaoId], // Usa o ID garantido pela transação
    );

    res.status(200).json(fullPromocaoResult.rows[0]);
  } catch (error: any) {
    if (client) {
      await client.query('ROLLBACK'); // ROLLBACK DA TRANSAÇÃO: Se algo deu errado, desfaz tudo.
    }
    console.error('Erro ao salvar/atualizar promoção no backend:', error);
    // Retorna uma mensagem de erro apropriada para o frontend
    res.status(500).json({
      message: 'Erro interno do servidor ao salvar/atualizar a promoção.',
      error: error.message || 'Erro desconhecido',
    });
  } finally {
    if (client) {
      client.release(); // Sempre libera a conexão de volta ao pool
    }
  }
}

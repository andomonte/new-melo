// src/pages/api/produtos/detalhes/[codprod].ts

import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function getProdutoEnriquecido(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { codprod, clienteId } = req.query; // codprod vem da URL, clienteId pode vir como query param
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    console.error('ERRO: Filial não informada no cookie.');
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  if (!codprod || typeof codprod !== 'string') {
    return res
      .status(400)
      .json({ error: 'Código do produto (codprod) é obrigatório.' });
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Query para obter um único produto com dados enriquecidos
    // ADAPTE O SELECT ABAIXO PARA INCLUIR TODOS OS CAMPOS DE ProdutoEnriquecido
    // E A LÓGICA DE PRECIFICAÇÃO FINAL, ASSIM COMO NO listaEnriquecida.ts
    const sqlQuery = `
      SELECT
          p.codprod AS codprod,
          p.descr AS descr,
          p.ref AS ref,
          p.qtest AS qtest,
          (p.qtest - p.qtdreservada) AS qtddisponivel,
          p.dolar AS dolar,
          cp."MARCA" AS codmarca,
          fp."PRECOVENDA" AS prvenda,
          p.unimed AS unidadeMedida,
          -- Lógica de precificação final
          CASE
              WHEN $2::text IS NOT NULL THEN (
                  -- Implemente a lógica real aqui, por exemplo:
                  fp."PRECOVENDA" * (1 - COALESCE(cr.desconto, 0)) -- Ex: preco com desconto do cliente
              )
              ELSE fp."PRECOVENDA"
          END AS precoFinalCalculado
      FROM dbprod p
      JOIN cmp_produto cp ON p.codprod = cp."CODPROD"
      JOIN dbformacaoprvenda fp ON p.codprod = fp."CODPROD"
      LEFT JOIN cliente_regras_preco cr ON p.codprod = cr.codprod AND cr.cliente_id = $2 -- Exemplo de join para regras de cliente
      WHERE p.codprod = $1 AND fp."PRECOVENDA" > 0 AND fp."TIPOPRECO" = $3; -- Certifique-se de que o tipo de preço seja aplicável
    `;

    // Para esta busca individual, você pode precisar definir um 'tipoPreco' padrão
    // ou passá-lo como um query param se for variável para o detalhe do produto.
    // Por simplicidade, estou usando '0' como um padrão, mas ajuste conforme sua regra.
    const defaultTipoPreco = '0'; // <<<<<<< AJUSTE ISTO CONFORME SUA NECESSIDADE
    const queryParams: any[] = [codprod];

    if (clienteId) {
      queryParams.push(String(clienteId)); // $2
    } else {
      queryParams.push(null); // Se não tem clienteId, passa NULL para o parâmetro do clienteId
    }
    queryParams.push(defaultTipoPreco); // $3

    const result = await client.query(sqlQuery, queryParams);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Produto não encontrado ou sem preço de venda válido.',
      });
    }

    res.status(200).json(serializeBigInt(result.rows[0]));
  } catch (error) {
    console.error('ERRO no API Route (getProdutoEnriquecido):', error);
    res.status(500).json({ error: 'Erro ao buscar detalhes do produto.' });
  } finally {
    if (client) {
      client.release();
    }
  }
}

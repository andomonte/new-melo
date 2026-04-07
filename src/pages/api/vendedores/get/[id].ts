// src/pages/api/vendedores/get/[id].ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient'; // Importe sua função getPgPool
import { serializeBigInt } from '@/utils/serializeBigInt'; // Importe sua função serializeBigInt
import { parseCookies } from 'nookies';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { id } = req.query; // codvend do vendedor

  if (!id || typeof id !== 'string') {
    // Garantir que id é uma string
    res
      .status(400)
      .json({ error: 'ID do vendedor é obrigatório e deve ser uma string.' });
    return;
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo; // Assumindo que a filial_melo é necessária para selecionar o pool correto

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial); // Obtém o pool de conexão para a filial
    client = await pool.connect(); // Conecta ao banco de dados

    // --- Consulta principal para o vendedor e suas relações ---
    // Esta query precisa ser mais complexa para replicar o 'include' do Prisma.
    // Usaremos JOINs e agregação para trazer os dados relacionados em um único objeto.
    // Adapte os nomes das tabelas e colunas de JOIN (ON conditions) para o seu schema real.

    const result = await client.query(
      `
      SELECT
          v.codvend,
          v.nome AS "NOMERAZAO", -- Coluna 'nome' do vendedor principal como NOMERAZAO
          v.nome, -- Mantém 'nome' original se precisar
          v.valobj,
          v.comnormal,
          v.comtele,
          v.debito,
          v.credito,
          v.limite,
          v.status,
          v.codcv,
          v.comobj,
          v.valobjf,
          v.valobjm,
          v.valobjsf,
          v.ra_mat,
          -- Detalhes do Vendedor (dbdados_vend)
          json_build_object(
              'codvend', dv.codvend,
              'bairro', dv.bairro,
              'cep', dv.cep,
              'cidade', dv.cidade,
              'estado', dv.estado,
              'celular', dv.celular,
              'logradouro', dv.logradouro,
              'nome', dv.nome, -- Nome dentro dos detalhes (pode ser o mesmo ou diferente)
              'tipo', dv.tipo,
              'cpf_cnpj', dv.cpf_cnpj
          ) AS detalhado_vendedor,
          -- Grupos de Produto do Vendedor (dbvendgpp e dbgpprod)
          COALESCE(
              json_agg(
                  json_build_object(
                      'codvend', vgp.codvend,
                      'codgpp', vgp.codgpp,
                      'exclusivo', vgp.exclusivo,
                      'comdireta', vgp.comdireta,
                      'comindireta', vgp.comindireta,
                      'grupo_produto', json_build_object(
                          'descr', gp.descr
                      )
                  )
              ) FILTER (WHERE vgp.codgpp IS NOT NULL),
              '[]'
          ) AS grupos_produto,
          -- Vendedor PST (dbvend_pst)
          json_build_object(
              'id', vp.id,
              'codvend', vp.codvend,
              'codpst', vp.codpst,
              'local', vp.local
          ) AS pst
      FROM dbvend v
      LEFT JOIN dbdados_vend dv ON v.codvend = dv.codvend -- Ajuste a coluna de JOIN se for diferente
      LEFT JOIN dbvend_pst vp ON v.codvend = vp.codvend -- Ajuste a coluna de JOIN se for diferente
      LEFT JOIN dbvendgpp vgp ON v.codvend = vgp.codvend
      LEFT JOIN dbgpprod gp ON vgp.codgpp = gp.codgpp
      WHERE v.codvend = $1
      GROUP BY v.codvend, dv.codvend, vp.id -- Agrupar por todas as colunas que não são agregadas
      -- e pelas chaves primárias das tabelas joinadas para garantir um registro único
    `,
      [id],
    );

    const vendedor = result.rows[0]; // Pega o primeiro (e único) resultado

    if (!vendedor) {
      res.status(404).json({ error: 'Vendedor não encontrado' });
      return;
    }

    res
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .json(serializeBigInt(vendedor)); // Aplica serializeBigInt ao objeto completo
  } catch (error) {
    console.error('Erro ao buscar vendedor:', error);
    res.status(500).json({ error: 'Erro ao buscar vendedor' });
  } finally {
    if (client) {
      client.release(); // Libera o cliente de volta para o pool
    }
  }
}

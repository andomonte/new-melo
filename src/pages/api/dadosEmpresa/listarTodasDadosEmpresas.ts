// src/pages/api/dadosEmpresa/listarTodasDadosEmpresas.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient'; // Importe sua função getPgPool
import { serializeBigInt } from '@/utils/serializeBigInt';
import { parseCookies } from 'nookies';
import { DBDadosEmpresa } from '@/data/dadosEmpresa/dadosEmpresas';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido. Use GET.' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo; // Pega a filial do cookie

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  let client: PoolClient | undefined;

  try {
    // Usa a filial do cookie para obter o pool de conexão COM A BASE DE DADOS CORRETA
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Consulta para buscar TODOS os dados da empresa.
    // NÃO FILTRA POR 'filial' DENTRO DA TABELA dadosempresa,
    // pois o pool de conexão já direciona para a base de dados da filial correta.
    const query = `
      SELECT *
      FROM dadosempresa
      ORDER BY nomecontribuinte ASC; -- Ordenar para consistência
    `;
    // Não há parâmetros para esta query, pois a filtragem de filial já foi feita na conexão
    const params: (string | number)[] = []; // Parâmetros agora vazios

    const result = await client.query<DBDadosEmpresa>(query, params);

    // Processa os resultados para adicionar indicadores de token/certificado
    const empresasProcessadas = result.rows
      .map((empresa) => {
        const { token, certificadoKey, certificadoCrt, cadeiaCrt, ...restOfEmpresa } = empresa;

        return {
          ...restOfEmpresa,
          // Mantendo a lógica original de verificar se token/certificado existem
          has_token: token !== null && token !== '',
          has_certificado: (certificadoKey !== null && certificadoKey !== '') ||
                          (certificadoCrt !== null && certificadoCrt !== '') ||
                          (cadeiaCrt !== null && cadeiaCrt !== ''),
        };
      })
      .map(serializeBigInt);

    res.status(200).json({ data: empresasProcessadas });
  } catch (error: any) {
    console.error(
      'Erro ao buscar todos os dados de empresas (sem paginação):',
      error,
    );
    res
      .status(500)
      .json({ error: error.message || 'Erro ao buscar dados de empresas.' });
  } finally {
    if (client) {
      client.release();
    }
  }
}

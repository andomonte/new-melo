// pages/api/armazensUsuario/get.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  let client: PoolClient | undefined;

  try {
    const pool = getPgPool();
    client = await pool.connect(); // 1. Buscar os detalhes de TODOS os armazéns da tabela 'dbarmazem' //    Adicionando as colunas 'filial' e 'ativo' à consulta SQL.

    const armazemDetailsRes = await client.query(
      `SELECT id_armazem, nome, filial, ativo FROM dbarmazem`,
    ); // 2. Mapear o resultado para incluir as novas colunas

    const armazens: {
      id_armazem: number;
      nome: string;
      filial: string;
      ativo: boolean;
    }[] = armazemDetailsRes.rows.map((row) => ({
      id_armazem: row.id_armazem,
      nome: row.nome,
      filial: row.filial, // Adicionado
      ativo: row.ativo, // Adicionado
    }));

    res.status(200).json({ data: armazens });
  } catch (error) {
    console.error('Erro ao buscar armazéns:', error);
    res.status(500).json({ error: 'Erro ao buscar armazéns' });
  } finally {
    if (client) {
      client.release();
    }
  }
}

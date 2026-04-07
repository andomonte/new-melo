import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
const dotenv = require('dotenv');
dotenv.config();
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

type Banco = {
  value: string;
  label: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Banco[] | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let client;

  try {
    client = await pool.connect();

    // Buscar contas bancárias (dbconta) ao invés de bancos (dbbanco)
    const query = `
      SELECT 
        c.cod_conta,
        c.nro_conta,
        c.oficial,
        c.digito,
        b.nome as banco_nome,
        b.cod_bc as banco_codigo
      FROM db_manaus.dbconta c
      LEFT JOIN db_manaus.dbbanco b ON b.cod_banco = c.cod_banco
      ORDER BY c.cod_conta
    `;

    const result = await client.query(query);

    // Transformar resultado para o formato esperado pelo Select
    const bancos: Banco[] = result.rows.map((row) => {
      const codConta = row.cod_conta?.toString().trim();
      const nroConta = row.nro_conta?.trim() || '';
      const oficial = row.oficial?.trim() || '';
      const digito = row.digito?.trim() || '';
      const bancoNome = row.banco_nome?.trim() || 'Banco não identificado';
      const bancoCodigo = row.banco_codigo?.toString().trim() || '';
      
      // Formatar número da conta completo
      const contaCompleta = oficial && digito 
        ? `${oficial}-${digito}`
        : nroConta;
      
      // Formatar label: "COD_CONTA - CONTA_COMPLETA - BANCO"
      const label = `${codConta} - ${contaCompleta} - ${bancoNome}`;

      return {
        value: codConta,
        label: label,
      };
    });

    return res.status(200).json(bancos);

  } catch (error: any) {
    console.error('Erro ao buscar bancos:', error);
    return res.status(500).json({ 
      error: `Erro ao buscar bancos: ${error.message}`
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

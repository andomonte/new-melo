import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { cpf_cgc, cod_credor } = req.query;

  if (!cpf_cgc || typeof cpf_cgc !== 'string' || !cpf_cgc.trim()) {
    return res.status(400).json({ error: 'cpf_cgc é obrigatório' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    let query: string;
    let params: string[];

    // Limpa formatação para comparar apenas dígitos
    const cpfCgcDigits = cpf_cgc.trim().replace(/\D/g, '');

    if (cod_credor && typeof cod_credor === 'string' && cod_credor.trim()) {
      // Edição: excluir o registro atual da verificação
      query = `SELECT cod_credor, nome FROM dbcredor WHERE REPLACE(REPLACE(REPLACE(REPLACE(cpf_cgc, '.', ''), '-', ''), '/', ''), ' ', '') = $1 AND TRIM(cod_credor) != TRIM($2) LIMIT 1`;
      params = [cpfCgcDigits, cod_credor.trim()];
    } else {
      // Cadastro: verificar qualquer registro com o mesmo CPF/CNPJ
      query = `SELECT cod_credor, nome FROM dbcredor WHERE REPLACE(REPLACE(REPLACE(REPLACE(cpf_cgc, '.', ''), '-', ''), '/', ''), ' ', '') = $1 LIMIT 1`;
      params = [cpfCgcDigits];
    }

    const result = await client.query(query, params);

    if (result.rows.length > 0) {
      const fornecedor = result.rows[0];
      return res.status(200).json({
        existe: true,
        fornecedor: {
          cod_credor: fornecedor.cod_credor,
          nome: fornecedor.nome,
        },
      });
    }

    return res.status(200).json({ existe: false });
  } catch (error: any) {
    console.error('Erro ao verificar duplicidade de fornecedor:', error);
    return res.status(500).json({
      error: 'Erro ao verificar duplicidade',
      message: error.message,
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

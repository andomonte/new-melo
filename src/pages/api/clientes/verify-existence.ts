import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

interface ClientExistsResult {
  exists: boolean;
  client?: {
    codigo: number;
    nome: string;
    nome_fantasia: string | null;
    cpf_cnpj: string;
    cidade: string | null;
    uf: string | null;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ClientExistsResult | { error: string }>,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { cpfCnpj } = req.body;

  if (!cpfCnpj) {
    return res.status(400).json({ error: 'CPF/CNPJ é obrigatório' });
  }

  try {
    const client = await getPgPool().connect();

    try {
      // Remove formatação do CPF/CNPJ para comparação
      const cleanedDocument = cpfCnpj.replace(/\D/g, '');

      const result = await client.query(
        `SELECT 
          codcli as codigo,
          nome,
          nomefant as nome_fantasia,
          cpfcgc as cpf_cnpj,
          cidade,
          uf
        FROM dbclien
        WHERE regexp_replace(cpfcgc, '[^0-9]', '', 'g') = $1
        LIMIT 1`,
        [cleanedDocument],
      );

      if (result.rows.length > 0) {
        return res.status(200).json({
          exists: true,
          client: result.rows[0],
        });
      }

      return res.status(200).json({ exists: false });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Erro ao verificar cliente:', error);
    return res.status(500).json({ error: 'Erro ao verificar cliente' });
  }
}

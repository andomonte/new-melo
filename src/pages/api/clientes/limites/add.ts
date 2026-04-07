import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { serializeBigInt } from '@/utils/serializeBigInt';
import { Cliente } from '@/data/clientes/clientes';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;
  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  const {
    cliente,
    observacao,
    codusr,
  }: { cliente: Cliente; observacao: string; codusr: string } = req.body;

  if (!cliente || !cliente.codcli || !codusr) {
    return res
      .status(400)
      .json({ error: 'Dados obrigatórios (cliente, codusr) não fornecidos.' });
  }

  const limiteValue = Number(cliente.limite);
  if (isNaN(limiteValue)) {
    return res
      .status(400)
      .json({
        error: `O valor do limite fornecido ("${cliente.limite}") não é um número válido.`,
      });
  }

  let client: PoolClient | undefined;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const latestLimiteResult = await client.query(`
      SELECT codclilim FROM dbcliente_limite ORDER BY codclilim DESC LIMIT 1;
    `);

    const latestCodCliLim = latestLimiteResult.rows[0]?.codclilim;
    const newCodCliLim = (latestCodCliLim ? Number(latestCodCliLim) : 0) + 1;

    if (isNaN(newCodCliLim)) {
      throw new Error(
        'Falha ao gerar o novo ID para o limite. O valor existente no banco não é um número.',
      );
    }

    // ✅ CORREÇÃO: Ajustamos o codusr para garantir que ele se encaixe na coluna do banco.
    // Isso remove os zeros à esquerda, assumindo que '00062' deve ser salvo como '62'.
    const codusrAjustado = String(parseInt(codusr, 10));

    const createQuery = `
      INSERT INTO dbcliente_limite (codclilim, codcli, ultimo_limite, data, observacao, codusr)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const createValues = [
      newCodCliLim,
      cliente.codcli,
      limiteValue,
      new Date(),
      observacao,
      codusrAjustado, // Usamos o valor ajustado
    ];

    const limiteClienteResult = await client.query(createQuery, createValues);
    const limiteCliente = limiteClienteResult.rows[0];

    res.status(201).json(serializeBigInt(limiteCliente));
  } catch (error: any) {
    console.error(`ERRO NO BANCO DE DADOS (PG Code: ${error.code}):`, error);
    let friendlyMessage =
      'Erro interno do servidor ao criar limite do cliente.';
    if (error.code === '23503') {
      friendlyMessage = `O cliente com código "${cliente.codcli}" não foi encontrado.`;
    } else if (error.code === '22001') {
      friendlyMessage = `Um dos valores enviados é longo demais para o campo no banco de dados.`;
    }
    res.status(500).json({ error: friendlyMessage });
  } finally {
    client?.release();
  }
}

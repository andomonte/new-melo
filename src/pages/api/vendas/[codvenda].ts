// pages/api/vendas/[codvenda].ts

import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  // Este endpoint só aceita o método PATCH
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', ['PATCH']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  let client: PoolClient | undefined;

  try {
    // 1. EXTRAIR DADOS DA REQUISIÇÃO
    const { codvenda } = req.query;
    const { status, transportadora, codtptransp, vlrfrete, formaPagamento, prazo, obsfat, obs, pedido } = req.body;

    if (!codvenda || typeof codvenda !== 'string') {
      res.status(400).json({ message: 'Código da venda inválido.' });
      return;
    }
    if (!status || typeof status !== 'string') {
      res.status(400).json({ message: 'Novo status não fornecido.' });
      return;
    }

    const pool = getPgPool();
    client = await pool.connect();

    // Montar UPDATE dinâmico com campos opcionais de finalização
    const setClauses = ['status = $1'];
    const params: any[] = [status, codvenda];
    let idx = 3;

    if (transportadora !== undefined) { setClauses.push(`transp = $${idx}`); params.push(transportadora); idx++; }
    if (codtptransp !== undefined) { setClauses.push(`codtptransp = $${idx}`); params.push(codtptransp); idx++; }
    if (vlrfrete !== undefined) { setClauses.push(`vlrfrete = $${idx}`); params.push(Number(vlrfrete) || 0); idx++; }
    if (prazo !== undefined) { setClauses.push(`prazo = $${idx}`); params.push(prazo); idx++; }
    // Forma de pagamento prefixada no obsfat (padrão Delphi pObsFat)
    let fpNorm = formaPagamento;
    if (fpNorm) {
      const fpUpper = fpNorm.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (fpUpper.includes('CARTAO') && fpUpper.includes('CREDITO')) {
        fpNorm = `CARTAO DE CREDITO`;
      } else if (fpUpper.includes('DEPOSITO')) {
        fpNorm = `DEPOSITO BANCARIO`;
      } else {
        fpNorm = `A VISTA (VE)`;
      }
    }
    const obsfatFinal = fpNorm
      ? (obsfat ? `${fpNorm} ${obsfat}` : fpNorm)
      : obsfat;
    if (obsfatFinal !== undefined) { setClauses.push(`obsfat = $${idx}`); params.push(obsfatFinal); idx++; }
    if (obs !== undefined) { setClauses.push(`obs = $${idx}`); params.push(obs); idx++; }
    if (pedido !== undefined) { setClauses.push(`pedido = $${idx}`); params.push(pedido); idx++; }

    setClauses.push(`bloqueada = '0'`);
    setClauses.push(`dtupdate = NOW()`);

    const updateQuery = `
      UPDATE dbvenda
      SET ${setClauses.join(', ')}
      WHERE codvenda = $2
      RETURNING *;
    `;

    const result = await client.query(updateQuery, params);

    // Se result.rows estiver vazio, significa que o WHERE não encontrou
    // nenhuma venda com o 'codvenda' fornecido.
    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Venda não encontrada.' });
      return;
    }

    const updatedVenda = result.rows[0];

    // 3. ENVIAR RESPOSTA DE SUCESSO
    res.status(200).json(serializeBigInt(updatedVenda));
  } catch (error) {
    // Tratamento para outros erros de banco de dados (ex: conexão, violação de constraint)
    console.error('Erro ao desbloquear venda:', error);
    res.status(500).json({
      message: 'Erro interno ao tentar desbloquear a venda.',
      error: (error as Error).message,
    });
    return;
  } finally {
    if (client) {
      client.release();
    }
  }
}

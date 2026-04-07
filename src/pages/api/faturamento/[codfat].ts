// pages/api/faturamento/fatura/[codfat].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const codfat = req.query.codfat;

  if (req.method !== 'PUT' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  if (!codfat || typeof codfat !== 'string') {
    return res.status(400).json({ error: 'Código da fatura é obrigatório' });
  }

  // Método DELETE - Excluir fatura
  if (req.method === 'DELETE') {
    try {
      const client = await getPgPool().connect();

      // Buscar as vendas associadas a esta fatura antes de excluir
      const vendasResult = await client.query(
        'SELECT codvenda FROM fatura_venda WHERE codfat = $1',
        [codfat],
      );

      // Reverter o status das vendas para 'A' (ativo)
      for (const venda of vendasResult.rows) {
        await client.query(
          `UPDATE dbvenda 
           SET status = 'A', statuspedido = 'A' 
           WHERE codvenda = $1`,
          [venda.codvenda],
        );

        console.log(
          `✅ Status da venda ${venda.codvenda} revertido para 'A' (ativo) - Fatura marcada como cancelada: ${codfat}`,
        );
      }

      // Excluir registros da tabela intermediária
      await client.query('DELETE FROM fatura_venda WHERE codfat = $1', [
        codfat,
      ]);

      // Excluir a fatura
      await client.query('DELETE FROM dbfatura WHERE codfat = $1', [codfat]);

      client.release();

      return res.status(200).json({ message: 'Fatura excluída com sucesso' });
    } catch (err) {
      console.error('Erro ao excluir fatura:', err);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  // Método PUT - Atualizar fatura
  const camposValidos = [
    'nroform',
    'totalnf',
    'data',
    'codvend',
    'codtransp',
    'cancel',
    'cobranca',
    'comdift',
  ];

  const dadosRecebidos = req.body;

  const camposParaAtualizar = Object.keys(dadosRecebidos).filter((campo) =>
    camposValidos.includes(campo),
  );

  if (camposParaAtualizar.length === 0) {
    return res
      .status(400)
      .json({ error: 'Nenhum campo válido para atualizar' });
  }

  const valores: any[] = [];
  const sets: string[] = [];

  camposParaAtualizar.forEach((campo, i) => {
    sets.push(`${campo} = $${i + 1}`);
    valores.push(dadosRecebidos[campo]);
  });

  valores.push(codfat); // última posição para o WHERE

  const sql = `UPDATE dbfatura SET ${sets.join(', ')} WHERE codfat = $${
    valores.length
  }`;

  try {
    const client = await getPgPool().connect();

    // Se está cancelando a fatura, reverter o status das vendas
    if (dadosRecebidos.cancel === 'S') {
      // Buscar as vendas associadas a esta fatura
      const vendasResult = await client.query(
        'SELECT codvenda FROM fatura_venda WHERE codfat = $1',
        [codfat],
      );

      // Reverter o status das vendas para 'A' (ativo)
      for (const venda of vendasResult.rows) {
        await client.query(
          `UPDATE dbvenda 
           SET status = 'A', statuspedido = 'A' 
           WHERE codvenda = $1`,
          [venda.codvenda],
        );

        console.log(
          `✅ Status da venda ${venda.codvenda} revertido para 'A' (ativo) - Fatura cancelada: ${codfat}`,
        );
      }
    }

    await client.query(sql, valores);
    client.release();

    res.status(200).json({ message: 'Fatura atualizada com sucesso' });
  } catch (err) {
    console.error('Erro ao atualizar fatura:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

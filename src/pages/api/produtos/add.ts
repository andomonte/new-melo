import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { Produto } from '@/data/produtos/produtos';
import { recalcularPrecosProduto } from '@/lib/calcularPrecos';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const data: Produto = req.body;

  // Definir valores padrão
  data.qtdreservada = 0;
  data.qtest_filial = 0;
  data.cmercd = '0.00';
  data.margem = 0;
  data.cmercf = '0.00';
  data.margempromo = 0;
  data.cmerczf = '0.00';
  data.excluido = 0;
  data.qtestmax_sugerido = 0;
  data.prmedio = 0;
  data.qtest = data.qtest || 0;
  data.prvenda = data.prvenda || 0;
  data.prcompra = data.prcompra || 0;

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    // Iniciar transação
    await client.query('BEGIN');

    // Gerar próximo código usando SEQUENCE (thread-safe, sem race condition)
    const sequenceResult = await client.query(`
      SELECT LPAD(nextval('seq_dbprod_codprod')::TEXT, 6, '0') as codprod
    `);

    data.codprod = sequenceResult.rows[0].codprod;

    // Inserir o novo produto
    const insertQuery = `
      INSERT INTO dbprod (
        codprod, descr, unimed, prvenda, qtest, codbar,
        qtdreservada, qtest_filial, cmercd, margem, cmercf,
        margempromo, cmerczf, excluido, qtestmax_sugerido,
        prmedio, prcompra
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17
      ) RETURNING *
    `;

    const values = [
      data.codprod,
      data.descr,
      data.unimed,
      data.prvenda,
      data.qtest,
      data.codbar,
      data.qtdreservada,
      data.qtest_filial,
      data.cmercd,
      data.margem,
      data.cmercf,
      data.margempromo,
      data.cmerczf,
      data.excluido,
      data.qtestmax_sugerido,
      data.prmedio,
      data.prcompra,
    ];

    const result = await client.query(insertQuery, values);

    // ✅ RECALCULAR PREÇOS AUTOMATICAMENTE (igual ao Delphi)
    // Gera os 8 tipos de preço na tabela DBFORMACAOPRVENDA
    await recalcularPrecosProduto(client, {
      codprod: data.codprod,
      prcompra: data.prcompra,
      prcustoatual: data.prcustoatual,
      dolar: data.dolar,
      txdolarcompra: data.txdolarcompra,
    });

    // Commit da transação
    await client.query('COMMIT');

    res.status(201).setHeader('Content-Type', 'application/json').json({
      data: result.rows[0],
      message: 'Produto cadastrado e preços recalculados automaticamente!',
    });
  } catch (errors) {
    // Rollback em caso de erro
    await client.query('ROLLBACK');
    console.log(errors);
    res.status(500).json({ error: 'Erro ao criar produto' });
  } finally {
    // Liberar conexão
    client.release();
  }
}

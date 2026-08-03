import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { Produto } from '@/data/produtos/produtos';
import { serializeBigInt } from '@/utils/serializeBigInt';
import { recalcularPrecosProduto } from '@/lib/calcularPrecos';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const produto: Produto = req.body;

  if (!produto) {
    res.status(400).json({ error: 'Produto é  Obrigatório.' });
    return;
  }

  const pool = getPgPool();
  let client: PoolClient | undefined;

  try {
    client = await pool.connect();

    // Iniciar transação
    await client.query('BEGIN');

    // Validação (Delphi): Compra Direta = SIM exige >= 1 referência de fábrica.
    // Feita no backend para NÃO depender do usuário abrir a aba no front:
    // se o front enviou a lista, usa-a; senão confere os vínculos no banco.
    if (produto.compradireta === 'S') {
      let temRef = false;
      if (Array.isArray(produto.referenciasFabrica)) {
        temRef = produto.referenciasFabrica.some((r: any) => r?.referencia);
      } else {
        const q = await client.query(
          'SELECT 1 FROM dbprod_ref_fabrica WHERE codprod = $1 LIMIT 1',
          [produto.codprod],
        );
        temRef = (q.rowCount ?? 0) > 0;
      }
      if (!temRef) {
        await client.query('ROLLBACK');
        res.status(400).json({
          error:
            'Compra Direta = SIM exige pelo menos 1 Referência de Fábrica cadastrada.',
        });
        return;
      }
    }

    // Chaves que NÃO são colunas de dbprod (tratadas à parte ou apenas de
    // exibição no front) — precisam ficar fora do UPDATE dinâmico, senão geram
    // "column ... does not exist" (ex.: referenciasFabrica é um array salvo em
    // dbprod_ref_fabrica logo abaixo).
    const CAMPOS_NAO_COLUNA = new Set([
      'codprod',
      'referenciasFabrica',
      'marca_nome',
      // Campos derivados (joins/subqueries) retornados pelo GET — não são
      // colunas de dbprod, então não podem entrar no UPDATE.
      'grupo_funcao_nome',
      'grupo_produto_nome',
      'estoque_disponivel',
    ]);

    const colunas = Object.keys(produto).filter(
      (key) => !CAMPOS_NAO_COLUNA.has(key),
    );

    const updateFields = colunas
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');

    const updateValues = colunas.map((key) => produto[key as keyof Produto]);

    const updatedProdutoResult = await client.query(
      `UPDATE dbprod SET ${updateFields} WHERE codprod = $1 RETURNING *`,
      [produto.codprod, ...updateValues],
    );

    // ✅ RECALCULAR PREÇOS AUTOMATICAMENTE (igual ao Delphi)
    // Atualiza os 8 tipos de preço na tabela DBFORMACAOPRVENDA
    await recalcularPrecosProduto(client, {
      codprod: produto.codprod,
      prcompra: produto.prcompra,
      prcustoatual: produto.prcustoatual,
      dolar: produto.dolar,
      txdolarcompra: produto.txdolarcompra,
    });

    // ✅ SALVAR REFERÊNCIAS DE FÁBRICA (se houver)
    if (produto.referenciasFabrica && Array.isArray(produto.referenciasFabrica)) {
      // Remove vínculos antigos
      await client.query('DELETE FROM dbprod_ref_fabrica WHERE codprod = $1', [produto.codprod]);

      // Insere novos
      for (const ref of produto.referenciasFabrica) {
        if (!ref.referencia) continue;

        const checkRef = await client.query(
          `SELECT cod_id FROM dbref_fabrica WHERE referencia = $1 AND codmarca = $2 AND codcredor = $3`,
          [ref.referencia, ref.codmarca || produto.codmarca || '', ref.codcredor || '']
        );

        let codId: number;
        if (checkRef.rows.length > 0) {
          codId = checkRef.rows[0].cod_id;
        } else {
          const maxId = await client.query('SELECT COALESCE(MAX(cod_id), 0) + 1 as next_id FROM dbref_fabrica');
          codId = maxId.rows[0].next_id;
          await client.query(
            `INSERT INTO dbref_fabrica (cod_id, codmarca, referencia, codcredor) VALUES ($1, $2, $3, $4)`,
            [codId, ref.codmarca || produto.codmarca || '', ref.referencia, ref.codcredor || '']
          );
        }

        await client.query(
          `INSERT INTO dbprod_ref_fabrica (codprod, cod_id) VALUES ($1, $2)`,
          [produto.codprod, codId]
        );
      }
    }

    // Commit da transação
    await client.query('COMMIT');

    res
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .json({
        data: serializeBigInt(updatedProdutoResult.rows[0]),
        message: 'Produto atualizado e preços recalculados automaticamente!',
      });
  } catch (errors) {
    // Rollback em caso de erro
    if (client) {
      await client.query('ROLLBACK');
    }
    console.log((errors as Error).message);
    res.status(500).json({ error: (errors as Error).message });
  } finally {
    if (client) {
      client.release();
    }
  }
}

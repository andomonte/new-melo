// src/lib/faturamento/gerarEstorno.ts
//
// FASE 1 do Estorno de NF-e: cria o Documento Interno (DI) — uma fatura de DEVOLUÇÃO
// (entrada) que reverte a NF-e original — SEM emitir à SEFAZ ainda. Espelha o
// spEstornoNfe do Delphi, porém explícito no Postgres:
//   1. gera nova fatura (dbfatura) com codfatrel = fatura original;
//   2. copia os itens (dbprodfat) para a DI, aplicando o CFOP de devolução informado;
//   3. ESTORNA o estoque (devolve as quantidades que a venda baixou);
//   4. marca a fatura original como estornada (estorno='S', codfatrel = DI).
// O CHAMADOR é dono da transação (BEGIN/COMMIT/ROLLBACK).

export interface EstornoParams {
  codfatOriginal: string;
  cfop: string; // CFOP de entrada/devolução (4 dígitos)
  justificativa: string;
  usuario?: string;
}
export interface EstornoResult {
  codfatDI: string;
  nroformDI: string;
  itens: number;
}

export async function gerarEstorno(
  client: any,
  { codfatOriginal, cfop, justificativa, usuario = 'API' }: EstornoParams,
): Promise<EstornoResult> {
  // 0. Confere a fatura original
  const orig = await client.query(
    `SELECT * FROM dbfatura WHERE codfat = $1`,
    [codfatOriginal],
  );
  if (orig.rowCount === 0) throw new Error('Fatura original não encontrada.');
  if (orig.rows[0].estorno && String(orig.rows[0].estorno).trim() !== '') {
    throw new Error(
      `Esta NF-e já foi estornada (documento ${orig.rows[0].codfatrel || '—'}).`,
    );
  }

  // Lock para gerar os próximos códigos sem corrida (igual ao salvar.ts).
  await client.query('LOCK TABLE dbfatura IN EXCLUSIVE MODE');
  const prox = async (campo: string) => {
    const r = await client.query(
      `SELECT COALESCE(MAX(CAST(${campo} AS INTEGER)), 0) + 1 AS n
         FROM dbfatura WHERE ${campo} ~ '^[0-9]+$'`,
    );
    return String(r.rows[0].n).padStart(9, '0');
  };
  const codfatDI = await prox('codfat');
  const nroformDI = await prox('nroform');
  const seloDI = await prox('selo');

  // 1. Cria a DI (fatura de devolução) copiando o cabeçalho da original.
  await client.query(
    `INSERT INTO dbfatura
       (codfat, codcli, nroform, data, codvend, codtransp, totalprod, totalfat,
        totalnf, cod_conta, tipodoc, cobranca, insc07, pedido, nfs, selo, serie,
        descrcfop, codfatrel)
     SELECT $1::text, codcli, $2::text, now(), codvend, codtransp, totalprod, totalfat,
        totalnf, cod_conta, tipodoc, 'N', insc07, pedido, nfs, $3::text, '2',
        'DEVOLUCAO DE VENDA - ESTORNO DE NF-E', $5::text
     FROM dbfatura WHERE codfat = $4::text`,
    [codfatDI, nroformDI, seloDI, codfatOriginal, codfatOriginal],
  );

  // 2. Copia os itens (dbprodfat) da original para a DI, com o CFOP de devolução.
  const itens = await client.query(
    `SELECT * FROM dbprodfat WHERE codfat = $1`,
    [codfatOriginal],
  );
  for (const it of itens.rows) {
    const linha: Record<string, any> = { ...it, codfat: codfatDI, cfop };
    const keys = Object.keys(linha);
    const ph = keys.map((_, i) => `$${i + 1}`);
    await client.query(
      `INSERT INTO dbprodfat (${keys.join(', ')}) VALUES (${ph.join(', ')})`,
      keys.map((k) => linha[k]),
    );
  }

  // 3. Estorna o estoque: DEVOLVE as quantidades que a venda baixou (inverso do salvar.ts).
  const itensVenda = await client.query(
    `SELECT i.codprod, i.qtd, i.arm_id
       FROM fatura_venda fv
       JOIN dbvenda v ON v.codvenda = fv.codvenda
       JOIN dbitvenda i ON i.codvenda = v.codvenda
      WHERE fv.codfat = $1 AND fv.status = 'ativo'`,
    [codfatOriginal],
  );
  for (const item of itensVenda.rows) {
    const qtd = parseFloat(item.qtd) || 0;
    if (qtd <= 0 || !item.codprod) continue;
    if (item.arm_id) {
      await client.query(
        `UPDATE cad_armazem_produto
            SET arp_qtest = COALESCE(arp_qtest, 0) + $1
          WHERE arp_codprod = $2 AND arp_arm_id = $3`,
        [qtd, item.codprod, item.arm_id],
      );
    }
    await client.query(
      `UPDATE dbprod SET qtest = COALESCE(qtest, 0) + $1 WHERE codprod = $2`,
      [qtd, item.codprod],
    );
  }

  // 4. Marca a fatura ORIGINAL como estornada e aponta para a DI.
  // (dbfatura não tem coluna de observação; a justificativa vai no evento/emissão
  // da devolução na fase 2. `usuario` fica reservado para o log da emissão.)
  void justificativa;
  void usuario;
  await client.query(
    `UPDATE dbfatura SET estorno = 'S', codfatrel = $1 WHERE codfat = $2`,
    [codfatDI, codfatOriginal],
  );

  return { codfatDI, nroformDI, itens: itens.rowCount ?? 0 };
}

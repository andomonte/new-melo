// src/lib/vendas/garantia.ts
//
// Regras da Garantia de Produto, portadas do TFrmGarantiaProd do Delphi
// (Formularios/GARANTIA PRODUTO/UniGarantiaProd.pas) e do package Oracle
// GERAL.GARANTIA, cujo fonte foi lido em ALL_SOURCE na base de desenvolvimento.
//
// GARANTIA.inc_garantia BAIXA ESTOQUE ao confirmar — em duas tabelas:
//   Select arp_QtEst - arp_QtEst_Reservada into vQtDisponivel ...
//   if vQtDisponivel >= ln_itaux.qtde then
//      Update DbProd Set QtEst = (QtEst - ln_itaux.qtde) ...
//      update cad_armazem_produto set arp_QtEst = arp_QtEst - ln_itaux.qtde ...
// e GARANTIA.Canc_Gar DEVOLVE o estoque das duas antes de marcar cancel='S'.
// Alt_Status_Garantia não mexe em estoque.

import type { PoolClient } from 'pg';

/** Situações do combo do Delphi (CbStatusAlt). */
export const STATUS_GARANTIA: Record<string, string> = {
  P: 'PROVISÓRIO',
  A: 'ATENDIDO',
  N: 'NÃO ATENDIDO',
  M: 'MELO',
  C: 'COBRADO DO CLIENTE',
};

/** Na inclusão o Delphi só oferece PROVISÓRIO e MELO (CbStatus). */
export const STATUS_INCLUSAO = ['P', 'M'] as const;

export class ErroGarantia extends Error {}

export interface ItemGarantia {
  codprod: string;
  qtde: number;
  prunit: number;
  arm_id: number;
}

/** Gera o próximo código no formato do Delphi (zero-preenchido, 9 posições). */
export async function proximoCodGar(client: PoolClient): Promise<string> {
  // Advisory lock para duas inclusões simultâneas não pegarem o mesmo número.
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['dbgarantiaprod']);
  const { rows } = await client.query(
    `SELECT COALESCE(MAX(NULLIF(regexp_replace(codgar, '\\D', '', 'g'), '')::bigint), 0) + 1 AS proximo
     FROM dbgarantiaprod`,
  );
  return String(rows[0].proximo).padStart(9, '0');
}

/** Valida e normaliza os itens vindos da tela. */
export function normalizarItens(bruto: unknown): ItemGarantia[] {
  if (!Array.isArray(bruto) || bruto.length === 0) {
    throw new ErroGarantia('Inclua ao menos um produto na garantia.');
  }

  const vistos = new Set<string>();

  return bruto.map((item: any) => {
    const codprod = String(item?.codprod ?? '').trim();
    if (!codprod) throw new ErroGarantia('Item sem produto informado.');

    // EXISTE_ITAUXGAR: o Delphi recusa o mesmo produto duas vezes na garantia.
    if (vistos.has(codprod)) {
      throw new ErroGarantia(`O produto ${codprod} está repetido na garantia.`);
    }
    vistos.add(codprod);

    // O Delphi lê a quantidade com StrToInt (MeQtde, mask '9999') e o estoque
    // em dbprod.qtest é integer — quantidade fracionada quebraria a baixa.
    const qtde = Number(item?.qtde);
    if (!Number.isInteger(qtde) || qtde <= 0) {
      throw new ErroGarantia(
        `Quantidade inválida no produto ${codprod} — informe um número inteiro maior que zero.`,
      );
    }

    const prunit = Number(item?.prunit);
    if (!Number.isFinite(prunit) || prunit < 0) {
      throw new ErroGarantia(`Preço inválido no produto ${codprod}.`);
    }

    const arm_id = Number(item?.arm_id);
    if (!Number.isFinite(arm_id)) {
      throw new ErroGarantia(`Informe o armazém do produto ${codprod}.`);
    }

    return { codprod, qtde, prunit, arm_id };
  });
}

/**
 * Baixa o estoque e valida a disponibilidade, como o inc_garantia faz item a
 * item. A conferência é refeita AQUI, dentro da transação — o comentário da
 * procedure é explícito: "verifico novamente a qtde do estoque (observando a
 * qtde reservadas), pois so abate estoque no momento em que a garantia e
 * finalizada".
 *
 * Uma diferença deliberada: quando falta saldo, o Oracle simplesmente PULA o
 * item (é um `if` sem `else`), gravando uma garantia incompleta e sem avisar
 * ninguém. Aqui a operação inteira é recusada com a mensagem do item — o
 * usuário fica sabendo em vez de descobrir depois.
 *
 * O `FOR UPDATE` serializa duas garantias concorrentes sobre a mesma linha de
 * estoque; sem ele as duas leriam o mesmo saldo e ambas passariam.
 */
export async function baixarEstoque(
  client: PoolClient,
  itens: ItemGarantia[],
): Promise<void> {
  for (const item of itens) {
    const { rows } = await client.query(
      `SELECT COALESCE(cap.arp_qtest, 0) - COALESCE(cap.arp_qtest_reservada, 0) AS disponivel
       FROM cad_armazem_produto cap
       WHERE cap.arp_codprod = $1 AND cap.arp_arm_id = $2
       FOR UPDATE`,
      [item.codprod, item.arm_id],
    );

    const ref = await referenciaDoProduto(client, item.codprod);
    const disponivel = rows.length ? Number(rows[0].disponivel ?? 0) : 0;

    if (item.qtde > disponivel) {
      throw new ErroGarantia(
        `Quantidade solicitada superior à quantidade em estoque no produto ${ref}. ` +
          `Disponível: ${disponivel}, solicitado: ${item.qtde}.`,
      );
    }

    // As duas tabelas que o inc_garantia atualiza: o total do produto e o
    // saldo do armazém.
    await client.query(
      `UPDATE dbprod SET qtest = COALESCE(qtest, 0) - $2 WHERE codprod = $1`,
      [item.codprod, item.qtde],
    );
    await client.query(
      `UPDATE cad_armazem_produto SET arp_qtest = COALESCE(arp_qtest, 0) - $3
       WHERE arp_codprod = $1 AND arp_arm_id = $2`,
      [item.codprod, item.arm_id, item.qtde],
    );
  }
}

/** Devolve o estoque dos itens da garantia — o laço do Canc_Gar. */
export async function devolverEstoque(
  client: PoolClient,
  codgar: string,
): Promise<void> {
  const { rows } = await client.query(
    `SELECT codprod, qtde, arm_id FROM dbitgarantiaprod WHERE codgar = $1`,
    [codgar],
  );

  for (const item of rows) {
    // qtde é numeric(12,3) e volta do pg como string ("2.000"); dbprod.qtest é
    // integer e recusaria esse valor direto.
    const qtde = Number(item.qtde);

    await client.query(
      `UPDATE dbprod SET qtest = COALESCE(qtest, 0) + $2 WHERE codprod = $1`,
      [item.codprod, qtde],
    );
    await client.query(
      `UPDATE cad_armazem_produto SET arp_qtest = COALESCE(arp_qtest, 0) + $3
       WHERE arp_codprod = $1 AND arp_arm_id = $2`,
      [item.codprod, item.arm_id, qtde],
    );
  }
}

async function referenciaDoProduto(
  client: PoolClient,
  codprod: string,
): Promise<string> {
  const { rows } = await client.query(
    'SELECT ref FROM dbprod WHERE codprod = $1',
    [codprod],
  );
  if (rows.length === 0) {
    throw new ErroGarantia(`Produto ${codprod} não encontrado.`);
  }
  return rows[0].ref || codprod;
}

/**
 * Trilha de auditoria — o Usuario.inc_acao_usr que toda procedure do package
 * chama no fim. No web a tabela é a mesma (dbacao).
 */
export async function registrarAcao(
  client: PoolClient,
  codusr: string | undefined,
  acao: string,
  tabela: string,
  obs: string,
): Promise<void> {
  await client.query(
    `INSERT INTO dbacao (codusr, acao, tabela, obs, data)
     VALUES ($1, $2, $3, $4, now())`,
    [
      String(codusr ?? 'DESCONHECIDO').slice(0, 60),
      acao.slice(0, 60),
      tabela.slice(0, 60),
      obs.slice(0, 255),
    ],
  );
}

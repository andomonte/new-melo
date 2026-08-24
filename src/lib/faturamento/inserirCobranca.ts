// src/lib/faturamento/inserirCobranca.ts
//
// Insere a COBRANÇA (dbreceb + dbprazo_pagamento) de uma fatura usando um `client`
// já dentro de uma transação — o CHAMADOR é dono do BEGIN/COMMIT/ROLLBACK.
//
// Isso permite gravar FATURA + COBRANÇA numa transação única (como o GERAR_FATURA do
// Delphi): se a cobrança falhar, o ROLLBACK do chamador desfaz a fatura + a baixa de
// estoque junto — nunca sobra fatura órfã. Também é reusado pelo endpoint standalone
// salvar-cobranca.ts (que abre a própria transação em volta).

import { salvarParcelasPagamento } from '@/utils/parcelasPagamento';
import { codigoFormaFatura } from '@/lib/faturamento/formaFatura';
import { bancoInternoDbreceb, codBancoDbfatura } from '@/lib/faturamento/bancoCobranca';

export interface ParcelaCobranca {
  vencimento: string;
  valor: number | string;
  documento: string;
  nossoNumero?: string;
}

export interface DadosCobranca {
  codfat: string;
  codcli: string;
  banco: string | number;
  tipofat: string;
  /** codvenda da 1ª venda (para gravar dbprazo_pagamento). Opcional. */
  codvenda?: string | null;
  /** Títulos a gerar em dbreceb. Vazio = só marca a fatura (ex.: DINHEIRO à vista). */
  parcelas?: ParcelaCobranca[];
}

/**
 * Grava a cobrança usando o `client` de uma transação já aberta.
 * NÃO gerencia BEGIN/COMMIT/ROLLBACK — quem chama é responsável por isso.
 * Lança Error (mensagem amigável) em qualquer falha de validação/gravação.
 */
export async function inserirCobranca(
  client: any,
  dados: DadosCobranca,
): Promise<void> {
  const { codfat, codcli, banco, tipofat, codvenda } = dados;
  const parcelas = dados.parcelas ?? [];

  // Forma de faturamento → código NUMÉRICO do Oracle (fonte única: formaFatura.ts).
  // Ex.: BOLETO→'2', CARTEIRA→'4', CARTÃO→'6'. Aceita descrição, número ou letra legada.
  const codigoForma = codigoFormaFatura(tipofat);
  if (!codigoForma) {
    throw new Error(
      `O tipo de fatura '${tipofat}' não é válido ou não foi mapeado.`,
    );
  }
  // Código do banco vem do dropdown (dbbanco_cobranca, 1..9). Convertemos para os
  // códigos INTERNOS do Oracle (fonte única: bancoCobranca.ts), fiel ao Delphi:
  //   - dbreceb.banco      = código interno (ex.: MELO(5) → '9')
  //   - dbfatura.cod_banco = código de 4 dígitos (ex.: MELO(5) → '0062')
  let codDropdown = parseInt(String(banco), 10);
  if (isNaN(codDropdown)) {
    // Fallback (mesma regra da UI: banco do cliente, senão MELO='5'): às vezes o
    // banco não chega do front por corrida de carregamento (opcoes-cobranca ainda
    // não hidratou formCobranca.banco). Resolve pelo cliente para não derrubar o
    // faturamento inteiro — dbbanco_cobranca usa códigos 1..9 ('5' = MELO).
    const rc = await client.query(
      `SELECT banco FROM dbclien WHERE codcli = $1`,
      [codcli],
    );
    codDropdown = parseInt(String(rc.rows[0]?.banco ?? ''), 10);
    if (isNaN(codDropdown)) codDropdown = 5; // MELO (padrão da UI)
  }
  const bancoDbreceb = bancoInternoDbreceb(codDropdown) ?? '9'; // default MELO interno
  const codBancoFatura = codBancoDbfatura(codDropdown) ?? '0062'; // default MELO 4 díg.

  // Auto-corrige a sequence de cod_receb quando ela está ATRÁS do maior cod_receb
  // (artefato de migração Oracle→Postgres): senão o nextval devolve valor já usado
  // e o INSERT viola a PK (pkdbreceb).
  await client.query(
    `SELECT setval('seq_cod_receb', GREATEST(
       (SELECT last_value FROM seq_cod_receb),
       (SELECT COALESCE(MAX(cod_receb::bigint), 0) FROM dbreceb WHERE cod_receb ~ '^[0-9]+$')
     ), true)`,
  );

  // Marca a fatura com a forma/banco da cobrança.
  await client.query(
    `UPDATE dbfatura
       SET frmfat = $1,
           cod_banco = $2,
           cobranca = 'S'
     WHERE codfat = $3`,
    [codigoForma, codBancoFatura, codfat],
  );

  // Herda a conta financeira da fatura para os títulos (mesmo elo do Delphi/TCOBRANCA).
  const contaFatura = await client.query(
    `SELECT cod_conta FROM dbfatura WHERE codfat = $1`,
    [codfat],
  );
  const codContaFatura = contaFatura.rows[0]?.cod_conta ?? null;
  // Data de emissão do título = hoje (equivale a trunc(sysdate) no Delphi).
  const dtEmissao = new Date().toISOString().split('T')[0];

  // Gera os títulos (dbreceb).
  for (const parcela of parcelas) {
    const { rows } = await client.query(
      `SELECT nextval('seq_cod_receb') as next_id`,
    );
    const novoCod = rows[0].next_id.toString().padStart(9, '0');

    await client.query(
      `INSERT INTO dbreceb
         (cod_receb, codcli, cod_fat, cod_conta, dt_venc, dt_emissao, valor_pgto,
          valor_rec, nro_doc, forma_fat, banco, tipo, rec, cancel, bradesco,
          venc_ant, dtvenc_previsao)
       VALUES ($1, $2, $3, $4, $5, $6, $7,
          0, $8, $9, $10, 'F', 'N', 'N', 'N',
          $5, $5)`,
      [
        novoCod,
        codcli,
        codfat,
        codContaFatura,
        parcela.vencimento,
        dtEmissao,
        parcela.valor,
        parcela.documento,
        codigoForma,
        bancoDbreceb,
      ],
    );
  }

  // Grava as parcelas na tabela nova dbprazo_pagamento (na MESMA transação: passa o client).
  if (codvenda && parcelas.length > 0) {
    const parcelasComDias = parcelas.map((parcela) => {
      const dataVencimento = new Date(parcela.vencimento);
      const hoje = new Date();
      const diffTime = dataVencimento.getTime() - hoje.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return { dia: diffDays };
    });
    await salvarParcelasPagamento(codvenda, parcelasComDias, client);
  }
}

// src/lib/faturamento/inserirCobrancaGP.ts
//
// Cobrança de GRUPO DE PAGAMENTO (GP), fiel ao Delphi (AGRUPAMENTO.GPFATURA_INCLUIR +
// TCOBRANCA.COBRANCA_CONFIRMAR/COBRANCA_INCLUIR/PRAZO_INCLUIR). Diferente da cobrança
// individual (inserirCobranca.ts), aqui os títulos são de GRUPO:
//   - dbreceb.codgp = <codgp>, cod_fat = NULL, tipo = 'G' (título de grupo)
//   - nro_doc = 'GP{codgp}-{parcela}'
//   - prazos gravados em dbpzfat (codfat de cada membro, prazo em dias, codgp)
//
// O CHAMADOR é dono da transação (BEGIN/COMMIT/ROLLBACK) — recebe o `client`.

import { codigoFormaFatura } from '@/lib/faturamento/formaFatura';
import { bancoInternoDbreceb } from '@/lib/faturamento/bancoCobranca';
import { proximoNroBanco, LEN_NRO_BANCO } from '@/lib/boleto/nossoNumero';

export interface ParcelaCobrancaGP {
  vencimento: string; // yyyy-MM-dd
  valor: number | string;
  /** Dias do prazo (para dbpzfat). Se ausente, calcula por (venc − hoje). */
  dias?: number;
}

export interface DadosCobrancaGP {
  codgp: number | string;
  codcli: string;
  banco: string | number;
  tipofat: string;
  parcelas: ParcelaCobrancaGP[];
  /** codfats dos membros do grupo (para gravar dbpzfat por fatura e herdar cod_conta). */
  codfatsMembros: string[];
}

export async function inserirCobrancaGP(client: any, dados: DadosCobrancaGP): Promise<void> {
  const { codgp, codcli, banco, tipofat, parcelas, codfatsMembros } = dados;

  const codigoForma = codigoFormaFatura(tipofat);
  if (!codigoForma) {
    throw new Error(`O tipo de fatura '${tipofat}' não é válido ou não foi mapeado.`);
  }

  // Banco: dropdown (1..9) → interno do dbreceb (fonte única bancoCobranca.ts).
  let codDropdown = parseInt(String(banco), 10);
  if (isNaN(codDropdown)) {
    const rc = await client.query(`SELECT banco FROM dbclien WHERE codcli = $1`, [codcli]);
    codDropdown = parseInt(String(rc.rows[0]?.banco ?? ''), 10);
    if (isNaN(codDropdown)) codDropdown = 5; // MELO
  }
  const bancoDbreceb = bancoInternoDbreceb(codDropdown) ?? '9';

  // cod_conta herdada da 1ª fatura membro (mesmo elo do TCOBRANCA).
  let codConta: string | null = null;
  if (codfatsMembros.length > 0) {
    const cc = await client.query(
      `SELECT cod_conta FROM dbfatura WHERE codfat = $1`,
      [codfatsMembros[0]],
    );
    codConta = cc.rows[0]?.cod_conta ?? null;
  }

  // Auto-corrige a sequence de cod_receb (artefato de migração) antes de inserir.
  await client.query(
    `SELECT setval('seq_cod_receb', GREATEST(
       (SELECT last_value FROM seq_cod_receb),
       (SELECT COALESCE(MAX(cod_receb::bigint), 0) FROM dbreceb WHERE cod_receb ~ '^[0-9]+$')
     ), true)`,
  );

  const ehBoleto = codigoForma === '2' && !!LEN_NRO_BANCO[bancoDbreceb];
  const dtEmissao = new Date().toISOString().split('T')[0];
  const hoje = new Date();

  // ===== Títulos do grupo (dbreceb: codgp, cod_fat NULL, tipo 'G') =====
  let i = 0;
  for (const parcela of parcelas) {
    i += 1;
    const { rows } = await client.query(`SELECT nextval('seq_cod_receb') as next_id`);
    const novoCod = rows[0].next_id.toString().padStart(9, '0');
    const nroBanco = ehBoleto ? await proximoNroBanco(client, bancoDbreceb) : null;
    const nroDoc = `GP${codgp}-${i}`;

    await client.query(
      `INSERT INTO dbreceb
         (cod_receb, codcli, cod_fat, codgp, cod_conta, dt_venc, dt_emissao, valor_pgto,
          valor_rec, nro_doc, forma_fat, banco, nro_banco, tipo, rec, cancel, bradesco,
          venc_ant, dtvenc_previsao)
       VALUES ($1, $2, NULL, $3, $4, $5, $6, $7,
          0, $8, $9, $10, $11, 'G', 'N', 'N', 'N',
          $5, $5)`,
      [
        novoCod,
        codcli,
        codgp,
        codConta,
        parcela.vencimento,
        dtEmissao,
        parcela.valor,
        nroDoc,
        codigoForma,
        bancoDbreceb,
        nroBanco,
      ],
    );
  }

  // ===== Prazos (dbpzfat: por fatura membro, em dias, com o codgp) =====
  // Fiel ao Delphi PRAZO_INCLUIR(codfat, prazo, codgp): cada membro recebe os prazos
  // (dias) do grupo. Substitui os prazos antigos da fatura antes de inserir os novos.
  const diasParcelas = parcelas.map((p) => {
    if (p.dias != null) return Math.max(0, Math.round(Number(p.dias)));
    const d = Math.ceil((new Date(p.vencimento).getTime() - hoje.getTime()) / 86400000);
    return Math.max(0, d);
  });
  for (const codfat of codfatsMembros) {
    await client.query(`DELETE FROM dbpzfat WHERE codfat = $1`, [codfat]);
    for (const dias of diasParcelas) {
      await client.query(
        `INSERT INTO dbpzfat (codfat, prazo, codgp) VALUES ($1, $2, $3)`,
        [codfat, String(dias).slice(0, 3), codgp],
      );
    }
  }
}

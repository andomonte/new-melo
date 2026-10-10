/**
 * Gera, pela VIA NACIONAL, a VENDA + FATURA da nota de nacionalização de uma DI.
 *
 * Fiel ao modelo do Delphi: a nota de nacionalização vira uma dbfatura normal
 * (com dbvenda/dbitvenda por trás + dbprodfat), para aparecer na Consulta de
 * Faturas e poder ser reemitida/cancelada pelo faturamento padrão. A identidade
 * de importação fica em `dbfatura.importacao_id` (migration 072) — é por ele que
 * a emissão/reemissão sabe que deve montar o XML pelo builder de importação
 * (gerarXmlImportacao), não pelo nacional.
 *
 * NÃO assina, NÃO transmite, NÃO baixa estoque. Só cria os registros faturáveis.
 * Idempotente: se a DI já tem fatura não-cancelada, reaproveita (para retry/reemissão).
 *
 * Recebe um PoolClient já em transação (o chamador faz BEGIN/COMMIT).
 */

import type { PoolClient } from 'pg';
import {
  construirNotasNacionalizacao,
  type ConstrucaoNotas,
} from '@/lib/compras/construirNotasNacionalizacao';
import { proximoNroForm } from '@/lib/faturamento/gerarNumeracaoFatura';

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface FaturaNacionalizacaoRef {
  codfat: string;
  codvenda: string | null;
  serie: string;
  nroform: string;
  jaExistia: boolean;
  construcao: ConstrucaoNotas;
}

export async function gerarFaturaNacionalizacao(
  client: PoolClient,
  importacaoId: number,
  opts?: { codusr?: string; codvend?: string; schema?: string },
): Promise<FaturaNacionalizacaoRef> {
  // Schema = o da filial (search_path do getPgPool), não fixo db_manaus.
  const schema = opts?.schema || (await client.query('SELECT current_schema() AS s')).rows[0].s;

  // 1) Dados da nota (gabarito de importação)
  const r = await construirNotasNacionalizacao(client, importacaoId);
  if (!r.ok) throw new Error(r.message);
  const construcao = r.data;
  const nota = construcao.notas[0];
  if (!nota) throw new Error('Sem itens para gerar a nota de nacionalização.');

  const codcli = String(construcao.codPrincipal || '').trim(); // exportador (dbclien tipo X)
  if (!codcli) throw new Error('Exportador principal sem cliente vinculado — vincule o fornecedor→cliente antes de emitir.');

  const totalProd = r2(nota.itensNfe.reduce((s, it) => s + r2(it.vUnit * it.qtd), 0));
  const totalNota = r2(totalProd + nota.vOutro);

  // A PK de dbitvenda é (codprod, codvenda), mas a nota pode ter o mesmo produto em
  // várias adições. Agregamos por codprod (soma qtd + valor; vUnit ponderado) para o
  // registro faturável (dbvenda/dbitvenda/dbprodfat). O XML continua por-linha — ele é
  // reconstruído da DI no emitir-faturado, não daqui.
  const agr = new Map<string, { codprod: string; descricao: string; ref: string | null; ncm: string | null; qtd: number; vProd: number; vIBSUF: number; vCBS: number }>();
  for (const it of nota.itensNfe) {
    const vp = r2(it.vUnit * it.qtd);
    const g = agr.get(it.codprod);
    if (g) {
      g.qtd += it.qtd;
      g.vProd = r2(g.vProd + vp);
      g.vIBSUF = r2(g.vIBSUF + (it.ibscbs?.vIBSUF ?? 0));
      g.vCBS = r2(g.vCBS + (it.ibscbs?.vCBS ?? 0));
    } else {
      agr.set(it.codprod, {
        codprod: it.codprod, descricao: it.descricao || '', ref: it.ref || null, ncm: it.ncm || null,
        qtd: it.qtd, vProd: vp, vIBSUF: it.ibscbs?.vIBSUF ?? 0, vCBS: it.ibscbs?.vCBS ?? 0,
      });
    }
  }
  const itensFat = [...agr.values()].map((g) => ({ ...g, vUnit: g.qtd > 0 ? r2(g.vProd / g.qtd) : 0 }));

  // 2) Já existe fatura para esta DI? (idempotência / reemissão)
  const existe = await client.query(
    `SELECT codfat, serie, nroform FROM ${schema}.dbfatura
      WHERE importacao_id = $1 AND COALESCE(cancel,'N') <> 'S'
      ORDER BY codfat DESC LIMIT 1`,
    [importacaoId],
  );
  if (existe.rows.length > 0) {
    const f = existe.rows[0];
    const fv = await client.query(
      `SELECT codvenda FROM ${schema}.fatura_venda WHERE codfat = $1 LIMIT 1`, [f.codfat]);
    return {
      codfat: String(f.codfat),
      codvenda: fv.rows[0]?.codvenda ? String(fv.rows[0].codvenda) : null,
      serie: String(f.serie || '1'),
      nroform: String(f.nroform),
      jaExistia: true,
      construcao,
    };
  }

  // 3) Numeração da VENDA (mesma lógica do criar-venda/finalizarVenda)
  const idsV = await client.query(
    `SELECT (COALESCE(MAX(NULLIF(regexp_replace(codvenda,'\\D','','g'),'')::bigint),0)+1)::text AS c,
            (COALESCE(MAX(NULLIF(regexp_replace(nrovenda,'\\D','','g'),'')::bigint),0)+1)::text AS n
       FROM ${schema}.dbvenda`,
  );
  const codvenda = String(idsV.rows[0].c).padStart(9, '0');
  const nrovenda = String(idsV.rows[0].n).padStart(9, '0');

  // 4) dbvenda (registro faturável; tipo_operacao/movimentacao ficam no default,
  //    como na transferência — a identidade fiscal está no descrcfop/cfop/importacao_id)
  await client.query(
    `INSERT INTO ${schema}.dbvenda
       (codvenda, nrovenda, codcli, data, total, status, tipo, cancel, impresso,
        cnpj_empresa, ie_empresa, codusr, codvend, obs)
     VALUES ($1,$2,$3,NOW(),$4,'F','1','N','N',$5,$6,$7,$8,$9)`,
    [
      codvenda, nrovenda, codcli, totalNota,
      construcao.emitente.cnpj || null, construcao.emitente.ie || null,
      String(opts?.codusr || '0').slice(0, 4), opts?.codvend || null,
      `NACIONALIZACAO DI ${construcao.di.nro_di}`,
    ],
  );

  // Armazém (dbitvenda.arm_id é NOT NULL): o da série da nota (1 → arm_serie '001'),
  // preferindo o GERAL; fallback p/ o primeiro armazém ativo.
  const armRes = await client.query(
    `SELECT arm_id FROM ${schema}.cad_armazem
      WHERE COALESCE(arm_status,'A') <> 'I'
      ORDER BY (arm_serie = '001') DESC, (arm_descricao = 'GERAL') DESC, arm_id
      LIMIT 1`,
  );
  const armId = armRes.rows[0]?.arm_id ?? null;
  if (!armId) throw new Error('Nenhum armazém cadastrado para a venda de nacionalização.');

  // 5) dbitvenda por item (fiscal nulo; CFOP 3102 — igual ao criar-venda da transferência)
  let nritem = 0;
  for (const it of itensFat) {
    nritem++;
    await client.query(
      `INSERT INTO ${schema}.dbitvenda
         (codvenda, codprod, prunit, qtd, demanda, descr, ref, nritem, ncm, cfop, arm_id)
       VALUES ($1,$2,$3,$4,'N',$5,$6,$7,$8,'3102',$9)`,
      [codvenda, it.codprod, it.vUnit, it.qtd, it.descricao || null, it.ref || null,
       String(nritem), it.ncm || null, armId],
    );
  }

  // 6) Série + número da FATURA. Série 1 (gabarito real MELO da nota de importação).
  const serie = '1';
  await client.query(`LOCK TABLE ${schema}.dbfatura IN SHARE ROW EXCLUSIVE MODE`);
  const nroform = await proximoNroForm(client, {
    serie, insc07: 'N', cgc: construcao.emitente.cnpj, schema,
  });

  // 7) codfat = GREATEST(MAX dbfatura.codfat, MAX dbreceb.cod_fat) + 1
  const idsF = await client.query(
    `SELECT GREATEST(
        COALESCE((SELECT MAX(CAST(regexp_replace(codfat,'\\D','','g') AS bigint))
                    FROM ${schema}.dbfatura WHERE codfat ~ '^[0-9]+$'), 0),
        COALESCE((SELECT MAX(CAST(regexp_replace(cod_fat,'\\D','','g') AS bigint))
                    FROM ${schema}.dbreceb WHERE cod_fat ~ '^[0-9]+$'), 0)
      ) + 1 AS c`,
  );
  const codfat = String(idsF.rows[0].c).padStart(9, '0');

  // 8) dbfatura (cabeçalho). Natureza = COMPRA PARA COMERCIALIZACAO (gabarito).
  await client.query(
    `INSERT INTO ${schema}.dbfatura
       (codfat, codcli, nroform, data, totalprod, totalfat, totalnf, tipodoc, tipofat,
        cobranca, insc07, nfs, serie, descrcfop, destfrete, cfop2, importacao_id)
     VALUES ($1,$2,$3,NOW(),$4,$5,$5,'1','1','N','N','N',$6,$7,'1','3102',$8)`,
    [codfat, codcli, nroform, totalProd, totalNota, serie,
     'COMPRA PARA COMERCIALIZACAO', importacaoId],
  );

  // 9) dbprodfat por item (snapshot p/ a Consulta de Faturas; CSTs de importação)
  nritem = 0;
  for (const it of itensFat) {
    nritem++;
    await client.query(
      `INSERT INTO ${schema}.dbprodfat
         (codfat, codvenda, codprod, qtde, prunit, descr, ref, nritem, cfop, ncm,
          csticms, icmsexterno_orig, cstipi, cstpis, cstcofins, totalproduto, baseicms, totalicms,
          aliquota_ibs, aliquota_cbs, valor_ibs, valor_cbs)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'3102',$9,
               '60','1','05','08','08',$10,0,0,
               0.1,0.9,$11,$12)`,
      [codfat, codvenda, it.codprod, it.qtd, it.vUnit, it.descricao || null, it.ref || null,
       String(nritem), it.ncm || null, it.vProd, it.vIBSUF, it.vCBS],
    );
  }

  // 10) vínculo fatura↔venda
  await client.query(
    `INSERT INTO ${schema}.fatura_venda (codfat, codvenda, data_associacao, usuario_associacao, status)
     VALUES ($1,$2,NOW(),$3,'ativo')`,
    [codfat, codvenda, String(opts?.codusr || 'SISTEMA')],
  );

  return { codfat, codvenda, serie, nroform, jaExistia: false, construcao };
}

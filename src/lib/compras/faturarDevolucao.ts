/**
 * Fatura a devolução de compra (porte do ramo "faturar pré-pedido" de
 * FATURAMENTOS.PROCESSO_DEVOLUCAO, do Delphi). Roda no `client` de uma transação aberta pelo
 * chamador — fatura, itens, baixa de estoque, título e fechamento da devolução são uma
 * unidade: se algo falhar, o ROLLBACK do chamador desfaz tudo.
 *
 * O que faz (igual ao Delphi):
 *  - dbfatura série 1, vendedor 00025, tipodoc 'V', natureza "DEVOLUCAO DE COMPRA…",
 *    CFOP do cabeçalho = o da 1ª linha, dev_id ligado; texto complementar com ST e IPI.
 *  - dbprodfat com o espelho (devolucaoEspelho.ts); a ST vai para acréscimo e
 *    basesubst/totalsubst_trib_outros, ST "normal" zerada (ZERAR_SUBSTITUICAO='S').
 *  - pré-pedido 'D' → faturado ('F'), fatura_venda, dbfecharvendas.
 *  - baixa do armazém 1004 (qtest e reservada) e do produto (qtest E qtdreservada — a
 *    devolução segurava a reserva no produto; o faturamento comum não baixa a reservada).
 *  - título a RECEBER do fornecedor em 30 dias (MELO / RECIBO), exceto destino que seja
 *    unidade da própria Melo (CNPJ 04618302…), como no Delphi.
 *  - fat_devolucao status 'F' + registros FATURA/RECEB.
 */
import { proximoNroForm } from '@/lib/faturamento/gerarNumeracaoFatura';
import { inserirCobranca } from '@/lib/faturamento/inserirCobranca';
import { ARMAZEM_DEVOLUCAO } from '@/lib/compras/devolucaoEntrada';
import {
  cfopValidoDevolucao,
  EspelhoDevolucao,
  LinhaEspelho,
  montarEspelhoDevolucao,
} from '@/lib/compras/devolucaoEspelho';

type Db = { query: (sql: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }> };

export const NATUREZA_DEVOLUCAO_COMPRA = 'DEVOLUCAO DE COMPRA PARA COMERCIALIZACAO';
const VENDEDOR_DEVOLUCAO = '00025'; // EXTRA, como no Delphi
const CONTA_DEVOLUCAO = '0110';
const BANCO_MELO_DROPDOWN = 5; // MELO (interno '9' / cod_banco '0062')
const PRAZO_TITULO_DIAS = 30;
const CNPJ_RAIZ_MELO = '04618302';

const r2 = (v: number) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

export interface TransporteDevolucao {
  codtransp?: string | null;
  /** modFrete da NF-e (0 emitente, 1 destinatário, 2 terceiros, 9 sem frete). */
  modFrete?: string | number | null;
  quantidade?: string | number | null;
  especie?: string | null;
  marca?: string | null;
  numero?: string | null;
  pesoBruto?: string | number | null;
  pesoLiquido?: string | number | null;
}

export interface OpcoesFaturarDevolucao {
  /** CFOP por linha (chave codprod|nItem), editado na tela; senão vale o sugerido. */
  cfops?: Record<string, string>;
  transporte?: TransporteDevolucao;
  /** Mensagem adicional para o texto complementar. */
  obs?: string | null;
  codusr?: string | null;
  nomeusr?: string | null;
  schema: string;
}

export interface ResultadoFaturarDevolucao {
  codfat: string;
  nroform: string;
  serie: string;
  totalnf: number;
  codReceb: string | null;
  codvenda: string;
  espelho: EspelhoDevolucao;
}

function dataMaisDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export async function faturarDevolucaoEntrada(
  client: Db,
  devId: string,
  opts: OpcoesFaturarDevolucao,
): Promise<ResultadoFaturarDevolucao> {
  // 1. Trava a devolução e valida o estado.
  const dev = (await client.query(
    `SELECT dev_id::text AS dev_id, dev_status, COALESCE(dev_cancel,'N') AS dev_cancel, dev_origem,
            dev_codfat, dev_coddest, dev_coddoc
       FROM fat_devolucao WHERE dev_id = $1 AND dev_tipodoc = 'ENTRADA' FOR UPDATE`,
    [devId],
  )).rows[0];
  if (!dev) throw new Error(`Devolução ${devId} não encontrada.`);
  if (dev.dev_origem !== 'WEB') throw new Error('Só as devoluções criadas pelo web são emitidas aqui. As do Delphi continuam no Delphi.');
  if (dev.dev_cancel === 'S') throw new Error('Devolução cancelada.');
  if (dev.dev_status !== 'A' || dev.dev_codfat) throw new Error(`A devolução ${devId} já foi faturada.`);

  for (const [chave, cfop] of Object.entries(opts.cfops ?? {})) {
    if (!cfopValidoDevolucao(cfop)) throw new Error(`CFOP inválido na linha ${chave}: ${cfop}`);
  }

  // 2. Espelho fiscal (recalculado aqui — a tela só manda os CFOPs editados).
  const esp = await montarEspelhoDevolucao(client, devId, opts.cfops);
  if (esp.pendencias.length) throw new Error(esp.pendencias.join(' '));
  if (!esp.linhas.length) throw new Error('A devolução não tem itens para faturar.');
  const codvenda = esp.codvenda as string;

  const venda = (await client.query(
    `SELECT codvenda, status FROM dbvenda WHERE codvenda = $1 FOR UPDATE`,
    [codvenda],
  )).rows[0];
  if (!venda || venda.status !== 'D') {
    throw new Error(`O pré-pedido ${esp.nrovenda ?? codvenda} da devolução não está aguardando faturamento.`);
  }

  // 3. Numeração (igual ao salvar.ts: lock + codfat alinhado à dbreceb; série 1 como no Delphi).
  await client.query('LOCK TABLE dbfatura IN EXCLUSIVE MODE');
  const SENTINELA_MIN = 90000000;
  const ult = (await client.query(
    `SELECT GREATEST(
        COALESCE((SELECT MAX(CAST(codfat AS BIGINT)) FROM dbfatura
                   WHERE codfat ~ '^[0-9]+$' AND CAST(codfat AS BIGINT) < $1), 0),
        COALESCE((SELECT MAX(CAST(cod_fat AS BIGINT)) FROM dbreceb
                   WHERE cod_fat ~ '^[0-9]+$' AND CAST(cod_fat AS BIGINT) < $1), 0)) AS u`,
    [SENTINELA_MIN],
  )).rows[0].u;
  const codfat = String(Number(ult) + 1).padStart(9, '0');
  const serie = '1';
  // Reemissão depois de um estorno: reaproveita o número da fatura estornada desta devolução
  // (a NF nunca foi autorizada), para não deixar buraco na numeração. Se uma NF com esse número
  // tiver sido autorizada sem retorno, a SEFAZ acusa a duplicidade em vez de aceitar outra.
  const reaproveitado = (await client.query(
    `SELECT f.nroform FROM dbfatura f
      WHERE f.dev_id::text = $1 AND f.cancel = 'S' AND f.serie = $2
        AND NOT EXISTS (SELECT 1 FROM dbfat_nfe n WHERE n.codfat = f.codfat
                         AND n.status IN ('100','150','301','302','303','103','105'))
        AND NOT EXISTS (SELECT 1 FROM dbfatura g WHERE g.nroform = f.nroform AND g.serie = f.serie
                         AND COALESCE(g.cancel,'N') <> 'S')
      ORDER BY f.codfat DESC LIMIT 1`,
    [String(devId), serie],
  )).rows[0]?.nroform as string | undefined;
  const nroform = reaproveitado
    ?? (await proximoNroForm(client, { serie, insc07: 'N', cgc: esp.empresa.cgc, schema: opts.schema }));
  const selo = String(
    Number((await client.query(
      `SELECT COALESCE(MAX(CAST(selo AS BIGINT)), 0) AS s FROM dbfatura WHERE selo ~ '^[0-9]+$'`,
    )).rows[0].s) + 1,
  ).padStart(9, '0');

  // 4. Totais (PROCESSO_DEVOLUCAO): despesa = outros + ST; NF = prod + IPI + despesa − desc − deson.
  const t = esp.totais;
  const despesa = r2(t.outros + t.st);
  const percAcresc = t.produtos > 0 ? r2((despesa / t.produtos) * 100) : 0;
  const percDesc = t.produtos > 0 ? r2((t.desconto / t.produtos) * 100) : 0;
  const tr = opts.transporte ?? {};
  const modFrete = ['0', '1', '2', '3', '4', '9'].includes(String(tr.modFrete ?? '')) ? String(tr.modFrete) : '9';
  const destfrete = String(Number(modFrete) + 1); // dbfatura guarda base 1
  const codtransp = tr.codtransp ? String(tr.codtransp).trim() : null;
  if (codtransp) {
    const ok = (await client.query(`SELECT 1 FROM dbtransp WHERE codtransp = $1`, [codtransp])).rowCount;
    if (!ok) throw new Error(`Transportadora ${codtransp} não encontrada.`);
  }
  const infCompl = [esp.infCompl, String(opts.obs ?? '').trim()].filter(Boolean).join(' ');
  const cfopCab = esp.linhas[0].cfop;

  await client.query(
    `INSERT INTO dbfatura (
       codfat, codcli, nroform, data, codvend, codtransp, totalprod, totalfat, totalnf, cod_conta,
       tipodoc, cobranca, insc07, pedido, nfs, selo, serie, descrcfop, cfop1, totalfrete, frete_nf,
       desconto, desconto_nf, acrescimo, acrescimo_nf, destfrete, totalipi, baseicms, valor_icms,
       despesa, zerar_ipi, zerar_icms, zerar_substituicao, descontosuframa, totalicmsdesconto,
       tipofat, tiponf, dev_id, info_compl, quatidade, especie, marca, numero, psbruto, psliquido,
       cancel, valoricms_subst, baseicms_subst)
     VALUES ($1,$2,$3,CURRENT_DATE,$4,$5,$6,$7,$7,$8,
       'V','N','N',$9,'N',$10,$11,$12,$13,0,'N',
       $14,$15,$16,$17,$18,$19,$20,$21,
       $22,$23,$24,'S',$25,$26,
       '1','A',$27,$28,$29,$30,$31,$32,$33,$34,
       'N',0,0)`,
    [
      codfat, esp.cliente.codcli, nroform, VENDEDOR_DEVOLUCAO, codtransp, t.produtos, t.nf, CONTA_DEVOLUCAO,
      String(esp.nrovenda ?? '').slice(0, 20) || null, selo, serie, NATUREZA_DEVOLUCAO_COMPRA.slice(0, 60), cfopCab,
      percDesc, percDesc > 0 ? 'S' : 'N', percAcresc, percAcresc > 0 ? 'S' : 'N', destfrete, t.ipi, t.baseIcms, t.icms,
      despesa, t.ipi > 0 ? 'N' : 'S', t.icms > 0 ? 'N' : 'S', t.icmsDeson > 0 ? 'S' : 'N', t.icmsDeson,
      Number(devId), infCompl, tr.quantidade != null && tr.quantidade !== '' ? String(tr.quantidade) : null,
      tr.especie || null, tr.marca || null, tr.numero || null,
      tr.pesoBruto != null && tr.pesoBruto !== '' ? String(tr.pesoBruto) : null,
      tr.pesoLiquido != null && tr.pesoLiquido !== '' ? String(tr.pesoLiquido) : null,
    ],
  );

  // 5. Itens (espelho) — ST somada ao acréscimo e guardada em *_outros, como o Delphi.
  let nItem = 0;
  for (const l of esp.linhas as LinhaEspelho[]) {
    nItem += 1;
    await client.query(
      `INSERT INTO dbprodfat (
         codprod, codfat, prunit, qtde, descr, codvenda, icms, ipi, cfop, totalipi, baseicms, totalicms,
         mva, basesubst_trib, totalsubst_trib, ref, ncm, baseipi, totalproduto, totalicmsdesconto,
         cstipi, cstpis, pis, cstcofins, cofins, basepis, valorpis, basecofins, valorcofins, csticms,
         acrescimo, desconto, basesubst_trib_outros, totalsubst_trib_outros, cest, nroitemnfe,
         aliquota_icms, aliquota_ipi)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
         0,0,0,$13,$14,$15,$16,$17,
         $18,$19,$20,$21,$22,$23,$24,$25,$26,$27,
         $28,$29,$30,$31,$32,$33,
         $7,$8)`,
      [
        l.codprod, codfat, l.prunit, l.qtd, l.descr.slice(0, 60), codvenda, l.aliqIcms, l.aliqIpi, l.cfop,
        l.valorIpi, l.baseIcms, l.valorIcms, l.ref.slice(0, 20) || null, l.ncm || null, l.baseIpi, l.totalproduto, l.icmsDeson,
        l.cstipi, l.cstpis, l.aliqPis, l.cstcofins, l.aliqCofins, l.basePis, l.valorPis, l.baseCofins, l.valorCofins,
        l.csticms, r2(l.outros + l.valorSt), l.desconto, l.baseSt, l.valorSt, l.cest || null, nItem,
      ],
    );
  }

  // 6. Pré-pedido faturado.
  await client.query(
    `INSERT INTO fatura_venda (codfat, codvenda, data_associacao, usuario_associacao, status)
     VALUES ($1, $2, NOW(), $3, 'ativo')`,
    [codfat, codvenda, opts.codusr ?? null],
  );
  await client.query(`UPDATE dbvenda SET status = 'F' WHERE codvenda = $1`, [codvenda]);
  await client.query(
    `INSERT INTO dbfecharvendas (codvenda, codfat, data, status) VALUES ($1, $2, CURRENT_DATE, '1')`,
    [codvenda, codfat],
  );

  // 7. Baixa do estoque reservado no armazém de devolução e no produto.
  const itensVenda = (await client.query(
    `SELECT codprod, SUM(qtd)::numeric AS qtd, arm_id FROM dbitvenda WHERE codvenda = $1 GROUP BY codprod, arm_id`,
    [codvenda],
  )).rows;
  for (const iv of itensVenda) {
    const q = Number(iv.qtd) || 0;
    if (q <= 0) continue;
    const arm = Number(iv.arm_id) || ARMAZEM_DEVOLUCAO;
    await client.query(
      `UPDATE cad_armazem_produto
          SET arp_qtest = GREATEST(0, COALESCE(arp_qtest,0) - $1),
              arp_qtest_reservada = GREATEST(0, COALESCE(arp_qtest_reservada,0) - $1)
        WHERE arp_codprod = $2 AND arp_arm_id = $3`,
      [q, iv.codprod, arm],
    );
    await client.query(
      `UPDATE dbprod
          SET qtest = GREATEST(0, COALESCE(qtest,0) - $1),
              qtdreservada = GREATEST(0, COALESCE(qtdreservada,0) - $1)
        WHERE codprod = $2`,
      [q, iv.codprod],
    );
  }

  // 8. Título a receber do fornecedor (30 dias), salvo destino Melo.
  let codReceb: string | null = null;
  const destinoMelo = esp.cliente.cpfcgc.replace(/\D/g, '').startsWith(CNPJ_RAIZ_MELO);
  if (!destinoMelo && t.nf > 0) {
    await inserirCobranca(client, {
      codfat,
      codcli: esp.cliente.codcli,
      banco: BANCO_MELO_DROPDOWN,
      tipofat: 'RECIBO',
      codvenda,
      parcelas: [{ vencimento: dataMaisDias(PRAZO_TITULO_DIAS), valor: t.nf, documento: `NF${nroform}A` }],
    });
    codReceb = (await client.query(
      `SELECT cod_receb FROM dbreceb WHERE cod_fat = $1 ORDER BY cod_receb LIMIT 1`,
      [codfat],
    )).rows[0]?.cod_receb ?? null;
  }

  // 9. Fecha a devolução e registra os documentos.
  await client.query(
    `UPDATE fat_devolucao
        SET dev_codfat = $2, dev_status = 'F', dev_cfop = $3, dev_transp = $4, dev_frete = $5,
            dev_totalprod = $6, dev_totalnf = $7, dev_codnfe_ent = COALESCE(dev_codnfe_ent, $8),
            dev_quantidade = $9, dev_especie = $10, dev_marca = $11, dev_numero = $12,
            dev_pesobruto = $13, dev_pesoliquido = $14
      WHERE dev_id = $1`,
    [
      devId, codfat, Number(cfopCab), codtransp, modFrete, t.produtos, t.nf, esp.codnfeEnt,
      tr.quantidade ?? null, tr.especie ?? null, tr.marca ?? null, tr.numero ?? null,
      tr.pesoBruto ?? null, tr.pesoLiquido ?? null,
    ],
  );
  const registrar = (doc: string, codigo: string) =>
    client.query(
      `INSERT INTO fat_devolucao_registro (der_dev_id, der_documento, der_codigo)
       VALUES ($1, $2, $3)`,
      [devId, doc, codigo],
    );
  await registrar('FATURA', codfat);
  if (codReceb) await registrar('RECEB', codReceb);
  await client.query(
    `UPDATE devolucoes SET status = 'FATURADA', updated_at = NOW()
      WHERE id = (SELECT dev_devolucao_receb_id FROM fat_devolucao WHERE dev_id = $1)`,
    [devId],
  );
  await client.query(
    `INSERT INTO dbacao (codusr, acao, tabela, obs, data) VALUES ($1, 'INCLUIR', 'DBFATURA', $2, now())`,
    [opts.codusr ?? null, `COD:${codfat} DEV:${devId}`],
  );

  return { codfat, nroform, serie, totalnf: t.nf, codReceb, codvenda, espelho: esp };
}

/** Status de NF-e que impedem o estorno: autorizada, denegada ou ainda em processamento. */
const STATUS_NFE_SEM_ESTORNO = ['100', '150', '301', '302', '303', '103', '105'];

/**
 * Estorna o faturamento de uma devolução do web cuja NF NÃO foi autorizada (rejeitada ou não
 * transmitida). É o inverso de faturarDevolucaoEntrada, na transação do chamador:
 *  - fatura, título a receber e vínculo fatura/venda cancelados;
 *  - estoque: volta o saldo E a reserva no armazém de cada item (a devolução segue aberta);
 *  - pré-pedido volta a 'D' e a devolução a 'A' (aguardando emissão), sem fatura.
 * As tentativas na SEFAZ (dbfat_nfe) ficam como histórico. O número da NF é reaproveitado na
 * próxima emissão desta devolução; se ela for cancelada, o número precisa ser inutilizado.
 */
export async function estornarFaturamentoDevolucao(
  client: Db,
  devId: string,
  opts: { codusr?: string | null; usuario?: string | null },
): Promise<{ codfat: string; nroform: string }> {
  const dev = (await client.query(
    `SELECT dev_id::text AS dev_id, dev_status, COALESCE(dev_cancel,'N') AS dev_cancel, dev_origem,
            dev_codfat, dev_devolucao_receb_id
       FROM fat_devolucao WHERE dev_id = $1 AND dev_tipodoc = 'ENTRADA' FOR UPDATE`,
    [devId],
  )).rows[0];
  if (!dev) throw new Error(`Devolução ${devId} não encontrada.`);
  if (dev.dev_origem !== 'WEB') throw new Error('Só devoluções do web.');
  if (dev.dev_cancel === 'S') throw new Error('Devolução cancelada.');
  if (dev.dev_status !== 'F' || !dev.dev_codfat) throw new Error('A devolução não está faturada.');
  const codfat = String(dev.dev_codfat);

  const nfes = (await client.query(
    `SELECT status, motivo FROM dbfat_nfe WHERE codfat = $1`, [codfat])).rows;
  const bloqueia = nfes.find((n: any) => STATUS_NFE_SEM_ESTORNO.includes(String(n.status)));
  if (bloqueia) {
    throw new Error(
      String(bloqueia.status) === '100' || String(bloqueia.status) === '150'
        ? 'A NF desta devolução foi autorizada: não dá para estornar o faturamento (seria preciso cancelar a NF).'
        : `A NF desta devolução está com status ${bloqueia.status} (${bloqueia.motivo ?? ''}) na SEFAZ: não dá para estornar.`,
    );
  }

  const fat = (await client.query(
    `SELECT codfat, nroform, COALESCE(cancel,'N') AS cancel FROM dbfatura WHERE codfat = $1 FOR UPDATE`, [codfat])).rows[0];
  if (!fat) throw new Error(`Fatura ${codfat} não encontrada.`);
  if (fat.cancel === 'S') throw new Error(`A fatura ${codfat} já está cancelada.`);
  const pagos = (await client.query(
    `SELECT count(*)::int AS n FROM dbreceb WHERE cod_fat = $1 AND COALESCE(cancel,'N') <> 'S' AND COALESCE(rec,'N') = 'S'`,
    [codfat])).rows[0].n;
  if (pagos > 0) throw new Error('O título a receber desta fatura já tem baixa: estorne a baixa antes.');

  const codvenda = (await client.query(
    `SELECT codvenda FROM fatura_venda WHERE codfat = $1 AND status = 'ativo' ORDER BY data_associacao DESC LIMIT 1`,
    [codfat])).rows[0]?.codvenda
    ?? (await client.query(
      `SELECT der_codigo AS codvenda FROM fat_devolucao_registro WHERE der_dev_id = $1 AND der_documento = 'VENDA' LIMIT 1`,
      [devId])).rows[0]?.codvenda;
  if (!codvenda) throw new Error('Pré-pedido da devolução não encontrado.');

  // Estoque: inverso do passo 7 do faturamento (saldo e reserva voltam ao armazém do item)
  const itensVenda = (await client.query(
    `SELECT codprod, SUM(qtd)::numeric AS qtd, arm_id FROM dbitvenda WHERE codvenda = $1 GROUP BY codprod, arm_id`,
    [codvenda])).rows;
  for (const iv of itensVenda) {
    const q = Number(iv.qtd) || 0;
    if (q <= 0) continue;
    const arm = Number(iv.arm_id) || ARMAZEM_DEVOLUCAO;
    const upd = await client.query(
      `UPDATE cad_armazem_produto
          SET arp_qtest = COALESCE(arp_qtest,0) + $1,
              arp_qtest_reservada = COALESCE(arp_qtest_reservada,0) + $1
        WHERE arp_codprod = $2 AND arp_arm_id = $3`,
      [q, iv.codprod, arm]);
    if (upd.rowCount !== 1) throw new Error(`Produto ${iv.codprod} sem cadastro no armazém ${arm}.`);
    await client.query(
      `UPDATE dbprod SET qtest = COALESCE(qtest,0) + $1, qtdreservada = COALESCE(qtdreservada,0) + $1 WHERE codprod = $2`,
      [q, iv.codprod]);
  }

  await client.query(`UPDATE dbreceb SET cancel = 'S' WHERE cod_fat = $1 AND COALESCE(cancel,'N') <> 'S'`, [codfat]);
  await client.query(`UPDATE dbfatura SET cancel = 'S' WHERE codfat = $1`, [codfat]);
  await client.query(`UPDATE fatura_venda SET status = 'cancelado' WHERE codfat = $1 AND status = 'ativo'`, [codfat]);
  await client.query(`DELETE FROM dbfecharvendas WHERE codfat = $1 AND codvenda = $2`, [codfat, codvenda]);
  await client.query(`UPDATE dbvenda SET status = 'D' WHERE codvenda = $1 AND status = 'F'`, [codvenda]);
  await client.query(
    `DELETE FROM fat_devolucao_registro WHERE der_dev_id = $1 AND der_documento IN ('FATURA','RECEB')`, [devId]);
  await client.query(
    `UPDATE fat_devolucao SET dev_status = 'A', dev_codfat = NULL, dev_totalnf = NULL WHERE dev_id = $1`, [devId]);
  if (dev.dev_devolucao_receb_id) {
    await client.query(
      `UPDATE devolucoes SET status = 'AGUARDANDO_EMISSAO', updated_at = NOW() WHERE id = $1`,
      [dev.dev_devolucao_receb_id]);
  }
  await client.query(
    `INSERT INTO dbacao (codusr, acao, tabela, obs, data) VALUES ($1, 'ESTORNAR', 'DBFATURA', $2, now())`,
    [opts.codusr ?? null, `COD:${codfat} NF:${fat.nroform} DEV:${devId} ${String(opts.usuario ?? '').slice(0, 20)}`]);

  return { codfat, nroform: String(fat.nroform) };
}

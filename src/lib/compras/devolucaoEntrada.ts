/**
 * Devolução de entrada no modelo do Delphi (Financeiro › Faturamento › Devolução,
 * FATURAMENTOS.INC_DEVOLUCAO_DOCUMENTO / INC_DEVOLUCAO_ITENS / PROCESSO_DEVOLUCAO).
 *
 * No Delphi a alocação grava toda a quantidade da nota (ARMAZEM.VALIDA_ROMANEIO) e o que veio
 * a menos, danificado ou errado é tirado depois pela tela de devolução: ela cria a devolução
 * aberta e um pré-pedido para o fornecedor, que reserva os itens. A NF de devolução sai quando
 * esse pré-pedido é faturado, gerando o título a RECEBER do fornecedor; não há título a pagar e
 * o atendido do pedido de compra não muda (validado no Oracle, 26/11/2026).
 *
 * No web isso acontece na finalização da alocação, na MESMA transação:
 *   - o que não está bom vai para o armazém virtual 1004 (DEVOLUCAO/FALTA), reservado;
 *   - nasce a devolução aberta (fat_devolucao 'A') e o pré-pedido (dbvenda status 'D');
 *   - a reserva do produto (dbprod.qtdreservada) da parte devolvida continua — agora é da
 *     devolução. Disponível para venda = o que chegou bom.
 * A NF de devolução é emitida em Faturamento › Devolução (lib/compras/
 * faturarDevolucao.ts), que baixa também dbprod.qtdreservada. Fornecedor sem cliente é
 * cadastrado automaticamente (criarClienteDoFornecedor).
 */
import { ARMAZEM_GERAL, creditarReservado, posicionarReserva } from './estoqueEntrada';

export const ARMAZEM_DEVOLUCAO = 1004;
export const STATUS_PREPEDIDO_DEVOLUCAO = 'D'; // fora das filas de faturamento/caixa
const VENDEDOR_DEVOLUCAO = '00025'; // EXTRA — o mesmo do pré-pedido do Delphi
export const MOTIVOS_DEVOLUCAO = ['FALTA', 'DANIFICADO', 'ERRADO'] as const;
/** Motivos da devolução manual (tela de devolução). itd_motivo é varchar(15). */
export const MOTIVOS_DEVOLUCAO_MANUAL = ['DANIFICADO', 'ERRADO', 'FALTA', 'GARANTIA', 'ACORDO', 'OUTROS'] as const;

type Executor = { query: (sql: string, params?: any[]) => Promise<any> };

export interface ItemDevolver {
  codprod: string;
  codreq: string | null;
  qtd: number;
  motivo: string;
  /** Armazém de onde sai (devolução manual). Sem ele: armazém virtual 1004 (alocação). */
  armId?: number;
}

export interface ResultadoDevolucao {
  devId: string;
  codvenda: string | null;
  nrovenda: string | null;
  codcli: string | null;
  semCliente: boolean;
  /** O fornecedor não tinha cliente e foi cadastrado automaticamente. */
  clienteCriado?: boolean;
  itens: { codprod: string; descr: string; qtd: number; motivo: string; prunit: number }[];
}

/**
 * Itens a devolver de uma entrada: diferença entre a nota e o que chegou bom, nos itens
 * conferidos como FALTA, DANIFICADO ou ERRADO ("Qtd Recebida" = peças boas).
 */
export async function itensParaDevolver(db: Executor, codent: string): Promise<ItemDevolver[]> {
  const { rows } = await db.query(
    `SELECT ie.codprod, ie.codreq, eir.status_item AS motivo,
            GREATEST(ie.quant - LEAST(COALESCE(eir.qtd_recebida, ie.quant), ie.quant), 0) AS qtd
       FROM dbitent ie
       JOIN entrada_itens_recebimento eir
         ON eir.codent = ie.codent AND eir.produto_cod = ie.codprod
        AND COALESCE(eir.codreq,'') = COALESCE(ie.codreq,'')
      WHERE ie.codent = $1 AND eir.status_item = ANY($2)
      ORDER BY ie.codprod, ie.codreq`,
    [codent, MOTIVOS_DEVOLUCAO]);
  return rows
    .map((r: any) => ({ codprod: r.codprod, codreq: r.codreq, qtd: Number(r.qtd), motivo: r.motivo }))
    .filter((r: ItemDevolver) => r.qtd > 0);
}

/** dev_id do web: 9 + AAAAMM + sequência de 4 dígitos (o Delphi usa 1AAAAMM…; não colide). */
export async function proximoDevId(db: Executor): Promise<string> {
  await db.query(`SELECT pg_advisory_xact_lock(hashtext('fat_devolucao_dev_id'))`);
  const { rows } = await db.query(
    `SELECT COALESCE(MAX(dev_id), (('9' || to_char(now(),'YYYYMM'))::bigint * 10000)) + 1 AS n
       FROM fat_devolucao
      WHERE dev_id BETWEEN ('9' || to_char(now(),'YYYYMM'))::bigint * 10000
                       AND ('9' || to_char(now(),'YYYYMM'))::bigint * 10000 + 9999`);
  return String(rows[0].n);
}

/**
 * Cliente que representa o fornecedor (o pré-pedido e a NF de devolução saem para ele).
 * Vínculo em cad_cliente_credor (Delphi: INC_CAD_CLIENTE_CREDOR); sem vínculo, procura o
 * cliente pelo CNPJ do fornecedor e grava o vínculo.
 */
export async function clienteDoFornecedor(db: Executor, codCredor: string | null): Promise<string | null> {
  if (!codCredor) return null;
  const vinc = await db.query(
    `SELECT clc_codcli FROM cad_cliente_credor c
      WHERE clc_codcredor = $1 AND EXISTS (SELECT 1 FROM dbclien x WHERE x.codcli = c.clc_codcli)
      ORDER BY clc_codcli DESC LIMIT 1`, [codCredor]);
  if (vinc.rows[0]) return vinc.rows[0].clc_codcli;
  const porCnpj = await db.query(
    `SELECT c.codcli FROM dbcredor f
       JOIN dbclien c ON regexp_replace(COALESCE(c.cpfcgc,''),'\\D','','g') = regexp_replace(f.cpf_cgc,'\\D','','g')
      WHERE f.cod_credor = $1 AND COALESCE(regexp_replace(f.cpf_cgc,'\\D','','g'),'') <> ''
      ORDER BY c.codcli DESC LIMIT 1`, [codCredor]);
  const codcli = porCnpj.rows[0]?.codcli ?? null;
  if (codcli) {
    await db.query(`INSERT INTO cad_cliente_credor (clc_codcli, clc_codcredor) VALUES ($1, $2)`, [codcli, codCredor]);
  }
  return codcli;
}

/**
 * Cadastra o fornecedor como CLIENTE, para a devolução (pré-pedido e NF) poder sair para ele.
 * Usado quando a alocação acha divergência e o fornecedor não tem cliente (nem por vínculo nem
 * por CNPJ). Dados: o emitente do XML da NF (nome, endereço, IE — validados pela SEFAZ) e o
 * cadastro do fornecedor (o que faltar no XML, como o código do município). Campos de crédito
 * ficam fechados (sem limite, status '2'); quem vende para ele completa o cadastro depois.
 * Código: mesma regra do cadastro de clientes do web (maior código + 1). Grava o vínculo
 * cad_cliente_credor. Retorna null se o fornecedor não tiver CNPJ/CPF.
 */
export async function criarClienteDoFornecedor(
  db: Executor,
  codCredor: string,
  codnfeEnt?: string | null,
): Promise<string | null> {
  const f = (await db.query(`SELECT * FROM dbcredor WHERE cod_credor = $1`, [codCredor])).rows[0];
  if (!f) return null;
  const x = codnfeEnt
    ? (await db.query(`SELECT * FROM dbnfe_ent_emit WHERE codnfe_ent = $1 LIMIT 1`, [codnfeEnt])).rows[0] ?? {}
    : {};
  const dig = (v: any) => String(v ?? '').replace(/\D/g, '');
  const doc = dig(x.cpf_cnpj) || dig(f.cpf_cgc);
  if (doc.length !== 14 && doc.length !== 11) return null;
  const t = (v: any, n: number) => {
    const s = String(v ?? '').trim();
    return s ? s.toUpperCase().slice(0, n) : null;
  };
  const mun7 = (v: any) => (/^\d{7}$/.test(dig(v)) ? dig(v) : null);
  const ie = String(x.ie ?? f.iest ?? '').trim();

  await db.query(`SELECT pg_advisory_xact_lock(hashtext('dbclien_codcli'))`);
  const codcli = String(Number((await db.query(
    `SELECT COALESCE(MAX(codcli::bigint), 0) AS m FROM dbclien
      WHERE codcli ~ '^[0-9]+$' AND codcli <> '99999'`,
  )).rows[0].m) + 1);

  await db.query(
    `INSERT INTO dbclien
       (codcli, nome, nomefant, cpfcgc, tipo, datacad, ender, numero, complemento, bairro, cidade, uf,
        cep, iest, imun, isuframa, codmunicipio, codpais, tipoemp, codvend, status, claspgto,
        debito, limite, atraso, kickback, acrescimo, desconto, habilitasuframa, icms, ipi, obs)
     VALUES ($1,$2,$3,$4,$5,CURRENT_DATE,$6,$7,$8,$9,$10,$11,
             $12,$13,$14,$15,$16,1058,$17,$18,'2','A',
             0,0,0,0,0,0,'N','N','N',$19)`,
    [
      codcli,
      t(x.xnome || f.nome, 40),
      t(x.xfant || f.nome_fant || x.xnome || f.nome, 30),
      doc,
      doc.length === 14 ? 'J' : 'F',
      t(x.xlgr || f.endereco, 100),
      t(x.nro || f.numero, 60) ?? 'S/N',
      t(x.xcpl || f.complemento, 100),
      t(x.xbairro || f.bairro, 100),
      t(x.xmun || f.cidade, 100),
      t(x.uf || f.uf, 2),
      dig(x.cep || f.cep).slice(0, 9) || null,
      ie ? ie.toUpperCase().slice(0, 20) : null,
      t(f.imun, 20),
      t(f.isuframa, 20),
      mun7(x.cmun) ?? mun7(f.codmunicipio),
      t(f.tipoemp, 5),
      VENDEDOR_DEVOLUCAO,
      `CADASTRO AUTOMATICO: FORNECEDOR ${codCredor} (DEVOLUCAO DE COMPRA)`,
    ],
  );
  await db.query(`INSERT INTO cad_cliente_credor (clc_codcli, clc_codcredor) VALUES ($1, $2)`, [codcli, codCredor]);
  return codcli;
}

/**
 * Inicia a devolução dos itens de uma entrada (chamar dentro da transação da alocação, DEPOIS
 * de liberar a reserva do que chegou bom). Move a parte devolvida para o armazém 1004,
 * grava o romaneio dela, a devolução aberta e o pré-pedido.
 */
export async function iniciarDevolucaoEntrada(
  db: Executor,
  codent: string,
  itens: ItemDevolver[],
  opts: { matricula: string; devolucaoRecebId?: number | null },
): Promise<ResultadoDevolucao | null> {
  if (!itens.length) return null;

  const ent = (await db.query(
    `SELECT e.codent, e.cod_credor, ne.codnfe_ent, ne.nnf
       FROM dbent e LEFT JOIN dbnfe_ent ne ON ne.chave = e.chave
      WHERE e.codent = $1`, [codent])).rows[0];
  if (!ent) throw new Error(`Entrada ${codent} não encontrada`);

  // 1) Estoque: a parte devolvida vai, reservada, para o armazém virtual.
  for (const it of itens) {
    const reservadaProduto = Number((await db.query(
      `SELECT COALESCE(qtdreservada,0) r FROM dbprod WHERE codprod = $1 FOR UPDATE`, [it.codprod])).rows[0]?.r ?? 0);
    const semReserva = await posicionarReserva(db, it.codprod, ARMAZEM_DEVOLUCAO, it.qtd);
    // entrada gerada antes do modelo por armazém: reservada só no produto
    const faltaNoArmazem = Math.min(semReserva, reservadaProduto);
    if (faltaNoArmazem > 0) await creditarReservado(db, it.codprod, ARMAZEM_DEVOLUCAO, faltaNoArmazem);
    await db.query(
      `INSERT INTO dbitent_armazem (codent, codprod, codreq, arm_id, qtd) VALUES ($1, $2, $3, $4, $5)`,
      [codent, it.codprod, it.codreq, ARMAZEM_DEVOLUCAO, it.qtd]);
  }

  // 2) Dados dos itens (preço da NF de entrada, descrição)
  const det = (await db.query(
    `SELECT ie.codprod, ie.codreq, ie.quantnf, ie.quant, COALESCE(ie.prunitnf, ie.prunit, 0) AS prunit,
            p.descr, p.ref, COALESCE(p.prcompra,0) prcompra, COALESCE(p.prmedio,0) prmedio
       FROM dbitent ie JOIN dbprod p ON p.codprod = ie.codprod
      WHERE ie.codent = $1`, [codent])).rows;
  const chave = (c: string, r: string | null) => `${c}|${r ?? ''}`;
  const porItem = new Map<string, any>(det.map((d: any) => [chave(d.codprod, d.codreq), d]));

  const devId = await proximoDevId(db);
  // Fornecedor sem cliente: cadastra automaticamente (dados do XML + cadastro do fornecedor).
  let codcli = await clienteDoFornecedor(db, ent.cod_credor);
  let clienteCriado = false;
  if (!codcli && ent.cod_credor) {
    codcli = await criarClienteDoFornecedor(db, ent.cod_credor, ent.codnfe_ent ?? null);
    clienteCriado = !!codcli;
  }
  const totalNota = det.reduce((s: number, d: any) => s + Number(d.quant), 0);
  const totalDev = itens.reduce((s, i) => s + i.qtd, 0);
  const nf = ent.nnf ? String(Number(ent.nnf)) : codent;
  const obs = `DEV ${totalDev >= totalNota ? 'TOTAL' : 'PARCIAL'} REF NF ${nf}`;
  const totalProd = itens.reduce((s, i) => s + i.qtd * Number(porItem.get(chave(i.codprod, i.codreq))?.prunit ?? 0), 0);

  // 3) Devolução aberta (FATURAMENTOS.INC_DEVOLUCAO_DOCUMENTO)
  await db.query(
    `INSERT INTO fat_devolucao
       (dev_id, dev_data, dev_program, dev_tipodoc, dev_coddoc, dev_coddest, dev_cancel, dev_obs,
        dev_codnfe_ent, dev_destino, dev_status, dev_totalprod, dev_origem, dev_matricula,
        dev_nomeusr, dev_devolucao_receb_id)
     VALUES ($1, now(), 'WEB ALOCACAO', 'ENTRADA', $2, $3, 'N', $4,
             $5, 'FORNECEDOR', 'A', $6, 'WEB', $7, $8, $9)`,
    [devId, codent, codcli, obs, ent.codnfe_ent ?? null, Number(totalProd.toFixed(2)),
     opts.matricula, String(opts.matricula).slice(0, 20), opts.devolucaoRecebId ?? null]);

  // 4) Pré-pedido para o fornecedor (VENDAS.SALVAR_VENDA no Delphi): segura a reserva e
  //    será faturado como NF de devolução. Uma linha por produto (PK de dbitvenda).
  let codvenda: string | null = null;
  let nrovenda: string | null = null;
  if (codcli) {
    ({ codvenda, nrovenda } = await criarPrePedido(db, codcli, obs, itens, porItem, chave));
    await db.query(
      `INSERT INTO fat_devolucao_registro (der_dev_id, der_documento, der_codigo) VALUES ($1, 'VENDA', $2)`,
      [devId, codvenda]);
  }

  // 5) Itens (FATURAMENTOS.INC_DEVOLUCAO_ITENS)
  let seq = 0;
  const saida: ResultadoDevolucao['itens'] = [];
  for (const it of itens) {
    const d = porItem.get(chave(it.codprod, it.codreq)) || {};
    const original = Number(d.quantnf ?? d.quant ?? it.qtd) || it.qtd;
    seq += 1;
    await db.query(
      `INSERT INTO fat_it_devolucao
         (itd_dev_id, itd_id, itd_codreq, itd_codprod, itd_arm_id, itd_quant_original,
          itd_quant_disponivel, itd_quant_devolvida, itd_percentual, itd_totalipi,
          itd_codvenda2, itd_motivo, itd_prunit)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, 0, $9, $10, $11)`,
      [devId, String(seq).padStart(3, '0'), it.codreq, it.codprod, ARMAZEM_DEVOLUCAO, original,
       it.qtd, Number(((it.qtd / original) * 100).toFixed(2)), codvenda, it.motivo, Number(d.prunit ?? 0)]);
    saida.push({ codprod: it.codprod, descr: d.descr ?? '', qtd: it.qtd, motivo: it.motivo, prunit: Number(d.prunit ?? 0) });
  }

  // 6) Registro do recebimento acompanha
  if (opts.devolucaoRecebId) {
    await db.query(
      `UPDATE devolucoes SET status = 'AGUARDANDO_EMISSAO', observacao = COALESCE(observacao || ' | ', '') || $2,
              updated_at = now() WHERE id = $1`,
      [opts.devolucaoRecebId, `Devolução ${devId}${codvenda ? ` · pré-pedido ${nrovenda}` : ''}`]);
  }

  return { devId, codvenda, nrovenda, codcli, semCliente: !codcli, clienteCriado, itens: saida };
}

export async function criarPrePedido(
  db: Executor,
  codcli: string,
  obs: string,
  itens: ItemDevolver[],
  porItem: Map<string, any>,
  chave: (c: string, r: string | null) => string,
): Promise<{ codvenda: string; nrovenda: string }> {
  await db.query(`SELECT pg_advisory_xact_lock(hashtext('dbvenda_codvenda'))`);
  const ids = (await db.query(
    `SELECT LPAD((COALESCE(MAX(NULLIF(regexp_replace(codvenda,'\\D','','g'),'')::bigint),0)+1)::text, 9, '0') AS codvenda,
            (SELECT LPAD((COALESCE(MAX(NULLIF(regexp_replace(nrovenda,'\\D','','g'),'')::bigint),0)+1)::text, 9, '0')
               FROM dbvenda WHERE tipo = 'P') AS nrovenda
       FROM dbvenda`)).rows[0];

  // agrupa por produto (o mesmo produto pode vir de pedidos diferentes)
  // dbitvenda tem uma linha por produto: o produto sai de um único armazém
  const porProd = new Map<string, { qtd: number; valor: number; d: any; arm: number }>();
  for (const it of itens) {
    const d = porItem.get(chave(it.codprod, it.codreq)) || {};
    const arm = it.armId ?? ARMAZEM_DEVOLUCAO;
    const ac = porProd.get(it.codprod) || { qtd: 0, valor: 0, d, arm };
    if (ac.arm !== arm) {
      throw new Error(`Produto ${it.codprod}: devolva de um armazém por vez (uma devolução por armazém).`);
    }
    ac.qtd += it.qtd;
    ac.valor += it.qtd * Number(d.prunit ?? 0);
    porProd.set(it.codprod, ac);
  }
  const total = [...porProd.values()].reduce((s, p) => s + p.valor, 0);

  await db.query(
    `INSERT INTO dbvenda
       (operacao, codvenda, codusr, codvend, nrovenda, codcli, data, total, pedido, status, transp, obs,
        tipo_desc, tipo, tele, cancel, statusest, impresso, vlrfrete, codtptransp, bloqueada,
        estoque_virtual, numeroserie, statuspedido, dtupdate)
     VALUES (1, $1, NULL, $2, $3, $4, now(), $5, NULL, $6, 'CLIENTE RETIRA', $7,
             '1', 'P', 'N', 'N', 'N', 'N', 0, '001', '0',
             'N', 'SO PRENOTA TEM NUMERO DE SERIE', NULL, now())`,
    [ids.codvenda, VENDEDOR_DEVOLUCAO, ids.nrovenda, codcli, Number(total.toFixed(2)),
     STATUS_PREPEDIDO_DEVOLUCAO, obs]);

  for (const [codprod, p] of porProd) {
    await db.query(
      `INSERT INTO dbitvenda
         (codprod, codvenda, qtd, prunit, demanda, descr, comissao, codvend, prcompra, prmedio,
          comissaovend, comissao_operador, desconto, arm_id, ref)
       VALUES ($1, $2, $3, $4, 'N', $5, 0, $6, $7, $8, 0, 0, 0, $9, $10)`,
      [codprod, ids.codvenda, p.qtd, Number((p.qtd ? p.valor / p.qtd : 0).toFixed(2)),
       String(p.d.descr ?? '').slice(0, 60), VENDEDOR_DEVOLUCAO, Number(p.d.prcompra ?? 0),
       Number(p.d.prmedio ?? 0), p.arm, p.d.ref ?? null]);
  }
  return { codvenda: ids.codvenda, nrovenda: ids.nrovenda };
}

/**
 * Gera o pré-pedido de uma devolução aberta que nasceu sem cliente (fornecedor sem cadastro
 * de cliente na hora da alocação). Usa o vínculo/CNPJ de novo ou o cliente informado.
 */
export async function gerarPrePedidoDevolucao(
  db: Executor, devId: string, codcliInformado?: string | null,
): Promise<{ codvenda: string; nrovenda: string; codcli: string }> {
  const dev = (await db.query(
    `SELECT d.*, e.cod_credor FROM fat_devolucao d JOIN dbent e ON e.codent = d.dev_coddoc
      WHERE d.dev_id = $1 AND d.dev_tipodoc = 'ENTRADA' FOR UPDATE OF d`, [devId])).rows[0];
  if (!dev) throw new Error('Devolução não encontrada');
  if (dev.dev_cancel === 'S' || dev.dev_status !== 'A') throw new Error('Devolução não está aberta');
  const jaTem = (await db.query(
    `SELECT der_codigo FROM fat_devolucao_registro WHERE der_dev_id = $1 AND der_documento = 'VENDA'`, [devId])).rows[0];
  if (jaTem) throw new Error('Esta devolução já tem pré-pedido');

  let codcli = codcliInformado || null;
  if (codcli) {
    const ok = (await db.query(`SELECT 1 FROM dbclien WHERE codcli = $1`, [codcli])).rows[0];
    if (!ok) throw new Error(`Cliente ${codcli} não encontrado`);
    if (dev.cod_credor) {
      await db.query(
        `INSERT INTO cad_cliente_credor (clc_codcli, clc_codcredor)
         SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM cad_cliente_credor WHERE clc_codcli = $1 AND clc_codcredor = $2)`,
        [codcli, dev.cod_credor]);
    }
  } else {
    codcli = await clienteDoFornecedor(db, dev.cod_credor);
  }
  if (!codcli) throw new Error('Fornecedor sem cadastro de cliente: informe o cliente da devolução');

  const its = (await db.query(
    `SELECT itd_codprod AS codprod, itd_codreq AS codreq, itd_quant_devolvida AS qtd, itd_motivo AS motivo,
            COALESCE(itd_prunit,0) prunit
       FROM fat_it_devolucao WHERE itd_dev_id = $1`, [devId])).rows;
  const det = (await db.query(
    `SELECT codprod, descr, ref, COALESCE(prcompra,0) prcompra, COALESCE(prmedio,0) prmedio
       FROM dbprod WHERE codprod = ANY($1)`, [its.map((i: any) => i.codprod)])).rows;
  const prod = new Map<string, any>(det.map((d: any) => [d.codprod, d]));
  const chave = (c: string, r: string | null) => `${c}|${r ?? ''}`;
  const porItem = new Map<string, any>(its.map((i: any) => [chave(i.codprod, i.codreq), { ...prod.get(i.codprod), prunit: i.prunit }]));
  const itens: ItemDevolver[] = its.map((i: any) => ({ codprod: i.codprod, codreq: i.codreq, qtd: Number(i.qtd), motivo: i.motivo }));

  const { codvenda, nrovenda } = await criarPrePedido(db, codcli, dev.dev_obs ?? '', itens, porItem, chave);
  await db.query(`UPDATE fat_devolucao SET dev_coddest = $2 WHERE dev_id = $1`, [devId, codcli]);
  await db.query(`UPDATE fat_it_devolucao SET itd_codvenda2 = $2 WHERE itd_dev_id = $1`, [devId, codvenda]);
  await db.query(
    `INSERT INTO fat_devolucao_registro (der_dev_id, der_documento, der_codigo) VALUES ($1, 'VENDA', $2)`,
    [devId, codvenda]);
  return { codvenda, nrovenda, codcli };
}

/**
 * Cancela uma devolução aberta (o fornecedor completou a entrega / item aceito): a quantidade
 * volta do armazém 1004 para o GERAL e fica disponível para venda; o pré-pedido é cancelado.
 * Devolução manual (item reservado no armazém de origem): só libera a reserva.
 */
export async function cancelarDevolucaoEntrada(db: Executor, devId: string, usuario: string): Promise<void> {
  const dev = (await db.query(
    `SELECT * FROM fat_devolucao WHERE dev_id = $1 AND dev_tipodoc = 'ENTRADA' FOR UPDATE`, [devId])).rows[0];
  if (!dev) throw new Error('Devolução não encontrada');
  if (dev.dev_cancel === 'S') throw new Error('Devolução já cancelada');
  if (dev.dev_status !== 'A' || dev.dev_codfat) throw new Error('Só devolução aberta (sem NF emitida) pode ser cancelada');
  if (dev.dev_origem !== 'WEB') throw new Error('Devolução do Delphi: cancele pelo Delphi');

  const its = (await db.query(
    `SELECT itd_codprod codprod, itd_codreq codreq, COALESCE(itd_arm_id, $2) arm_id, itd_quant_devolvida qtd
       FROM fat_it_devolucao WHERE itd_dev_id = $1`, [devId, ARMAZEM_DEVOLUCAO])).rows;
  for (const it of its) {
    const q = Number(it.qtd);
    if (!(q > 0)) continue;
    const arm = Number(it.arm_id);
    if (arm !== ARMAZEM_DEVOLUCAO) {
      // devolução manual: o item continua no armazém de origem; só a reserva acaba
      await db.query(
        `UPDATE cad_armazem_produto SET arp_qtest_reservada = GREATEST(COALESCE(arp_qtest_reservada,0) - $1, 0)
          WHERE arp_arm_id = $2 AND arp_codprod = $3`, [q, arm, it.codprod]);
      await db.query(
        `UPDATE dbprod SET qtdreservada = GREATEST(COALESCE(qtdreservada,0) - $1, 0) WHERE codprod = $2`, [q, it.codprod]);
      continue;
    }
    // sai do virtual (saldo e reserva) e entra livre no GERAL; a reserva do produto acaba
    await db.query(
      `UPDATE cad_armazem_produto
          SET arp_qtest = GREATEST(COALESCE(arp_qtest,0) - $1, 0),
              arp_qtest_reservada = GREATEST(COALESCE(arp_qtest_reservada,0) - $1, 0)
        WHERE arp_arm_id = $2 AND arp_codprod = $3`, [q, arm, it.codprod]);
    await creditarReservado(db, it.codprod, ARMAZEM_GERAL, q);
    await db.query(
      `UPDATE cad_armazem_produto SET arp_qtest_reservada = GREATEST(COALESCE(arp_qtest_reservada,0) - $1, 0)
        WHERE arp_arm_id = $2 AND arp_codprod = $3`, [q, ARMAZEM_GERAL, it.codprod]);
    await db.query(
      `UPDATE dbprod SET qtdreservada = GREATEST(COALESCE(qtdreservada,0) - $1, 0) WHERE codprod = $2`, [q, it.codprod]);
    // romaneio da entrada: a quantidade passa do virtual para o GERAL
    await db.query(
      `DELETE FROM dbitent_armazem WHERE codent = $1 AND codprod = $2 AND COALESCE(codreq,'') = COALESCE($3,'') AND arm_id = $4`,
      [dev.dev_coddoc, it.codprod, it.codreq, arm]);
    const upd = await db.query(
      `UPDATE dbitent_armazem SET qtd = qtd + $4
        WHERE codent = $1 AND codprod = $2 AND COALESCE(codreq,'') = COALESCE($3,'') AND arm_id = $5`,
      [dev.dev_coddoc, it.codprod, it.codreq, q, ARMAZEM_GERAL]);
    if (!upd.rowCount) {
      await db.query(
        `INSERT INTO dbitent_armazem (codent, codprod, codreq, arm_id, qtd) VALUES ($1, $2, $3, $4, $5)`,
        [dev.dev_coddoc, it.codprod, it.codreq, ARMAZEM_GERAL, q]);
    }
  }

  const venda = (await db.query(
    `SELECT der_codigo FROM fat_devolucao_registro WHERE der_dev_id = $1 AND der_documento = 'VENDA'`, [devId])).rows;
  for (const v of venda) {
    await db.query(
      `UPDATE dbvenda SET status = 'C', cancel = 'S', dtupdate = now() WHERE codvenda = $1 AND status = $2`,
      [v.der_codigo, STATUS_PREPEDIDO_DEVOLUCAO]);
  }
  await db.query(
    `UPDATE fat_devolucao SET dev_cancel = 'S', dev_nomeusr_cancel = $2, dev_dt_cancel = now() WHERE dev_id = $1`,
    [devId, String(usuario || '').slice(0, 20)]);
  if (dev.dev_devolucao_receb_id) {
    await db.query(`UPDATE devolucoes SET status = 'CANCELADA', updated_at = now() WHERE id = $1`, [dev.dev_devolucao_receb_id]);
  }
}

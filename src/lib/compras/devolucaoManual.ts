/**
 * Devolução de compra MANUAL — a "Nova devolução" da tela Faturamento › Devolução
 * (porte do ramo ENTRADA da tela UniDevolFat do Delphi: FATURAMENTOS.NAV_DEVOLUCAO_DOCUMENTO,
 * NAV_DEVOLUCAO_ITENS, NAV_DEVOLUCAO_DESTINATARIO, INC_CAD_CLIENTE_CREDOR,
 * INC_DEVOLUCAO_DOCUMENTO/ITENS e a 1ª chamada do PROCESSO_DEVOLUCAO).
 *
 * Diferente da devolução que nasce na alocação (devolucaoEntrada.ts), aqui o produto já está
 * na prateleira: como no Delphi, ele fica RESERVADO NO PRÓPRIO ARMAZÉM (sem armazém virtual)
 * pelo pré-pedido do fornecedor. A NF sai pela mesma emissão (faturarDevolucao.ts), que baixa
 * o estoque do armazém gravado em cada item do pré-pedido.
 *
 * Regras do Delphi:
 *  - só entrada finalizada (status 'F') e alocada (est_alocado = 1);
 *  - itens por armazém do romaneio (dbitent_armazem). Entrada sem romaneio (migradas do
 *    Oracle): armazém GERAL com a quantidade da entrada, como o ramo QUANT_FILIAL do Delphi;
 *  - disponível = menor entre (alocado no armazém − já devolvido em devoluções abertas ou
 *    faturadas, não canceladas) e o estoque livre do armazém;
 *  - (web) item que já está numa devolução pendente da mesma nota (aguardando emissão ou NF não
 *    autorizada) não entra em outra — evita devolução em duplicidade;
 *  - destinatário = cliente ligado ao fornecedor, com o mesmo CNPJ/CPF e IE do fornecedor
 *    (exceto importação, CFOP 3xxx). Sem cliente: cadastro automático (criarClienteDoFornecedor).
 */
import { ARMAZEM_GERAL } from './estoqueEntrada';
import {
  ARMAZEM_DEVOLUCAO,
  MOTIVOS_DEVOLUCAO_MANUAL,
  ResultadoDevolucao,
  clienteDoFornecedor,
  criarClienteDoFornecedor,
  criarPrePedido,
  proximoDevId,
} from './devolucaoEntrada';

type Executor = { query: (sql: string, params?: any[]) => Promise<any> };

const dig = (v: any) => String(v ?? '').replace(/\D/g, '');
const num = (v: any) => (v == null || v === '' ? 0 : Number(v) || 0);

export type FiltroEntrada = 'CODIGO' | 'NF' | 'CHAVE';

export interface EntradaDevolucao {
  codent: string;
  nroform: string;
  serie: string;
  dtent: string;
  totalnf: number;
  totalprod: number;
  cfop: string;
  chave: string;
  codCredor: string;
  fornecedor: string;
  cpfcgc: string;
  iest: string;
  uf: string;
  /** Motivo que impede devolver (null = pode). */
  bloqueio: string | null;
}

/** NAV_DEVOLUCAO_DOCUMENTO (ENTRADA): busca por código da entrada, nº da NF ou chave. */
export async function buscarEntradasParaDevolucao(
  db: Executor, filtro: FiltroEntrada, valor: string,
): Promise<EntradaDevolucao[]> {
  const v = dig(valor);
  if (!v) return [];
  let cond: string;
  let param: string;
  if (filtro === 'CODIGO') { cond = `e.codent = $1`; param = v.padStart(9, '0'); }
  else if (filtro === 'NF') { cond = `NULLIF(regexp_replace(e.nroform,'\\D','','g'),'')::bigint = $1::bigint`; param = v; }
  else { cond = `right(regexp_replace(COALESCE(e.chave,''),'\\D','','g'), 44) = $1`; param = v.slice(-44); }
  const { rows } = await db.query(
    `SELECT e.codent, e.nroform, e.serie, e.dtent, e.totalnf, e.totalprod, e.cfop, e.chave, e.status,
            e.est_alocado, f.cod_credor, f.nome, f.cpf_cgc, f.iest, f.uf
       FROM dbent e
       LEFT JOIN dbcredor f ON f.cod_credor = e.cod_credor
      WHERE ${cond}
      ORDER BY e.dtent DESC
      LIMIT 50`,
    [param]);
  return rows.map((r: any) => ({
    codent: r.codent,
    nroform: String(r.nroform ?? '').replace(/^0+/, ''),
    serie: String(r.serie ?? ''),
    dtent: r.dtent,
    totalnf: num(r.totalnf),
    totalprod: num(r.totalprod),
    cfop: String(r.cfop ?? ''),
    chave: dig(r.chave).slice(-44),
    codCredor: r.cod_credor ?? '',
    fornecedor: r.nome ?? '',
    cpfcgc: dig(r.cpf_cgc),
    iest: String(r.iest ?? ''),
    uf: String(r.uf ?? '').toUpperCase(),
    bloqueio: r.status === 'C' ? 'Entrada cancelada.'
      : r.status !== 'F' ? 'Entrada não finalizada.'
      : Number(r.est_alocado) !== 1 ? 'Entrada ainda não alocada: a falta ou avaria é tratada na alocação.'
      : !r.cod_credor ? 'Entrada sem fornecedor.'
      : null,
  }));
}

export interface ItemDisponivel {
  codprod: string;
  codreq: string | null;
  armId: number;
  armazem: string;
  ref: string;
  descr: string;
  unidade: string;
  localizacao: string;
  prunit: number;
  qtdOriginal: number;
  qtdAlocada: number;
  qtdDevolvida: number;
  estoqueLivre: number;
  qtdDisponivel: number;
  /** Devolução(ões) pendente(s) da mesma nota com este item (aguardando emissão ou NF pendente). */
  pendenteEm: string | null;
}

/** NAV_DEVOLUCAO_ITENS (ENTRADA). Só leitura. */
export async function itensDisponiveisDevolucao(db: Executor, codent: string): Promise<ItemDisponivel[]> {
  const { rows } = await db.query(
    `WITH rom AS (
       SELECT a.codprod, a.codreq, a.arm_id::int AS arm_id, SUM(a.qtd) AS qtd
         FROM dbitent_armazem a
        WHERE a.codent = $1 AND a.arm_id <> $2 AND a.qtd > 0
        GROUP BY 1, 2, 3
     ), base AS (
       SELECT ie.codprod, ie.codreq, COALESCE(r.arm_id, $3) AS arm_id,
              COALESCE(r.qtd, ie.quant, ie.quantnf, 0) AS alocado,
              COALESCE(ie.quantnf, ie.quant, 0) AS original,
              COALESCE(ie.prunitnf, ie.prunit, 0) AS prunit
         FROM dbitent ie
         LEFT JOIN rom r ON r.codprod = ie.codprod AND COALESCE(r.codreq,'') = COALESCE(ie.codreq,'')
        WHERE ie.codent = $1
          AND (r.codprod IS NOT NULL OR NOT EXISTS (SELECT 1 FROM rom))
     )
     SELECT b.codprod, b.codreq, b.arm_id, b.alocado, b.original, b.prunit,
            p.ref, p.descr, p.unimed, ca.arm_descricao,
            COALESCE(ap.arp_qtest, 0) - COALESCE(ap.arp_qtest_reservada, 0) AS livre,
            COALESCE((
              SELECT SUM(i.itd_quant_devolvida)
                FROM fat_it_devolucao i
                JOIN fat_devolucao d ON d.dev_id = i.itd_dev_id
               WHERE d.dev_tipodoc = 'ENTRADA' AND d.dev_coddoc = $1
                 AND COALESCE(d.dev_cancel,'N') = 'N' AND d.dev_status IN ('A','F')
                 AND i.itd_codprod = b.codprod AND COALESCE(i.itd_codreq,'') = COALESCE(b.codreq,'')
                 AND COALESCE(i.itd_arm_id, $3) = b.arm_id), 0) AS devolvido,
            (SELECT string_agg(DISTINCT d.dev_id::text, ', ')
               FROM fat_it_devolucao i
               JOIN fat_devolucao d ON d.dev_id = i.itd_dev_id
              WHERE d.dev_tipodoc = 'ENTRADA' AND d.dev_coddoc = $1 AND COALESCE(d.dev_cancel,'N') = 'N'
                AND i.itd_codprod = b.codprod AND COALESCE(i.itd_codreq,'') = COALESCE(b.codreq,'')
                AND COALESCE(i.itd_quant_devolvida,0) > 0
                AND (d.dev_status = 'A'
                     OR (d.dev_origem = 'WEB' AND d.dev_status = 'F' AND d.dev_codfat IS NOT NULL
                         AND NOT EXISTS (SELECT 1 FROM dbfat_nfe n WHERE n.codfat = d.dev_codfat AND n.status = '100')))
            ) AS pendente_em,
            (SELECT string_agg(DISTINCT trim(l.apl_descricao), ' / ')
               FROM cad_armazem_produto_locacao l
              WHERE l.apl_codprod = b.codprod AND l.apl_arm_id = b.arm_id
                AND trim(COALESCE(l.apl_descricao,'')) <> '') AS localizacao
       FROM base b
       JOIN dbprod p ON p.codprod = b.codprod
       LEFT JOIN cad_armazem ca ON ca.arm_id = b.arm_id
       LEFT JOIN cad_armazem_produto ap ON ap.arp_codprod = b.codprod AND ap.arp_arm_id = b.arm_id
      ORDER BY p.ref, b.codprod, b.codreq`,
    [codent, ARMAZEM_DEVOLUCAO, ARMAZEM_GERAL]);
  return rows.map((r: any) => {
    const alocado = num(r.alocado);
    const devolvido = num(r.devolvido);
    const livre = num(r.livre);
    return {
      codprod: r.codprod,
      codreq: r.codreq ?? null,
      armId: Number(r.arm_id),
      armazem: String(r.arm_descricao ?? r.arm_id).trim(),
      ref: String(r.ref ?? '').trim(),
      descr: String(r.descr ?? '').trim(),
      unidade: String(r.unimed ?? 'UN').trim() || 'UN',
      localizacao: r.localizacao ?? '',
      prunit: num(r.prunit),
      qtdOriginal: num(r.original),
      qtdAlocada: alocado,
      qtdDevolvida: devolvido,
      estoqueLivre: livre,
      qtdDisponivel: Math.max(0, Math.min(alocado - devolvido, livre)),
      pendenteEm: r.pendente_em ?? null,
    };
  });
}

export interface Destinatario {
  codcli: string;
  nome: string;
  cpfcgc: string;
  iest: string;
  uf: string;
  codmunicipio: string;
}

async function lerCliente(db: Executor, codcli: string): Promise<Destinatario | null> {
  const c = (await db.query(
    `SELECT codcli, nome, cpfcgc, iest, uf, codmunicipio FROM dbclien WHERE codcli = $1`, [codcli])).rows[0];
  if (!c) return null;
  return {
    codcli: c.codcli, nome: c.nome ?? '', cpfcgc: dig(c.cpfcgc), iest: String(c.iest ?? ''),
    uf: String(c.uf ?? '').toUpperCase(), codmunicipio: String(c.codmunicipio ?? ''),
  };
}

/**
 * NAV_DEVOLUCAO_DESTINATARIO (ENTRADA), só leitura: o cliente ligado ao fornecedor (vínculo
 * ou mesmo CNPJ). `codcli` informado: lê esse cliente.
 */
export async function destinatarioDaEntrada(
  db: Executor, codent: string, codcli?: string | null,
): Promise<{ cliente: Destinatario | null; seraCriado: boolean }> {
  if (codcli) return { cliente: await lerCliente(db, codcli), seraCriado: false };
  const ent = (await db.query(
    `SELECT e.cod_credor, f.cpf_cgc FROM dbent e LEFT JOIN dbcredor f ON f.cod_credor = e.cod_credor WHERE e.codent = $1`,
    [codent])).rows[0];
  if (!ent?.cod_credor) return { cliente: null, seraCriado: false };
  const vinc = (await db.query(
    `SELECT clc_codcli FROM cad_cliente_credor c
      WHERE clc_codcredor = $1 AND EXISTS (SELECT 1 FROM dbclien x WHERE x.codcli = c.clc_codcli)
      ORDER BY clc_codcli DESC LIMIT 1`, [ent.cod_credor])).rows[0]?.clc_codcli;
  const porCnpj = vinc ?? (dig(ent.cpf_cgc)
    ? (await db.query(
        `SELECT codcli FROM dbclien WHERE regexp_replace(COALESCE(cpfcgc,''),'\\D','','g') = $1
          ORDER BY codcli DESC LIMIT 1`, [dig(ent.cpf_cgc)])).rows[0]?.codcli
    : null);
  if (porCnpj) return { cliente: await lerCliente(db, porCnpj), seraCriado: false };
  const doc = dig(ent.cpf_cgc);
  return { cliente: null, seraCriado: doc.length === 11 || doc.length === 14 };
}

/** O Delphi exige o mesmo CPF/CNPJ e IE do fornecedor, salvo importação (CFOP 3xxx). */
export function conferirDestinatario(
  fornecedor: { cpfcgc: string; iest: string }, cliente: Destinatario, cfopEntrada: string,
): string | null {
  if (String(cfopEntrada ?? '').startsWith('3')) return null;
  const ie = (v: string) => {
    const d = dig(v);
    return d || 'ISENTO';
  };
  if (dig(fornecedor.cpfcgc) !== dig(cliente.cpfcgc) || ie(fornecedor.iest) !== ie(cliente.iest)) {
    return `O cliente ${cliente.codcli} não corresponde ao fornecedor da nota (verifique CPF/CNPJ e inscrição estadual).`;
  }
  return null;
}

export interface ItemManual {
  codprod: string;
  codreq: string | null;
  armId: number;
  qtd: number;
  motivo: string;
}

export interface NovaDevolucaoManual {
  codent: string;
  itens: ItemManual[];
  codcli?: string | null;
  pedido?: string | null;
  obs?: string | null;
  matricula: string;
  nomeusr?: string | null;
  codusr?: string | null;
}

/**
 * Grava a devolução manual (chamar dentro de uma transação): vínculo fornecedor→cliente,
 * reserva no armazém de origem, devolução aberta, pré-pedido e itens.
 */
export async function criarDevolucaoManual(db: Executor, input: NovaDevolucaoManual): Promise<ResultadoDevolucao> {
  const codent = dig(input.codent).padStart(9, '0');
  await db.query(`SELECT pg_advisory_xact_lock(hashtext('devolucao_entrada_' || $1))`, [codent]);
  const ent = (await db.query(
    `SELECT e.codent, e.status, e.est_alocado, e.cfop, e.nroform, e.cod_credor, e.chave,
            f.cpf_cgc, f.iest, ne.codnfe_ent
       FROM dbent e
       LEFT JOIN dbcredor f ON f.cod_credor = e.cod_credor
       LEFT JOIN LATERAL (SELECT codnfe_ent FROM dbnfe_ent n WHERE right(n.chave,44) = right(e.chave,44)
                           ORDER BY codnfe_ent DESC LIMIT 1) ne ON true
      WHERE e.codent = $1 FOR UPDATE OF e`, [codent])).rows[0];
  if (!ent) throw new Error(`Entrada ${codent} não encontrada.`);
  if (ent.status !== 'F') throw new Error('Só entrada finalizada pode ser devolvida.');
  if (Number(ent.est_alocado) !== 1) throw new Error('A entrada ainda não foi alocada: a falta ou avaria é tratada na alocação.');
  if (!ent.cod_credor) throw new Error('A entrada não tem fornecedor.');

  // 1) Itens: quantidade válida e dentro do disponível (recalculado aqui, com o lock)
  const pedidos = (input.itens || []).filter((i) => num(i.qtd) > 0);
  if (!pedidos.length) throw new Error('Informe a quantidade a devolver de pelo menos um item.');
  const disp = await itensDisponiveisDevolucao(db, codent);
  const k = (c: string, r: string | null, a: number) => `${c}|${r ?? ''}|${a}`;
  const porChave = new Map(disp.map((d) => [k(d.codprod, d.codreq, d.armId), d]));
  const vistos = new Set<string>();
  for (const it of pedidos) {
    const chave = k(it.codprod, it.codreq ?? null, Number(it.armId));
    const d = porChave.get(chave);
    if (!d) throw new Error(`Item ${it.codprod} não pertence à entrada ${codent} neste armazém.`);
    if (vistos.has(chave)) throw new Error(`Item ${d.ref || it.codprod} repetido.`);
    // Evita devolução em duplicidade: o item não pode estar em outra devolução pendente da nota
    if (d.pendenteEm) {
      throw new Error(`Item ${d.ref || it.codprod} já está na devolução ${d.pendenteEm}, ainda pendente de NF. Emita ou cancele essa devolução antes de devolver o item de novo.`);
    }
    vistos.add(chave);
    if (!Number.isInteger(num(it.qtd))) throw new Error(`Item ${d.ref || it.codprod}: quantidade inválida.`);
    if (num(it.qtd) > d.qtdDisponivel) {
      throw new Error(`Item ${d.ref || it.codprod}: devolver ${it.qtd}, disponível ${d.qtdDisponivel} (respeite o limite da quantidade disponível).`);
    }
    if (!(MOTIVOS_DEVOLUCAO_MANUAL as readonly string[]).includes(it.motivo)) {
      throw new Error(`Item ${d.ref || it.codprod}: informe o motivo.`);
    }
  }

  // 2) Destinatário (INC_CAD_CLIENTE_CREDOR): informado, ligado, pelo CNPJ ou criado agora
  let codcli = input.codcli ? String(input.codcli).trim() : null;
  let clienteCriado = false;
  if (codcli) {
    if (!(await lerCliente(db, codcli))) throw new Error(`Cliente ${codcli} não encontrado.`);
  } else {
    codcli = await clienteDoFornecedor(db, ent.cod_credor);
    if (!codcli) {
      codcli = await criarClienteDoFornecedor(db, ent.cod_credor, ent.codnfe_ent ?? null);
      clienteCriado = !!codcli;
    }
  }
  if (!codcli) throw new Error('O fornecedor não tem CPF/CNPJ válido para o cadastro automático do cliente. Informe o cliente.');
  const cliente = (await lerCliente(db, codcli))!;
  const divergente = conferirDestinatario({ cpfcgc: ent.cpf_cgc, iest: ent.iest }, cliente, ent.cfop);
  if (divergente) throw new Error(divergente);
  await db.query(
    `INSERT INTO cad_cliente_credor (clc_codcli, clc_codcredor)
     SELECT $1::varchar, $2::varchar
      WHERE NOT EXISTS (SELECT 1 FROM cad_cliente_credor WHERE clc_codcli = $1::varchar AND clc_codcredor = $2::varchar)`,
    [codcli, ent.cod_credor]);

  // 3) Reserva no próprio armazém (o pré-pedido do Delphi reserva no armazém do item)
  for (const it of pedidos) {
    const q = num(it.qtd);
    const upd = await db.query(
      `UPDATE cad_armazem_produto SET arp_qtest_reservada = COALESCE(arp_qtest_reservada,0) + $1
        WHERE arp_codprod = $2 AND arp_arm_id = $3
          AND COALESCE(arp_qtest,0) - COALESCE(arp_qtest_reservada,0) >= $1`,
      [q, it.codprod, Number(it.armId)]);
    if (upd.rowCount !== 1) throw new Error(`Estoque insuficiente do produto ${it.codprod} no armazém ${it.armId}.`);
    // a emissão baixa qtest e qtdreservada do produto (faturarDevolucao.ts)
    await db.query(`UPDATE dbprod SET qtdreservada = COALESCE(qtdreservada,0) + $1 WHERE codprod = $2`, [q, it.codprod]);
  }

  // 4) Devolução aberta (INC_DEVOLUCAO_DOCUMENTO)
  const det = (await db.query(
    `SELECT ie.codprod, ie.codreq, COALESCE(ie.quantnf, ie.quant) AS quantnf, COALESCE(ie.prunitnf, ie.prunit, 0) AS prunit,
            p.descr, p.ref, COALESCE(p.prcompra,0) prcompra, COALESCE(p.prmedio,0) prmedio
       FROM dbitent ie JOIN dbprod p ON p.codprod = ie.codprod
      WHERE ie.codent = $1`, [codent])).rows;
  const ch = (c: string, r: string | null) => `${c}|${r ?? ''}`;
  const porItem = new Map<string, any>(det.map((d: any) => [ch(d.codprod, d.codreq), d]));
  const nf = String(ent.nroform ?? '').replace(/^0+/, '') || codent;
  const obs = (String(input.obs ?? '').trim() || `DEV REF NF ${nf}`).toUpperCase().slice(0, 100);
  const totalProd = pedidos.reduce((s, i) => s + num(i.qtd) * num(porItem.get(ch(i.codprod, i.codreq))?.prunit), 0);
  const devId = await proximoDevId(db);
  const usuario = String(input.nomeusr || input.matricula || '').slice(0, 20);
  await db.query(
    `INSERT INTO fat_devolucao
       (dev_id, dev_data, dev_program, dev_tipodoc, dev_coddoc, dev_coddest, dev_cancel, dev_obs, dev_pedido,
        dev_codnfe_ent, dev_destino, dev_status, dev_totalprod, dev_origem, dev_matricula, dev_nomeusr, dev_codusr)
     VALUES ($1, now(), 'WEB MANUAL', 'ENTRADA', $2, $3, 'N', $4, $5,
             $6, 'FORNECEDOR', 'A', $7, 'WEB', $8, $9, $10)`,
    [devId, codent, codcli, obs, input.pedido ? String(input.pedido).trim().slice(0, 30) : null,
     ent.codnfe_ent ?? null, Number(totalProd.toFixed(2)), input.matricula, usuario,
     input.codusr ? String(input.codusr).slice(0, 4) : null]);

  // 5) Pré-pedido para o fornecedor (VENDAS.SALVAR_VENDA), item no armazém de origem
  const itensDev = pedidos.map((i) => ({
    codprod: i.codprod, codreq: i.codreq ?? null, qtd: num(i.qtd), motivo: i.motivo, armId: Number(i.armId),
  }));
  const { codvenda, nrovenda } = await criarPrePedido(db, codcli, obs, itensDev, porItem, ch);
  await db.query(
    `INSERT INTO fat_devolucao_registro (der_dev_id, der_documento, der_codigo) VALUES ($1, 'VENDA', $2)`,
    [devId, codvenda]);

  // 6) Itens (INC_DEVOLUCAO_ITENS)
  let seq = 0;
  const saida: ResultadoDevolucao['itens'] = [];
  for (const it of itensDev) {
    const d = porItem.get(ch(it.codprod, it.codreq)) || {};
    const di = porChave.get(k(it.codprod, it.codreq, it.armId))!;
    const original = num(d.quantnf) || di.qtdOriginal || it.qtd;
    seq += 1;
    await db.query(
      `INSERT INTO fat_it_devolucao
         (itd_dev_id, itd_id, itd_codreq, itd_codprod, itd_arm_id, itd_quant_original,
          itd_quant_disponivel, itd_quant_devolvida, itd_percentual, itd_totalipi,
          itd_codvenda2, itd_motivo, itd_prunit)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10, $11, $12)`,
      [devId, String(seq).padStart(3, '0'), it.codreq, it.codprod, it.armId, original,
       di.qtdDisponivel, it.qtd, Number(((it.qtd / original) * 100).toFixed(2)), codvenda, it.motivo,
       num(d.prunit)]);
    saida.push({ codprod: it.codprod, descr: d.descr ?? '', qtd: it.qtd, motivo: it.motivo, prunit: num(d.prunit) });
  }

  await db.query(
    `INSERT INTO dbacao (codusr, acao, tabela, obs, data) VALUES ($1, 'INCLUIR', 'FAT_DEVOLUCAO', $2, now())`,
    [input.codusr ?? null, `DEV:${devId} ENT:${codent} PRE:${nrovenda} MANUAL`],
  );

  return { devId, codvenda, nrovenda, codcli, semCliente: false, clienteCriado, itens: saida };
}

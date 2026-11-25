/**
 * Contas a Pagar → Ajustar parcelamento (pedido do usuário, 25/11/2026).
 *
 * A edição do título altera só aquele título; o parcelamento muda apenas por aqui, e só se
 * NENHUMA parcela tiver pagamento, remessa, crédito ou adiantamento envolvido.
 *
 * Grupo do parcelamento = mesmo credor/transportadora/tipo e mesma BASE de duplicata:
 *   "78239/1/3" → base "78239" (formato base/parcela/total, Compras e Nova Conta)
 *   "DUP123/02" → base "DUP123" (formato antigo base/NN)
 *   sem "/"     → o título sozinho (pode ser dividido em parcelas).
 *
 * Ao salvar:
 *   - parcelas mantidas: novo vencimento, valor e duplicata renumerada (base/i/N);
 *   - parcelas removidas: CANCELADAS (cancel = 'S', obs com o motivo) — histórico preservado;
 *   - parcelas novas: cópia do título modelo (credor, conta, NF, banco...) com o novo valor;
 *   - vínculos de Compras acompanham: dbpgto_nota (valor atendido de cada parcela) e
 *     ordem_pagamento_conta / ordem_pagamento_parcelas (rateio por ordem, na mesma proporção).
 * A soma das parcelas tem de fechar com o total atual do parcelamento.
 */
import type { PoolClient } from 'pg';
import { proximoCodPgto } from '@/lib/compras/tituloCompras';

export class AjusteParcelamentoError extends Error {
  constructor(msg: string) { super(msg); this.name = 'AjusteParcelamentoError'; }
}

export interface ParcelaGrupo {
  cod_pgto: string;
  nro_dup: string | null;
  dt_venc: string;          // AAAA-MM-DD
  valor_pgto: number;
  valor_pago: number;
  paga: string;
}

export interface GrupoParcelamento {
  base: string | null;
  formato: 'base/n/N' | 'base/n' | 'unico';
  parcelas: ParcelaGrupo[];
  total: number;
  bloqueios: string[];
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const hojeBR = () => new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Manaus' });

function baseDaDuplicata(nroDup: string | null): { base: string | null; formato: GrupoParcelamento['formato'] } {
  const d = String(nroDup || '').trim();
  let m = /^(.+)\/(\d+)\/(\d+)$/.exec(d);
  if (m) return { base: m[1], formato: 'base/n/N' };
  m = /^(.+)\/(\d+)$/.exec(d);
  if (m) return { base: m[1], formato: 'base/n' };
  return { base: null, formato: 'unico' };
}

const escRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Carrega o parcelamento do título (e o que impede o ajuste). Com `travar`, bloqueia as linhas. */
export async function grupoDoTitulo(db: PoolClient, codPgto: string, travar = false): Promise<GrupoParcelamento & { modelo: any }> {
  const t = (await db.query(`SELECT * FROM dbpgto WHERE cod_pgto = $1`, [codPgto])).rows[0];
  if (!t) throw new AjusteParcelamentoError('Título não encontrado.');
  if (t.cancel === 'S') throw new AjusteParcelamentoError('O título está cancelado.');
  const { base, formato } = baseDaDuplicata(t.nro_dup);

  const lock = travar ? ' FOR UPDATE' : '';
  const sel = `SELECT cod_pgto, nro_dup, dt_venc::date::text AS dt_venc, COALESCE(valor_pgto,0)::float AS valor_pgto,
                      COALESCE(valor_pago,0)::float AS valor_pago, COALESCE(paga,'N') AS paga
                 FROM dbpgto`;
  const rows = base
    ? (await db.query(
      `${sel} WHERE COALESCE(cancel,'N') <> 'S'
          AND COALESCE(cod_credor,'') = COALESCE($1,'') AND COALESCE(cod_transp,'') = COALESCE($2,'')
          AND COALESCE(tipo,'') = COALESCE($3,'')
          AND nro_dup ~ $4
        ORDER BY dt_venc, nro_dup, cod_pgto${lock}`,
      [t.cod_credor, t.cod_transp, t.tipo, `^${escRegex(base)}/[0-9]+(/[0-9]+)?$`])).rows
    : (await db.query(`${sel} WHERE cod_pgto = $1${lock}`, [codPgto])).rows;

  const cods = rows.map((r) => r.cod_pgto);
  const bloqueios: string[] = [];
  const pagos = rows.filter((r) => r.paga === 'S' || r.valor_pago > 0);
  if (pagos.length) bloqueios.push(`${pagos.length} parcela(s) com pagamento (${pagos.map((p) => p.nro_dup || p.cod_pgto).join(', ')}).`);
  const conta = async (sql: string) => Number((await db.query(sql, [cods])).rows[0]?.n || 0);
  if (await conta(`SELECT count(*) n FROM dbfpgto WHERE cod_pgto = ANY($1) AND COALESCE(cancel,'N') <> 'S'`)) {
    bloqueios.push('Há baixa registrada em alguma parcela.');
  }
  if (await conta(`SELECT count(*) n FROM dbpgto_sispag WHERE spg_cod_pgto = ANY($1)`)
    || await conta(`SELECT count(*) n FROM pgt_arquivo_sispag WHERE aqs_cod_pgto = ANY($1)`)) {
    bloqueios.push('Alguma parcela já foi para remessa bancária (SISPAG).');
  }
  if (await conta(`SELECT count(*) n FROM credor_credito WHERE cod_pgto = ANY($1)`)) {
    bloqueios.push('O título gerou crédito do fornecedor (pagamento sem NF).');
  }
  if (await conta(`SELECT count(*) n FROM credor_credito_uso WHERE cod_pgto_abatido = ANY($1) AND estornado_em IS NULL`)) {
    bloqueios.push('Alguma parcela foi abatida com crédito do fornecedor.');
  }
  if (await conta(`SELECT count(*) n FROM ordem_pagamento_conta WHERE cod_pgto = ANY($1) AND numero_parcela = 0`)) {
    bloqueios.push('É pagamento antecipado de ordem de compra (ajuste pela ordem).');
  }
  if (t.eh_internacional === 'S' && !(Number(t.taxa_conversao) > 0)) {
    bloqueios.push('Título internacional sem taxa de conversão.');
  }

  const parcelas: ParcelaGrupo[] = rows;
  return { base, formato, parcelas, total: r2(parcelas.reduce((s, p) => s + p.valor_pgto, 0)), bloqueios, modelo: t };
}

export interface ParcelaNova { cod_pgto?: string | null; dt_venc: string; valor: number }

function duplicata(base: string | null, formato: GrupoParcelamento['formato'], original: string | null, i: number, n: number) {
  if (n === 1 && formato === 'unico') return original;          // continua título único
  if (formato === 'base/n') return `${base}/${String(i).padStart(2, '0')}`.slice(0, 20);
  const sufixo = `/${i}/${n}`;
  return `${String(base || '').slice(0, 20 - sufixo.length)}${sufixo}`;
}

/** Aplica o novo parcelamento (dentro da transação do chamador). */
export async function ajustarParcelamento(db: PoolClient, codPgto: string, novas: ParcelaNova[], usuario: string) {
  const g = await grupoDoTitulo(db, codPgto, true);
  if (g.bloqueios.length) throw new AjusteParcelamentoError(`Parcelamento não pode ser ajustado: ${g.bloqueios.join(' ')}`);
  if (!Array.isArray(novas) || novas.length === 0) throw new AjusteParcelamentoError('Informe ao menos uma parcela.');
  if (novas.length > 120) throw new AjusteParcelamentoError('Máximo de 120 parcelas.');

  const atuais = new Set(g.parcelas.map((p) => p.cod_pgto));
  const lista = novas.map((p) => ({ cod_pgto: p.cod_pgto ? String(p.cod_pgto) : null, dt_venc: String(p.dt_venc || '').slice(0, 10), valor: r2(Number(p.valor)) }));
  for (const p of lista) {
    if (!ISO.test(p.dt_venc)) throw new AjusteParcelamentoError('Informe o vencimento de todas as parcelas.');
    if (!(p.valor > 0)) throw new AjusteParcelamentoError('Todas as parcelas precisam ter valor maior que zero.');
    if (p.cod_pgto && !atuais.has(p.cod_pgto)) throw new AjusteParcelamentoError(`O título ${p.cod_pgto} não pertence a este parcelamento.`);
  }
  const usados = lista.filter((p) => p.cod_pgto).map((p) => p.cod_pgto);
  if (new Set(usados).size !== usados.length) throw new AjusteParcelamentoError('Parcela repetida na lista.');
  const soma = r2(lista.reduce((s, p) => s + p.valor, 0));
  if (Math.abs(soma - g.total) > 0.005) {
    throw new AjusteParcelamentoError(`A soma das parcelas (${soma.toFixed(2)}) precisa ser igual ao total do parcelamento (${g.total.toFixed(2)}).`);
  }

  lista.sort((a, b) => a.dt_venc.localeCompare(b.dt_venc));
  const n = lista.length;
  const t = g.modelo;
  // título sem base que vira várias parcelas: base = duplicata, NF ou o próprio código
  const formato = g.formato === 'unico' && n > 1 ? 'base/n/N' : g.formato;
  const base = g.base || String(t.nro_dup || t.nro_nf || t.cod_pgto).split('/')[0].trim();
  const internacional = t.eh_internacional === 'S';
  const taxa = Number(t.taxa_conversao) || 0;
  const quem = String(usuario || 'Sistema').slice(0, 100);
  const nota = `Parcelamento ajustado em ${hojeBR()} por ${quem} (${n} parcela${n > 1 ? 's' : ''})`;

  // vínculos de Compras ANTES de mexer (para refazer o rateio)
  const cods = g.parcelas.map((p) => p.cod_pgto);
  const opc = (await db.query(
    `SELECT orc_id, cod_pgto, numero_parcela, valor_parcela::float AS valor, data_vencimento::date::text AS venc, status
       FROM ordem_pagamento_conta WHERE cod_pgto = ANY($1) AND numero_parcela > 0`, [cods])).rows;
  const notas = (await db.query(
    `SELECT DISTINCT ON (codnfe_ent) codnfe_ent, nnf, serie, chave, tipo, valor_nf FROM dbpgto_nota
      WHERE cod_pgto = ANY($1) AND tipo = 'PARCELA' ORDER BY codnfe_ent, criado_em`, [cods])).rows;

  const resultado: { cod_pgto: string; nro_dup: string | null; dt_venc: string; valor: number; acao: 'mantida' | 'nova' }[] = [];
  for (let i = 0; i < n; i++) {
    const p = lista[i];
    const dup = duplicata(base, formato, t.nro_dup, i + 1, n);
    const valorMoeda = internacional && taxa > 0 ? r2(p.valor / taxa) : null;
    if (p.cod_pgto) {
      await db.query(
        `UPDATE dbpgto SET dt_venc = $2::date, valor_pgto = $3, nro_dup = $4,
                valor_moeda = CASE WHEN $5::numeric IS NULL THEN valor_moeda ELSE $5::numeric END,
                obs = left(COALESCE(obs,'') || $6, 500), updatedat = now(), username = $7
          WHERE cod_pgto = $1`,
        [p.cod_pgto, p.dt_venc, p.valor, dup, valorMoeda, ` | ${nota}`, quem]);
      resultado.push({ cod_pgto: p.cod_pgto, nro_dup: dup, dt_venc: p.dt_venc, valor: p.valor, acao: 'mantida' });
    } else {
      const novo = await proximoCodPgto(db);
      const cols = (await db.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = 'dbpgto'
            AND column_name NOT IN ('cod_pgto','dt_venc','valor_pgto','nro_dup','valor_moeda','obs','dt_pgto','valor_pago',
                                    'paga','cancel','valor_juros','createdat','updatedat','username')`)).rows.map((c) => `"${c.column_name}"`);
      await db.query(
        `INSERT INTO dbpgto (cod_pgto, dt_venc, valor_pgto, nro_dup, valor_moeda, obs, dt_pgto, valor_pago, paga, cancel,
                             valor_juros, createdat, updatedat, username, ${cols.join(',')})
         SELECT $2, $3::date, $4, $5, CASE WHEN $6::numeric IS NULL THEN valor_moeda ELSE $6::numeric END,
                left(COALESCE(obs,'') || $7, 500), NULL, 0, 'N', 'N', 0, now(), now(), $8, ${cols.join(',')}
           FROM dbpgto WHERE cod_pgto = $1`,
        [t.cod_pgto, novo, p.dt_venc, p.valor, dup, valorMoeda, ` | ${nota}`, quem]);
      p.cod_pgto = novo;
      resultado.push({ cod_pgto: novo, nro_dup: dup, dt_venc: p.dt_venc, valor: p.valor, acao: 'nova' });
    }
  }

  // removidas → canceladas (histórico preservado)
  const mantidas = new Set(lista.map((p) => p.cod_pgto));
  const removidas = g.parcelas.filter((p) => !mantidas.has(p.cod_pgto));
  for (const r of removidas) {
    await db.query(
      `UPDATE dbpgto SET cancel = 'S', obs = left(COALESCE(obs,'') || $2, 500), updatedat = now(), username = $3 WHERE cod_pgto = $1`,
      [r.cod_pgto, ` | Cancelada: ${nota.toLowerCase()}`, quem]);
  }

  // NF da parcela (Compras): cada parcela atende o seu valor
  for (const nf of notas) {
    for (const p of lista) {
      await db.query(
        `INSERT INTO dbpgto_nota (cod_pgto, codnfe_ent, nnf, serie, chave, tipo, valor_nf, valor_atendido, usuario)
         VALUES ($1,$2,$3,$4,$5,'PARCELA',$6,$7,$8)
         ON CONFLICT (cod_pgto, codnfe_ent) DO UPDATE SET valor_atendido = EXCLUDED.valor_atendido, usuario = EXCLUDED.usuario`,
        [p.cod_pgto, nf.codnfe_ent, nf.nnf, nf.serie, nf.chave, nf.valor_nf, p.valor, quem.slice(0, 60)]);
    }
  }

  // ordem de compra: refaz o rateio das parcelas (> 0) na mesma proporção por ordem
  if (opc.length) {
    const porOrdem = new Map<number, number>();
    opc.forEach((o) => porOrdem.set(o.orc_id, (porOrdem.get(o.orc_id) || 0) + o.valor));
    const totalOpc = [...porOrdem.values()].reduce((s, v) => s + v, 0) || 1;
    const modeloParcela = new Map<number, any>();
    for (const o of opc) {
      if (!modeloParcela.has(o.orc_id)) {
        const mp = (await db.query(
          `SELECT banco, tipo_documento FROM ordem_pagamento_parcelas WHERE orc_id = $1 AND numero_parcela = $2 LIMIT 1`,
          [o.orc_id, o.numero_parcela])).rows[0];
        modeloParcela.set(o.orc_id, mp || { banco: null, tipo_documento: null });
      }
      await db.query(
        `DELETE FROM ordem_pagamento_parcelas WHERE id IN (
           SELECT id FROM ordem_pagamento_parcelas WHERE orc_id = $1 AND numero_parcela = $2
              AND data_vencimento::date = $3::date AND round(valor_parcela::numeric, 2) = round($4::numeric, 2) LIMIT 1)`,
        [o.orc_id, o.numero_parcela, o.venc, o.valor]);
    }
    await db.query(`DELETE FROM ordem_pagamento_conta WHERE cod_pgto = ANY($1) AND numero_parcela > 0`, [cods]);
    const ordens = [...porOrdem.keys()];
    for (let i = 0; i < n; i++) {
      const p = lista[i];
      let restante = p.valor;
      for (let k = 0; k < ordens.length; k++) {
        const orc = ordens[k];
        const v = k === ordens.length - 1 ? r2(restante) : r2(p.valor * (porOrdem.get(orc)! / totalOpc));
        restante = r2(restante - v);
        const mp = modeloParcela.get(orc);
        await db.query(
          `INSERT INTO ordem_pagamento_conta (orc_id, cod_pgto, numero_parcela, valor_parcela, data_vencimento, status)
           VALUES ($1,$2,$3,$4,$5,'PENDENTE')`, [orc, p.cod_pgto, i + 1, v, p.dt_venc]);
        await db.query(
          `INSERT INTO ordem_pagamento_parcelas (orc_id, banco, tipo_documento, numero_parcela, valor_parcela, dias, data_vencimento, status)
           VALUES ($1,$2,$3,$4,$5,0,$6,'PENDENTE')`, [orc, mp.banco, mp.tipo_documento, i + 1, v, p.dt_venc]);
      }
    }
  }

  return { parcelas: resultado, canceladas: removidas.map((r) => r.cod_pgto), total: g.total };
}

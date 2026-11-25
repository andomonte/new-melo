/**
 * NFS-e TOMADAS — serviços contratados pela empresa (no Delphi: Nota Fiscal de Serviço > Tomado).
 * Não há lançamento manual: as notas vêm do portal nacional (ADN, papel TOMADOR, baixadas pela
 * mesma busca das prestadas — distribuicao.ts). Daqui se gera, MANUALMENTE, o título a pagar:
 *   - fornecedor pelo CNPJ do prestador (dbcredor.cpf_cgc) ou escolhido na tela;
 *   - valor = LÍQUIDO da nota (vLiq: serviço − retenções). O que a empresa reteve (ISS, IR,
 *     INSS, PIS/COFINS/CSLL) é recolhido por ela e não entra no título do fornecedor;
 *   - uma ou mais parcelas (soma = líquido), duplicata {nº da nota}/{parcela}/{total};
 *   - vínculo em nfs_tomada_titulo (migration 098). Nota cancelada no portal não gera título.
 */
import type { PoolClient } from 'pg';
import { proximoCodPgto } from '@/lib/compras/tituloCompras';
import { lerDocumentoNacional, type NotaNacional } from './adn/leitorXml';
import { ambienteAdn, cnpjAtualNfse } from './adn/distribuicao';

export class TomadaValidacaoError extends Error {
  constructor(msg: string) { super(msg); this.name = 'TomadaValidacaoError'; }
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Colunas da lista (uma linha por nota tomada). */
const SQL_TOMADAS = `
  SELECT d.id, d.nsu, d.chave_acesso, d.numero, d.dt_emissao::text AS dt_emissao, d.competencia,
         d.cnpj_prestador, d.nome_prestador, d.cod_servico, d.descricao,
         COALESCE(d.valor_servico,0)::float AS valor_servico, COALESCE(d.valor_liquido,0)::float AS valor_liquido,
         d.criado_em::text AS baixada_em,
         EXISTS (SELECT 1 FROM nfs_adn_documento e
                  WHERE e.tipo_documento = 'EVENTO' AND e.chave_referida = d.chave_acesso
                    AND e.tipo_evento IN ('CANCELAMENTO', 'CANCELAMENTO_POR_SUBSTITUICAO',
                                          'CANCELAMENTO_DEFERIDO_ANALISE_FISCAL', 'CANCELAMENTO_POR_OFICIO')) AS cancelada,
         (SELECT c.cod_credor FROM dbcredor c
           WHERE d.cnpj_prestador <> '' AND regexp_replace(COALESCE(c.cpf_cgc,''), '\\D', '', 'g') = d.cnpj_prestador
           ORDER BY c.cod_credor LIMIT 1) AS cod_credor_sugerido,
         (SELECT c.nome FROM dbcredor c
           WHERE d.cnpj_prestador <> '' AND regexp_replace(COALESCE(c.cpf_cgc,''), '\\D', '', 'g') = d.cnpj_prestador
           ORDER BY c.cod_credor LIMIT 1) AS nome_credor_sugerido,
         COALESCE(t.qtd, 0)::int AS qtd_titulos, COALESCE(t.valor, 0)::float AS valor_titulos,
         COALESCE(t.pago, 0)::float AS valor_pago, t.titulos
    FROM nfs_adn_documento d
    LEFT JOIN LATERAL (
      SELECT count(*) AS qtd, sum(p.valor_pgto) AS valor, sum(COALESCE(p.valor_pago,0)) AS pago,
             string_agg(p.nro_dup, ', ' ORDER BY p.dt_venc) AS titulos
        FROM nfs_tomada_titulo tt JOIN dbpgto p ON p.cod_pgto = tt.cod_pgto AND COALESCE(p.cancel,'N') <> 'S'
       WHERE tt.doc_id = d.id) t ON true
   WHERE d.tipo_documento = 'NFSE' AND d.papel = 'TOMADOR' AND d.ambiente = $1 AND d.cnpj = $2`;

export interface FiltroTomadas {
  de?: string | null; ate?: string | null;
  situacao?: 'pendentes' | 'com_titulo' | 'canceladas' | 'todas';
  q?: string | null;
}

export async function listarTomadas(db: PoolClient | any, f: FiltroTomadas) {
  const cnpj = await cnpjAtualNfse(db);
  const params: any[] = [ambienteAdn(), cnpj];
  const onde: string[] = [];
  if (f.de) { params.push(f.de); onde.push(`x.dt_emissao >= $${params.length}`); }
  if (f.ate) { params.push(f.ate); onde.push(`x.dt_emissao <= $${params.length}`); }
  if (f.q && f.q.trim()) {
    params.push(`%${f.q.trim()}%`);
    const p = `$${params.length}`;
    onde.push(`(x.numero ILIKE ${p} OR x.nome_prestador ILIKE ${p} OR x.cnpj_prestador ILIKE ${p} OR x.descricao ILIKE ${p} OR x.chave_acesso ILIKE ${p})`);
  }
  const sit = f.situacao || 'pendentes';
  if (sit === 'pendentes') onde.push(`NOT x.cancelada AND x.qtd_titulos = 0`);
  if (sit === 'com_titulo') onde.push(`x.qtd_titulos > 0`);
  if (sit === 'canceladas') onde.push(`x.cancelada`);
  const rows = (await db.query(
    `SELECT * FROM (${SQL_TOMADAS}) x ${onde.length ? `WHERE ${onde.join(' AND ')}` : ''}
      ORDER BY x.dt_emissao DESC NULLS LAST, x.nsu DESC LIMIT 1000`, params)).rows;
  const totais = rows.reduce((t: any, r: any) => {
    t.qtd += 1; t.servico += r.valor_servico; t.liquido += r.valor_liquido; t.titulos += r.valor_titulos;
    return t;
  }, { qtd: 0, servico: 0, liquido: 0, titulos: 0 });
  return { cnpj, ambiente: ambienteAdn(), notas: rows, totais };
}

/** Uma nota tomada com os valores lidos do XML (retenções) e os títulos já gerados. */
export async function detalheTomada(db: PoolClient | any, id: number | string) {
  const cnpj = await cnpjAtualNfse(db);
  const d = (await db.query(`SELECT * FROM (${SQL_TOMADAS}) x WHERE x.id = $3`, [ambienteAdn(), cnpj, Number(id)])).rows[0];
  if (!d) throw new TomadaValidacaoError('Nota tomada não encontrada.');
  const xml = (await db.query(`SELECT xml FROM nfs_adn_documento WHERE id = $1`, [d.id])).rows[0]?.xml || '';
  const lida = (await lerDocumentoNacional(xml).catch(() => null)) as NotaNacional | null;
  const titulos = (await db.query(
    `SELECT p.cod_pgto, p.nro_dup, p.dt_venc::date::text AS dt_venc, p.valor_pgto::float AS valor_pgto,
            COALESCE(p.valor_pago,0)::float AS valor_pago, COALESCE(p.paga,'N') AS paga, COALESCE(p.cancel,'N') AS cancel
       FROM nfs_tomada_titulo tt JOIN dbpgto p ON p.cod_pgto = tt.cod_pgto
      WHERE tt.doc_id = $1 ORDER BY p.dt_venc, p.nro_dup`, [d.id])).rows;
  return { nota: d, valores: lida?.valores || null, codServicoMun: lida?.codServicoMun || null, titulos };
}

export interface GerarTituloTomada {
  cod_credor: string;
  pag_cof_id?: number | string | null;
  cod_conta?: string | null;
  cod_ccusto?: string | null;
  parcelas: { dt_venc: string; valor: number }[];
  obs?: string | null;
}

/** Gera o(s) título(s) a pagar da nota tomada (na transação do chamador). */
export async function gerarTituloTomada(db: PoolClient, id: number | string, g: GerarTituloTomada, usuario: string) {
  const { nota } = await detalheTomada(db, id);
  await db.query(`SELECT id FROM nfs_adn_documento WHERE id = $1 FOR UPDATE`, [nota.id]);
  if (nota.cancelada) throw new TomadaValidacaoError('A nota foi cancelada no portal — não gera título.');
  const ativos = (await db.query(
    `SELECT count(*)::int n FROM nfs_tomada_titulo tt JOIN dbpgto p ON p.cod_pgto = tt.cod_pgto
      WHERE tt.doc_id = $1 AND COALESCE(p.cancel,'N') <> 'S'`, [nota.id])).rows[0].n;
  if (ativos > 0) throw new TomadaValidacaoError('Esta nota já tem título a pagar. Cancele-o no Contas a Pagar para gerar de novo.');

  const codCredor = String(g.cod_credor || '').trim();
  if (!codCredor) throw new TomadaValidacaoError('Informe o fornecedor.');
  const cred = (await db.query(`SELECT cod_credor, nome FROM dbcredor WHERE cod_credor = $1`, [codCredor])).rows[0];
  if (!cred) throw new TomadaValidacaoError('Fornecedor não encontrado no cadastro.');

  const parcelas = (g.parcelas || []).map((p) => ({ dt_venc: String(p.dt_venc || '').slice(0, 10), valor: r2(Number(p.valor)) }));
  if (!parcelas.length) throw new TomadaValidacaoError('Informe ao menos uma parcela.');
  if (parcelas.length > 60) throw new TomadaValidacaoError('Máximo de 60 parcelas.');
  for (const p of parcelas) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.dt_venc)) throw new TomadaValidacaoError('Informe o vencimento de todas as parcelas.');
    if (!(p.valor > 0)) throw new TomadaValidacaoError('Todas as parcelas precisam ter valor maior que zero.');
  }
  const soma = r2(parcelas.reduce((s, p) => s + p.valor, 0));
  const liquido = r2(Number(nota.valor_liquido) || Number(nota.valor_servico) || 0);
  if (Math.abs(soma - liquido) > 0.005) {
    throw new TomadaValidacaoError(`A soma das parcelas (${soma.toFixed(2)}) precisa ser igual ao líquido da nota (${liquido.toFixed(2)}).`);
  }
  parcelas.sort((a, b) => a.dt_venc.localeCompare(b.dt_venc));

  const numero = String(nota.numero || '').trim() || String(nota.chave_acesso || '').slice(-9);
  const n = parcelas.length;
  const cof = g.pag_cof_id != null && String(g.pag_cof_id).trim() !== '' && !isNaN(Number(g.pag_cof_id)) ? Number(g.pag_cof_id) : null;
  const obsBase = `NFS-e tomada nº ${numero} de ${nota.dt_emissao ? nota.dt_emissao.split('-').reverse().join('/') : '-'}`
    + (nota.chave_acesso ? ` · chave ${nota.chave_acesso}` : '') + (g.obs ? ` · ${String(g.obs).trim()}` : '');
  const quem = String(usuario || 'Sistema').slice(0, 60);

  const criados: { cod_pgto: string; nro_dup: string; dt_venc: string; valor: number }[] = [];
  for (let i = 0; i < n; i++) {
    const p = parcelas[i];
    const cod = await proximoCodPgto(db);
    const sufixo = `/${i + 1}/${n}`;
    const dup = `${numero.slice(0, 20 - sufixo.length)}${sufixo}`;
    await db.query(
      `INSERT INTO dbpgto (cod_pgto, pag_cof_id, tipo, cod_credor, cod_conta, cod_ccusto, dt_venc, dt_emissao, valor_pgto,
                           valor_pago, nro_nf, tem_nota, obs, tem_cobr, nro_dup, paga, cancel, eh_internacional,
                           titulo_importado, username)
       VALUES ($1,$2,'F',$3,$4,$5,$6::date,$7::date,$8, 0,$9,'S',$10,'S',$11,'N','N','N', false, $12)`,
      [cod, cof, codCredor, g.cod_conta ? String(g.cod_conta).slice(0, 4) : null, g.cod_ccusto ? String(g.cod_ccusto).slice(0, 4) : null,
        p.dt_venc, nota.dt_emissao || p.dt_venc, p.valor, numero.slice(0, 200), obsBase.slice(0, 500), dup, quem]);
    await db.query(`INSERT INTO nfs_tomada_titulo (doc_id, cod_pgto, usuario) VALUES ($1,$2,$3)`, [nota.id, cod, quem]);
    criados.push({ cod_pgto: cod, nro_dup: dup, dt_venc: p.dt_venc, valor: p.valor });
  }
  await db.query(`UPDATE nfs_adn_documento SET tratado_em = now(), tratado_por = $2 WHERE id = $1`, [nota.id, quem]);
  return { titulos: criados, fornecedor: `${cred.cod_credor} - ${cred.nome}`, total: soma };
}

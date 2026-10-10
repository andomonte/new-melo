/**
 * Construção (sem transmitir) das NOTAS de nacionalização de uma DI.
 *
 * Centraliza toda a lógica de dados (carrega DI + itens associados + adições +
 * vínculo fornecedor→cliente, monta hierarquia, particiona por grupo de pedidos,
 * resolve destinatário exterior e monta os itens NF-e no gabarito Delphi).
 *
 * Consumido por:
 *  - preview-nacionalizacao.ts  → vira XML (gerarNotasNacionalizacao)
 *  - preview-danfe.ts           → vira DANFE/PDF
 *  - (futuro) emitir             → numeração + assinatura + SEFAZ
 *
 * NÃO abre conexão nem faz commit — recebe um PoolClient pronto.
 */

import type { PoolClient } from 'pg';
import type {
  ItemImportacaoNfe,
  DadosNacionalizacao,
  EmitenteImportacao,
  DiHeader,
} from '@/components/services/sefazNfe/gerarXmlImportacao';
import {
  montarHierarquia,
  fornecedorPrincipal,
  type AdicaoHier,
  type RegraPrincipal,
} from '@/lib/compras/importacaoHierarquia';

type DestExterior = NonNullable<DadosNacionalizacao['destExterior']>;

export interface NotaConstruida {
  codExportador: string;
  pedidos: number[];
  dest: DestExterior;
  infCpl: string;
  itensNfe: ItemImportacaoNfe[];
  vProd: number;
  vOutro: number;
}

export interface ConstrucaoNotas {
  di: any;
  emp: any; // linha crua de dadosempresa (p/ DANFE)
  emitente: EmitenteImportacao;
  diHeader: DiHeader;
  forns: ReturnType<typeof montarHierarquia>;
  principal: ReturnType<typeof fornecedorPrincipal>;
  regra: RegraPrincipal;
  codPrincipal?: string;
  qtdAdicoes: number;
  notas: NotaConstruida[];
}

export type ResultadoConstrucao =
  | { ok: true; data: ConstrucaoNotas }
  | { ok: false; status: number; message: string };

const r2 = (n: number) => Math.round(n * 100) / 100;

export async function construirNotasNacionalizacao(
  client: PoolClient,
  importacaoId: number,
): Promise<ResultadoConstrucao> {
  // 1) DI
  const diRes = await client.query(`SELECT * FROM dbent_importacao WHERE id = $1`, [importacaoId]);
  if (diRes.rows.length === 0) return { ok: false, status: 404, message: 'DI não encontrada' };
  const di = diRes.rows[0];

  // 2) Itens associados
  const itensRes = await client.query(
    `SELECT it.*, p.ref, p.descr AS prod_descr, p.cest AS prod_cest
       FROM dbent_importacao_it_ent it
       LEFT JOIN dbprod p ON p.codprod = it.codprod
      WHERE it.id_importacao = $1 AND it.codprod IS NOT NULL
      ORDER BY it.numero_adicao, it.num_item, it.id`,
    [importacaoId],
  );
  if (itensRes.rows.length === 0) {
    return { ok: false, status: 422, message: 'Nenhum item associado a produto — associe os itens antes de gerar a nota.' };
  }

  // 3) Adições persistidas
  const adRes = await client.query(
    `SELECT numero_adicao, COALESCE(fornecedor_nome,'') AS fornecedor_nome, COALESCE(ncm,'') AS ncm,
            COALESCE(vl_fob,0) AS vl_fob, COALESCE(bc_ii,0) AS bc_ii, COALESCE(valor_ii,0) AS valor_ii
       FROM dbent_importacao_adicao WHERE id_importacao = $1 ORDER BY numero_adicao`,
    [importacaoId],
  );
  const fornecedorPorAdicao = new Map<number, string>();
  const dadosAdicao = new Map<number, any>();
  adRes.rows.forEach((a: any) => {
    const n = Number(a.numero_adicao);
    fornecedorPorAdicao.set(n, a.fornecedor_nome);
    dadosAdicao.set(n, a);
  });

  // Vínculo fornecedor(DIe) → cliente (tipo X)
  const entRes = await client.query(
    `SELECT COALESCE(fornecedor_nome,'') AS fornecedor_nome, cod_cliente, nro_invoice
       FROM dbent_importacao_entrada WHERE id_importacao = $1`,
    [importacaoId],
  );
  const codClientePorForn = new Map<string, string>();
  const invoicePorForn = new Map<string, string>();
  entRes.rows.forEach((r: any) => {
    if (r.cod_cliente) codClientePorForn.set(r.fornecedor_nome, String(r.cod_cliente));
    if (r.nro_invoice) invoicePorForn.set(r.fornecedor_nome, String(r.nro_invoice));
  });

  // 4) Hierarquia Fornecedor→Adição→Item
  const itensPorAdicao = new Map<number, any[]>();
  for (const it of itensRes.rows) {
    const n = Number(it.numero_adicao) || 0;
    if (!itensPorAdicao.has(n)) itensPorAdicao.set(n, []);
    itensPorAdicao.get(n)!.push(it);
  }
  const adicoesHier: AdicaoHier[] = adRes.rows
    .filter((a: any) => itensPorAdicao.has(Number(a.numero_adicao)))
    .map((a: any) => {
      const n = Number(a.numero_adicao);
      return {
        numAdicao: n,
        nomeFornecedor: a.fornecedor_nome,
        ncm: a.ncm,
        vlFob: Number(a.vl_fob) || 0,
        itens: (itensPorAdicao.get(n) || []).map((it: any) => ({
          numItem: Number(it.num_item) || 0,
          numAdicao: n,
          ncm: it.ncm || a.ncm || '',
          codprod: it.codprod,
          _row: it,
        })),
      };
    });
  if (adicoesHier.length === 0) {
    return { ok: false, status: 422, message: 'Hierarquia de adições vazia — reimporte a DI para gerar fornecedor/adição/item.' };
  }

  const forns = montarHierarquia(adicoesHier);
  const regra: RegraPrincipal = di.fornecedor_principal_regra === 'MAIOR_FOB' ? 'MAIOR_FOB' : 'ADICAO_001';
  let principal = fornecedorPrincipal(forns, regra);
  if (di.fornecedor_principal) {
    const manual = forns.find((f) => f.nome === di.fornecedor_principal);
    if (manual) principal = manual;
  }

  // Destinatário fallback (exportador principal)
  let destPrincipal: DestExterior = {
    idEstrangeiro: '',
    nome: principal?.nome,
    xLgr: 'EXTERIOR', nro: 'S/N', xBairro: 'EXTERIOR', cep: '99999999',
    cPais: '9999', xPais: 'EXTERIOR',
  };
  const codPrincipal = principal ? codClientePorForn.get(principal.nome) : undefined;

  // dest por exportador (cache dbclien)
  const destCache = new Map<string, DestExterior>();
  const destDoExportador = async (cod: string): Promise<DestExterior> => {
    if (!cod) return destPrincipal;
    const hit = destCache.get(cod);
    if (hit) return hit;
    let d = destPrincipal;
    const cli = await client.query(
      `SELECT nome, cpfcgc, codpais, ender, numero, bairro, cep FROM dbclien WHERE codcli = $1`,
      [cod],
    );
    const c = cli.rows[0];
    if (c) {
      let xPais = 'EXTERIOR';
      if (c.codpais) {
        const p = await client.query(`SELECT descricao FROM dbpais WHERE codpais = $1`, [c.codpais]);
        xPais = p.rows[0]?.descricao || xPais;
      }
      d = {
        idEstrangeiro: '',
        nome: c.nome,
        xLgr: c.ender || 'EXTERIOR',
        nro: c.numero || 'S/N',
        xBairro: c.bairro || 'EXTERIOR',
        cep: String(c.cep || '99999999').replace(/\D/g, '') || '99999999',
        cPais: c.codpais ? String(c.codpais) : '9999',
        xPais,
      };
      if (String(cod) === String(codPrincipal)) destPrincipal = d;
    }
    destCache.set(cod, d);
    return d;
  };

  // 5) Emitente
  const empRes = await client.query(`SELECT * FROM dadosempresa LIMIT 1`);
  const emp = empRes.rows[0] || {};
  const emitente: EmitenteImportacao = {
    cnpj: String(emp.cgc || '').replace(/\D/g, ''),
    ie: String(emp.inscricaoestadual_07 || emp.inscricaoestadual || '').replace(/\D/g, ''),
    nome: emp.nomecontribuinte || 'MELO',
    fantasia: emp.nomecontribuinte || 'MELO',
    ender: emp.logradouro || '',
    numero: emp.numero || 'S/N',
    bairro: emp.bairro || '',
    cidade: emp.municipio || 'MANAUS',
    uf: emp.uf || 'AM',
    cep: String(emp.cep || '').replace(/\D/g, ''),
    crt: String(emp.crt || '3'),
  };
  const diHeader: DiHeader = {
    nro_di: di.nro_di,
    data_di: di.data_di,
    local_desembaraco: di.local_desembaraco || di.recinto_aduaneiro || '',
    uf_desembaraco: di.uf_desembaraco || 'AM',
    data_desembaraco: di.data_desembaraco || di.data_di,
    via_transporte: di.via_transporte ?? 1,
    forma_importacao: di.forma_importacao ?? 1,
    valor_afrmm: Number(di.valor_afrmm) || 0,
  };

  // 6) NOTA ÚNICA por DI (decisão travada). Destinatário = exportador PRINCIPAL;
  //    o cExportador real de cada item vai no grupo DI do item. outros_valores
  //    rateado FLAT por item.
  const outrosTotal = Number(di.outros_valores) || 0;
  const vUnitDe = (it: any) =>
    Number(it.nf_unit) ||
    (Number(it.invoice_unit)
      ? Number(it.invoice_unit) * (Number(di.taxa_dolar_di) || Number(di.taxa_dolar) || 1)
      : Number(it.custo_unit_real) || 0);

  const fornResumo = forns
    .map((f) => {
      const cod = codClientePorForn.get(f.nome) || 'S/VINCULO';
      const inv = invoicePorForn.get(f.nome);
      return `${f.nome}(${cod}${inv ? `/${inv}` : ''})`;
    })
    .join(', ');

  const montarItemNfe = (it: any, vOutroItem: number): ItemImportacaoNfe => {
    const numAdic = Number(it.numero_adicao) || 0;
    const fornItem = fornecedorPorAdicao.get(numAdic) || '';
    const codExp = codClientePorForn.get(fornItem) || '';
    const ad = dadosAdicao.get(numAdic);
    const qtd = Number(it.qtd) || 0;
    const vUnit = vUnitDe(it);
    const vProd = r2(vUnit * qtd);
    const vIBSUF = r2(vProd * 0.001);
    const vCBS = r2(vProd * 0.009);
    return {
      codprod: it.codprod,
      descricao: it.prod_descr || it.descricao || '',
      ref: it.ref || undefined,
      cest: it.prod_cest || undefined,
      cEAN: it.codbarra || undefined,
      ncm: it.ncm || ad?.ncm || '',
      cfop: '3102',
      unidade: it.unidade || 'UN',
      qtd,
      vUnit,
      vOutro: vOutroItem,
      adicao: {
        numero_adicao: numAdic,
        seq_adicao: Number(it.num_item) || 1,
        cod_exportador: codExp,
        cod_fabricante: codExp,
        exportador_nome: fornItem,
        bc_ii: 0, despesa_aduaneira: 0, valor_ii: 0, valor_iof: 0,
      },
      icms: { cstICMS: '60', origem: '1', vBCSTRet: 0, pST: 0, vICMSSubstituto: 0, vICMSSTRet: 0 },
      ipi: { cstIPI: '05' },
      pis: { cstPIS: '08' },
      cofins: { cstCOFINS: '08' },
      ibscbs: {
        cst: '000', cClassTrib: '000001', vBC: vProd,
        pIBSUF: 0.1, vIBSUF, pIBSMun: 0, vIBSMun: 0, vIBS: vIBSUF, pCBS: 0.9, vCBS,
      },
    };
  };

  const rowsOrdenados = [...itensRes.rows].sort((a: any, b: any) =>
    String(a.ref ?? a.codprod ?? '').localeCompare(String(b.ref ?? b.codprod ?? ''), 'en'),
  );
  const nItens = rowsOrdenados.length;
  const vOutroItem = nItens > 0 ? r2(outrosTotal / nItens) : 0;
  const dest = await destDoExportador(codPrincipal || '');
  const itensNfe = rowsOrdenados.map((it) => montarItemNfe(it, vOutroItem));
  const pedidos = [
    ...new Set(
      itensRes.rows
        .map((it: any) => Number(it.id_orc))
        .filter((n: number) => Number.isFinite(n) && n > 0),
    ),
  ].sort((a, b) => a - b);
  const vProd = r2(itensNfe.reduce((s, it) => s + r2(it.vUnit * it.qtd), 0));
  const infCpl =
    `PEDIDO: ${pedidos.join(',')} OBSERVACAO: REF. DI ${di.nro_di}` +
    (fornResumo ? ` FORNECEDORES: ${fornResumo}` : '');
  const notas: NotaConstruida[] = [
    { codExportador: codPrincipal || '', pedidos, dest, infCpl, itensNfe, vProd, vOutro: r2(outrosTotal) },
  ];

  return {
    ok: true,
    data: { di, emp, emitente, diHeader, forns, principal, regra, codPrincipal, qtdAdicoes: adRes.rows.length, notas },
  };
}

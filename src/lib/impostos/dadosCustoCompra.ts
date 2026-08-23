import { PoolClient } from 'pg';
import {
  orquestrarCustoCompra,
  ncmDerivadoPetroleo,
  calcularMvaAjustado,
  mvaDerivadoPetroleo,
  mvaProdutoLegislacao,
  type EstadoCompraCompleto,
} from './motorCustoCompra';
import type { ParamsCusto, ResultadoCusto } from './calcularCustoMercadoria';

/**
 * Camada de DADOS (Postgres) do custo de compra: lê produto, fornecedor, regra,
 * UFs e legislação ICMS-ST do db_manaus e monta o EstadoCompraCompleto para o
 * motor `orquestrarCustoCompra`. Substitui a ponte Oracle — porta as consultas
 * de CALCULO_IMPOSTO (LEGISLACAO_ICMS, PROTOCOLO_1785, MVA_PRODUTO_LEGISLACAO).
 */

const S = process.env.DB_SCHEMA || 'db_manaus';

function so(v: any): string {
  return String(v ?? '').replace(/\D/g, '');
}

// PRODUTO_ICMS: NCM participa da legislação (match exato ou prefixo 7..3), sem exceção
async function produtoNaLegislacao(
  client: PoolClient,
  leiId: number,
  ncm: string,
  codmarca: string,
): Promise<boolean> {
  const r = await client.query(
    `SELECT count(*) n FROM ${S}.cad_legislacao_icmsst_ncm
      WHERE "LIN_LEI_ID"=$1 AND (
        "LIN_NCM"=$2
        OR ("LIN_NCM"=substr($2,1,7) AND length("LIN_NCM")=7)
        OR ("LIN_NCM"=substr($2,1,6) AND length("LIN_NCM")=6)
        OR ("LIN_NCM"=substr($2,1,5) AND length("LIN_NCM")=5)
        OR ("LIN_NCM"=substr($2,1,4) AND length("LIN_NCM")=4)
        OR ("LIN_NCM"=substr($2,1,3) AND length("LIN_NCM")=3))`,
    [leiId, ncm],
  );
  if (Number(r.rows[0].n) === 0) return false;
  // exceção por NCM exato
  const ex = await client.query(
    `SELECT count(*) n FROM ${S}.cad_legislacao_icmsst_ncm
      WHERE "LIN_LEI_ID"=$1 AND "LIN_NCM"=$2 AND "LIN_STATUS"='EXCECAO'`,
    [leiId, ncm],
  );
  if (Number(ex.rows[0].n) > 0) return false;
  // PRODUTO_EXCECAO_ST (hardcoded NCM + marca 01094)
  if (
    codmarca === '01094' &&
    ['85437099', '83026000', '85389010', '85399010'].includes(ncm)
  ) {
    return false;
  }
  return true;
}

// LEGISLACAO_ICMS por tipo — retorna a legislação vencedora (maior LEI_ID) cujo NCM casa
async function legislacaoPorTipo(
  client: PoolClient,
  tipo: string,
  origem: string,
  destino: string,
  empresaUf: string,
  ncm: string,
  codmarca: string,
): Promise<{ leiId: number; protocolo: number } | null> {
  let sql: string;
  let params: any[];
  if (tipo === 'CONVENIO' || tipo === 'PROTOCOLO') {
    sql = `SELECT picms."LEI_ID" id, picms."LEI_PROTOCOLO" pro
             FROM ${S}.cad_legislacao_icmsst picms
             JOIN ${S}.cad_legislacao_signatario pso ON picms."LEI_ID"=pso."LES_LEI_ID"
             JOIN ${S}.cad_legislacao_signatario psd ON picms."LEI_ID"=psd."LES_LEI_ID"
            WHERE pso."LES_UF"=$1 AND psd."LES_UF"=$2
              AND picms."LEI_STATUS"='EM VIGOR' AND picms."LEI_TIPO"=$3
            ORDER BY picms."LEI_ID" DESC`;
    params = [origem, destino, tipo];
  } else {
    // RESOLUCAO / DECRETO: signatário = UF da empresa e empresa = destino
    if (empresaUf !== destino) return null;
    sql = `SELECT picms."LEI_ID" id, picms."LEI_PROTOCOLO" pro
             FROM ${S}.cad_legislacao_icmsst picms
             JOIN ${S}.cad_legislacao_signatario pso ON picms."LEI_ID"=pso."LES_LEI_ID"
            WHERE pso."LES_UF"=$1 AND picms."LEI_STATUS"='EM VIGOR' AND picms."LEI_TIPO"=$2
            ORDER BY picms."LEI_ID" DESC`;
    params = [empresaUf, tipo];
  }
  const r = await client.query(sql, params);
  for (const row of r.rows) {
    if (await produtoNaLegislacao(client, row.id, ncm, codmarca)) {
      return { leiId: Number(row.id), protocolo: Number(row.pro) };
    }
  }
  return null;
}

// Ordem usada pelo Calcular_ICMS_Subst para a MVA por legislação
const TIPOS = ['CONVENIO', 'PROTOCOLO', 'DECRETO', 'RESOLUCAO'];

async function resolverLegislacao(
  client: PoolClient,
  origem: string,
  destino: string,
  empresaUf: string,
  ncm: string,
  codmarca: string,
) {
  let vencedora: { leiId: number; protocolo: number } | null = null;
  let protocolo1785 = false;
  for (const tipo of TIPOS) {
    const res = await legislacaoPorTipo(client, tipo, origem, destino, empresaUf, ncm, codmarca);
    if (res) {
      if (!vencedora) vencedora = res;
      if (tipo === 'PROTOCOLO' && res.protocolo === 17) protocolo1785 = true;
    }
  }
  return { vencedora, protocolo1785 };
}

// LIN_MVA_ST_ORIGINAL da legislação para o NCM (prefixo mais longo primeiro)
async function buscaMvaOrig(client: PoolClient, leiId: number, ncm: string): Promise<number | null> {
  const tent = [ncm, ncm.slice(0, 7), ncm.slice(0, 6), ncm.slice(0, 5), ncm.slice(0, 4), ncm.slice(0, 3)];
  for (let i = 0; i < tent.length; i++) {
    const cond = i === 0
      ? `"LIN_NCM"=$2`
      : `"LIN_NCM"=$2 AND length("LIN_NCM")=${tent[i].length}`;
    const r = await client.query(
      `SELECT "LIN_MVA_ST_ORIGINAL" m FROM ${S}.cad_legislacao_icmsst_ncm WHERE "LIN_LEI_ID"=$1 AND ${cond} LIMIT 1`,
      [leiId, tent[i]],
    );
    if (r.rows.length) return Number(r.rows[0].m);
  }
  return null;
}

async function colonsFormula(client: PoolClient, leiId: number): Promise<number> {
  const r = await client.query(
    `SELECT (length("LEI_MVA_AJUSTADA")-length(replace("LEI_MVA_AJUSTADA",':',''))) c
       FROM ${S}.cad_legislacao_icmsst WHERE "LEI_ID"=$1`,
    [leiId],
  );
  return r.rows.length ? Number(r.rows[0].c) : 0;
}

export interface DadosCustoNaoEncontrado {
  erro: string;
}

/**
 * Calcula Custo/CustoFE/CustoZF de um produto na compra, 100% Postgres.
 */
export async function calcularCustoCompraPg(
  client: PoolClient,
  codprod: string,
  codCredor: string,
  prNF: number,
  prSNF: number,
  params: ParamsCusto,
  zerarSt: boolean,
  zerarIpi = false,
  /** overrides da importação (Informação Opcional). -1/null = usa o do produto. */
  overrides?: { ipi?: number | null; pis?: number | null; cofins?: number | null },
): Promise<ResultadoCusto | DadosCustoNaoEncontrado> {
  const prod = (
    await client.query(
      `SELECT isentoipi, strib, COALESCE(ipi,0) ipi, COALESCE(percsubst,0) percsubst,
              clasfiscal, COALESCE(pis,0) pis, cofins, tipo, codmarca
         FROM ${S}.dbprod WHERE codprod=$1`,
      [codprod],
    )
  ).rows[0];
  if (!prod) return { erro: 'Produto não encontrado' };

  const cred = (
    await client.query(
      `SELECT regime_tributacao, fabricante, uf FROM ${S}.dbcredor WHERE cod_credor=$1`,
      [codCredor],
    )
  ).rows[0];
  if (!cred || !cred.uf) return { erro: 'Fornecedor não encontrado ou sem UF' };

  const emp = (await client.query(`SELECT uf FROM ${S}.dadosempresa LIMIT 1`)).rows[0];
  const ufEmpresa = emp.uf;
  const ufEmp = (
    await client.query(
      `SELECT "ZONA_ISENTIVADA" z, "ICMSINTERNO" i FROM ${S}.dbuf_n WHERE "UF"=$1`,
      [ufEmpresa],
    )
  ).rows[0];
  const ufForn = (
    await client.query(`SELECT "ICMSEXTERNO" e FROM ${S}.dbuf_n WHERE "UF"=$1`, [cred.uf])
  ).rows[0];
  const regra =
    (
      await client.query(
        `SELECT cobrar_ipi_importado, piscofins_365, piscofins_925, piscofins_1150, piscofins_1310,
                desc_icms_sufra, desc_icms_sufra_importado, basereduzida_st, desc_piscofins_st, acres_piscofins_st
           FROM ${S}.cad_credor_regra_faturamento WHERE crf_id=$1`,
        [codCredor],
      )
    ).rows[0] || {};

  const ncm = so(prod.clasfiscal);
  // overrides da importação (o Oracle grava esses no dbprod antes de calcular)
  const usa = (o: number | null | undefined, base: any) =>
    o != null && o !== -1 ? Number(o) : base;
  const ipiAliq = Number(usa(overrides?.ipi, Number(prod.ipi) || 0)) || 0;
  const prodPisVal = Number(usa(overrides?.pis, Number(prod.pis) || 0)) || 0;
  const prodCofinsVal =
    overrides?.cofins != null && overrides.cofins !== -1
      ? Number(overrides.cofins)
      : prod.cofins == null
        ? null
        : Number(prod.cofins);
  const importadoST = ['1', '2', '3'].includes(String(prod.strib).charAt(0));
  const externoAdj = importadoST ? 4 : Number(ufForn?.e) || 0;
  const interno = Number(ufEmp?.i) || 0;
  const ufDiff = cred.uf !== ufEmpresa;

  // Legislação + protocolo 1785
  const { vencedora, protocolo1785 } = await resolverLegislacao(
    client,
    cred.uf,
    ufEmpresa,
    ufEmpresa,
    ncm,
    String(prod.codmarca ?? ''),
  );
  const legislacao = !!vencedora;

  // MVA (mesma orquestração do Calcular_ICMS_Subst)
  let mva = 0;
  const percsubst = Number(prod.percsubst) || 0;
  if (!zerarSt) {
    if (ncmDerivadoPetroleo(ncm)) {
      mva = mvaDerivadoPetroleo(cred.uf, ufEmpresa, 'COMPRA');
    } else if (ufDiff && vencedora) {
      const mvaOrig = await buscaMvaOrig(client, vencedora.leiId, ncm);
      if (mvaOrig != null) {
        const cols = await colonsFormula(client, vencedora.leiId);
        mva = mvaProdutoLegislacao(
          mvaOrig,
          cols,
          externoAdj,
          interno,
          String(cred.regime_tributacao),
          'ENTRADA_COMPRAS',
        );
      }
    } else if (percsubst > 0 && ufDiff) {
      mva =
        ufEmpresa === 'RO'
          ? Math.round((percsubst / 100) * 10000) / 10000
          : calcularMvaAjustado(percsubst, externoAdj, interno);
    }
  }

  const estado: EstadoCompraCompleto = {
    prNF,
    prSNF,
    params,
    isentoipi: prod.isentoipi,
    strib: prod.strib,
    ipiAliquota: ipiAliq,
    percsubst,
    ncm,
    prodPis: prodPisVal,
    prodCofins: prodCofinsVal,
    ufEmpresa,
    zonaEmpresa: ufEmp?.z,
    icmsInternoEmpresa: interno,
    ufFornecedor: cred.uf,
    icmsExternoFornecedor: Number(ufForn?.e) || 0,
    regimeFornecedor: String(cred.regime_tributacao),
    fabricante: cred.fabricante,
    cobrarIpiImportado: regra.cobrar_ipi_importado ?? null,
    piscofins365: regra.piscofins_365 ?? null,
    piscofins925: regra.piscofins_925 ?? null,
    piscofins1150: regra.piscofins_1150 ?? null,
    piscofins1310: regra.piscofins_1310 ?? null,
    descIcmsSufra: regra.desc_icms_sufra ?? null,
    descIcmsSufraImportado: regra.desc_icms_sufra_importado ?? null,
    baseReduzidaST: regra.basereduzida_st ?? null,
    descPiscofinsST: regra.desc_piscofins_st ?? null,
    acresPiscofinsST: regra.acres_piscofins_st ?? null,
    cfop: '',
    legislacao,
    protocolo1785,
    mva,
    zerarST: zerarSt,
    zerarIpi,
  };

  return orquestrarCustoCompra(estado);
}

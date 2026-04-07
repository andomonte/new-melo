import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { parseCookies } from 'nookies';
import { z } from 'zod';
import { getPgPool } from '@/lib/pgClient';

const bodySchema = z.object({
  tipoMovimentacao: z.enum(['SAIDA', 'ENTRADA']).default('SAIDA'),
  tipoOperacao: z.enum(['VENDA', 'COMPRA']).default('VENDA'),
  tipoFatura: z.enum(['NOTA_FISCAL', 'PEDIDO', 'ORCAMENTO']).optional(),
  codProduto: z.string().min(1, 'Obrigatório'),
  codCliente: z.string().min(1, 'Obrigatório'),
  totalProduto: z.number().positive(),
  baseProduto: z.number().nonnegative().optional(), // se não vier, usa totalProduto
  mvaAntecipado: z.number().nonnegative().default(0),
  zerarIPI: z.enum(['S', 'N']).default('N'),
  zerarICMS: z.enum(['S', 'N']).default('N'),
  zerarSubstituicao: z.enum(['S', 'N']).default('N'),
  descontoSUFRAMA: z.enum(['S', 'N']).default('N'),
  cfop: z.string().optional(),
});

type UFRowLower = {
  uf: string;
  icmsinterno: string | number;
  icmsexterno: string | number;
  st?: string;
};

type UFRowUpper = {
  UF: string;
  ICMSINTERNO: string | number;
  ICMSEXTERNO: string | number;
  ST?: string;
};

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  console.log('[IMPOSTOS] method:', req.method);

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;
  if (!filial)
    return res.status(400).json({ error: 'Filial não informada no cookie.' });

  let parsed;
  try {
    // normalizar nomes antigos do front (se vierem) -> novos nomes
    const payload = {
      tipoMovimentacao:
        req.body?.Tipo_Movimentacao ?? req.body?.tipoMovimentacao,
      tipoOperacao: req.body?.TipoOperacao ?? req.body?.tipoOperacao,
      tipoFatura: req.body?.TipoFatura ?? req.body?.tipoFatura,
      codProduto: req.body?.CodProduto ?? req.body?.codProduto,
      codCliente: req.body?.Codigo ?? req.body?.codCliente,
      totalProduto: Number(req.body?.Total_Produto ?? req.body?.totalProduto),
      baseProduto:
        req.body?.Base_Produto != null
          ? Number(req.body?.Base_Produto)
          : req.body?.baseProduto != null
          ? Number(req.body?.baseProduto)
          : undefined,
      mvaAntecipado: Number(
        req.body?.MVA_ANTECIPADO ?? req.body?.mvaAntecipado ?? 0,
      ),
      zerarIPI: (req.body?.Zerar_IPI ?? req.body?.zerarIPI ?? 'N') as 'S' | 'N',
      zerarICMS: (req.body?.Zerar_ICMS ?? req.body?.zerarICMS ?? 'N') as
        | 'S'
        | 'N',
      zerarSubstituicao: (req.body?.Zerar_SUBSTITUICAO ??
        req.body?.zerarSubstituicao ??
        'N') as 'S' | 'N',
      descontoSUFRAMA: (req.body?.Desconto_SUFRAMA ??
        req.body?.descontoSUFRAMA ??
        'N') as 'S' | 'N',
      cfop: req.body?.CFOP ?? req.body?.cfop,
    };
    parsed = bodySchema.parse(payload);
  } catch (e: any) {
    console.error('[IMPOSTOS] ZOD ERROR:', e?.flatten?.() ?? e);
    return res
      .status(400)
      .json({ error: 'Body inválido', details: e?.flatten?.() ?? String(e) });
  }

  const baseCalc = parsed.baseProduto ?? parsed.totalProduto;

  let client: PoolClient | undefined;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // 1) Produto: pegar PIS/COFINS/IPI se existirem (senão 0)
    const prodSQL = `
      SELECT codprod, pis, cofins, ipi
      FROM dbprod
      WHERE codprod = $1
      LIMIT 1;
    `;
    const prodResult = await client.query(prodSQL, [parsed.codProduto]);
    if (prodResult.rowCount === 0) {
      return res
        .status(400)
        .json({ error: 'Produto não encontrado em dbprod.' });
    }
    const prod = prodResult.rows[0] || {};
    const pisProd = Number(prod.pis ?? 0) || 0;
    const cofinsProd = Number(prod.cofins ?? 0) || 0;
    const ipiProd = Number(prod.ipi ?? 0) || 0;

    // 2) Cliente: pegar UF
    const cliSQL = `
      SELECT uf
      FROM dbclien
      WHERE codcli = $1
      LIMIT 1;
    `;
    const cliResult = await client.query(cliSQL, [parsed.codCliente]);
    if (cliResult.rowCount === 0) {
      return res
        .status(400)
        .json({ error: 'Cliente não encontrado em dbclien.' });
    }
    const ufCliente: string = cliResult.rows[0].uf;

    // 3) Empresa (origem): pegar UF
    const empSQL = `SELECT uf FROM dadosempresa LIMIT 1;`;
    const empResult = await client.query(empSQL);
    if (empResult.rowCount === 0) {
      return res
        .status(500)
        .json({ error: 'UF da empresa (dadosempresa) não encontrada.' });
    }
    const ufEmpresa: string = empResult.rows[0].uf;

    // 4) Buscar alíquotas na DBUF_N (tenta minúsculas primeiro; se falhar, usa maiúsculas com aspas)
    async function getUFRow(uf: string) {
      try {
        // tentativa 1: colunas minúsculas (caso você as tenha padronizado)
        const q1 = await client!.query<UFRowLower>(
          `SELECT uf, icmsinterno, icmsexterno, st FROM dbuf_n WHERE uf = $1 LIMIT 1;`,
          [uf],
        );
        if (q1.rowCount && q1.rows[0])
          return {
            uf: q1.rows[0].uf,
            icmsInterno: Number(q1.rows[0].icmsinterno),
            icmsExterno: Number(q1.rows[0].icmsexterno),
            st: q1.rows[0].st ?? 'N',
          };
      } catch (_) {
        // ignora e tenta maiúsculas
      }
      // tentativa 2: colunas originais maiúsculas (entre aspas)
      const q2 = await client!.query<UFRowUpper>(
        `SELECT "UF", "ICMSINTERNO", "ICMSEXTERNO", "ST" FROM dbuf_n WHERE "UF" = $1 LIMIT 1;`,
        [uf],
      );
      if (q2.rowCount && q2.rows[0]) {
        return {
          uf: q2.rows[0].UF,
          icmsInterno: Number(q2.rows[0].ICMSINTERNO),
          icmsExterno: Number(q2.rows[0].ICMSEXTERNO),
          st: (q2.rows[0].ST ?? 'N') as string,
        };
      }
      return null;
    }

    const origemRow = await getUFRow(ufEmpresa);
    const destinoRow = await getUFRow(ufCliente);

    if (!origemRow) {
      return res.status(400).json({
        error: `UF de origem (${ufEmpresa}) não encontrada em dbuf_n.`,
      });
    }
    if (!destinoRow) {
      return res.status(400).json({
        error: `UF de destino (${ufCliente}) não encontrada em dbuf_n.`,
      });
    }

    // 5) Escolha de alíquota (Plano B):
    // - Mesma UF: usa ICMSINTERNO do UF de origem
    // - UFs diferentes: usa ICMSEXTERNO do UF de origem
    const isIntra = ufEmpresa === ufCliente;
    const aliqICMS =
      parsed.zerarICMS === 'S'
        ? 0
        : isIntra
        ? origemRow.icmsInterno
        : origemRow.icmsExterno;

    // 6) Cálculos (simples – ST desativada se zerarSubstituicao = 'S')
    const valorIPI =
      parsed.zerarIPI === 'S' ? 0 : round2(baseCalc * (ipiProd / 100));
    const valorICMS = round2(baseCalc * (aliqICMS / 100));
    const valorICMS_ST = parsed.zerarSubstituicao === 'S' ? 0 : 0; // sem ST por enquanto
    const valorPIS = round2(
      baseCalc * ((Number.isFinite(pisProd) ? pisProd : 0) / 100),
    );
    const valorCOFINS = round2(
      baseCalc * ((Number.isFinite(cofinsProd) ? cofinsProd : 0) / 100),
    );

    const totalImpostos = round2(
      valorIPI + valorICMS + valorICMS_ST + valorPIS + valorCOFINS,
    );

    return res.status(200).json({
      sucesso: true,
      entrada: parsed,
      origem: {
        uf: ufEmpresa,
        aliqInterna: origemRow.icmsInterno,
        aliqInterestadual: origemRow.icmsExterno,
      },
      destino: { uf: ufCliente },
      calculo: {
        base: baseCalc,
        aliquotaICMS: aliqICMS,
        valor_IPI: valorIPI,
        valor_ICMS: valorICMS,
        valor_ICMS_Subst: valorICMS_ST,
        valor_Pis: valorPIS,
        valor_Cofins: valorCOFINS,
        total_Impostos: totalImpostos,
      },
    });
  } catch (err: any) {
    console.error('[IMPOSTOS] ERRO:', err);
    return res.status(500).json({
      error: 'Falha ao calcular impostos',
      detail: err?.message ?? String(err),
    });
  } finally {
    if (client) client.release();
  }
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

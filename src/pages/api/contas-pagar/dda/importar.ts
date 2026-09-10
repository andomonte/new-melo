import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { parseDda, formatarCpfCnpj, type DdaTitulo } from '@/lib/dda/parseDda';

export const config = { api: { bodyParser: { sizeLimit: '20mb' } } };

/**
 * POST /api/contas-pagar/dda/importar
 * body: { arquivoBase64, nome? }
 *
 * Importa o arquivo DDA (CNAB240 Itaú), separa os títulos e os cedentes (distintos por CNPJ),
 * e marca quais cedentes já estão cadastrados em dbcredor (comparação por dígitos, pois o
 * cpf_cgc do cadastro vem em formatos variados). Fiel ao Delphi (DDA_BUSCAR_CEDENTE). NÃO grava
 * conta a pagar — isso é o passo "Importar/Confirmar" (fase seguinte).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido. Use POST.' });
  const { arquivoBase64 } = req.body || {};
  if (!arquivoBase64) return res.status(400).json({ erro: 'Envie o arquivo (arquivoBase64).' });

  let texto: string;
  try {
    texto = Buffer.from(String(arquivoBase64), 'base64').toString('latin1');
  } catch {
    return res.status(400).json({ erro: 'Não foi possível decodificar o arquivo.' });
  }

  const parsed = parseDda(texto);
  if (parsed.titulos.length === 0) {
    return res.status(400).json({
      erro: 'Nenhum título DDA reconhecido. Confira se é um arquivo DDA CNAB240 (linhas de 240 caracteres, banco 341/Itaú).',
      linhasLidas: parsed.linhasLidas,
      linhasInvalidas: parsed.linhasInvalidas,
    });
  }

  // dígitos sem zeros à esquerda (casa padding do arquivo × cadastro).
  const semZeros = (d: string) => d.replace(/\D/g, '').replace(/^0+/, '') || '0';

  // Cedentes distintos por CNPJ.
  const mapaCed = new Map<string, { cnpj: string; cnpjFmt: string; nome: string; tipo: 'F' | 'J'; qtdTitulos: number; valorTotal: number }>();
  for (const t of parsed.titulos) {
    const k = semZeros(t.cnpj);
    if (!mapaCed.has(k)) mapaCed.set(k, { cnpj: t.cnpj, cnpjFmt: t.cnpjFmt, nome: t.nome, tipo: t.tipoInscricao, qtdTitulos: 0, valorTotal: 0 });
    const c = mapaCed.get(k)!;
    c.qtdTitulos += 1;
    c.valorTotal += t.valor;
    if (!c.nome && t.nome) c.nome = t.nome;
  }

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const chaves = Array.from(mapaCed.keys());
    const cadastrados = new Map<string, { cod_credor: string; nome: string; tipo: string }>();
    if (chaves.length > 0) {
      const r = await client.query(
        `SELECT cod_credor, nome, tipo,
                LTRIM(regexp_replace(COALESCE(cpf_cgc,''), '\\D', '', 'g'), '0') AS doc
           FROM dbcredor
          WHERE LTRIM(regexp_replace(COALESCE(cpf_cgc,''), '\\D', '', 'g'), '0') = ANY($1::text[])`,
        [chaves],
      );
      for (const row of r.rows) {
        if (row.doc && !cadastrados.has(row.doc)) {
          cadastrados.set(row.doc, { cod_credor: row.cod_credor, nome: row.nome, tipo: row.tipo });
        }
      }
    }

    const cedentes = Array.from(mapaCed.entries()).map(([k, c]) => {
      const cad = cadastrados.get(k);
      return {
        cnpj: c.cnpj,
        cnpjFmt: c.cnpjFmt || formatarCpfCnpj(c.cnpj),
        nome: c.nome,
        tipo: c.tipo,
        cadastrado: !!cad,
        cod_credor: cad?.cod_credor || null,
        nome_credor: cad?.nome || null,
        qtdTitulos: c.qtdTitulos,
        valorTotal: c.valorTotal,
      };
    }).sort((a, b) => a.nome.localeCompare(b.nome));

    // Conferência: cada título do DDA já está lançado em dbpgto? (valor + vencimento
    // + credor quando cadastrado). Identifica "já lançado" × "novo" (evita duplicidade).
    const titulos = [];
    for (const t of parsed.titulos) {
      const cad = cadastrados.get(semZeros(t.cnpj));
      const codCredor = cad?.cod_credor || null;
      const m = await client.query(
        `SELECT cod_pgto, COALESCE(paga,'N') AS paga
           FROM dbpgto
          WHERE COALESCE(cancel,'N') <> 'S'
            AND ROUND(COALESCE(valor_pgto,0) * 100) = $1
            AND ($2::date IS NULL OR dt_venc::date = $2::date)
            AND ($3::text IS NULL OR cod_credor = $3)
          ORDER BY cod_pgto
          LIMIT 1`,
        [Math.round(t.valor * 100), t.dtVenc, codCredor],
      );
      const existente = m.rows[0];
      titulos.push({
        ...t,
        cadastrado: !!cad,
        cod_credor: codCredor,
        ja_lancado: !!existente,
        cod_pgto_existente: existente?.cod_pgto || null,
        pago_existente: existente ? existente.paga === 'S' : false,
      });
    }

    const cedCad = cedentes.filter((c) => c.cadastrado).length;
    const jaLancados = titulos.filter((t) => t.ja_lancado).length;
    return res.status(200).json({
      banco: parsed.banco,
      cedentes,
      titulos,
      resumo: {
        totalTitulos: titulos.length,
        valorTotal: titulos.reduce((s, t) => s + t.valor, 0),
        cedentesCadastrados: cedCad,
        cedentesNaoCadastrados: cedentes.length - cedCad,
        titulosJaLancados: jaLancados,
        titulosNovos: titulos.length - jaLancados,
        linhasInvalidas: parsed.linhasInvalidas,
      },
    });
  } catch (error: any) {
    console.error('Erro ao importar DDA:', error);
    return res.status(500).json({ erro: 'Erro ao importar DDA', detalhes: error.message });
  } finally {
    client.release();
  }
}

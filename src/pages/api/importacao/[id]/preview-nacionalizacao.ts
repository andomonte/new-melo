/**
 * POST /api/importacao/[id]/preview-nacionalizacao
 *
 * Monta o(s) XML(s) da NF-e de nacionalização em modo PREVIEW (NÃO transmite ao SEFAZ).
 * Fase 1 do spec docs/nota-nacionalizacao-web.md.
 *
 * Passos:
 *  1) carrega a DI (dbent_importacao) + itens associados (dbent_importacao_it_ent);
 *  2) parseia as adições do xml_original (server-side) → exportador/fabricante + II por adição;
 *  3) persiste as adições em dbent_importacao_adicao (upsert);
 *  4) rateia o II (vBC/vII) da adição para cada item pela participação no invoice;
 *  5) chama o builder isolado gerarNotasNacionalizacao (POR_DI padrão | POR_EXPORTADOR).
 *
 * Body: { modo?: 'POR_DI' | 'POR_EXPORTADOR', numeroNFInicial?: string }
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { DOMParser } from '@xmldom/xmldom';
import { getPgPool } from '@/lib/pgClient';
import type { PoolClient } from 'pg';
import {
  gerarNotasNacionalizacao,
  DadosNacionalizacao,
  ItemImportacaoNfe,
  ModoEmissaoImportacao,
} from '@/components/services/sefazNfe/gerarXmlImportacao';

/** "1.234,56" (pt) ou "1234.56" → number. O XML federal usa vírgula decimal. */
function moneyBR(v: string | null | undefined): number {
  if (!v) return 0;
  const s = String(v).trim();
  if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.')) || 0;
  return Number(s) || 0;
}

function tagText(parent: Element, tag: string): string {
  const el = parent.getElementsByTagName(tag)[0];
  return el?.textContent?.trim() ?? '';
}

interface AdicaoParsed {
  numAdicao: number;
  fornecedorNome: string;
  fabricanteNome: string;
  bc_ii: number;
  valor_ii: number;
  ncm: string;
}

/** Extrai as adições do XML da DI (formato Siscomex federal). */
function parseAdicoes(xml: string): AdicaoParsed[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const ads = doc.getElementsByTagName('adicao');
  const out: AdicaoParsed[] = [];
  for (let i = 0; i < ads.length; i++) {
    const ad = ads[i] as unknown as Element;
    out.push({
      numAdicao: parseInt(tagText(ad, 'numeroAdicao') || '0', 10),
      fornecedorNome: tagText(ad, 'fornecedorNome'),
      fabricanteNome: tagText(ad, 'fabricanteNome'),
      bc_ii: moneyBR(tagText(ad, 'iiBaseCalculo')),
      valor_ii: moneyBR(tagText(ad, 'iiAliquotaValorRecolher')), // ZFM = 0
      ncm: tagText(ad, 'dadosMercadoriaCodigoNcm'),
    });
  }
  return out;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

  const { id } = req.query;
  const importacaoId = parseInt(String(id), 10);
  if (!importacaoId) return res.status(400).json({ message: 'ID de importação inválido' });

  const modo: ModoEmissaoImportacao = req.body?.modo === 'POR_EXPORTADOR' ? 'POR_EXPORTADOR' : 'POR_DI';
  const numeroNFInicial = String(req.body?.numeroNFInicial || '1');

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS';
  const pool = getPgPool(filial);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    // 1) DI (cabeçalho)
    const diRes = await client.query(`SELECT * FROM dbent_importacao WHERE id = $1`, [importacaoId]);
    if (diRes.rows.length === 0) return res.status(404).json({ message: 'DI não encontrada' });
    const di = diRes.rows[0];

    // 2) Itens associados (codprod preenchido)
    const itensRes = await client.query(
      `SELECT it.*, p.ref, p.descr AS prod_descr
         FROM dbent_importacao_it_ent it
         LEFT JOIN dbprod p ON p.codprod = it.codprod
        WHERE it.id_importacao = $1 AND it.codprod IS NOT NULL
        ORDER BY it.numero_adicao, it.id`,
      [importacaoId],
    );
    if (itensRes.rows.length === 0) {
      return res.status(422).json({ message: 'Nenhum item associado a produto — associe os itens antes de gerar a nota.' });
    }

    // 3) Adições do XML → persistir
    const adicoes: AdicaoParsed[] = di.xml_original ? parseAdicoes(di.xml_original) : [];
    const adicaoPorNum = new Map<number, AdicaoParsed>();
    for (const a of adicoes) adicaoPorNum.set(a.numAdicao, a);

    await client.query('BEGIN');
    for (const a of adicoes) {
      await client.query(
        `INSERT INTO dbent_importacao_adicao
           (id_importacao, numero_adicao, ncm, cod_exportador, exportador_nome, cod_fabricante, bc_ii, valor_ii)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id_importacao, numero_adicao) DO UPDATE SET
           ncm = EXCLUDED.ncm, exportador_nome = EXCLUDED.exportador_nome,
           cod_fabricante = EXCLUDED.cod_fabricante, bc_ii = EXCLUDED.bc_ii, valor_ii = EXCLUDED.valor_ii`,
        [importacaoId, a.numAdicao, a.ncm, null, a.fornecedorNome, a.fabricanteNome, a.bc_ii, a.valor_ii],
      );
    }
    await client.query('COMMIT');

    // 4) Rateio do II por item: soma do invoice por adição → participação do item
    const somaInvoicePorAdicao = new Map<number, number>();
    for (const it of itensRes.rows) {
      const n = Number(it.numero_adicao) || 0;
      const inv = Number(it.invoice_total) || Number(it.proforma_total) || 0;
      somaInvoicePorAdicao.set(n, (somaInvoicePorAdicao.get(n) || 0) + inv);
    }

    const itens: ItemImportacaoNfe[] = itensRes.rows.map((it: any) => {
      const n = Number(it.numero_adicao) || 0;
      const ad = adicaoPorNum.get(n);
      const invItem = Number(it.invoice_total) || Number(it.proforma_total) || 0;
      const somaInv = somaInvoicePorAdicao.get(n) || 0;
      const share = somaInv > 0 ? invItem / somaInv : 0;
      const qtd = Number(it.qtd) || 0;
      // vUnit da nota: custo real por unidade (fallback invoice*taxa / proforma)
      const vUnit =
        Number(it.custo_unit_real) ||
        (Number(it.invoice_unit) ? Number(it.invoice_unit) * (Number(di.taxa_dolar) || 1) : Number(it.real_unit) || 0);
      const vProd = Math.round(vUnit * qtd * 100) / 100;
      const aliqIcms = Number(it.icms) || 0;

      return {
        codprod: it.codprod,
        descricao: it.descricao || it.prod_descr || '',
        ncm: it.ncm || ad?.ncm || '',
        cfop: '3102',
        unidade: it.unidade || 'UN',
        qtd,
        vUnit,
        adicao: {
          numero_adicao: n,
          seq_adicao: 1,
          cod_fabricante: ad?.fabricanteNome ? ad.fabricanteNome.slice(0, 60) : '',
          cod_exportador: ad?.fornecedorNome ? ad.fornecedorNome.slice(0, 60) : '',
          exportador_nome: ad?.fornecedorNome,
          bc_ii: Math.round((ad?.bc_ii || 0) * share * 100) / 100,
          despesa_aduaneira: 0,
          valor_ii: Math.round((ad?.valor_ii || 0) * share * 100) / 100,
          valor_iof: 0,
        },
        // Imposto mínimo p/ preview (origem 1 é forçada no builder):
        icms: { cstICMS: '00', baseICMS: vProd, pICMS: aliqIcms, vICMS: Math.round(vProd * aliqIcms) / 100 },
        ipi: { cstIPI: '50' }, // ZFM suspenso
        pis: { cstPIS: '01', vPIS: 0 },
        cofins: { cstCOFINS: '01', vCOFINS: 0 },
      };
    });

    // 5) Emitente (empresa MELO)
    const empRes = await client.query(`SELECT * FROM dadosempresa LIMIT 1`);
    const emp = empRes.rows[0] || {};
    const emitente = {
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

    // Destinatário exterior (POR_DI): primeiro fornecedor da DI
    const primeiraAd = adicoes[0];
    const dados: DadosNacionalizacao = {
      modo,
      ambiente: 2, // preview sempre homologação
      serie: '2',
      naturezaOperacao: 'IMPORTACAO DIRETA P/ COMERCIALIZACAO',
      cfopPadrao: '3102',
      emitente,
      di: {
        nro_di: di.nro_di,
        data_di: di.data_di,
        local_desembaraco: di.local_desembaraco || di.recinto_aduaneiro || '',
        uf_desembaraco: di.uf_desembaraco || 'AM',
        data_desembaraco: di.data_desembaraco || di.data_di,
        via_transporte: di.via_transporte ?? 1,
        forma_importacao: di.forma_importacao ?? 1,
        valor_afrmm: Number(di.valor_afrmm) || 0,
      },
      destExterior: { idEstrangeiro: (primeiraAd?.fornecedorNome || 'EXTERIOR').slice(0, 20), nome: primeiraAd?.fornecedorNome, cPais: '9999', xPais: 'EXTERIOR' },
      itens,
    };

    const notas = gerarNotasNacionalizacao(dados, numeroNFInicial);

    return res.status(200).json({
      success: true,
      modo,
      di: { id: importacaoId, nro_di: di.nro_di },
      qtd_itens: itens.length,
      qtd_adicoes: adicoes.length,
      notas: notas.map((n) => ({
        modo: n.modo,
        cod_exportador: n.cod_exportador,
        seq_nota: n.seq_nota,
        chave: n.chave,
        totais: n.totais,
        xml: n.xml,
      })),
    });
  } catch (e: any) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('[preview-nacionalizacao] erro:', e);
    return res.status(500).json({ message: 'Erro ao gerar preview da nota de nacionalização', detail: e.message });
  } finally {
    if (client) client.release();
  }
}

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
import { getPgPool } from '@/lib/pgClient';
import type { PoolClient } from 'pg';
import {
  gerarNotasNacionalizacao,
  DadosNacionalizacao,
  ItemImportacaoNfe,
  ModoEmissaoImportacao,
} from '@/components/services/sefazNfe/gerarXmlImportacao';
import {
  montarHierarquia,
  ordemItensNota,
  fornecedorPrincipal,
  type AdicaoHier,
  type RegraPrincipal,
} from '@/lib/compras/importacaoHierarquia';

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
        ORDER BY it.numero_adicao, it.num_item, it.id`,
      [importacaoId],
    );
    if (itensRes.rows.length === 0) {
      return res.status(422).json({ message: 'Nenhum item associado a produto — associe os itens antes de gerar a nota.' });
    }

    // 3) Adições PERSISTIDAS (hierarquia Fornecedor→Adição→Item) — não re-parseia o XML.
    //    A importação (post.ts) e o backfill já gravam fornecedor_nome/NCM/FOB por adição.
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

    // Vínculo fornecedor(DIe) → cliente (cadastro tipo X), gravado na fatura
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

    // 4) Monta a hierarquia a partir dos itens associados + adições persistidas
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
      return res.status(422).json({ message: 'Hierarquia de adições vazia — reimporte a DI para gerar fornecedor/adição/item.' });
    }

    const forns = montarHierarquia(adicoesHier);
    const ordem = ordemItensNota(forns);
    const regra: RegraPrincipal = di.fornecedor_principal_regra === 'MAIOR_FOB' ? 'MAIOR_FOB' : 'ADICAO_001';
    const principal = fornecedorPrincipal(forns, regra);

    // Destinatário exterior = cliente do fornecedor PRINCIPAL (adição 001 por padrão)
    let destExterior: NonNullable<DadosNacionalizacao['destExterior']> = {
      idEstrangeiro: (principal?.nome || 'EXTERIOR').slice(0, 20),
      nome: principal?.nome,
      cPais: '9999',
      xPais: 'EXTERIOR',
    };
    const codPrincipal = principal ? codClientePorForn.get(principal.nome) : undefined;
    if (codPrincipal) {
      const cli = await client.query(`SELECT nome, cpfcgc, codpais FROM dbclien WHERE codcli = $1`, [codPrincipal]);
      const c = cli.rows[0];
      if (c) {
        let xPais = 'EXTERIOR';
        if (c.codpais) {
          const p = await client.query(`SELECT descricao FROM dbpais WHERE codpais = $1`, [c.codpais]);
          xPais = p.rows[0]?.descricao || xPais;
        }
        destExterior = {
          idEstrangeiro: String(c.cpfcgc || 'EXTERIOR').slice(0, 20),
          nome: c.nome,
          cPais: c.codpais ? String(c.codpais) : '9999',
          xPais,
        };
      }
    }

    // 5) Itens da nota na ORDEM da listagem (fornecedor→adição→numItem)
    const itens: ItemImportacaoNfe[] = ordem.map((o) => {
      const it: any = (o.item as any)._row;
      const fornItem = fornecedorPorAdicao.get(o.numAdicao) || '';
      const codExp = codClientePorForn.get(fornItem) || ''; // cExportador = cliente do fornecedor do item
      const ad = dadosAdicao.get(o.numAdicao);
      const qtd = Number(it.qtd) || 0;
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
          numero_adicao: o.numAdicao,     // nAdicao
          seq_adicao: o.numItem,          // nSeqAdic = numItem da DIe
          cod_exportador: codExp,         // cExportador = cliente do fornecedor do item
          cod_fabricante: codExp,         // cFabricante = cliente do fornecedor da adição (placeholder = exportador)
          exportador_nome: fornItem,
          bc_ii: Number(ad?.bc_ii) || 0,
          despesa_aduaneira: 0,
          valor_ii: Number(ad?.valor_ii) || 0, // ZFM = 0
          valor_iof: 0,
        },
        icms: { cstICMS: '00', baseICMS: vProd, pICMS: aliqIcms, vICMS: Math.round(vProd * aliqIcms) / 100 },
        ipi: { cstIPI: '50' }, // ZFM suspenso
        pis: { cstPIS: '01', vPIS: 0 },
        cofins: { cstCOFINS: '01', vCOFINS: 0 },
      };
    });

    // infCpl: lista todos os fornecedores (cliente vinculado + adições + fatura)
    const infCpl =
      `DI ${di.nro_di} - NACIONALIZACAO. FORNECEDORES: ` +
      forns
        .map((f) => {
          const cod = codClientePorForn.get(f.nome) || 'S/VINCULO';
          const inv = invoicePorForn.get(f.nome);
          const ads = f.adicoes.map((a) => String(a.numAdicao).padStart(3, '0')).join(',');
          return `${f.nome} (cliente ${cod}${inv ? `, fatura ${inv}` : ''}, adicoes ${ads})`;
        })
        .join(' | ');
    const adicoes = adRes.rows; // p/ contagem na resposta

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
      destExterior,
      infCpl,
      itens,
    };

    const notas = gerarNotasNacionalizacao(dados, numeroNFInicial);

    return res.status(200).json({
      success: true,
      modo,
      regra_principal: regra,
      di: { id: importacaoId, nro_di: di.nro_di },
      principal: principal ? { fornecedor: principal.nome, cod_cliente: codPrincipal || null } : null,
      qtd_itens: itens.length,
      qtd_adicoes: adicoes.length,
      qtd_fornecedores: forns.length,
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

import { RelatorioValidacaoError, type ColunaDef, type Relatorio } from '../tipos';
import { AVISO_DBPRODFAT, DOC_FATURA, consultar, dataLocal, numerosDasColunas, periodo } from './_utilB';

/**
 * Relatórios › Gerenciais › Resumo de Documentos (Delphi: frmRelFatura / tabResumoDoc — RELATO.RESUMO_DOCUMENTO).
 * Para um cliente, os documentos do período (N.F. e F.A.G.) e as vendas que os originaram, opcionalmente
 * com os itens. Diferenças do legado:
 *  - venda ↔ documento: dbprodfat.codvenda, fatura_venda (web) e dbfecharvendas; documento sem venda ligada
 *    também aparece (o legado só mostrava os que tinham itens);
 *  - documento interno: dbdocinterno não existe no banco novo — notas de documento interno aparecem com o
 *    código do D.I. do item (dbprodfat.codint), sem os dados do D.I.;
 *  - D1/D2 (tipos de venda sem movimento desde 2009) não entram;
 *  - com itens: os itens vêm de dbprodfat (só desde 08/2026); documento sem itens no banco novo sai numa
 *    linha com o total de produtos da nota.
 */
const colunasSem: ColunaDef[] = [
  { campo: 'documento', titulo: 'Documento' },
  { campo: 'data', titulo: 'Data doc.', tipo: 'data' },
  { campo: 'venda', titulo: 'Venda' },
  { campo: 'data_venda', titulo: 'Data venda', tipo: 'data' },
  { campo: 'total_venda', titulo: 'Total venda', tipo: 'moeda', total: true },
  { campo: 'total_doc', titulo: 'Total documento', tipo: 'moeda' },
];
const colunasCom: ColunaDef[] = [
  { campo: 'documento', titulo: 'Documento' },
  { campo: 'venda', titulo: 'Venda' },
  { campo: 'ref', titulo: 'Referência' },
  { campo: 'marca', titulo: 'Marca' },
  { campo: 'descr', titulo: 'Descrição' },
  { campo: 'qtd', titulo: 'Qtde', tipo: 'inteiro', total: true },
  { campo: 'prunit', titulo: 'Pr. unitário', tipo: 'moeda' },
  { campo: 'total', titulo: 'Total', tipo: 'moeda', total: true },
];

export const relatorio: Relatorio = {
  slug: 'resumoDocumentos',
  titulo: 'Resumo de Documentos',
  descricao:
    'Para um cliente, os documentos do período (N.F. e F.A.G.) e as vendas que os originaram, com ou sem os itens. ' +
    'O vínculo venda × documento no banco novo só existe para as notas emitidas pelo web (desde 08/2025); documentos mais antigos aparecem sem a venda. ' +
    AVISO_DBPRODFAT + ' Documentos internos: sem os dados do D.I. (a tabela dbdocinterno ainda não existe no banco novo).',
  paisagem: true,
  filtros: [
    { campo: 'periodo', rotulo: 'Período (data do documento)', tipo: 'periodo', obrigatorio: true, padrao: { de: 'inicio_mes', ate: 'hoje' } },
    { campo: 'cliente', rotulo: 'Cliente', tipo: 'lookup', lookup: 'cliente', obrigatorio: true },
    { campo: 'documento', rotulo: 'Documento', tipo: 'select', padrao: 'T',
      opcoes: [{ valor: 'T', rotulo: 'Todos' }, { valor: 'F', rotulo: 'F.A.G.' }, { valor: 'N', rotulo: 'N.F.' }] },
    { campo: 'itens', rotulo: 'Mostrar itens', tipo: 'checkbox', padrao: true },
  ],
  colunas: colunasCom,
  quebra: 'documento',
  async executar(db, p) {
    const { de, ate } = periodo(p);
    if (!p.cliente) throw new RelatorioValidacaoError('Informe o cliente.');
    const params: any[] = [de, ate, p.cliente];
    const onde = [`f.data BETWEEN $1::date AND $2::date`, `f.cancel = 'N'`, `f.codcli = $3`, `COALESCE(f.tipofat, '') <> '2'`];
    if (p.documento === 'F') onde.push(`f.tipofat = '3'`);
    else if (p.documento === 'N') onde.push(`COALESCE(f.tipofat, '1') <> '3'`);
    const docs = `docs AS (
        SELECT f.codfat, f.data, f.totalnf, f.totalprod,
               CASE WHEN f.tipofat = '3' THEN 'F' || f.codfat ELSE 'NF' || COALESCE(f.nroform, f.codfat) END
                 || CASE WHEN f.tipodoc = 'I' THEN ' (doc. interno)' ELSE '' END
                 || ' — ' || to_char(f.data, 'DD/MM/YYYY') AS documento, ${DOC_FATURA('f')} AS tipo
          FROM dbfatura f WHERE ${onde.join(' AND ')})`;

    if (!p.itens) {
      const linhas = await consultar(db,
        `WITH ${docs},
         lig AS (
           SELECT pf.codfat, pf.codvenda, max(pf.codint) AS codint FROM dbprodfat pf JOIN docs d ON d.codfat = pf.codfat GROUP BY 1, 2
           UNION SELECT fv.codfat, fv.codvenda, NULL FROM fatura_venda fv JOIN docs d ON d.codfat = fv.codfat
                  WHERE COALESCE(fv.status, 'ativo') = 'ativo'
           UNION SELECT fe.codfat, fe.codvenda, NULL FROM dbfecharvendas fe JOIN docs d ON d.codfat = fe.codfat),
         lig1 AS (SELECT codfat, codvenda, max(codint) AS codint FROM lig GROUP BY 1, 2)
         SELECT d.documento, to_char(d.data, 'YYYY-MM-DD') AS data,
                CASE WHEN v.codvenda IS NOT NULL THEN COALESCE(v.tipo, '') || COALESCE(v.nrovenda, v.codvenda)
                     WHEN l.codint IS NOT NULL THEN 'DI' || l.codint ELSE l.codvenda END AS venda,
                to_char(${dataLocal('v.data')}, 'YYYY-MM-DD') AS data_venda, v.total AS total_venda, d.totalnf AS total_doc
           FROM docs d
           LEFT JOIN lig1 l ON l.codfat = d.codfat
           LEFT JOIN dbvenda v ON v.codvenda = l.codvenda
          ORDER BY d.data, d.documento, 3`, params);
      return { linhas: numerosDasColunas(linhas, colunasSem), colunas: colunasSem };
    }

    const linhas = await consultar(db,
      `WITH ${docs}
       SELECT d.documento,
              CASE WHEN v.codvenda IS NOT NULL THEN COALESCE(v.tipo, '') || COALESCE(v.nrovenda, v.codvenda)
                   WHEN pf.codint IS NOT NULL THEN 'DI' || pf.codint ELSE pf.codvenda END AS venda,
              COALESCE(pd.ref, pf.ref) AS ref, m.descr AS marca, COALESCE(pf.descr, pd.descr) AS descr,
              pf.qtde AS qtd, pf.prunit, round(COALESCE(pf.qtde, 0) * COALESCE(pf.prunit, 0), 2) AS total, d.data, 1 AS ordem
         FROM docs d
         JOIN dbprodfat pf ON pf.codfat = d.codfat
         LEFT JOIN dbvenda v ON v.codvenda = pf.codvenda
         LEFT JOIN dbprod pd ON pd.codprod = pf.codprod
         LEFT JOIN dbmarcas m ON m.codmarca = pd.codmarca
       UNION ALL
       SELECT d.documento, NULL, NULL, NULL, '(itens não disponíveis no banco novo — total de produtos da nota)',
              NULL, NULL, d.totalprod, d.data, 2
         FROM docs d
        WHERE NOT EXISTS (SELECT 1 FROM dbprodfat pf WHERE pf.codfat = d.codfat)
        ORDER BY 9, 1, 10, 2, 3`, params);
    const avisos = linhas.some((l) => l.ordem === 2) ? [AVISO_DBPRODFAT] : [];
    for (const l of linhas) { delete l.data; delete l.ordem; }
    return { linhas: numerosDasColunas(linhas, colunasCom), colunas: colunasCom, avisos };
  },
};

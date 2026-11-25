import { RelatorioValidacaoError, type ColunaDef, type Relatorio } from '../tipos';
import { AVISO_DBPRODFAT, DOC_FATURA, FATURA_CLIENTE, consultar, numerosDasColunas, periodo } from './_utilB';

/**
 * Relatórios › Gerenciais › Resumo Doctos Grupo/Marca (Delphi: frmRelFatura / tabResumo_Doctos_Grupo_Marca —
 * FATURAMENTO_POR_DOC e FATURAMENTO_POR_DOC_GRUPO).
 * Documentos (N.F. ou F.A.G.) do período que têm produtos da(s) marca(s) ou grupo(s) escolhidos, com o total
 * desses produtos em cada documento, agrupados por cliente. No ramo Grupo, o legado abria por marca — aqui
 * também (coluna Marca). Diferenças: aceita vários códigos e "Todos" os documentos; considera só notas para
 * cliente (o legado não filtrava tipodest). Fonte: dbprodfat — itens só a partir de 08/2026 no banco novo.
 */
const colunasPara = (porGrupo: boolean): ColunaDef[] => [
  { campo: 'cliente', titulo: 'Cliente' },
  { campo: 'data', titulo: 'Data', tipo: 'data' },
  { campo: 'codfat', titulo: 'Fatura' },
  { campo: 'nroform', titulo: 'Formulário' },
  { campo: 'documento', titulo: 'Doc.' },
  ...(porGrupo ? [{ campo: 'grupo', titulo: 'Grupo' }, { campo: 'marca', titulo: 'Marca' }] : [{ campo: 'marca', titulo: 'Marca' }]),
  { campo: 'qtd', titulo: 'Qtde itens', tipo: 'inteiro', total: true },
  { campo: 'total', titulo: 'Total no documento', tipo: 'moeda', total: true },
  { campo: 'totalnf', titulo: 'Total da NF', tipo: 'moeda' },
];

export const relatorio: Relatorio = {
  slug: 'resumoDoctosGrupoMarca',
  titulo: 'Resumo Doctos Grupo/Marca',
  descricao:
    'Documentos (N.F. ou F.A.G.) do período que contêm produtos das marcas ou grupos escolhidos, com o total desses produtos em cada documento, agrupados por cliente. ' +
    AVISO_DBPRODFAT,
  paisagem: true,
  filtros: [
    { campo: 'periodo', rotulo: 'Período (data do documento)', tipo: 'periodo', obrigatorio: true, padrao: { de: 'inicio_mes', ate: 'hoje' } },
    { campo: 'por', rotulo: 'Filtrar por', tipo: 'select', obrigatorio: true, padrao: 'M',
      opcoes: [{ valor: 'M', rotulo: 'Marca' }, { valor: 'G', rotulo: 'Grupo de produto' }] },
    { campo: 'marcas', rotulo: 'Marcas', tipo: 'lookup', lookup: 'marca', multiplo: true },
    { campo: 'grupos', rotulo: 'Grupos de produto', tipo: 'lookup', lookup: 'grupo', multiplo: true },
    { campo: 'documento', rotulo: 'Documento', tipo: 'select', padrao: 'T',
      opcoes: [{ valor: 'T', rotulo: 'Todos' }, { valor: 'N', rotulo: 'N.F.' }, { valor: 'F', rotulo: 'F.A.G.' }] },
  ],
  colunas: colunasPara(false),
  quebra: 'cliente',
  async executar(db, p) {
    const { de, ate } = periodo(p);
    const porGrupo = p.por === 'G';
    const codigos = porGrupo ? p.grupos : p.marcas;
    if (!codigos) throw new RelatorioValidacaoError(porGrupo ? 'Escolha ao menos um grupo de produto.' : 'Escolha ao menos uma marca.');
    const params: any[] = [de, ate, codigos];
    const onde = [`f.data BETWEEN $1::date AND $2::date`, `f.cancel = 'N'`, FATURA_CLIENTE('f'), porGrupo ? `pd.codgpp = ANY($3)` : `pd.codmarca = ANY($3)`];
    if (p.documento === 'F') onde.push(`f.tipofat = '3'`);
    else if (p.documento === 'N') onde.push(`COALESCE(f.tipofat, '1') <> '3'`);
    const linhas = await consultar(db,
      `SELECT f.codcli || ' - ' || COALESCE(c.nome, '') AS cliente, to_char(f.data, 'YYYY-MM-DD') AS data, f.codfat, f.nroform,
              ${DOC_FATURA('f')} AS documento,
              ${porGrupo ? `COALESCE(g.descr, pd.codgpp) AS grupo,` : ''} COALESCE(m.descr, pd.codmarca) AS marca,
              sum(COALESCE(pf.qtde, 0)) AS qtd, round(sum(COALESCE(pf.qtde, 0) * COALESCE(pf.prunit, 0)), 2) AS total,
              max(f.totalnf) AS totalnf
         FROM dbfatura f
         JOIN dbprodfat pf ON pf.codfat = f.codfat
         JOIN dbprod pd ON pd.codprod = pf.codprod
         LEFT JOIN dbmarcas m ON m.codmarca = pd.codmarca
         LEFT JOIN dbgpprod g ON g.codgpp = pd.codgpp
         LEFT JOIN dbclien c ON c.codcli = f.codcli
        WHERE ${onde.join(' AND ')}
        GROUP BY 1, 2, 3, 4, 5, 6${porGrupo ? ', 7' : ''}
        ORDER BY 1, 2, 3`, params);
    const avisos: string[] = [];
    if (de < '2026-08-01') avisos.push(AVISO_DBPRODFAT);
    const colunas = colunasPara(porGrupo);
    return { linhas: numerosDasColunas(linhas, colunas), colunas, avisos };
  },
};

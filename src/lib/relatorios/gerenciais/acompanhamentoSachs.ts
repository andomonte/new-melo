import { RelatorioValidacaoError, type ColunaDef, type Relatorio } from '../tipos';
import { numeros } from './_utilD';

/**
 * Relatórios › Gerenciais › Acompanhamento SACHS (Delphi: FrmAcompanhamentoSACHS, sem fonte do form;
 * regra da procedure CONSULTA_SACHS_VENDA_ESTOQUE). Arquivos de venda e estoque para o fabricante,
 * com o código da filial no fabricante (20388201 = MAO … 20388205 = JPS). Diferenças deliberadas:
 *  - genérico: marca vira filtro (vazio = marca de nome exatamente "SACHS", como o LIKE 'SACHS' do
 *    legado — SACHS PESADO fica fora); só a filial atual (o legado juntava 5 filiais por dblink);
 *  - código da filial no fabricante: automático para Manaus (20388201) e Porto Velho (20388202), ou informado;
 *  - "Sintético de venda" sai um valor por mês do período (o legado somava tudo no mês da data inicial);
 *  - estoque: opção de esconder referências zeradas.
 */
const COLUNAS: Record<string, ColunaDef[]> = {
  V: [
    { campo: 'data_inicial', titulo: 'Data inicial' },
    { campo: 'data_final', titulo: 'Data final' },
    { campo: 'filial', titulo: 'Filial' },
    { campo: 'referencia', titulo: 'Referência' },
    { campo: 'qtd', titulo: 'Qtd', tipo: 'numero', total: true },
  ],
  E: [
    { campo: 'data_estoque', titulo: 'Data estoque' },
    { campo: 'filial', titulo: 'Filial' },
    { campo: 'referencia', titulo: 'Referência' },
    { campo: 'qtd', titulo: 'Qtd', tipo: 'numero', total: true },
  ],
  SV: [
    { campo: 'mes', titulo: 'Mês' },
    { campo: 'filial', titulo: 'Filial' },
    { campo: 'valor', titulo: 'Valor', tipo: 'moeda', total: true },
  ],
  SE: [
    { campo: 'mes', titulo: 'Mês' },
    { campo: 'filial', titulo: 'Filial' },
    { campo: 'valor', titulo: 'Valor', tipo: 'moeda', total: true },
  ],
};

export const relatorio: Relatorio = {
  slug: 'acompanhamentoSachs',
  titulo: 'Acompanhamento SACHS',
  descricao: 'Arquivos para o fabricante (padrão: marca SACHS): venda analítica por referência no período, estoque atual por referência, '
    + 'sintético de venda em valor por mês e sintético de estoque em valor (estoque × preço de compra). Vendas faturadas (status F), '
    + 'não canceladas, sem as vendas para as filiais da Melo (dbclien_filial). Só a filial atual. Quase sem movimento no legado desde 2025.',
  filtros: [
    { campo: 'tipo', rotulo: 'Tipo', tipo: 'select', obrigatorio: true, padrao: 'V',
      opcoes: [
        { valor: 'V', rotulo: 'Venda por referência' },
        { valor: 'E', rotulo: 'Estoque por referência' },
        { valor: 'SV', rotulo: 'Sintético de venda (valor)' },
        { valor: 'SE', rotulo: 'Sintético de estoque (valor)' },
      ] },
    { campo: 'periodo', rotulo: 'Período (venda)', tipo: 'periodo', padrao: { de: 'inicio_mes', ate: 'hoje' }, ajuda: 'Não usado nos tipos de estoque.' },
    { campo: 'marcas', rotulo: 'Marcas', tipo: 'lookup', lookup: 'marca', multiplo: true, ajuda: 'Vazio = marca SACHS.' },
    { campo: 'codigo_filial', rotulo: 'Código da filial no fabricante', tipo: 'texto', ajuda: 'Vazio = automático (Manaus 20388201, Porto Velho 20388202).' },
    { campo: 'esconder_zerados', rotulo: 'Estoque: esconder referências zeradas', tipo: 'checkbox', padrao: true },
  ],
  colunas: COLUNAS.V,
  async executar(db, p) {
    const tipo = COLUNAS[p.tipo] ? String(p.tipo) : 'V';
    if ((tipo === 'V' || tipo === 'SV') && (!p.de || !p.ate)) throw new RelatorioValidacaoError('Informe o período.');
    const params: any[] = [];
    let marca = `pd.codmarca IN (SELECT codmarca FROM dbmarcas WHERE upper(trim(descr)) = 'SACHS')`;
    if (p.marcas) { params.push(p.marcas); marca = `pd.codmarca = ANY($${params.length})`; }
    params.push(String(p.codigo_filial ?? '').trim() || null);
    const filial = `COALESCE($${params.length}::text, CASE current_schema() WHEN 'db_manaus' THEN '20388201'
                      WHEN 'db_rondonia' THEN '20388202' WHEN 'db_portovelho' THEN '20388202' ELSE '' END)`;

    let sql: string;
    if (tipo === 'V' || tipo === 'SV') {
      params.push(p.de, p.ate);
      const de = `$${params.length - 1}::date`;
      const ate = `$${params.length}::date`;
      const base = `FROM dbvenda v
           JOIN dbitvenda iv ON iv.codvenda = v.codvenda
           JOIN dbprod pd ON pd.codprod = iv.codprod
          WHERE ${marca} AND v.cancel = 'N' AND v.status = 'F'
            AND v.data >= ${de} AND v.data < ${ate} + 1
            AND v.codcli NOT IN (SELECT codcli FROM dbclien_filial WHERE codcli IS NOT NULL)`;
      sql = tipo === 'V'
        ? `SELECT to_char(${de}, 'YYYYMMDD') AS data_inicial, to_char(${ate}, 'YYYYMMDD') AS data_final, ${filial} AS filial,
                  trim(pd.ref) AS referencia, sum(iv.qtd) AS qtd
             ${base}
            GROUP BY trim(pd.ref) ORDER BY 4`
        : `SELECT to_char(v.data, 'YYYY,MM') AS mes, ${filial} AS filial, round(sum(iv.qtd * iv.prunit)::numeric, 2) AS valor
             ${base}
            GROUP BY 1 ORDER BY 1`;
    } else if (tipo === 'E') {
      sql = `SELECT to_char(current_date, 'YYYYMMDD') AS data_estoque, ${filial} AS filial, trim(pd.ref) AS referencia, sum(COALESCE(pd.qtest, 0)) AS qtd
               FROM dbprod pd
              WHERE ${marca}
              GROUP BY trim(pd.ref)
             ${p.esconder_zerados ? 'HAVING sum(COALESCE(pd.qtest, 0)) <> 0' : ''}
              ORDER BY 3`;
    } else {
      sql = `SELECT to_char(current_date, 'YYYY,MM') AS mes, ${filial} AS filial,
                    round(COALESCE(sum(COALESCE(pd.qtest, 0) * COALESCE(pd.prcompra, 0)), 0)::numeric, 2) AS valor
               FROM dbprod pd
              WHERE ${marca}`;
    }
    const rows = (await db.query(sql, params)).rows;
    return { linhas: numeros(rows, tipo === 'V' || tipo === 'E' ? ['qtd'] : ['valor']), colunas: COLUNAS[tipo] };
  },
};

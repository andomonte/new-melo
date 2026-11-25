import type { FiltroDef, Relatorio } from '../tipos';
import { numeros, SQL_SALDO_PEDIDO } from './_utilC';

/**
 * Relatórios › Gerenciais › Estoque Saturado / Estoque Crítico (Delphi: frmEstoqueSaturado e
 * frmEstoqueCritico, herdados de frmCMV; RELATORIOS.ESTOQUE_SATURADO / ESTOQUE_CRITICO).
 * Mesmo SQL, só muda o sentido: saturado = estoque acima do mínimo; crítico = abaixo.
 * Diferenças deliberadas:
 *  - o legado comparava com dbprod.qtestmin_sugerido, que está parado (jobs JOBS.PROJECAO_*
 *    quebrados no Oracle): aqui o padrão é o estoque mínimo atual (qtestmin) e o sugerido é opção;
 *  - coluna Pedido: vinha de dbrequis/dbitrequis (vazias no Oracle, inexistentes no PG); agora é o
 *    saldo das requisições de compra do web (cmp_it_requisicao), critério da Sugestão de Compras;
 *  - filtros em parâmetros (o legado concatenava vFiltro); informativo vazio entra (o NOT IN do
 *    Oracle excluía esses produtos sem querer); no saturado, opção de ignorar mínimo zero.
 */
export function relatorioEstoqueMinimo(sentido: 'excesso' | 'falta', slug: string, titulo: string): Relatorio {
  const excesso = sentido === 'excesso';
  const campoDif = excesso ? 'excesso' : 'falta';
  return {
    slug,
    titulo,
    descricao: (excesso
      ? 'Produtos estocados com estoque físico ACIMA do estoque mínimo, com o índice estoque ÷ mínimo e o excesso. '
      : 'Produtos estocados com estoque físico ABAIXO do estoque mínimo, com o índice estoque ÷ mínimo e a falta. ') +
      'A coluna Pedido é o saldo em requisições de compra submetidas/aprovadas. ' +
      'O mínimo sugerido (qtestmin_sugerido) está desatualizado desde que o cálculo automático do Delphi parou; por isso o padrão é o estoque mínimo atual do cadastro.',
    paisagem: true,
    filtros: [
      { campo: 'base_minimo', rotulo: 'Base do mínimo', tipo: 'select', padrao: 'atual',
        opcoes: [
          { valor: 'atual', rotulo: 'Estoque mínimo atual (qtestmin)' },
          { valor: 'sugerido', rotulo: 'Mínimo sugerido (qtestmin_sugerido, desatualizado)' },
        ] },
      { campo: 'marcas', rotulo: 'Marcas', tipo: 'lookup', lookup: 'marca', multiplo: true },
      { campo: 'grupos', rotulo: 'Grupos de produto', tipo: 'lookup', lookup: 'grupo', multiplo: true },
      { campo: 'gruposfunc', rotulo: 'Grupos funcionais', tipo: 'lookup', lookup: 'grupofunc', multiplo: true },
      { campo: 'compradores', rotulo: 'Compradores (do grupo)', tipo: 'lookup', lookup: 'comprador', multiplo: true },
      { campo: 'segmentos', rotulo: 'Segmentos (do grupo)', tipo: 'lookup', lookup: 'segmento', multiplo: true },
      { campo: 'informativo', rotulo: 'Informativo', tipo: 'texto',
        ajuda: 'Códigos do informativo separados por vírgula (ex.: *,L). Vazio = todos, menos D, S e ^.' },
      ...(excesso
        ? [{ campo: 'ignorar_sem_minimo', rotulo: 'Ignorar produtos com mínimo zero', tipo: 'checkbox', padrao: true } as FiltroDef]
        : []),
    ],
    colunas: [
      { campo: 'marca', titulo: 'Marca' },
      { campo: 'grupo', titulo: 'Grupo' },
      { campo: 'ref', titulo: 'Referência' },
      { campo: 'aplicacao', titulo: 'Aplicação' },
      { campo: 'curva', titulo: 'Curva' },
      { campo: 'est_minimo', titulo: 'Est. mínimo', tipo: 'inteiro', total: true },
      { campo: 'estoque', titulo: 'Est. físico', tipo: 'inteiro', total: true },
      { campo: 'indice', titulo: 'Índice (est./mín.)', tipo: 'numero' },
      { campo: campoDif, titulo: excesso ? 'Excesso' : 'Falta', tipo: 'inteiro', total: true },
      { campo: 'pedido', titulo: 'Pedido', tipo: 'inteiro', total: true },
    ],
    quebra: 'marca',
    async executar(db, p) {
      const sugerido = p.base_minimo === 'sugerido';
      const min = sugerido ? 'pd.qtestmin_sugerido' : 'pd.qtestmin';
      const curva = sugerido ? 'pd.curva_sugerido' : 'pd.curva';
      const qt = 'COALESCE(pd.qtest, 0)';
      const params: any[] = [];
      const onde = [`pd.est = 'S'`, `COALESCE(pd.excluido, 0) <> 1`, `${min} IS NOT NULL`,
        excesso ? `${min} < ${qt}` : `${min} > ${qt}`];
      if (excesso && p.ignorar_sem_minimo) onde.push(`${min} > 0`);
      const lista = (v: any, col: string) => { if (v) { params.push(v); onde.push(`${col} = ANY($${params.length})`); } };
      lista(p.marcas, 'pd.codmarca');
      lista(p.grupos, 'pd.codgpp');
      lista(p.gruposfunc, 'pd.codgpf');
      lista(p.compradores, 'g.codcomprador');
      lista(p.segmentos, 'g.codseg');
      const infs = String(p.informativo || '').split(',').map((s) => s.trim()).filter(Boolean);
      if (infs.length) lista(infs, 'pd.inf');
      else onde.push(`COALESCE(pd.inf, '') NOT IN ('D', 'S', '^')`);
      const rows = (await db.query(
        `SELECT m.descr AS marca, g.descr AS grupo, pd.ref, COALESCE(pd.aplic_extendida, pd.descr) AS aplicacao,
                ${curva} AS curva, ${min} AS est_minimo, ${qt} AS estoque,
                CASE WHEN ${min} = 0 THEN ${qt} ELSE round(${qt}::numeric / ${min}, 3) END AS indice,
                ${excesso ? `${qt} - ${min}` : `${min} - ${qt}`} AS ${campoDif},
                ${SQL_SALDO_PEDIDO('pd.codprod')} AS pedido
           FROM dbprod pd
           LEFT JOIN dbmarcas m ON m.codmarca = pd.codmarca
           LEFT JOIN dbgpprod g ON g.codgpp = pd.codgpp
          WHERE ${onde.join(' AND ')}
          ORDER BY m.descr, g.descr, ${curva}, pd.ref`, params)).rows;
      numeros(rows, ['est_minimo', 'estoque', 'indice', campoDif, 'pedido']);
      return { linhas: rows, resumo: [`${rows.length.toLocaleString('pt-BR')} produtos`] };
    },
  };
}

export const relatorio: Relatorio = relatorioEstoqueMinimo('excesso', 'estoqueSaturado', 'Estoque Saturado');

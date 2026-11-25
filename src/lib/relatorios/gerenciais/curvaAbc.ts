import type { ColunaDef, Relatorio } from '../tipos';

/**
 * Relatórios › Gerenciais › Curva ABC (Delphi: FrmRelCurva_Abc / procedure CURVA_ABC_IVENTARIO).
 * Valor de estoque REAL (prcompra × qtest) e IDEAL (prcompra × qtestmin) por grupo de produto ou
 * por marca, aberto nas curvas A/B/C/D e "sem curva" (dbprod.curva), com o % de cada curva.
 * Correções em relação ao legado (docs/relatorios-delphi/analise_grupo_C.md): as colunas
 * "Custo Real" recebiam o valor ideal, e o ramo Marca devolvia as colunas trocadas.
 */
const CURVAS = ['A', 'B', 'C', 'D', 'X'] as const; // X = sem curva
const rotuloCurva = (c: string) => (c === 'X' ? 'sem curva' : c);

const colunasPara = (mostrar: string): ColunaDef[] => {
  const cols: ColunaDef[] = [{ campo: 'codigo', titulo: 'Código' }, { campo: 'descricao', titulo: 'Descrição' }];
  if (mostrar !== 'real') CURVAS.forEach((c) => cols.push({ campo: `ideal_${c.toLowerCase()}`, titulo: `Ideal ${rotuloCurva(c)}`, tipo: 'moeda', total: true }));
  if (mostrar !== 'ideal') CURVAS.forEach((c) => cols.push({ campo: `real_${c.toLowerCase()}`, titulo: `Real ${rotuloCurva(c)}`, tipo: 'moeda', total: true }));
  if (mostrar !== 'real') cols.push({ campo: 'total_ideal', titulo: 'Total ideal', tipo: 'moeda', total: true });
  if (mostrar !== 'ideal') cols.push({ campo: 'total_real', titulo: 'Total real', tipo: 'moeda', total: true });
  return cols;
};

export const relatorio: Relatorio = {
  slug: 'curvaAbc',
  titulo: 'Curva ABC',
  descricao: 'Valor do estoque real (custo × estoque) e ideal (custo × estoque mínimo) por grupo de produto ou marca, aberto nas curvas A, B, C e D. A linha de total mostra o % de cada curva.',
  paisagem: true,
  filtros: [
    { campo: 'agrupar', rotulo: 'Agrupar por', tipo: 'select', obrigatorio: true, padrao: 'G',
      opcoes: [{ valor: 'G', rotulo: 'Grupo de produto' }, { valor: 'M', rotulo: 'Marca' }] },
    { campo: 'mostrar', rotulo: 'Valores', tipo: 'select', obrigatorio: true, padrao: 'ambos',
      opcoes: [{ valor: 'ambos', rotulo: 'Ideal e real' }, { valor: 'ideal', rotulo: 'Só ideal' }, { valor: 'real', rotulo: 'Só real' }] },
    { campo: 'marcas', rotulo: 'Marcas', tipo: 'lookup', lookup: 'marca', multiplo: true },
    { campo: 'grupos', rotulo: 'Grupos de produto', tipo: 'lookup', lookup: 'grupo', multiplo: true },
    { campo: 'somente_estocados', rotulo: 'Só produtos estocados (est = S)', tipo: 'checkbox', padrao: true },
  ],
  colunas: colunasPara('ambos'),
  async executar(db, p) {
    const porMarca = p.agrupar === 'M';
    const params: any[] = [];
    const onde: string[] = [`COALESCE(pd.excluido, 0) <> 1`];
    if (p.somente_estocados) onde.push(`pd.est = 'S'`);
    if (p.marcas) { params.push(p.marcas); onde.push(`pd.codmarca = ANY($${params.length})`); }
    if (p.grupos) { params.push(p.grupos); onde.push(`pd.codgpp = ANY($${params.length})`); }
    const curva = `COALESCE(NULLIF(upper(trim(pd.curva)), ''), 'X')`;
    const soma = (expr: string, c: string) =>
      `round(COALESCE(sum(${expr}) FILTER (WHERE ${curva} ${c === 'X' ? `NOT IN ('A','B','C','D')` : `= '${c}'`}), 0)::numeric, 2)`;
    const custo = `COALESCE(pd.prcompra, 0)`;
    const real = `${custo} * GREATEST(COALESCE(pd.qtest, 0), 0)`;
    const ideal = `${custo} * GREATEST(COALESCE(pd.qtestmin, 0), 0)`;
    const rows = (await db.query(
      `SELECT ${porMarca ? 'pd.codmarca' : 'pd.codgpp'} AS codigo, ${porMarca ? 'm.descr' : 'g.descr'} AS descricao,
              ${CURVAS.map((c) => `${soma(ideal, c)} AS ideal_${c.toLowerCase()}`).join(', ')},
              ${CURVAS.map((c) => `${soma(real, c)} AS real_${c.toLowerCase()}`).join(', ')},
              round(COALESCE(sum(${ideal}), 0)::numeric, 2) AS total_ideal,
              round(COALESCE(sum(${real}), 0)::numeric, 2) AS total_real
         FROM dbprod pd
         ${porMarca ? 'LEFT JOIN dbmarcas m ON m.codmarca = pd.codmarca' : 'LEFT JOIN dbgpprod g ON g.codgpp = pd.codgpp'}
        WHERE ${onde.join(' AND ')}
        GROUP BY 1, 2
       HAVING sum(${ideal}) <> 0 OR sum(${real}) <> 0
        ORDER BY 2, 1`, params)).rows.map((r) => {
      const o: Record<string, any> = { ...r };
      for (const k of Object.keys(o)) if (k !== 'codigo' && k !== 'descricao') o[k] = Number(o[k]);
      return o;
    });

    // % de cada curva sobre o total (como o rodapé do Delphi)
    const tot = (campo: string) => rows.reduce((s, r) => s + (r[campo] || 0), 0);
    const totIdeal = tot('total_ideal');
    const totReal = tot('total_real');
    const pct = (v: number, t: number) => (t ? ((v / t) * 100).toFixed(1).replace('.', ',') : '0');
    const resumo = [
      `Ideal: ${CURVAS.map((c) => `${rotuloCurva(c)} ${pct(tot(`ideal_${c.toLowerCase()}`), totIdeal)}%`).join(' · ')}`,
      `Real: ${CURVAS.map((c) => `${rotuloCurva(c)} ${pct(tot(`real_${c.toLowerCase()}`), totReal)}%`).join(' · ')}`,
    ];
    return { linhas: rows, colunas: colunasPara(String(p.mostrar || 'ambos')), resumo };
  },
};

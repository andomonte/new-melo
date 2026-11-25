import { RelatorioValidacaoError, type ColunaDef, type Relatorio } from '../tipos';
import { AVISO_ITENS, consultar, cteItensFaturados, numerosDasColunas } from './_utilB';

/**
 * Relatórios › Gerenciais › Projetar Vendas (Delphi: frmRelFatura / tabProjetarVendas —
 * TEMP.VENDCLI_GRUPO_MARCA, chamada uma vez por mês, e VENDEDOR.INC/DEL_SUGESTAO_VENDA).
 * Faturamento dos 3 meses anteriores ao mês da previsão nos clientes da CARTEIRA do vendedor
 * (dbclien.codvend, como o legado — não pelo vendedor da nota), por grupo de produto ou por cliente × grupo,
 * com a média e a projeção (base escolhida × (1 + % de crescimento)).
 * Diferença deliberada: no web é só consulta — o Delphi gravava a projeção em dbsugestaovendas (sem
 * gravação desde 12/2005); aqui a projeção já gravada para o mês aparece numa coluna, mas nada é gravado.
 */
const mesesAnteriores = (mes: string) => {
  const [y, m] = mes.split('-').map(Number);
  return [3, 2, 1].map((k) => {
    const d = new Date(Date.UTC(y, m - 1 - k, 1));
    return { ini: d.toISOString().slice(0, 10), rot: `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}` };
  });
};
const fimMes = (ini: string) => {
  const [y, m] = ini.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

const colunasPara = (porCliente: boolean, rot: string[]): ColunaDef[] => [
  ...(porCliente ? [{ campo: 'cliente', titulo: 'Cliente' }] : []),
  { campo: 'codgpp', titulo: 'Código' },
  { campo: 'grupo', titulo: 'Grupo' },
  { campo: 'mes1', titulo: `Total ${rot[0]}`, tipo: 'moeda', total: true },
  { campo: 'mes2', titulo: `Total ${rot[1]}`, tipo: 'moeda', total: true },
  { campo: 'mes3', titulo: `Total ${rot[2]}`, tipo: 'moeda', total: true },
  { campo: 'media', titulo: 'Média', tipo: 'moeda', total: true },
  { campo: 'projecao', titulo: 'Projeção', tipo: 'moeda', total: true },
  ...(porCliente ? [] : [{ campo: 'gravado', titulo: 'Projeção gravada', tipo: 'moeda' as const, total: true }]),
];

export const relatorio: Relatorio = {
  slug: 'projetarVendas',
  titulo: 'Projetar Vendas',
  descricao:
    'Projeção de venda de um vendedor para o mês escolhido, a partir do faturamento dos 3 meses anteriores nos clientes da carteira dele, por grupo de produto ou por cliente × grupo: média e projeção (base × (1 + % de crescimento)). ' +
    'Somente consulta — não grava a projeção (no sistema antigo ela era gravada, mas a função não é usada desde 2005); a projeção já gravada para o mês aparece na visão por grupo. ' +
    AVISO_ITENS,
  filtros: [
    { campo: 'vendedor', rotulo: 'Vendedor', tipo: 'lookup', lookup: 'vendedor', obrigatorio: true },
    { campo: 'mes', rotulo: 'Mês da previsão', tipo: 'mes', obrigatorio: true },
    { campo: 'visao', rotulo: 'Projeção por', tipo: 'select', obrigatorio: true, padrao: 'grupo',
      opcoes: [{ valor: 'grupo', rotulo: 'Grupo de produto' }, { valor: 'cliente', rotulo: 'Cliente × grupo' }] },
    { campo: 'base', rotulo: 'Base da projeção', tipo: 'select', obrigatorio: true, padrao: 'media',
      opcoes: [{ valor: 'media', rotulo: 'Média' }, { valor: 'mes1', rotulo: '1º mês' }, { valor: 'mes2', rotulo: '2º mês' }, { valor: 'mes3', rotulo: '3º mês (anterior)' }] },
    { campo: 'crescimento', rotulo: '% de crescimento', tipo: 'numero', padrao: 0 },
  ],
  colunas: colunasPara(false, ['mês 1', 'mês 2', 'mês 3']),
  async executar(db, p) {
    if (!p.vendedor) throw new RelatorioValidacaoError('Escolha o código do vendedor.');
    if (!p.mes) throw new RelatorioValidacaoError('Informe o mês da previsão.');
    const meses = mesesAnteriores(p.mes);
    const porCliente = p.visao === 'cliente';
    const params: any[] = [];
    const cte = cteItensFaturados(params, meses[0].ini, fimMes(meses[2].ini));
    params.push(p.vendedor, meses[1].ini, meses[2].ini);
    const [pv, p2, p3] = [params.length - 2, params.length - 1, params.length];
    const [mm, yy] = [p.mes.slice(5, 7), p.mes.slice(0, 4)];
    if (!porCliente) params.push(`${mm}/${yy}`);
    const pMes = params.length;
    const mesDe = `CASE WHEN i.data >= $${p3}::date THEN 3 WHEN i.data >= $${p2}::date THEN 2 ELSE 1 END`;
    const linhas = await consultar(db,
      `WITH ${cte},
       t AS (
         SELECT ${porCliente ? `i.codcli,` : ''} pd.codgpp,
                sum(i.valor) FILTER (WHERE ${mesDe} = 1) AS mes1,
                sum(i.valor) FILTER (WHERE ${mesDe} = 2) AS mes2,
                sum(i.valor) FILTER (WHERE ${mesDe} = 3) AS mes3
           FROM itf i
           JOIN dbclien c ON c.codcli = i.codcli AND c.codvend = $${pv}
           LEFT JOIN dbprod pd ON pd.codprod = i.codprod
          GROUP BY ${porCliente ? '1, 2' : '1'})
       SELECT ${porCliente ? `t.codcli || ' - ' || COALESCE(c.nome, '') AS cliente,` : ''} t.codgpp, COALESCE(g.descr, '(sem grupo)') AS grupo,
              round(COALESCE(t.mes1, 0), 2) AS mes1, round(COALESCE(t.mes2, 0), 2) AS mes2, round(COALESCE(t.mes3, 0), 2) AS mes3
              ${porCliente ? '' : `, (SELECT sum(s.valor) FROM dbsugestaovendas s WHERE s.codvend = $${pv} AND s.codgpp = t.codgpp AND s.mes = $${pMes}) AS gravado`}
         FROM t
         LEFT JOIN dbgpprod g ON g.codgpp = t.codgpp
         ${porCliente ? 'LEFT JOIN dbclien c ON c.codcli = t.codcli' : ''}
        ORDER BY ${porCliente ? 'c.nome, ' : ''}grupo`, params);
    const fator = 1 + (Number(p.crescimento) || 0) / 100;
    const colunas = colunasPara(porCliente, meses.map((m) => m.rot));
    numerosDasColunas(linhas, colunas);
    for (const l of linhas) {
      l.media = Math.round(((l.mes1 + l.mes2 + l.mes3) / 3) * 100) / 100;
      const base = p.base && p.base !== 'media' ? l[p.base] : l.media;
      l.projecao = Math.round(base * fator * 100) / 100;
    }
    const avisos = meses[0].ini <= '2026-07-31' && fimMes(meses[2].ini) >= '2025-07-01' ? [AVISO_ITENS] : [];
    return { linhas, colunas, quebra: porCliente ? 'cliente' : null, avisos };
  },
};

import type { Relatorio } from '../tipos';
import { diaIso, hora, numerar, periodo, situacaoVenda } from './_utilA';

/**
 * Relatórios › Gerenciais › Vendas Desbloqueadas (Delphi: frmRelatorioVendaDesbloqueada /
 * VENDAS_OPERACOES.HISTORICO_DESBLOQUEADAS). Auditoria das vendas bloqueadas que foram analisadas
 * (liberadas, editadas, canceladas…): quem, quando, totais e margens.
 * Diferenças do legado (relatório reescrito sobre o modelo web):
 *  - o histórico do Delphi (dbvenda_desbloqueada_historico + xaud_dbvenda, alimentado por trigger)
 *    não foi migrado; aqui a fonte é dbanalise_liberacao, gravada pela tela Vendas Bloqueadas do
 *    web (desde 07/2026). Não há IP, máquina nem usuário da rede (o web não grava);
 *  - as margens são calculadas AGORA com o custo gravado nos itens da venda (dbitvenda.prcompra e
 *    prmedio), não uma foto do momento da liberação; margem = (venda ÷ custo − 1) × 100;
 *  - o filtro Venda/Garantia/Devolução do Delphi não tem equivalente no web e foi retirado.
 */
export const relatorio: Relatorio = {
  slug: 'vendasDesbloqueadas',
  titulo: 'Vendas Desbloqueadas',
  descricao: 'Vendas bloqueadas que passaram pela análise de liberação no período (data da conclusão): resultado, usuário, data e hora, total da venda, total a custo de compra e a custo médio e as margens. Fonte: análises registradas pelo web (desde 07/2026); o histórico do Delphi não foi migrado e o web não grava IP/máquina. As margens usam o custo gravado nos itens da venda.',
  paisagem: true,
  filtros: [
    { campo: 'periodo', rotulo: 'Período', tipo: 'periodo', obrigatorio: true, padrao: { de: 'inicio_mes', ate: 'hoje' }, largura: 2 },
    { campo: 'cliente', rotulo: 'Cliente', tipo: 'lookup', lookup: 'cliente' },
    { campo: 'resultado', rotulo: 'Resultado da análise', tipo: 'select', padrao: 'LIBERADA',
      opcoes: [{ valor: 'LIBERADA', rotulo: 'Liberadas' }, { valor: 'todas', rotulo: 'Todas as análises concluídas' }] },
    { campo: 'fatura', rotulo: 'Fatura', tipo: 'select', padrao: 'todas',
      opcoes: [{ valor: 'todas', rotulo: 'Todas' }, { valor: 'F', rotulo: 'Faturadas' }, { valor: 'N', rotulo: 'Não faturadas' }] },
    { campo: 'nrovenda', rotulo: 'Nº da venda', tipo: 'texto' },
  ],
  colunas: [
    { campo: 'nrovenda', titulo: 'Nº venda' },
    { campo: 'cliente', titulo: 'Cliente' },
    { campo: 'total_venda', titulo: 'Total venda', tipo: 'moeda', total: true },
    { campo: 'total_compra', titulo: 'Total compra', tipo: 'moeda', total: true },
    { campo: 'margem_compra', titulo: 'Margem compra (%)', tipo: 'percentual' },
    { campo: 'total_medio', titulo: 'Total médio', tipo: 'moeda', total: true },
    { campo: 'margem_medio', titulo: 'Margem médio (%)', tipo: 'percentual' },
    { campo: 'data', titulo: 'Data', tipo: 'data' },
    { campo: 'hora', titulo: 'Hora' },
    { campo: 'usuario', titulo: 'Usuário' },
    { campo: 'resultado', titulo: 'Resultado' },
    { campo: 'motivo', titulo: 'Motivo' },
    { campo: 'situacao', titulo: 'Situação da venda' },
  ],
  async executar(db, p) {
    const params: any[] = [p.de, p.ate];
    const onde = [`a.dt_conclusao IS NOT NULL`, periodo('a.dt_conclusao', 1, 2)];
    if (p.resultado !== 'todas') onde.push(`a.resultado = 'LIBERADA'`);
    if (p.cliente) { params.push(p.cliente); onde.push(`v.codcli = $${params.length}`); }
    if (p.fatura === 'F') onde.push(`v.status = 'F'`);
    if (p.fatura === 'N') onde.push(`COALESCE(v.status, '') <> 'F'`);
    if (p.nrovenda) {
      params.push(String(p.nrovenda).replace(/\D/g, ''));
      onde.push(`(ltrim(v.nrovenda, '0') = ltrim($${params.length}, '0') OR ltrim(v.codvenda, '0') = ltrim($${params.length}, '0'))`);
    }
    const rows = (await db.query(
      `WITH a AS (
         SELECT a.*, v.tipo, v.nrovenda, v.codcli, v.status, v.cancel, v.total
           FROM dbanalise_liberacao a JOIN dbvenda v ON v.codvenda = a.codvenda
          WHERE ${onde.join(' AND ')}
       ), it AS (
         SELECT i.codvenda,
                sum(COALESCE(i.qtd, 0) * COALESCE(i.prunit, 0)) AS venda,
                sum(COALESCE(i.qtd, 0) * COALESCE(i.prcompra, 0)) AS compra,
                sum(COALESCE(i.qtd, 0) * COALESCE(i.prmedio, 0)) AS medio
           FROM dbitvenda i WHERE i.codvenda IN (SELECT codvenda FROM a) GROUP BY i.codvenda
       )
       SELECT COALESCE(a.tipo, '') || COALESCE(a.nrovenda, a.codvenda) AS nrovenda,
              a.codcli || ' - ' || COALESCE(c.nome, '') AS cliente,
              round(COALESCE(a.total, it.venda, 0)::numeric, 2) AS total_venda,
              round(COALESCE(it.compra, 0)::numeric, 2) AS total_compra,
              CASE WHEN COALESCE(it.compra, 0) > 0 THEN round(((it.venda / it.compra - 1) * 100)::numeric, 2) END AS margem_compra,
              round(COALESCE(it.medio, 0)::numeric, 2) AS total_medio,
              CASE WHEN COALESCE(it.medio, 0) > 0 THEN round(((it.venda / it.medio - 1) * 100)::numeric, 2) END AS margem_medio,
              ${diaIso('a.dt_conclusao')} AS data, ${hora('a.dt_conclusao')} AS hora,
              a.usuario, a.resultado, a.motivo, ${situacaoVenda('a')} AS situacao
         FROM a
         LEFT JOIN it ON it.codvenda = a.codvenda
         LEFT JOIN dbclien c ON c.codcli = a.codcli
        ORDER BY a.dt_conclusao, a.id`, params)).rows;
    numerar(rows, ['total_venda', 'total_compra', 'margem_compra', 'total_medio', 'margem_medio']);

    // margens do total (como o rodapé do Delphi)
    const s = (k: string) => rows.reduce((t, r) => t + (r[k] || 0), 0);
    const tv = s('total_venda'); const tc = s('total_compra'); const tm = s('total_medio');
    const totais: Record<string, number> = { total_venda: tv, total_compra: tc, total_medio: tm };
    if (tc > 0) totais.margem_compra = Number(((tv / tc - 1) * 100).toFixed(2));
    if (tm > 0) totais.margem_medio = Number(((tv / tm - 1) * 100).toFixed(2));
    return { linhas: rows, totais };
  },
};

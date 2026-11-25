import type { Relatorio } from '../tipos';
import { avisoLacunaVendas, diaIso, numerar, periodo } from './_utilA';

/**
 * Relatórios › Gerenciais › Produto sem Demanda (Delphi: FrmRelatorioGeral / TabProdSemDemanda /
 * procedure PRODUTO_SEM_DEMANDA). Produtos com estoque que tiveram entrada confirmada no período e
 * nenhuma venda (não cancelada) no mesmo período.
 * Diferenças do legado: o Delphi mandava sempre o tipo 'M' (Grupo filtrava como se fosse marca) —
 * aqui marca e grupo são filtros independentes e com vários códigos; o código deixou de ser
 * obrigatório; SQL parametrizado (o legado concatenava as datas e o código).
 */
export const relatorio: Relatorio = {
  slug: 'produtoSemDemanda',
  titulo: 'Produto sem Demanda',
  descricao: 'Produtos com estoque (dbprod.qtest > 0) que tiveram entrada confirmada no período e não tiveram nenhuma venda não cancelada no período. Observação: o banco novo só tem entradas de 07/2025 a 11/2025 (≈2,6 mil notas migradas) e as lançadas no web a partir de 08/2026; fora disso o relatório sai vazio. Como as vendas migradas vão só até 06/2025, em 07/2025 a 07/2026 todo produto com entrada aparece "sem demanda" (o relatório avisa os meses sem vendas).',
  filtros: [
    { campo: 'periodo', rotulo: 'Período', tipo: 'periodo', obrigatorio: true, padrao: { de: 'inicio_mes', ate: 'hoje' }, largura: 2 },
    { campo: 'marcas', rotulo: 'Marcas', tipo: 'lookup', lookup: 'marca', multiplo: true },
    { campo: 'grupos', rotulo: 'Grupos de produto', tipo: 'lookup', lookup: 'grupo', multiplo: true },
  ],
  colunas: [
    { campo: 'grupo', titulo: 'Grupo' },
    { campo: 'marca', titulo: 'Marca' },
    { campo: 'codprod', titulo: 'Código' },
    { campo: 'ref', titulo: 'Referência' },
    { campo: 'descr', titulo: 'Descrição' },
    { campo: 'qtest', titulo: 'Estoque', tipo: 'numero', total: true },
    { campo: 'qtd_entrada', titulo: 'Qtd. entrada no período', tipo: 'numero', total: true },
    { campo: 'ult_entrada', titulo: 'Última entrada', tipo: 'data' },
    { campo: 'prcompra', titulo: 'Pr. compra', tipo: 'moeda' },
    { campo: 'prcustoatual', titulo: 'Custo atual', tipo: 'moeda' },
    { campo: 'valor_estoque', titulo: 'Estoque × custo', tipo: 'moeda', total: true },
  ],
  async executar(db, p) {
    const params: any[] = [p.de, p.ate];
    const onde = [`COALESCE(pd.qtest, 0) > 0`, `COALESCE(pd.excluido, 0) <> 1`];
    if (p.marcas) { params.push(p.marcas); onde.push(`pd.codmarca = ANY($${params.length})`); }
    if (p.grupos) { params.push(p.grupos); onde.push(`pd.codgpp = ANY($${params.length})`); }
    const rows = (await db.query(
      `WITH ent AS (
         SELECT ie.codprod, sum(COALESCE(ie.quant, 0)) AS qtd_entrada, max(e.dtent) AS ult_entrada
           FROM dbent e JOIN dbitent ie ON ie.codent = e.codent
          WHERE e.status = 'F' AND ${periodo('e.dtent', 1, 2)}
          GROUP BY ie.codprod
       )
       SELECT g.descr AS grupo, m.descr AS marca, pd.codprod, pd.ref, pd.descr, pd.qtest,
              ent.qtd_entrada, ${diaIso('ent.ult_entrada')} AS ult_entrada,
              round(COALESCE(pd.prcompra, 0)::numeric, 2) AS prcompra,
              round(COALESCE(pd.prcustoatual, 0)::numeric, 2) AS prcustoatual,
              round((COALESCE(pd.qtest, 0) * COALESCE(pd.prcompra, 0))::numeric, 2) AS valor_estoque
         FROM ent
         JOIN dbprod pd ON pd.codprod = ent.codprod
         LEFT JOIN dbmarcas m ON m.codmarca = pd.codmarca
         LEFT JOIN dbgpprod g ON g.codgpp = pd.codgpp
        WHERE ${onde.join(' AND ')}
          AND NOT EXISTS (
                SELECT 1 FROM dbitvenda i JOIN dbvenda v ON v.codvenda = i.codvenda
                 WHERE i.codprod = pd.codprod AND COALESCE(v.cancel, 'N') <> 'S' AND ${periodo('v.data', 1, 2, true)})
        ORDER BY pd.ref`, params)).rows;
    return { linhas: numerar(rows, ['qtest', 'qtd_entrada', 'prcompra', 'prcustoatual', 'valor_estoque']), avisos: await avisoLacunaVendas(db, p.de, p.ate) };
  },
};

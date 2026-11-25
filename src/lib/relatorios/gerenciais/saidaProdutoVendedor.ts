import { RelatorioValidacaoError, type Relatorio } from '../tipos';
import { avisoLacunaVendas, numerar, periodo } from './_utilA';

/**
 * Relatórios › Gerenciais › Saída de Produto por Vendedor (Delphi: frmExtratoVendedor / procedure
 * EXTRATO_VENDEDOR). Quantidade de uma referência vendida por vendedor no período, separada em D1,
 * Operador (telemarketing) e Externo.
 * Diferenças do legado:
 *  - Operador/Externo vinham dos itens de FATURA (dbprodfat, pela data da fatura) e o vendedor de
 *    dbvvend — nenhum dos dois tem histórico no PG. Aqui vêm dos itens das vendas FATURADAS
 *    (dbvenda.status = 'F'), pela data da venda; operador = dbitvenda.codoperador e externo =
 *    dbitvenda.codvend / dbvenda.codvend (com dbvvend como reserva);
 *  - D1 (dbvenda.tipo = '1'): como no Delphi, cada participante da venda recebe a quantidade;
 *  - a exclusão dos clientes da própria Melo (00002, 03341, 04487), fixa no legado, virou opção;
 *  - UNION sem ALL do legado (que podia juntar linhas iguais) não é reproduzido.
 */
const CLIENTES_MELO = ['00002', '03341', '04487'];

export const relatorio: Relatorio = {
  slug: 'saidaProdutoVendedor',
  titulo: 'Saída de Produto por Vendedor',
  descricao: 'Quantidade vendida de um produto (ou de todas as marcas de uma referência) por vendedor no período, separada em D1, Operador (telemarketing) e Externo. Operador e Externo consideram as vendas faturadas, pela data da venda (no Delphi era pela data da fatura).',
  filtros: [
    { campo: 'periodo', rotulo: 'Período', tipo: 'periodo', obrigatorio: true, padrao: { de: 'inicio_mes', ate: 'hoje' }, largura: 2 },
    { campo: 'produto', rotulo: 'Produto', tipo: 'lookup', lookup: 'produto' },
    { campo: 'ref', rotulo: 'ou Referência (exata)', tipo: 'texto', ajuda: 'Todas as marcas com essa referência.' },
    { campo: 'excluir_melo', rotulo: 'Excluir clientes da própria Melo (00002, 03341, 04487)', tipo: 'checkbox', padrao: true, largura: 2 },
  ],
  colunas: [
    { campo: 'vendedor', titulo: 'Vendedor' },
    { campo: 'tipo', titulo: 'Tipo de venda' },
    { campo: 'ref', titulo: 'Referência' },
    { campo: 'marca', titulo: 'Marca' },
    { campo: 'vendas', titulo: 'Nº vendas', tipo: 'inteiro', total: true },
    { campo: 'quantidade', titulo: 'Quantidade', tipo: 'numero', total: true },
  ],
  quebra: 'vendedor',
  async executar(db, p) {
    if (!p.produto && !p.ref) throw new RelatorioValidacaoError('Informe o produto ou a referência.');
    const params: any[] = [p.de, p.ate];
    let filtroProd: string;
    if (p.produto) { params.push(p.produto); filtroProd = `pd.codprod = $${params.length}`; }
    else { params.push(p.ref); filtroProd = `upper(pd.ref) = upper($${params.length})`; }
    params.push(p.excluir_melo ? CLIENTES_MELO : []);
    const pMelo = params.length;

    const rows = (await db.query(
      `WITH it AS (
         SELECT i.codvenda, i.codprod, COALESCE(i.qtd, 0) AS qtd, i.codvend, i.codoperador,
                v.tipo, v.tele, v.status, v.codvend AS codvend_venda, pd.ref, m.descr AS marca
           FROM dbprod pd
           JOIN dbitvenda i ON i.codprod = pd.codprod
           JOIN dbvenda v ON v.codvenda = i.codvenda
           LEFT JOIN dbmarcas m ON m.codmarca = pd.codmarca
          WHERE ${filtroProd}
            AND ${periodo('v.data', 1, 2, true)}
            AND COALESCE(v.cancel, 'N') <> 'S'
            AND NOT (v.codcli = ANY($${pMelo}::text[]))
       ), vv AS (
         SELECT x.codvenda, x.codvend, x.operador FROM dbvvend x WHERE x.codvenda IN (SELECT codvenda FROM it)
       ), lanc AS (
         -- D1: todos os participantes da venda
         SELECT 'D1' AS tipo, part.codvend, it.codvenda, it.ref, it.marca, it.qtd
           FROM it
           LEFT JOIN LATERAL (
             SELECT DISTINCT c AS codvend FROM unnest(ARRAY[it.codvend, it.codoperador, it.codvend_venda]) c WHERE c IS NOT NULL
             UNION SELECT vv.codvend FROM vv WHERE vv.codvenda = it.codvenda
           ) part ON true
          WHERE it.tipo = '1'
         UNION ALL
         -- Operador: telemarketing faturado
         SELECT 'Operador', COALESCE(it.codoperador, (SELECT min(vv.codvend) FROM vv WHERE vv.codvenda = it.codvenda AND vv.operador = 'S')),
                it.codvenda, it.ref, it.marca, it.qtd
           FROM it WHERE it.tipo <> '1' AND it.tele = 'S' AND it.status = 'F'
         UNION ALL
         -- Externo: venda normal faturada
         SELECT 'Externo', COALESCE(it.codvend, it.codvend_venda, (SELECT min(vv.codvend) FROM vv WHERE vv.codvenda = it.codvenda AND vv.operador = 'N')),
                it.codvenda, it.ref, it.marca, it.qtd
           FROM it WHERE it.tipo <> '1' AND COALESCE(it.tele, 'N') = 'N' AND it.status = 'F'
       )
       SELECT COALESCE(l.codvend || ' - ' || ve.nome, l.codvend, '(sem vendedor)') AS vendedor,
              l.tipo, l.ref, l.marca, count(DISTINCT l.codvenda) AS vendas, sum(l.qtd) AS quantidade
         FROM lanc l
         LEFT JOIN dbvend ve ON ve.codvend = l.codvend
        GROUP BY 1, 2, 3, 4
        ORDER BY 1, 2, 3, 4`, params)).rows;
    return { linhas: numerar(rows, ['vendas', 'quantidade']), avisos: await avisoLacunaVendas(db, p.de, p.ate) };
  },
};

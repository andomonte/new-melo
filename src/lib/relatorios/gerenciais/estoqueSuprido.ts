import type { Relatorio } from '../tipos';
import { diaIso, numerar, periodo } from './_utilA';

/**
 * Relatórios › Gerenciais › Estoque Suprido (Delphi: FrmRelatorioGeral / TabSuprido / procedure
 * ESTOQUE_SUPRIDO). Produtos que estavam zerados (dbitent.quantant = 0) e foram supridos por entrada
 * confirmada (dbent.status = 'F').
 * Diferenças do legado:
 *  - a data filtrada era a da ação 'CONFIRMAR ESTOQUE' em dbacao, que o web não grava; aqui é a
 *    data de fim da alocação (entrada_operacoes.fim_alocacao), senão a confirmação do estoque do
 *    recebimento (dbent_recebimento.data_confirmacao_estoque), senão a data da entrada (dbent.dtent);
 *  - o web não grava dbitent.quantant (estoque antes da entrada): entradas lançadas no web não
 *    aparecem até isso ser gravado;
 *  - o rodapé "TOTAL FATURADO PARA O VENDEDOR" da impressão (copiado de outro relatório) não existe.
 */
export const relatorio: Relatorio = {
  slug: 'estoqueSuprido',
  titulo: 'Estoque Suprido',
  descricao: 'Produtos que estavam com estoque zerado e foram supridos por entrada confirmada no período (quantidade que entrou, data e disponível atual). A data é a da confirmação/alocação da entrada (ou a da entrada, quando não houver). Limitação: só entradas que registraram o estoque anterior — as notas migradas (07/2025 a 11/2025); as entradas lançadas no web ainda não gravam esse dado.',
  filtros: [
    { campo: 'periodo', rotulo: 'Período', tipo: 'periodo', obrigatorio: true, padrao: { de: 'inicio_mes', ate: 'hoje' }, largura: 2 },
    { campo: 'marcas', rotulo: 'Marcas', tipo: 'lookup', lookup: 'marca', multiplo: true },
  ],
  colunas: [
    { campo: 'codprod', titulo: 'Código' },
    { campo: 'ref', titulo: 'Referência' },
    { campo: 'aplic_extendida', titulo: 'Aplicação' },
    { campo: 'marca', titulo: 'Marca' },
    { campo: 'codent', titulo: 'Entrada' },
    { campo: 'quantant', titulo: 'Estoque anterior', tipo: 'numero' },
    { campo: 'quant', titulo: 'Qtd. suprida', tipo: 'numero', total: true },
    { campo: 'dtent', titulo: 'Data', tipo: 'data' },
    { campo: 'disp', titulo: 'Disponível atual', tipo: 'numero' },
  ],
  async executar(db, p) {
    const params: any[] = [p.de, p.ate];
    let filtroMarca = '';
    if (p.marcas) { params.push(p.marcas); filtroMarca = `AND pd.codmarca = ANY($${params.length})`; }
    const rows = (await db.query(
      `WITH e AS (
         SELECT e.codent, COALESCE(op.fim, r.data_confirmacao_estoque, e.dtent) AS data_conf
           FROM dbent e
           LEFT JOIN (SELECT codent, max(fim_alocacao) AS fim FROM entrada_operacoes GROUP BY codent) op ON op.codent = e.codent
           LEFT JOIN dbent_recebimento r ON r.codent = e.codent
          WHERE e.status = 'F'
       )
       SELECT pd.codprod, pd.ref, pd.aplic_extendida, m.descr AS marca, e.codent,
              ie.quantant, (COALESCE(ie.quant, 0) - COALESCE(ie.quant_filial, 0)) AS quant,
              ${diaIso('e.data_conf')} AS dtent,
              (COALESCE(pd.qtest, 0) - COALESCE(pd.qtdreservada, 0)) AS disp
         FROM e
         JOIN dbitent ie ON ie.codent = e.codent
         JOIN dbprod pd ON pd.codprod = ie.codprod
         LEFT JOIN dbmarcas m ON m.codmarca = pd.codmarca
        WHERE ${periodo('e.data_conf', 1, 2)}
          AND ie.quantant = 0
          AND (COALESCE(ie.quant, 0) - COALESCE(ie.quant_filial, 0)) > 0
          ${filtroMarca}
        ORDER BY pd.ref, e.data_conf`, params)).rows;
    return { linhas: numerar(rows, ['quantant', 'quant', 'disp']) };
  },
};

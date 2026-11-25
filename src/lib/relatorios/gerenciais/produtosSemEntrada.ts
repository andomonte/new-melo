import type { Relatorio } from '../tipos';
import { numeros } from './_utilC';

/**
 * Relatórios › Gerenciais › Produtos que ainda não deram entrada (Delphi:
 * FrmRel_Prod_nao_deram_entrada / procedure REL_ENT_PROD_EM_ABERTO). Itens de notas de compra
 * (abertas ou finalizadas) que ainda não foram alocados no estoque, a partir de uma data.
 * Fonte do "alocado" no web: dbent.est_alocado (a Alocação grava 1 ao finalizar; reabrir/cancelar
 * voltam para 0) — o estoque já entra reservado na geração da entrada e a alocação só confirma.
 * A situação do recebimento (dbent_recebimento) aparece como coluna informativa.
 * Diferenças deliberadas: comprador em LEFT JOIN (o legado sumia com entradas sem comprador);
 * a coluna "Aplicação" do Delphi mostrava a descrição — aqui vêm as duas.
 */
export const relatorio: Relatorio = {
  slug: 'produtosSemEntrada',
  titulo: 'Produtos que ainda não deram entrada',
  descricao:
    'Itens de entradas de compra abertas ou finalizadas cuja mercadoria ainda não foi alocada no estoque (alocação não finalizada), a partir da data informada, ' +
    'com a quantidade pendente (quantidade da nota menos a enviada à filial) e a situação do recebimento. Entradas no sistema novo a partir de 2025.',
  paisagem: true,
  filtros: [
    { campo: 'data_inicial', rotulo: 'Entradas a partir de', tipo: 'data', obrigatorio: true, padrao: '-180d' },
    { campo: 'marcas', rotulo: 'Marcas', tipo: 'lookup', lookup: 'marca', multiplo: true },
    { campo: 'produtos', rotulo: 'Produtos', tipo: 'lookup', lookup: 'produto', multiplo: true },
    { campo: 'compradores', rotulo: 'Compradores', tipo: 'lookup', lookup: 'comprador', multiplo: true },
  ],
  colunas: [
    { campo: 'entrada', titulo: 'Entrada' },
    { campo: 'nota', titulo: 'Nota fiscal' },
    { campo: 'marca', titulo: 'Marca' },
    { campo: 'ref', titulo: 'Referência' },
    { campo: 'descricao', titulo: 'Descrição' },
    { campo: 'aplicacao', titulo: 'Aplicação' },
    { campo: 'quantidade', titulo: 'Quantidade', tipo: 'numero', total: true },
    { campo: 'data', titulo: 'Data', tipo: 'data' },
    { campo: 'comprador', titulo: 'Comprador' },
    { campo: 'recebimento', titulo: 'Recebimento' },
  ],
  quebra: 'marca',
  async executar(db, p) {
    const params: any[] = [p.data_inicial];
    const onde = [`e.status IN ('A', 'F')`, `COALESCE(e.est_alocado, 0) = 0`, `e.dtent >= $1::date`,
      `COALESCE(it.quant, 0) > COALESCE(it.quant_filial, 0)`];
    const lista = (v: any, col: string) => { if (v) { params.push(v); onde.push(`${col} = ANY($${params.length})`); } };
    lista(p.marcas, 'pd.codmarca');
    lista(p.produtos, 'it.codprod');
    lista(p.compradores, 'e.codcomprador');
    const rows = (await db.query(
      `SELECT e.codent AS entrada, e.nroform AS nota, m.descr AS marca, pd.ref, pd.descr AS descricao,
              pd.aplic_extendida AS aplicacao, it.quant - COALESCE(it.quant_filial, 0) AS quantidade,
              to_char(e.dtent, 'YYYY-MM-DD') AS data, co.nome AS comprador,
              COALESCE(replace(initcap(replace(r.status, '_', ' ')), 'Disponivel', 'Disponível'),
                       CASE e.status WHEN 'A' THEN 'Entrada aberta' ELSE 'Sem recebimento' END) AS recebimento
         FROM dbent e
         JOIN dbitent it ON it.codent = e.codent
         JOIN dbprod pd ON pd.codprod = it.codprod
         LEFT JOIN dbmarcas m ON m.codmarca = pd.codmarca
         LEFT JOIN dbcompradores co ON co.codcomprador = e.codcomprador
         LEFT JOIN dbent_recebimento r ON r.codent = e.codent
        WHERE ${onde.join(' AND ')}
        ORDER BY m.descr, e.dtent, e.codent, pd.ref`, params)).rows;
    numeros(rows, ['quantidade']);
    const entradas = new Set(rows.map((r) => r.entrada)).size;
    return { linhas: rows, resumo: [`${entradas} entrada(s) · ${rows.length} item(ns) pendentes de alocação`] };
  },
};

import { RelatorioValidacaoError, type Relatorio } from '../tipos';
import { avisoLacunaVendas, OPCOES_TIPO_VENDA, diaIso, moeda, numerar, periodo, situacaoVenda } from './_utilA';

/**
 * Relatórios › Gerenciais › Listagem de Vendas - Diária (Delphi: FrmRelatorioGeral /
 * tabListagem_Vendas_Diarias / RELATO.LISTAGEM_VENDAS). Item a item das vendas do período, por
 * documento, com a situação, total por venda e totais cancelado × válido (Melo × Ferramenta).
 * Diferenças do legado:
 *  - a opção Pré-nota (PRENOTA.LISTAGEM_PRENOTA) não existe: dbprenota no PG está vazia e só com
 *    3 colunas, e dbitprenota não existe;
 *  - a lista de usuários "Ferramenta" era fixa no código (0044, 0140, …); aqui é um filtro editável;
 *  - a separação Melo × Ferramenta vale para qualquer tipo (no Delphi, só D1 e pré-nota);
 *  - UNION do legado (que juntava itens iguais) virou leitura direta, sem perder linhas.
 */
const USUARIOS_FERRAMENTA = '0044,0140,0104,0141,0160,0030,0164';

export const relatorio: Relatorio = {
  slug: 'listagemVendasDiaria',
  titulo: 'Listagem de Vendas - Diária',
  descricao: 'Itens das vendas do período, agrupados por documento com a situação (cancelada, aguardando liberação, liberada aguardando faturamento, faturada) e o total de cada venda. O resumo separa total válido e cancelado, e Melo × Ferramenta pelos usuários informados. A opção Pré-nota do Delphi não está disponível (pré-notas não foram migradas).',
  paisagem: true,
  filtros: [
    { campo: 'periodo', rotulo: 'Período', tipo: 'periodo', obrigatorio: true, padrao: { de: 'inicio_mes', ate: 'hoje' }, largura: 2 },
    { campo: 'tipo', rotulo: 'Tipo de documento', tipo: 'select', obrigatorio: true, opcoes: OPCOES_TIPO_VENDA, padrao: 'P' },
    { campo: 'situacao', rotulo: 'Situação', tipo: 'select', padrao: 'todas',
      opcoes: [{ valor: 'todas', rotulo: 'Todas' }, { valor: 'validas', rotulo: 'Só válidas' }, { valor: 'canceladas', rotulo: 'Só canceladas' }] },
    { campo: 'usuarios_ferramenta', rotulo: 'Usuários da Ferramenta', tipo: 'texto', padrao: USUARIOS_FERRAMENTA, largura: 2,
      ajuda: 'Códigos de usuário (separados por vírgula) cujas vendas contam como "Ferramenta" no resumo. Vazio = não separar.' },
  ],
  colunas: [
    { campo: 'documento', titulo: 'Documento' },
    { campo: 'data', titulo: 'Data', tipo: 'data' },
    { campo: 'ref', titulo: 'Referência' },
    { campo: 'marca', titulo: 'Marca' },
    { campo: 'descr', titulo: 'Descrição' },
    { campo: 'qtd', titulo: 'Qtde', tipo: 'numero', total: true },
    { campo: 'prunit', titulo: 'Pr. unit.', tipo: 'moeda' },
    { campo: 'prtotal', titulo: 'Pr. total', tipo: 'moeda', total: true },
  ],
  quebra: 'documento',
  async executar(db, p) {
    if (!p.tipo) throw new RelatorioValidacaoError('Informe o tipo de documento.');
    const params: any[] = [p.de, p.ate, p.tipo];
    const onde = [periodo('v.data', 1, 2, true), `v.tipo = $3`];
    if (p.situacao === 'validas') onde.push(`COALESCE(v.cancel, 'N') <> 'S' AND COALESCE(v.status, '') <> 'C'`);
    if (p.situacao === 'canceladas') onde.push(`(v.cancel = 'S' OR v.status = 'C')`);
    const ferramenta = String(p.usuarios_ferramenta || '').split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean)
      .map((s) => s.padStart(4, '0'));
    params.push(ferramenta);

    const rows = (await db.query(
      `WITH v AS (SELECT v.* FROM dbvenda v WHERE ${onde.join(' AND ')})
       SELECT COALESCE(v.tipo, '') || COALESCE(v.nrovenda, v.codvenda) || ' — ' || ${situacaoVenda('v')} AS documento,
              ${diaIso('v.data', true)} AS data, COALESCE(pd.ref, i.ref) AS ref, m.descr AS marca,
              COALESCE(pd.descr, i.descr) AS descr, i.qtd, i.prunit,
              round((COALESCE(i.qtd, 0) * COALESCE(i.prunit, 0))::numeric, 2) AS prtotal,
              (v.cancel = 'S' OR v.status = 'C') AS cancelada,
              (lpad(COALESCE(v.codusr, ''), 4, '0') = ANY($4::text[])) AS ferramenta
         FROM v
         JOIN dbitvenda i ON i.codvenda = v.codvenda
         LEFT JOIN dbprod pd ON pd.codprod = i.codprod
         LEFT JOIN dbmarcas m ON m.codmarca = pd.codmarca
        ORDER BY v.nrovenda, v.codvenda, pd.ref`, params)).rows;
    numerar(rows, ['qtd', 'prunit', 'prtotal']);

    const soma = (f: (r: any) => boolean) => rows.filter(f).reduce((s, r) => s + (r.prtotal || 0), 0);
    const resumo = [
      `Total válido: R$ ${moeda(soma((r) => !r.cancelada))} · Total cancelado: R$ ${moeda(soma((r) => r.cancelada))}`,
    ];
    if (ferramenta.length) {
      resumo.push(`Melo — válido R$ ${moeda(soma((r) => !r.cancelada && !r.ferramenta))} · cancelado R$ ${moeda(soma((r) => r.cancelada && !r.ferramenta))}`);
      resumo.push(`Ferramenta — válido R$ ${moeda(soma((r) => !r.cancelada && r.ferramenta))} · cancelado R$ ${moeda(soma((r) => r.cancelada && r.ferramenta))}`);
    }
    for (const r of rows) { delete r.cancelada; delete r.ferramenta; }
    return { linhas: rows, resumo, avisos: await avisoLacunaVendas(db, p.de, p.ate) };
  },
};

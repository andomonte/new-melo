import type { Relatorio } from '../tipos';
import { avisoLacunaVendas, CTE_USUARIOS, OPCOES_TIPO_VENDA, diaBR, diaIso, numerar, periodo } from './_utilA';

/**
 * Relatórios › Gerenciais › Listagem de Vendas (Delphi: FrmRelatorioGeral / TabListagemVendas /
 * RELATO.FILTRO_VENDAS). Vendas não canceladas do período, por dia, com total do dia e geral.
 * Diferença do legado: o vendedor vinha de dbvvend (operador='N'), que quase não existe no PG;
 * aqui vem de dbvenda.codvend (vendas do web) ou do vendedor dos itens (dbitvenda.codvend,
 * histórico migrado), e por último de dbvvend. Venda sem vendedor também aparece (no Delphi sumia).
 */
export const relatorio: Relatorio = {
  slug: 'listagemVendas',
  titulo: 'Listagem de Vendas',
  descricao: 'Vendas não canceladas do período, dia a dia (nº, cliente, valor e vendedor), com total por dia e total geral. O vendedor é o da venda (vendedor externo); no telemarketing, o operador aparece à parte.',
  filtros: [
    { campo: 'periodo', rotulo: 'Período', tipo: 'periodo', obrigatorio: true, padrao: { de: 'inicio_mes', ate: 'hoje' }, largura: 2 },
    { campo: 'cliente', rotulo: 'Cliente', tipo: 'lookup', lookup: 'cliente', ajuda: 'Vazio = todos os clientes.' },
    { campo: 'tipo', rotulo: 'Tipo de documento', tipo: 'select', opcoes: [{ valor: 'T', rotulo: 'Todos' }, ...OPCOES_TIPO_VENDA], padrao: 'T' },
    { campo: 'vendedores', rotulo: 'Vendedores', tipo: 'lookup', lookup: 'vendedor', multiplo: true },
  ],
  colunas: [
    { campo: 'dia', titulo: 'Dia' },
    { campo: 'data', titulo: 'Data', tipo: 'data' },
    { campo: 'nrovenda', titulo: 'Nº venda' },
    { campo: 'codcli', titulo: 'Cód. cliente' },
    { campo: 'nome', titulo: 'Cliente' },
    { campo: 'total', titulo: 'Valor venda', tipo: 'moeda', total: true },
    { campo: 'codvend', titulo: 'Vendedor' },
    { campo: 'nomevend', titulo: 'Nome do vendedor' },
    { campo: 'operador', titulo: 'Operador (tele)' },
    { campo: 'usuario', titulo: 'Usuário' },
  ],
  quebra: 'dia',
  async executar(db, p) {
    const params: any[] = [p.de, p.ate];
    const onde = [periodo('v.data', 1, 2, true), `COALESCE(v.cancel, 'N') <> 'S'`];
    if (p.cliente) { params.push(p.cliente); onde.push(`v.codcli = $${params.length}`); }
    if (p.tipo && p.tipo !== 'T') { params.push(p.tipo); onde.push(`v.tipo = $${params.length}`); }
    let filtroVend = '';
    if (p.vendedores) { params.push(p.vendedores); filtroVend = `WHERE x.codvend_ef = ANY($${params.length})`; }

    const rows = (await db.query(
      `WITH v AS (
         SELECT v.codvenda, v.data, v.tipo, v.nrovenda, v.codcli, v.total, v.codvend, v.codusr
           FROM dbvenda v WHERE ${onde.join(' AND ')}
       ), it AS (
         SELECT i.codvenda, min(i.codvend) AS codvend, min(i.codoperador) AS codoperador
           FROM dbitvenda i JOIN v ON v.codvenda = i.codvenda GROUP BY i.codvenda
       ), vv AS (
         SELECT x.codvenda, min(x.codvend) FILTER (WHERE x.operador = 'N') AS codvend,
                min(x.codvend) FILTER (WHERE x.operador = 'S') AS codoperador
           FROM dbvvend x JOIN v ON v.codvenda = x.codvenda GROUP BY x.codvenda
       ), ${CTE_USUARIOS}, x AS (
         SELECT v.*, COALESCE(v.codvend, it.codvend, vv.codvend) AS codvend_ef,
                COALESCE(it.codoperador, vv.codoperador) AS codoperador
           FROM v LEFT JOIN it ON it.codvenda = v.codvenda LEFT JOIN vv ON vv.codvenda = v.codvenda
       )
       SELECT ${diaBR('x.data', true)} AS dia, ${diaIso('x.data', true)} AS data,
              COALESCE(x.tipo, '') || COALESCE(x.nrovenda, x.codvenda) AS nrovenda,
              x.codcli, c.nome, round(COALESCE(x.total, 0)::numeric, 2) AS total,
              x.codvend_ef AS codvend, ve.nome AS nomevend,
              CASE WHEN x.codoperador IS NULL THEN NULL ELSE x.codoperador || COALESCE(' - ' || op.nome, '') END AS operador,
              COALESCE(u.nomeusr, x.codusr) AS usuario
         FROM x
         LEFT JOIN dbclien c ON c.codcli = x.codcli
         LEFT JOIN dbvend ve ON ve.codvend = x.codvend_ef
         LEFT JOIN dbvend op ON op.codvend = x.codoperador
         LEFT JOIN usr u ON u.codusr = lpad(x.codusr, 4, '0')
         ${filtroVend}
        ORDER BY x.data, x.tipo, x.nrovenda`, params)).rows;
    return { linhas: numerar(rows, ['total']), avisos: await avisoLacunaVendas(db, p.de, p.ate) };
  },
};

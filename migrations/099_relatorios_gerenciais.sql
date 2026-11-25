-- 099_relatorios_gerenciais.sql  (25/11/2026)
-- Menu Relatórios › Gerenciais (mesmos relatórios e ordem do Delphi) — 47 telas
-- /relatorios/gerenciais/<slug> (catálogo: src/lib/relatorios/gerenciais/catalogo.ts).
-- Permissão: os grupos que já tinham a tela "Relatórios" (/admin/relatorios — ADMINISTRAÇÃO e
-- ASSISTENTE COMERCIAL) e DIRETOR. Outros grupos: Acessos > Perfis.
-- Idempotente; roda em todos os schemas de filial. Depois de aplicar, RE-LOGAR para ver o menu.

DO $mig$
DECLARE
  s        text;
  r        record;
  v_codigo integer;
  v_base   integer;
BEGIN
  FOR s IN
    SELECT table_schema FROM information_schema.tables
     WHERE table_name = 'tb_telas' AND table_schema LIKE 'db\_%' ORDER BY 1
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = s AND table_name = 'tb_grupo_Permissao') THEN
      RAISE NOTICE '%: sem tb_grupo_Permissao — ignorado', s;
      CONTINUE;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE c.relkind = 'S' AND n.nspname = s AND c.relname = 'tb_grupo_Permissao_id_seq'
    ) THEN
      EXECUTE format(
        'SELECT setval(%L, GREATEST((SELECT COALESCE(MAX(id),0) FROM %I."tb_grupo_Permissao"), (SELECT last_value FROM %I."tb_grupo_Permissao_id_seq")), true)',
        s || '."tb_grupo_Permissao_id_seq"', s, s);
    END IF;
    EXECUTE format('SELECT "CODIGO_TELA" FROM %I.tb_telas WHERE "PATH_TELA" = %L LIMIT 1', s, '/admin/relatorios') INTO v_base;

    FOR r IN SELECT * FROM (VALUES
    ('/relatorios/gerenciais/cautelasAberto', 'Relatórios - Gerenciais - Cautelas em Aberto'),
    ('/relatorios/gerenciais/extratoItens', 'Relatórios - Gerenciais - Extrato de Itens'),
    ('/relatorios/gerenciais/extratoRaioX', 'Relatórios - Gerenciais - Extrato Produto - Raio-X'),
    ('/relatorios/gerenciais/extratoItemNF', 'Relatórios - Gerenciais - Extrato de Item de Nota Fiscal'),
    ('/relatorios/gerenciais/extratoDetalhado', 'Relatórios - Gerenciais - Extrato Detalhado'),
    ('/relatorios/gerenciais/faturasSemTitulos', 'Relatórios - Gerenciais - Faturas sem Títulos de Cobrança'),
    ('/relatorios/gerenciais/listagemVendas', 'Relatórios - Gerenciais - Listagem de Vendas'),
    ('/relatorios/gerenciais/produtosNE', 'Relatórios - Gerenciais - Produtos para N.E.'),
    ('/relatorios/gerenciais/pendenciaProdutos', 'Relatórios - Gerenciais - Pendência de Produtos'),
    ('/relatorios/gerenciais/produtosPromocao', 'Relatórios - Gerenciais - Produtos em Promoção'),
    ('/relatorios/gerenciais/resumoDoctosGrupoMarca', 'Relatórios - Gerenciais - Resumo Doctos Grupo/Marca'),
    ('/relatorios/gerenciais/produtoSemDemanda', 'Relatórios - Gerenciais - Produto sem Demanda'),
    ('/relatorios/gerenciais/rankingVendedores', 'Relatórios - Gerenciais - Ranking de Vendedores'),
    ('/relatorios/gerenciais/comissaoGerencial', 'Relatórios - Gerenciais - Comissão por Vendedor - Gerencial'),
    ('/relatorios/gerenciais/comissaoFinanceiro', 'Relatórios - Gerenciais - Comissão por Vendedor - Financeiro'),
    ('/relatorios/gerenciais/comissaoCliente', 'Relatórios - Gerenciais - Relação para Comissão por Cliente'),
    ('/relatorios/gerenciais/notasSemCobranca', 'Relatórios - Gerenciais - Relatório de Notas sem Cobrança'),
    ('/relatorios/gerenciais/listagemVendasDiaria', 'Relatórios - Gerenciais - Listagem de Vendas - Diária'),
    ('/relatorios/gerenciais/resumoDocumentos', 'Relatórios - Gerenciais - Resumo de Documentos'),
    ('/relatorios/gerenciais/vendasTelemarketing', 'Relatórios - Gerenciais - Vendas Telemarketing por Vendedor'),
    ('/relatorios/gerenciais/metasPerfil', 'Relatórios - Gerenciais - Metas de Venda por Perfil'),
    ('/relatorios/gerenciais/metasCliente', 'Relatórios - Gerenciais - Metas de Venda por Cliente'),
    ('/relatorios/gerenciais/acompanhamentoVendas', 'Relatórios - Gerenciais - Acompanhamento de Vendas'),
    ('/relatorios/gerenciais/analiseFaturamento', 'Relatórios - Gerenciais - Análise de Faturamento'),
    ('/relatorios/gerenciais/analiseDetalhadaFaturamento', 'Relatórios - Gerenciais - Análise Detalhada do Faturamento'),
    ('/relatorios/gerenciais/analiseFaturamentoTele', 'Relatórios - Gerenciais - Análise de Faturamento - Telemarketing'),
    ('/relatorios/gerenciais/analiseVendas', 'Relatórios - Gerenciais - Análise de Vendas'),
    ('/relatorios/gerenciais/cmv', 'Relatórios - Gerenciais - Custo de Mercadoria Vendida'),
    ('/relatorios/gerenciais/vendasDesbloqueadas', 'Relatórios - Gerenciais - Vendas Desbloqueadas'),
    ('/relatorios/gerenciais/faturamento2Vendedor', 'Relatórios - Gerenciais - Faturamento do 2º Vendedor nos Grupos'),
    ('/relatorios/gerenciais/analiseCompraVendas', 'Relatórios - Gerenciais - Análise de Compra e Vendas'),
    ('/relatorios/gerenciais/projecaoCompra', 'Relatórios - Gerenciais - Análise de Projeção de Compra'),
    ('/relatorios/gerenciais/pedidosPorComprador', 'Relatórios - Gerenciais - Pedidos/Entradas por Comprador'),
    ('/relatorios/gerenciais/comprasOrigemAB', 'Relatórios - Gerenciais - Compras por Origem AB'),
    ('/relatorios/gerenciais/curvaAbc', 'Relatórios - Gerenciais - Curva ABC'),
    ('/relatorios/gerenciais/projetarVendas', 'Relatórios - Gerenciais - Projetar Vendas'),
    ('/relatorios/gerenciais/estoqueSuprido', 'Relatórios - Gerenciais - Estoque Suprido'),
    ('/relatorios/gerenciais/saidaProdutoVendedor', 'Relatórios - Gerenciais - Saída de Produto por Vendedor'),
    ('/relatorios/gerenciais/estoqueSaturado', 'Relatórios - Gerenciais - Estoque Saturado'),
    ('/relatorios/gerenciais/estoqueCritico', 'Relatórios - Gerenciais - Estoque Crítico'),
    ('/relatorios/gerenciais/produtosSemEntrada', 'Relatórios - Gerenciais - Produtos que ainda não deram entrada'),
    ('/relatorios/gerenciais/licitacoes', 'Relatórios - Gerenciais - Licitações'),
    ('/relatorios/gerenciais/produtosFagNF', 'Relatórios - Gerenciais - Produtos por FAG e NF (DI)'),
    ('/relatorios/gerenciais/acompanhamentoSony', 'Relatórios - Gerenciais - Acompanhamento SONY'),
    ('/relatorios/gerenciais/acompanhamentoHBuster', 'Relatórios - Gerenciais - Acompanhamento HBuster'),
    ('/relatorios/gerenciais/acompanhamentoSachs', 'Relatórios - Gerenciais - Acompanhamento SACHS'),
    ('/relatorios/gerenciais/produtosClientesFags', 'Relatórios - Gerenciais - Produtos por Clientes e FAGs')
    ) AS t(caminho, nome)
    LOOP
      EXECUTE format('SELECT "CODIGO_TELA" FROM %I.tb_telas WHERE "PATH_TELA" = %L LIMIT 1', s, r.caminho) INTO v_codigo;
      IF v_codigo IS NULL THEN
        EXECUTE format('SELECT COALESCE(MAX("CODIGO_TELA"),0) + 1 FROM %I.tb_telas', s) INTO v_codigo;
        EXECUTE format('INSERT INTO %I.tb_telas ("CODIGO_TELA","NOME_TELA","PATH_TELA") VALUES (%L,%L,%L)',
          s, v_codigo, r.nome, r.caminho);
      ELSE
        EXECUTE format('UPDATE %I.tb_telas SET "NOME_TELA" = %L WHERE "CODIGO_TELA" = %L', s, r.nome, v_codigo);
      END IF;

      -- grupos da tela "Relatórios" antiga + DIRETOR (se o grupo existir no schema)
      EXECUTE format($f$
        INSERT INTO %I."tb_grupo_Permissao" ("grupoId", tela, cadastrar, editar, remover, exportar)
        SELECT g."grupoId", %L, true, true, true, true
          FROM (SELECT DISTINCT "grupoId" FROM %I."tb_grupo_Permissao"
                 WHERE tela = %L OR "grupoId" = 'DIRETOR') g
         WHERE NOT EXISTS (SELECT 1 FROM %I."tb_grupo_Permissao" x WHERE x."grupoId" = g."grupoId" AND x.tela = %L)$f$,
        s, v_codigo, s, COALESCE(v_base, -1), s, v_codigo);
    END LOOP;
    RAISE NOTICE '%: relatórios gerenciais registrados', s;
  END LOOP;
END $mig$;

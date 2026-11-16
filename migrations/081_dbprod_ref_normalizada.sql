-- 081: índice da referência "sem pontuação" para a busca de produto da venda
--
-- A busca do Adicionar Itens (Nova Venda V2) compara a referência ignorando
-- espaço, ponto, traço e barra: "02374-BAGE", "02374 BAGE" e "02374BAGE" acham a
-- mesma peça (~40% das referências têm pontuação). A expressão abaixo precisa ser
-- IDÊNTICA à usada em src/lib/vendas/buscaProduto.ts para o índice ser usado.
--
-- Rodar em todos os schemas db_* que tenham dbprod. Idempotente.

DO $$
DECLARE s text;
BEGIN
  FOR s IN
    SELECT table_schema FROM information_schema.tables
     WHERE table_name = 'dbprod' AND table_schema LIKE 'db\_%'
     ORDER BY 1
  LOOP
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_dbprod_ref_norm ON %I.dbprod
         (regexp_replace(upper(ref), ''[^A-Z0-9]'', '''', ''g'') text_pattern_ops)', s);
    RAISE NOTICE '%: idx_dbprod_ref_norm ok', s;
  END LOOP;
END $$;

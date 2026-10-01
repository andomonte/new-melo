-- 060_idx_dbacao_fatura_incluir.sql
-- Índice para o relatório "Títulos Diário à Vista" (ramo Auto Peças/Ferramentas).
--
-- O ramo vem do registro de emissão da fatura no dbacao, cujo obs é sempre
-- 'COD:<codfat>'. O procedure do Oracle liga por "obs LIKE 'COD:'||f.codfat",
-- predicado que no Postgres não usa índice (a concatenação fica dos dois lados)
-- e varre o dbacao inteiro a cada fatura — com 177 mil registros de inclusão e
-- 1,9 mi de títulos, a consulta não termina.
--
-- Aqui a ligação vira igualdade sobre substring(obs FROM 5), que este índice
-- atende. Conferido na carga: as 177.286 linhas de DBFATURA/INCLUIR seguem
-- exatamente o padrão 'COD:<número>' (zero fora do padrão).
--
-- Índice parcial: só a fatia que o relatório consulta.

DO $$
DECLARE
  s text;
BEGIN
  FOR s IN
    SELECT table_schema FROM information_schema.tables
    WHERE table_name = 'dbacao' AND table_schema LIKE 'db\_%'
  LOOP
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_dbacao_fatura_incluir
         ON %I.dbacao ((substring(obs FROM 5)))
         WHERE tabela = ''DBFATURA'' AND acao = ''INCLUIR''', s);
    RAISE NOTICE '% : índice idx_dbacao_fatura_incluir pronto', s;
  END LOOP;
END $$;

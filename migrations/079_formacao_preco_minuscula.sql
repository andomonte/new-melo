-- 079: dbformacaoprvenda (minúscula) passa a ser a única tabela de formação de preço
--
-- A venda sempre leu dbformacaoprvenda (minúscula, ~3 mi linhas, tipos 0 a 7).
-- Parte do código (confirmação de preço da entrada, Cadastro > Formação de
-- Preço, Análise de Margem, cadastro de produto) gravava em "DBFORMACAOPRVENDA"
-- (maiúscula, ~10 mil linhas, tipos 1 a 5), então o preço calculado pela web
-- não chegava à venda. O código passa a usar a minúscula; esta migration:
--
--   1. deixa a minúscula com a mesma chave da maiúscula:
--      CODPROD obrigatório e único (CODPROD, TIPOPRECO);
--   2. guarda em dbformacaoprvenda_bkp_079 as linhas da minúscula que serão
--      alteradas (valores de antes), para poder voltar;
--   3. copia da maiúscula as linhas que diferem (atualiza) ou que só existem
--      nela (insere).
--
-- A maiúscula NÃO é apagada aqui: a homologação usa o mesmo banco e roda o
-- código antigo até ser atualizada. Remover depois (migration 003, nas 3 bases).
--
-- Rodar em todos os schemas db_* que tenham as duas tabelas.

DO $$
DECLARE
  s text;
  n_upd bigint;
  n_ins bigint;
  cols text := '"MARGEMLIQUIDA","ICMSDEVOL","ICMS","IPI","PIS","COFINS","DCI","COMISSAO","FATORDESPESAS","PRECOVENDA","TAXACARTAO"';
BEGIN
  FOR s IN
    SELECT m.table_schema
      FROM information_schema.tables m
      JOIN information_schema.tables u
        ON u.table_schema = m.table_schema AND u.table_name = 'DBFORMACAOPRVENDA'
     WHERE m.table_name = 'dbformacaoprvenda' AND m.table_schema LIKE 'db\_%'
     ORDER BY 1
  LOOP
    -- 1. Chave igual à da maiúscula
    EXECUTE format('ALTER TABLE %I.dbformacaoprvenda ALTER COLUMN "CODPROD" SET NOT NULL', s);
    -- Roraima e Rondônia já tinham a chave (dbformacaoprvenda_codprod_tipopreco_uk);
    -- só cria quando não houver nenhuma UNIQUE em (CODPROD, TIPOPRECO).
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conrelid = format('%I.dbformacaoprvenda', s)::regclass
         AND contype = 'u'
         AND pg_get_constraintdef(oid) = 'UNIQUE ("CODPROD", "TIPOPRECO")'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I.dbformacaoprvenda
           ADD CONSTRAINT dbformacaoprvenda_codprod_tipo_uk UNIQUE ("CODPROD", "TIPOPRECO")', s);
    END IF;

    -- 2. Backup das linhas que vão mudar (valores atuais da minúscula)
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I.dbformacaoprvenda_bkp_079 AS
         SELECT m.*, now() AS bkp_em FROM %I.dbformacaoprvenda m WHERE false', s, s);
    EXECUTE format(
      'INSERT INTO %1$I.dbformacaoprvenda_bkp_079
         SELECT m.*, now()
           FROM %1$I.dbformacaoprvenda m
           JOIN %1$I."DBFORMACAOPRVENDA" u
             ON u."CODPROD" = m."CODPROD" AND u."TIPOPRECO" = m."TIPOPRECO"
          WHERE (m.%2$s) IS DISTINCT FROM (u.%3$s)',
      s,
      replace(cols, ',', ',m.'),
      replace(cols, ',', ',u.'));

    -- 3a. Atualiza as que diferem
    EXECUTE format(
      'UPDATE %1$I.dbformacaoprvenda m
          SET "MARGEMLIQUIDA" = u."MARGEMLIQUIDA", "ICMSDEVOL" = u."ICMSDEVOL",
              "ICMS" = u."ICMS", "IPI" = u."IPI", "PIS" = u."PIS", "COFINS" = u."COFINS",
              "DCI" = u."DCI", "COMISSAO" = u."COMISSAO", "FATORDESPESAS" = u."FATORDESPESAS",
              "PRECOVENDA" = u."PRECOVENDA", "TAXACARTAO" = u."TAXACARTAO"
         FROM %1$I."DBFORMACAOPRVENDA" u
        WHERE u."CODPROD" = m."CODPROD" AND u."TIPOPRECO" = m."TIPOPRECO"
          AND (m.%2$s) IS DISTINCT FROM (u.%3$s)',
      s,
      replace(cols, ',', ',m.'),
      replace(cols, ',', ',u.'));
    GET DIAGNOSTICS n_upd = ROW_COUNT;

    -- 3b. Insere as que só existem na maiúscula
    EXECUTE format(
      'INSERT INTO %1$I.dbformacaoprvenda ("CODPROD","TIPOPRECO",%2$s)
         SELECT u."CODPROD", u."TIPOPRECO", u.%3$s
           FROM %1$I."DBFORMACAOPRVENDA" u
          WHERE NOT EXISTS (SELECT 1 FROM %1$I.dbformacaoprvenda m
                             WHERE m."CODPROD" = u."CODPROD" AND m."TIPOPRECO" = u."TIPOPRECO")',
      s, cols, replace(cols, ',', ',u.'));
    GET DIAGNOSTICS n_ins = ROW_COUNT;

    RAISE NOTICE '%: % linha(s) atualizada(s), % inserida(s)', s, n_upd, n_ins;
  END LOOP;
END $$;

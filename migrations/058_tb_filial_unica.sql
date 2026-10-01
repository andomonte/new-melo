-- 058_tb_filial_unica.sql
-- Uma cópia só da tb_filial, no schema central (db_manaus).
--
-- MOTIVO
-- A tb_filial é a tabela de roteamento do login: é ela que diz em qual schema
-- cada filial grava (schema_db) e com qual conexão (db_conn_enc). Ela estava
-- duplicada dentro dos schemas das filiais, e as cópias divergiam da central:
--
--   central (db_manaus)  RORAIMA  -> schema_db=db_roraima   tz=America/Boa_Vista
--   cópia   db_roraima   RORAIMA  -> schema_db=NULL         tz=America/Manaus
--   central (db_manaus)  RONDONIA -> schema_db=db_rondonia  tz=America/Porto_Velho
--   cópia   db_rondonia  RONDONIA -> schema_db=NULL         tz=America/Manaus
--   db_boavista          (versão antiga, colunas em maiúsculas, tabela vazia)
--
-- Com schema_db NULL, o fallback do getPgPoolPorNomeFilial é "usa o pool
-- central" — ou seja, bastaria alguém migrar o leitor do schema_db para o pool
-- da filial (como já foi feito em outros ~200 endpoints) para um usuário de
-- Roraima gravar em Manaus sem nenhum erro na tela.
--
-- POR QUE VIEW E NÃO SÓ DROP
-- Quatro consultas leem a tb_filial pelo pool da FILIAL, não pelo central:
--   src/lib/filialTimezone.ts            SELECT timezone FROM tb_filial ...
--   api/vendas/postgresql/finalizarVenda SELECT timezone FROM tb_filial ...
--   api/clientes/exportar-excel.ts       LEFT JOIN tb_filial f ON ...
--   api/clientes/exportarClientes.ts     LEFT JOIN tb_filial f ON ...
-- As duas últimas fazem JOIN com dbclien dentro do schema da filial, então não
-- dá para simplesmente trocá-las de pool. Um DROP seco quebraria as quatro
-- fora de Manaus. A view resolve: os dados passam a existir em um lugar só
-- (a tabela do db_manaus) e toda consulta continua enxergando a mesma verdade.
--
-- LIMITE CONHECIDO
-- A view só funciona enquanto os schemas vivem no mesmo banco. No dia em que
-- uma filial ganhar db_conn_enc própria (outro servidor), a view não existirá
-- lá e essas quatro consultas terão que passar pelo pool central. Está
-- documentado aqui de propósito para ser o lembrete dessa hora.
--
-- OBS: ao acrescentar colunas na tb_filial, recriar as views (CREATE OR REPLACE
-- não aceita mudança de lista de colunas — precisa DROP VIEW + CREATE VIEW).

DO $$
DECLARE
  s       text;
  eh_view boolean;
  dep     record;
  n_dep   bigint;
BEGIN
  FOR s IN
    SELECT nspname
    FROM pg_namespace
    WHERE nspname LIKE 'db\_%' AND nspname <> 'db_manaus'
    ORDER BY nspname
  LOOP
    SELECT c.relkind = 'v' INTO eh_view
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = s AND c.relname = 'tb_filial';

    IF eh_view IS NULL THEN
      RAISE NOTICE '% : sem tb_filial — criando a view', s;
    ELSIF eh_view THEN
      RAISE NOTICE '% : já é view — recriando', s;
      EXECUTE format('DROP VIEW %I.tb_filial', s);
    ELSE
      -- Trava: só descarta a cópia se nada COM DADOS depender dela. A única
      -- dependência encontrada foi a FK de tb_user_filial (tabela vazia, que
      -- não existe no schema central e não é usada por nenhum endpoint) —
      -- o CASCADE remove essa FK, não a tabela.
      FOR dep IN
        SELECT n.nspname AS sch, rel.relname AS tabela, con.conname AS fk
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace n ON n.oid = rel.relnamespace
        JOIN pg_class ref ON ref.oid = con.confrelid
        JOIN pg_namespace rn ON rn.oid = ref.relnamespace
        WHERE con.contype = 'f' AND ref.relname = 'tb_filial' AND rn.nspname = s
      LOOP
        EXECUTE format('SELECT count(*) FROM %I.%I', dep.sch, dep.tabela) INTO n_dep;
        IF n_dep > 0 THEN
          RAISE EXCEPTION
            'ABORTADO: %.% tem % linha(s) e depende de %.tb_filial pela FK %. '
            'Migre esses dados antes de unificar a tb_filial.',
            dep.sch, dep.tabela, n_dep, s, dep.fk;
        END IF;
        RAISE NOTICE '  dependência: %.% (vazia) — a FK % será removida',
          dep.sch, dep.tabela, dep.fk;
      END LOOP;

      RAISE NOTICE '% : era TABELA (cópia divergente) — removendo', s;
      EXECUTE format('DROP TABLE %I.tb_filial CASCADE', s);
    END IF;

    EXECUTE format(
      'CREATE VIEW %I.tb_filial AS
         SELECT nome_filial, codigo_filial, timezone, codigo_acesso,
                schema_db, db_conn_enc
         FROM db_manaus.tb_filial', s);
  END LOOP;
END $$;

-- Conferência: todo schema deve enxergar as MESMAS linhas do db_manaus.
DO $$
DECLARE
  s text;
  n_central int;
  n_schema  int;
BEGIN
  SELECT count(*) INTO n_central FROM db_manaus.tb_filial;
  FOR s IN
    SELECT nspname FROM pg_namespace
    WHERE nspname LIKE 'db\_%' AND nspname <> 'db_manaus' ORDER BY nspname
  LOOP
    EXECUTE format('SELECT count(*) FROM %I.tb_filial', s) INTO n_schema;
    IF n_schema <> n_central THEN
      RAISE EXCEPTION '% enxerga % linha(s), central tem %', s, n_schema, n_central;
    END IF;
    RAISE NOTICE '% : OK (% linhas, iguais às do db_manaus)', s, n_schema;
  END LOOP;
END $$;

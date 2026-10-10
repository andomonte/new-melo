-- 071_tela_gerar_entrada_importacao.sql
-- Registra a tela "Gerar Entrada (Importação)" (/compras/importacao/gerar-entrada)
-- no menu (db_manaus.tb_telas) e concede exatamente aos MESMOS perfis que já
-- enxergam a tela "Importação" (/compras/importacao) — assim quem usa a
-- Importação também vê o Gerar Entrada, sem hardcode de perfis.
--
-- ACL é central (só db_manaus). Idempotente.

DO $mig$
DECLARE
  v_cod integer;   -- CODIGO_TELA da tela nova
  v_src integer;   -- CODIGO_TELA da tela "Importação" (fonte dos grants)
BEGIN
  -- 1) tela nova (idempotente por PATH_TELA)
  SELECT "CODIGO_TELA" INTO v_cod
    FROM db_manaus.tb_telas WHERE "PATH_TELA" = '/compras/importacao/gerar-entrada';
  IF v_cod IS NULL THEN
    SELECT COALESCE(MAX("CODIGO_TELA"), 0) + 1 INTO v_cod FROM db_manaus.tb_telas;
    INSERT INTO db_manaus.tb_telas ("CODIGO_TELA", "NOME_TELA", "PATH_TELA")
    VALUES (v_cod, 'Gerar Entrada (Importação)', '/compras/importacao/gerar-entrada');
    RAISE NOTICE 'tela criada: CODIGO_TELA=%', v_cod;
  ELSE
    RAISE NOTICE 'tela já existe: CODIGO_TELA=%', v_cod;
  END IF;

  -- 2) tela fonte (Importação) p/ espelhar os grants
  SELECT "CODIGO_TELA" INTO v_src
    FROM db_manaus.tb_telas WHERE "PATH_TELA" = '/compras/importacao';

  -- 3) grants: copia cada perfil que tem a tela Importação (idempotente por grupoId+tela).
  --    id explícito (MAX+n) porque a sequence de "tb_grupo_Permissao".id está dessincronizada.
  IF v_src IS NOT NULL THEN
    INSERT INTO db_manaus."tb_grupo_Permissao" (id, editar, cadastrar, remover, exportar, "grupoId", tela)
    SELECT (SELECT COALESCE(MAX(id), 0) FROM db_manaus."tb_grupo_Permissao")
             + row_number() OVER (ORDER BY src."grupoId"),
           src.editar, src.cadastrar, src.remover, src.exportar, src."grupoId", v_cod
    FROM db_manaus."tb_grupo_Permissao" src
    WHERE src.tela = v_src
      AND NOT EXISTS (
        SELECT 1 FROM db_manaus."tb_grupo_Permissao" p
        WHERE p."grupoId" = src."grupoId" AND p.tela = v_cod
      );
    RAISE NOTICE 'grants espelhados da tela Importação (CODIGO_TELA=%)', v_src;
  ELSE
    -- Fallback: Importação não encontrada em tb_telas → concede ao ADMINISTRAÇÃO.
    INSERT INTO db_manaus."tb_grupo_Permissao" (id, editar, cadastrar, remover, exportar, "grupoId", tela)
    SELECT (SELECT COALESCE(MAX(id), 0) + 1 FROM db_manaus."tb_grupo_Permissao"),
           true, true, true, true, 'ADMINISTRAÇÃO', v_cod
    WHERE NOT EXISTS (
      SELECT 1 FROM db_manaus."tb_grupo_Permissao" p
      WHERE p."grupoId" = 'ADMINISTRAÇÃO' AND p.tela = v_cod
    );
    RAISE NOTICE 'tela Importação não encontrada; grant fallback p/ ADMINISTRAÇÃO';
  END IF;
END
$mig$;

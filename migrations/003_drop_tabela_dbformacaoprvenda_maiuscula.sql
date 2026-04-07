-- Migration: Deletar tabela DBFORMACAOPRVENDA antiga (maiúscula)
-- Data: 2026-01-11
-- Descrição: Remove a tabela DBFORMACAOPRVENDA (maiúscula) que foi substituída pela versão minúscula

-- A tabela correta é: db_manaus.dbformacaoprvenda (minúscula)
-- Esta migration remove a tabela antiga: db_manaus."DBFORMACAOPRVENDA" (maiúscula)

-- Verificar se existe antes de deletar
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'db_manaus'
          AND table_name = 'DBFORMACAOPRVENDA'
    ) THEN
        -- Mostrar quantos registros existem
        RAISE NOTICE 'Deletando tabela DBFORMACAOPRVENDA (maiúscula)...';

        -- Deletar a tabela
        DROP TABLE db_manaus."DBFORMACAOPRVENDA" CASCADE;

        RAISE NOTICE 'Tabela deletada com sucesso!';
    ELSE
        RAISE NOTICE 'Tabela DBFORMACAOPRVENDA (maiúscula) não existe. Nada a fazer.';
    END IF;
END $$;

-- Verificar que a tabela correta ainda existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'db_manaus'
          AND table_name = 'dbformacaoprvenda'
    ) THEN
        RAISE EXCEPTION 'ERRO: Tabela dbformacaoprvenda (minúscula) não existe!';
    ELSE
        RAISE NOTICE 'Tabela dbformacaoprvenda (minúscula) existe e está correta.';
    END IF;
END $$;

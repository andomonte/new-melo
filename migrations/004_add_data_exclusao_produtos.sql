-- Migration: Adicionar campo data_exclusao na tabela dbprod
-- Data: 2026-01-11
-- Descrição: Adiciona campo para registrar data de exclusão (soft delete)

-- Verificar se campo já existe antes de criar
DO $$
BEGIN
    -- Adicionar campo data_exclusao se não existir
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'db_manaus'
          AND table_name = 'dbprod'
          AND column_name = 'data_exclusao'
    ) THEN
        ALTER TABLE db_manaus.dbprod
        ADD COLUMN data_exclusao TIMESTAMP DEFAULT NULL;

        RAISE NOTICE 'Campo data_exclusao adicionado com sucesso!';
    ELSE
        RAISE NOTICE 'Campo data_exclusao já existe.';
    END IF;
END $$;

-- Comentário no campo
COMMENT ON COLUMN db_manaus.dbprod.data_exclusao IS 'Data/hora da exclusão lógica do produto (soft delete)';

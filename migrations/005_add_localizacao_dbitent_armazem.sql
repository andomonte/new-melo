-- Migração: adicionar coluna localizacao em dbitent_armazem
-- Esta coluna armazena temporariamente a localização física informada pelo peão
-- durante a alocação, e depois é persistida em cad_armazem_produto_locacao ao finalizar

-- Verificar se a coluna já existe antes de adicionar
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'dbitent_armazem' AND column_name = 'localizacao'
    ) THEN
        ALTER TABLE dbitent_armazem ADD COLUMN localizacao VARCHAR(100);
        RAISE NOTICE 'Coluna localizacao adicionada em dbitent_armazem';
    ELSE
        RAISE NOTICE 'Coluna localizacao já existe em dbitent_armazem';
    END IF;
END $$;

-- Comentário na coluna
COMMENT ON COLUMN dbitent_armazem.localizacao IS 'Localização física do produto no armazém (ex: P1/35 D 1 = Prateleira 1, Rua 35, Corredor D, Posição 1)';

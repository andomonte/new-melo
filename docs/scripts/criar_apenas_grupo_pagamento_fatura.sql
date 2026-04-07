-- Script para criar apenas a tabela grupo_pagamento_fatura
-- Estrutura correta com fatura_id como VARCHAR(9)

CREATE TABLE IF NOT EXISTS grupo_pagamento_fatura (
    id SERIAL PRIMARY KEY,
    grupo_pagamento_id INTEGER NOT NULL,
    fatura_id VARCHAR(9) NOT NULL,
    data_inclusao TIMESTAMP DEFAULT NOW(),
    usuario_inclusao VARCHAR(4),
    
    -- Constraints
    UNIQUE(grupo_pagamento_id, fatura_id)
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_grupo_pagamento_fatura_grupo_id ON grupo_pagamento_fatura(grupo_pagamento_id);
CREATE INDEX IF NOT EXISTS idx_grupo_pagamento_fatura_fatura_id ON grupo_pagamento_fatura(fatura_id);
CREATE INDEX IF NOT EXISTS idx_grupo_pagamento_fatura_data_inclusao ON grupo_pagamento_fatura(data_inclusao);

-- Comentário sobre o uso da tabela
COMMENT ON TABLE grupo_pagamento_fatura IS 'Tabela de relacionamento entre grupos de pagamento e faturas - serve como suporte para localizar melhor as faturas agrupadas';
COMMENT ON COLUMN grupo_pagamento_fatura.grupo_pagamento_id IS 'ID do grupo de pagamento (pode ser o ID da tabela grupo_pagamento ou o código do grupo para compatibilidade)';
COMMENT ON COLUMN grupo_pagamento_fatura.fatura_id IS 'Código da fatura (referência para dbfatura.codfat)';

-- Verificar se foi criada com sucesso
SELECT 
    table_name,
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'grupo_pagamento_fatura'
ORDER BY ordinal_position;

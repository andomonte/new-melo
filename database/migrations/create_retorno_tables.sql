-- ============================================================================
-- TABELAS PARA PROCESSAMENTO DE ARQUIVO DE RETORNO CNAB 400
-- Baseado na estrutura Oracle do package RETORNO
-- ============================================================================

-- Tabela para armazenar informações do arquivo de retorno (header)
CREATE TABLE IF NOT EXISTS db_retorno_arquivo (
    codretorno SERIAL PRIMARY KEY,
    banco VARCHAR(100) NOT NULL,                      -- Nome do banco (BRADESCO, SANTANDER, etc)
    data_importacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    nome_arquivo VARCHAR(255) NOT NULL,               -- Nome do arquivo importado
    usuario_importacao VARCHAR(100),                  -- Usuário que importou
    
    -- Contadores por filial
    qtd_mao INTEGER DEFAULT 0,                        -- Quantidade títulos Manaus
    qtd_pvh INTEGER DEFAULT 0,                        -- Quantidade títulos Porto Velho
    qtd_rec INTEGER DEFAULT 0,                        -- Quantidade títulos Recife
    qtd_flz INTEGER DEFAULT 0,                        -- Quantidade títulos Fortaleza
    qtd_cccc INTEGER DEFAULT 0,                       -- Quantidade títulos BMO/CCCC
    qtd_csac INTEGER DEFAULT 0,                       -- Quantidade títulos CSAC
    qtd_jps INTEGER DEFAULT 0,                        -- Quantidade títulos JPS
    
    -- Dados do header do arquivo CNAB
    datageracaoarquivo VARCHAR(8),                    -- Data geração do arquivo (DDMMAAAA)
    numerosequencialarquivo VARCHAR(10),              -- Número sequencial do arquivo
    nomebanco VARCHAR(100),                           -- Nome do banco no arquivo
    numerobancocamaracompensacao VARCHAR(3),          -- Código do banco (237, 033, etc)
    
    -- Metadados
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_retorno_arquivo_banco ON db_retorno_arquivo(banco);
CREATE INDEX IF NOT EXISTS idx_retorno_arquivo_data ON db_retorno_arquivo(data_importacao);
CREATE INDEX IF NOT EXISTS idx_retorno_arquivo_duplicata 
    ON db_retorno_arquivo(datageracaoarquivo, numerosequencialarquivo, nomebanco, numerobancocamaracompensacao);

-- Comentários
COMMENT ON TABLE db_retorno_arquivo IS 'Armazena informações do header de arquivos de retorno CNAB 400';
COMMENT ON COLUMN db_retorno_arquivo.codretorno IS 'Código único do arquivo de retorno';
COMMENT ON COLUMN db_retorno_arquivo.qtd_mao IS 'Quantidade de títulos da filial Manaus';
COMMENT ON COLUMN db_retorno_arquivo.qtd_pvh IS 'Quantidade de títulos da filial Porto Velho';


-- ============================================================================
-- Tabela para armazenar detalhes dos títulos (linhas de detalhe do arquivo)
-- ============================================================================

CREATE TABLE IF NOT EXISTS db_retorno_detalhe (
    coddetalhe SERIAL PRIMARY KEY,
    codretorno INTEGER NOT NULL REFERENCES db_retorno_arquivo(codretorno) ON DELETE CASCADE,
    
    -- Identificação do título
    codreceb VARCHAR(50),                             -- Código do recebimento/título
    codcli VARCHAR(20),                               -- Código do cliente
    nomecli VARCHAR(100),                             -- Nome do cliente
    tipo_empresa VARCHAR(1),                          -- Tipo empresa (F=Fornecedor, T=Transportadora)
    cnpj VARCHAR(18),                                 -- CNPJ do cliente
    
    -- Dados do documento
    nro_docbanco VARCHAR(20),                         -- Número do documento no banco (nosso número)
    nro_doc VARCHAR(20),                              -- Número do documento (NF, duplicata)
    carteira VARCHAR(10),                             -- Código da carteira
    
    -- Ocorrência
    codocorrencia VARCHAR(2),                         -- Código da ocorrência (02=Entrada, 06=Liquidação, etc)
    ocorrencia VARCHAR(100),                          -- Descrição da ocorrência
    
    -- Datas
    dt_ocorrencia DATE,                               -- Data da ocorrência
    dt_venc DATE,                                     -- Data de vencimento
    
    -- Valores
    valor_titulo DECIMAL(15,2) DEFAULT 0,             -- Valor original do título
    valor_pago DECIMAL(15,2) DEFAULT 0,               -- Valor efetivamente pago
    valor_desconto DECIMAL(15,2) DEFAULT 0,           -- Valor de desconto concedido
    valor_juros DECIMAL(15,2) DEFAULT 0,              -- Valor de juros/multa
    
    -- Dados bancários
    banco_cobrador VARCHAR(3),                        -- Código do banco cobrador
    agencia_cobradora VARCHAR(10),                    -- Agência cobradora
    
    -- Protesto
    protesto VARCHAR(2),                              -- Código de protesto
    motivo VARCHAR(200),                              -- Motivo de rejeição/ocorrência
    
    -- Status de processamento
    situacao VARCHAR(1),                              -- P=Pago, 1=Não pago totalmente, 2=Pago atraso jx correto, 
                                                      -- 3=Pago atraso jx menor, 4=Título não localizado
    
    -- Metadados
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_retorno_detalhe_arquivo ON db_retorno_detalhe(codretorno);
CREATE INDEX IF NOT EXISTS idx_retorno_detalhe_cnpj ON db_retorno_detalhe(cnpj);
CREATE INDEX IF NOT EXISTS idx_retorno_detalhe_codreceb ON db_retorno_detalhe(codreceb);
CREATE INDEX IF NOT EXISTS idx_retorno_detalhe_nro_doc ON db_retorno_detalhe(nro_doc);
CREATE INDEX IF NOT EXISTS idx_retorno_detalhe_situacao ON db_retorno_detalhe(situacao);
CREATE INDEX IF NOT EXISTS idx_retorno_detalhe_ocorrencia ON db_retorno_detalhe(codocorrencia);

-- Comentários
COMMENT ON TABLE db_retorno_detalhe IS 'Armazena detalhes dos títulos do arquivo de retorno CNAB 400';
COMMENT ON COLUMN db_retorno_detalhe.situacao IS 'P=Pago, 1=Não pago totalmente, 2=Pago atraso juros correto, 3=Pago atraso juros menor, 4=Título não localizado';


-- ============================================================================
-- Tabela de códigos de ocorrência (tabela auxiliar)
-- ============================================================================

CREATE TABLE IF NOT EXISTS db_retorno_ocorrencias (
    cod_ocorrencia VARCHAR(2) PRIMARY KEY,
    banco VARCHAR(50) NOT NULL,                       -- Banco ao qual se aplica (TODOS, BRADESCO, etc)
    descricao VARCHAR(200) NOT NULL,
    tipo VARCHAR(20),                                 -- ENTRADA, LIQUIDACAO, BAIXA, PROTESTO, REJEICAO, etc
    baixa_automatica BOOLEAN DEFAULT FALSE,           -- Se permite baixa automática
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Comentários
COMMENT ON TABLE db_retorno_ocorrencias IS 'Códigos de ocorrência dos arquivos de retorno por banco';

-- Inserir códigos de ocorrência comuns (BRADESCO como exemplo)
INSERT INTO db_retorno_ocorrencias (cod_ocorrencia, banco, descricao, tipo, baixa_automatica) VALUES
('02', 'BRADESCO', 'Entrada Confirmada', 'ENTRADA', FALSE),
('03', 'BRADESCO', 'Entrada Rejeitada', 'REJEICAO', FALSE),
('06', 'BRADESCO', 'Liquidação Normal', 'LIQUIDACAO', TRUE),
('09', 'BRADESCO', 'Baixado Automaticamente', 'BAIXA', TRUE),
('10', 'BRADESCO', 'Baixado conforme instruções', 'BAIXA', FALSE),
('11', 'BRADESCO', 'Em Ser - Arquivo de Títulos Pendentes', 'POSICAO', FALSE),
('12', 'BRADESCO', 'Abatimento Concedido', 'ABATIMENTO', FALSE),
('13', 'BRADESCO', 'Abatimento Cancelado', 'ABATIMENTO', FALSE),
('14', 'BRADESCO', 'Vencimento Alterado', 'ALTERACAO', FALSE),
('15', 'BRADESCO', 'Liquidação em Cartório', 'LIQUIDACAO', TRUE),
('19', 'BRADESCO', 'Confirmação Recebimento Instrução de Protesto', 'PROTESTO', FALSE),
('20', 'BRADESCO', 'Confirmação Recebimento Instrução Sustação de Protesto', 'PROTESTO', FALSE),
('21', 'BRADESCO', 'Transferência Cessão Crédito', 'TRANSFERENCIA', FALSE),
('23', 'BRADESCO', 'Título Enviado a Cartório/Tarifa', 'PROTESTO', FALSE),
('24', 'BRADESCO', 'Instrução de Protesto Rejeitada', 'REJEICAO', FALSE),
('27', 'BRADESCO', 'Confirmação Pedido de Alteração de Outros Dados', 'ALTERACAO', FALSE),
('28', 'BRADESCO', 'Débito de Tarifas/Custas', 'TARIFA', FALSE),
('32', 'BRADESCO', 'Instrução Rejeitada', 'REJEICAO', FALSE),
('33', 'BRADESCO', 'Confirmação Pedido de Alteração de Dados', 'ALTERACAO', FALSE),
('34', 'BRADESCO', 'Retirado de Cartório e Manutenção Carteira', 'PROTESTO', FALSE),
('35', 'BRADESCO', 'Desagendamento do Débito Automático', 'ALTERACAO', FALSE),
('68', 'BRADESCO', 'Acerto dos Dados do Rateio de Crédito', 'ALTERACAO', FALSE),
('69', 'BRADESCO', 'Cancelamento dos Dados do Rateio', 'ALTERACAO', FALSE)
ON CONFLICT (cod_ocorrencia) DO NOTHING;

-- Códigos SANTANDER (exemplos)
INSERT INTO db_retorno_ocorrencias (cod_ocorrencia, banco, descricao, tipo, baixa_automatica) VALUES
('02', 'SANTANDER', 'Entrada Confirmada', 'ENTRADA', FALSE),
('03', 'SANTANDER', 'Entrada Rejeitada', 'REJEICAO', FALSE),
('06', 'SANTANDER', 'Liquidação Normal', 'LIQUIDACAO', TRUE),
('09', 'SANTANDER', 'Baixado Automaticamente via Arquivo', 'BAIXA', TRUE),
('10', 'SANTANDER', 'Baixado conforme instruções da Agência', 'BAIXA', FALSE),
('17', 'SANTANDER', 'Liquidação após baixa ou Título não registrado', 'LIQUIDACAO', TRUE),
('19', 'SANTANDER', 'Confirmação Recebimento Instrução de Protesto', 'PROTESTO', FALSE),
('20', 'SANTANDER', 'Confirmação Recebimento Instrução de Sustação de Protesto', 'PROTESTO', FALSE)
ON CONFLICT DO NOTHING;


-- ============================================================================
-- Tabela de situação de processamento
-- ============================================================================

CREATE TABLE IF NOT EXISTS db_retorno_situacao (
    cod_situacao VARCHAR(1) PRIMARY KEY,
    descricao VARCHAR(100) NOT NULL,
    permite_baixa_automatica BOOLEAN DEFAULT FALSE
);

-- Comentários
COMMENT ON TABLE db_retorno_situacao IS 'Situações possíveis de títulos no retorno';

-- Inserir situações
INSERT INTO db_retorno_situacao (cod_situacao, descricao, permite_baixa_automatica) VALUES
('P', 'PAGO', TRUE),
('1', 'NAO PAGO TOTALMENTE', FALSE),
('2', 'PAGO ATRASO JX CORRETO', TRUE),
('3', 'PAGO ATRASO JX MENOR', FALSE),
('4', 'TITULO NAO LOCALIZADO', FALSE)
ON CONFLICT (cod_situacao) DO NOTHING;


-- ============================================================================
-- View para consulta consolidada
-- ============================================================================

CREATE OR REPLACE VIEW vw_retorno_completo AS
SELECT 
    ra.codretorno,
    ra.banco,
    ra.nome_arquivo,
    ra.data_importacao,
    ra.usuario_importacao,
    (ra.qtd_mao + ra.qtd_pvh + ra.qtd_rec + ra.qtd_flz + ra.qtd_cccc + ra.qtd_csac + ra.qtd_jps) as total_titulos,
    
    rd.coddetalhe,
    rd.codreceb,
    rd.nomecli,
    rd.cnpj,
    rd.nro_docbanco,
    rd.nro_doc,
    rd.codocorrencia,
    rd.ocorrencia,
    rd.dt_ocorrencia,
    rd.dt_venc,
    rd.valor_titulo,
    rd.valor_pago,
    rd.valor_desconto,
    rd.valor_juros,
    rd.situacao,
    
    rs.descricao as descricao_situacao,
    rs.permite_baixa_automatica,
    
    ro.tipo as tipo_ocorrencia,
    ro.baixa_automatica as ocorrencia_permite_baixa
    
FROM db_retorno_arquivo ra
LEFT JOIN db_retorno_detalhe rd ON ra.codretorno = rd.codretorno
LEFT JOIN db_retorno_situacao rs ON rd.situacao = rs.cod_situacao
LEFT JOIN db_retorno_ocorrencias ro ON rd.codocorrencia = ro.cod_ocorrencia AND (ro.banco = ra.banco OR ro.banco = 'TODOS')
ORDER BY ra.data_importacao DESC, rd.dt_ocorrencia DESC;

COMMENT ON VIEW vw_retorno_completo IS 'View consolidada de retornos com detalhes, situações e ocorrências';

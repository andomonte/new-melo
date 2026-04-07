-- Tabela para armazenar dados importados dos arquivos de retorno das operadoras
CREATE TABLE IF NOT EXISTS db_manaus.fin_cartao_receb_import (
  id SERIAL PRIMARY KEY,
  
  -- Dados do arquivo
  loja VARCHAR(10),                    -- Código da loja (0001=Manaus, 0002=Porto Velho)
  filial VARCHAR(20),                  -- Nome da filial identificada
  nsu VARCHAR(50),                     -- Número Sequencial Único
  dt_transacao DATE,                   -- Data da transação
  hora_transacao TIME,                 -- Hora da transação
  
  -- Dados do cartão
  bandeira VARCHAR(30),                -- VISA, MASTERCARD, ELO, etc
  tipo_transacao VARCHAR(20),          -- CRÉDITO, DÉBITO
  parcela VARCHAR(10),                 -- Formato: 01-03, 02-03, etc
  
  -- Valores
  valor_bruto DECIMAL(15,2),           -- Valor bruto da transação
  taxa DECIMAL(15,2),                  -- Taxa cobrada pela operadora
  valor_liquido DECIMAL(15,2),         -- Valor líquido (bruto - taxa)
  
  -- Identificadores
  autorizacao VARCHAR(50),             -- Número de autorização
  tid VARCHAR(100),                    -- Transaction ID
  codigo_operacao VARCHAR(20),         -- Código da operação
  
  -- Controle de importação
  dt_importacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  arquivo_nome VARCHAR(255),           -- Nome do arquivo importado
  linha_arquivo INTEGER,               -- Número da linha no arquivo
  
  -- Status de conciliação
  status VARCHAR(20) DEFAULT 'PENDENTE',  -- PENDENTE, CONCILIADO, NAO_LOCALIZADO, ERRO
  cod_receb VARCHAR(20),               -- FK para DBRECEB (quando conciliado)
  cod_freceb VARCHAR(20),              -- FK para DBFRECEB (quando conciliado)
  dt_conciliacao TIMESTAMP,            -- Data/hora da conciliação
  observacao TEXT,                     -- Observações/erros
  
  -- Constraint de unicidade
  CONSTRAINT idx_import_nsu UNIQUE (nsu, autorizacao, parcela)
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_import_status ON db_manaus.fin_cartao_receb_import(status);
CREATE INDEX IF NOT EXISTS idx_import_dt_transacao ON db_manaus.fin_cartao_receb_import(dt_transacao);
CREATE INDEX IF NOT EXISTS idx_import_autorizacao ON db_manaus.fin_cartao_receb_import(autorizacao);
CREATE INDEX IF NOT EXISTS idx_import_conciliacao ON db_manaus.fin_cartao_receb_import(cod_receb, cod_freceb);

-- Comentários
COMMENT ON TABLE db_manaus.fin_cartao_receb_import IS 'Armazena dados importados de arquivos de retorno das operadoras de cartão';
COMMENT ON COLUMN db_manaus.fin_cartao_receb_import.status IS 'PENDENTE: Aguardando conciliação | CONCILIADO: Encontrado e vinculado | NAO_LOCALIZADO: Não encontrado no sistema | ERRO: Erro no processamento';

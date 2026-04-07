const { Client } = require('pg');
require('dotenv').config();

async function createHistoricoTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔌 Conectado ao banco de dados');

    const sql = `
      -- Criar tabela para histórico de remessas Equifax
      CREATE TABLE IF NOT EXISTS db_manaus.historico_remessa_equifax (
          id SERIAL PRIMARY KEY,
          data_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          periodo_inicio DATE NOT NULL,
          periodo_fim DATE NOT NULL,
          tipo_envio VARCHAR(20) NOT NULL, -- 'download' ou 'email'
          email_destino VARCHAR(255),
          registros_enviados INTEGER NOT NULL,
          valor_total DECIMAL(15,2),
          nome_arquivo VARCHAR(255) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'sucesso', -- 'sucesso', 'erro', 'pendente'
          erro_descricao TEXT,
          usuario_id INTEGER,
          usuario_nome VARCHAR(255)
      );

      -- Criar índices para melhor performance
      CREATE INDEX IF NOT EXISTS idx_historico_remessa_data ON db_manaus.historico_remessa_equifax(data_envio);
      CREATE INDEX IF NOT EXISTS idx_historico_remessa_periodo ON db_manaus.historico_remessa_equifax(periodo_inicio, periodo_fim);
      CREATE INDEX IF NOT EXISTS idx_historico_remessa_status ON db_manaus.historico_remessa_equifax(status);
    `;

    await client.query(sql);
    console.log('✅ Tabela historico_remessa_equifax criada com sucesso!');

  } catch (error) {
    console.error('❌ Erro ao criar tabela:', error);
  } finally {
    await client.end();
    console.log('🔌 Conexão fechada');
  }
}

createHistoricoTable();
-- Logo do fornecedor para relatórios (ex.: PDF da Ordem de Compra).
-- Tabela WEB-ONLY: NÃO alterar dbcredor (que espelha o Oracle e pode ser refrescada).
-- A imagem é normalizada (PNG, máx. 400px de largura) e guardada em bytea.
CREATE TABLE IF NOT EXISTS db_manaus.cad_credor_logo (
  cod_credor    varchar(20)  PRIMARY KEY,
  imagem        bytea        NOT NULL,
  mime          varchar(50)  NOT NULL DEFAULT 'image/png',
  largura       integer,
  altura        integer,
  atualizado_em timestamp without time zone DEFAULT now()
);

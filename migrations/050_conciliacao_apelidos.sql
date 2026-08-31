-- 050: conciliação — apelidos de pagador (memorizar pagador → cliente).
-- Quando o operador vincula manualmente um recebimento "a identificar" a um cliente,
-- pode memorizar o pagador (por CPF/CNPJ ou nome) para que as PRÓXIMAS importações
-- resolvam o cliente automaticamente. Aditivo.

CREATE TABLE IF NOT EXISTS db_manaus.conc_apelido (
  apl_id        bigserial PRIMARY KEY,
  apl_doc       varchar(20),          -- CPF/CNPJ (só dígitos) do pagador, quando houver
  apl_nome_norm varchar(120),         -- nome normalizado do pagador, quando sem doc
  apl_codcli    varchar(15) NOT NULL, -- cliente memorizado
  apl_usuario   varchar(60),
  apl_data      timestamp DEFAULT now()
);
-- 1 apelido por documento; nome é índice comum (pode repetir doc nulo).
CREATE UNIQUE INDEX IF NOT EXISTS ux_conc_apelido_doc  ON db_manaus.conc_apelido (apl_doc) WHERE apl_doc IS NOT NULL AND apl_doc <> '';
CREATE INDEX        IF NOT EXISTS ix_conc_apelido_nome ON db_manaus.conc_apelido (apl_nome_norm);

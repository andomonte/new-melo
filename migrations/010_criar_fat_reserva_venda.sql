-- 010_criar_fat_reserva_venda.sql
-- Reserva (soft lock) de vendas no fluxo de Novo Faturamento.
-- Quando um usuário seleciona uma venda para faturar, ela fica reservada para ele;
-- outros usuários veem "em uso por X" e não conseguem selecionar. A reserva expira
-- sozinha (expira_em) — se o navegador fechar/travar, a venda é liberada por TTL.
-- A expiração é LAZY: as queries filtram expira_em > now(), sem precisar de cron.

CREATE TABLE IF NOT EXISTS db_manaus.fat_reserva_venda (
  codvenda     varchar(20)  PRIMARY KEY,
  usuario      varchar(60)  NOT NULL,        -- login do dono (user.usuario)
  usuario_nome varchar(120),                 -- nome exibido ("em uso por ...")
  reservado_em timestamptz  NOT NULL DEFAULT now(),
  expira_em    timestamptz  NOT NULL         -- TTL: além disso, reserva é considerada livre
);

-- Acelera o filtro por validade (expira_em > now()) usado na listagem e no claim.
CREATE INDEX IF NOT EXISTS idx_fat_reserva_expira
  ON db_manaus.fat_reserva_venda (expira_em);

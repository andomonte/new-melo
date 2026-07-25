-- Alarga dbclien.banco (era varchar(1)) para comportar 2+ dígitos.
--
-- Causa do erro "Erro ao salvar cliente" (22001 - valor muito longo para
-- character varying(1)) ao cadastrar/editar cliente escolhendo um banco novo:
--   O front grava dbclien.banco = (codigo do banco em dbbanco_cobranca) - 1
--   (convenção legada do Delphi). Historicamente os bancos iam de 1 a 9
--   (stored 0..8, 1 dígito). Foram adicionados os bancos de codigo 14 e 15
--   (SANTANDER e btg), que gravam '13'/'14' (2 dígitos) e estouravam a coluna
--   varchar(1). Como 22001 não era um código tratado na rota, o usuário via
--   apenas a mensagem genérica.
--
-- Idempotente: só altera se ainda estiver menor que 5.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'db_manaus'
      AND table_name = 'dbclien'
      AND column_name = 'banco'
      AND (character_maximum_length IS NULL OR character_maximum_length < 5)
  ) THEN
    ALTER TABLE db_manaus.dbclien ALTER COLUMN banco TYPE varchar(5);
  END IF;
END $$;

-- OBS: aplicar o equivalente nos bancos das demais filiais (Rondônia, Roraima),
-- ajustando o schema, se lá também houver a mesma restrição de tamanho.

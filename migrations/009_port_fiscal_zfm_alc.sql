-- FASE 2 · Bloco 1 — port dos helpers ZFM/ALC do CALCULO_IMPOSTO (Oracle) para PL/pgSQL.
-- Tradução FIEL (mesma estrutura/nomes). Consultam as tabelas migradas na 008.
-- Oracle: FUNCTION MESMA_ZFM/MESMA_ALC(vcdmunicipioorigem, vcdmunicipiodestino) RETURN boolean.

CREATE OR REPLACE FUNCTION db_manaus.mesma_zfm(
  vcdmunicipioorigem  varchar,
  vcdmunicipiodestino varchar
) RETURNS boolean
LANGUAGE plpgsql AS $$
DECLARE
  xcount integer;
BEGIN
  SELECT COUNT(*)
    INTO xcount
    FROM db_manaus.zfm_combinacoes
   WHERE municipio_emitente     = vcdmunicipioorigem::integer
     AND municipio_destinatario = vcdmunicipiodestino::integer;
  IF xcount > 0 THEN
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION db_manaus.mesma_alc(
  vcdmunicipioorigem  varchar,
  vcdmunicipiodestino varchar
) RETURNS boolean
LANGUAGE plpgsql AS $$
DECLARE
  xcount integer;
BEGIN
  SELECT COUNT(*)
    INTO xcount
    FROM db_manaus.alc_combinacoes
   WHERE municipio_emitente     = vcdmunicipioorigem::integer
     AND municipio_destinatario = vcdmunicipiodestino::integer;
  IF xcount > 0 THEN
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$;

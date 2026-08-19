-- 030_migrar_dbcalc_dbferiado.sql
-- Migra do Oracle GERAL: DBCALC (parâmetros, incl. TXCART=taxa de juros) e DBFERIADO
-- (feriados: FIXO='S' casa dia/mês em qualquer ano; FIXO='N' casa data exata; TIPO='N'=nacional).
-- Base para a carência de juros do Caixa (VERIFICA_DATA_FERIADO). Idempotente.

CREATE TABLE IF NOT EXISTS db_manaus.dbcalc (
  icmsam numeric(5,2), icmsout numeric(5,2), icmsfnt numeric(5,2), txjr numeric(7,2),
  vlrenc numeric(5,2), txagr numeric(5,2), dlrcom numeric(5,2), dlrpar numeric(5,2),
  pzmed numeric(3,0), txiss numeric(5,2), dscvista numeric(5,2), txcart numeric(7,2),
  dscbalcaogm numeric(5,2), mva numeric(5,2), txcartaocredito numeric(7,2),
  marcagm varchar(5), margem_min_venda numeric(7,2)
);
DELETE FROM db_manaus.dbcalc;
INSERT INTO db_manaus.dbcalc (icmsam,icmsout,icmsfnt,txjr,vlrenc,txagr,dlrcom,dlrpar,pzmed,txiss,dscvista,txcart,dscbalcaogm,mva,txcartaocredito,marcagm,margem_min_venda) VALUES (18,12,0,8,8,0,5.8,6,0,0,2,8,2,40,2.7,'01008',10);

CREATE TABLE IF NOT EXISTS db_manaus.dbferiado (
  codferiado integer PRIMARY KEY,
  data date NOT NULL,
  descricao varchar(100),
  tipo varchar(1),   -- 'N'=nacional
  local varchar(50),
  fixo varchar(1)    -- 'S'=fixo (dia/mês), 'N'=móvel (data exata)
);
CREATE INDEX IF NOT EXISTS idx_dbferiado_diames ON db_manaus.dbferiado (EXTRACT(MONTH FROM data), EXTRACT(DAY FROM data));
DELETE FROM db_manaus.dbferiado;
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (7,'2010-01-01','CONFRATERNIZACAO UNIVERSAL ','N','NAC','S');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (8,'2010-02-16','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (9,'2010-04-02','PAIXAO DE CRISTO ','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (10,'2010-04-21','TIRADENTES','N','NAC','S');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (11,'2010-05-01','DIA DO TRABALHADOR','N','NAC','S');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (12,'2010-06-03','CORPUS CHRISTI','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (13,'2010-09-07','INDEPENDENCIA DO BRASIL','N','NAC','S');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (14,'2010-10-12','NOSSA SRA APARECIDA','N','NAC','S');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (15,'2010-11-02','FINADOS','N','NAC','S');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (16,'2010-11-15','PROCLAMACAO DA REPUBLICA','N','NAC','S');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (17,'2010-12-25','NATAL','N','NAC','S');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (18,'2011-03-08','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (19,'2011-06-23','CORPUS CHRISTI','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (20,'2011-04-22','PAIXAO DE CRISTO','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (21,'2012-02-21','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (22,'2012-04-06','PAIXAO DE CRISTO','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (23,'2012-06-07','CORPUS CHRISTI','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (24,'2010-09-05','ELEVACAO DO AMAZONAS A CATEGORIA DE PROVINCIA','E','AM','S');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (25,'2010-11-20','DIA DA CONSCIENCIA NEGRA','E','AM','S');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (26,'2010-12-08','DIA DE NOSSA SENHORA DA CONCEICAO','E','AM','S');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (27,'2010-01-04','CRIACAO DO ESTADO DE RONDONIA','E','RO','S');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (28,'2010-06-18','DIA DO EVANGELICO','E','RO','S');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (29,'2013-02-12','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (30,'2013-03-29','PAIXAO DE CRISTO','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (31,'2013-05-30','CORPUS CHRISTI','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (32,'2014-03-04','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (33,'2014-04-18','PAIXAO DE CRISTO','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (34,'2014-06-19','CORPUS CHRISTI','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (35,'2015-02-17','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (36,'2015-04-03','PAIXAO DE CRISTO','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (37,'2015-06-04','CORPUS CHRISTI','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (38,'2012-02-20','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (39,'2012-02-11','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (40,'2014-03-03','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (41,'2015-02-16','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (42,'2016-02-08','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (43,'2016-02-09','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (44,'2016-03-25','PAIXAO DE CRISTO','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (45,'2016-05-26','CORPUS CHRISTI','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (46,'2017-02-27','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (47,'2017-02-28','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (48,'2017-04-14','PAIXAO DE CRISTO','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (49,'2017-06-15','CORPUS CHRISTI','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (50,'2018-02-12','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (51,'2018-02-13','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (52,'2018-03-30','PAIXAO DE CRISTO','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (53,'2018-05-31','CORPUS CHRISTI','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (54,'2019-03-04','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (55,'2019-03-05','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (56,'2019-04-19','PAIXAO DE CRISTO','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (57,'2019-06-20','CORPUS CHRISTI','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (58,'2020-02-24','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (59,'2020-02-25','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (60,'2020-04-10','PAIXAO DE CRISTO','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (61,'2020-06-11','CORPUS CHRISTI','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (62,'2021-02-15','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (63,'2021-02-16','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (64,'2021-04-02','PAIXAO DE CRISTO','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (65,'2021-06-03','CORPUS CHRISTI','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (66,'2022-02-28','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (67,'2022-03-01','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (68,'2022-04-15','PAIXAO DE CRISTO','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (69,'2022-06-16','CORPUS CHRISTI','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (70,'2023-02-20','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (71,'2023-02-21','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (72,'2023-04-07','PAIXAO DE CRISTO','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (73,'2023-06-08','CORPUS CHRISTI','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (74,'2024-02-12','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (75,'2024-02-13','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (76,'2024-03-29','PAIXAO DE CRISTO','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (77,'2024-05-30','CORPUS CHRISTI','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (78,'2025-03-03','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (79,'2025-03-04','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (80,'2025-04-18','PAIXAO DE CRISTO','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (81,'2025-06-19','CORPUS CHRISTI','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (82,'2026-02-16','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (83,'2026-02-17','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (84,'2026-04-03','PAIXAO DE CRISTO','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (85,'2026-06-04','CORPUS CHRISTI','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (86,'2027-02-08','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (87,'2027-02-09','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (88,'2027-03-26','PAIXAO DE CRISTO','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (89,'2027-05-27','CORPUS CHRISTI','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (90,'2028-02-28','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (91,'2028-02-29','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (92,'2028-04-14','PAIXAO DE CRISTO','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (93,'2028-06-15','CORPUS CHRISTI','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (94,'2029-02-12','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (95,'2029-02-13','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (96,'2029-03-30','PAIXAO DE CRISTO','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (97,'2029-05-31','CORPUS CHRISTI','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (98,'2030-03-04','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (99,'2030-03-05','CARNAVAL','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (100,'2030-04-19','PAIXAO DE CRISTO','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (101,'2030-06-20','CORPUS CHRISTI','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (102,'2017-12-29','FERIADO BANCARIO (EXCEPCIONAL)','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (103,'2018-12-31','FERIADO BANCARIO (EXCEPCIONAL)','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (104,'2019-12-31','FERIADO BANCARIO (EXCEPCIONAL)','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (105,'2020-12-31','FERIADO BANCARIO (EXCEPCIONAL)','N','NAC','S');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (106,'2020-11-20','CONSCIENCIA NEGRA','E','AM','S');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (107,'2022-12-30','FERIADO BANCARIO (EXCEPCIONAL)','N','NAC','N');
INSERT INTO db_manaus.dbferiado (codferiado,data,descricao,tipo,local,fixo) VALUES (108,'2025-10-24','ANIVERSARIO DE MANAUS','E','AM','S');

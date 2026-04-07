SELECT cgc, nomecontribuinte,
       CASE WHEN "certificadoKey" IS NOT NULL THEN 'SIM' ELSE 'NÃO' END as tem_certificado_key,
       CASE WHEN "certificadoCrt" IS NOT NULL THEN 'SIM' ELSE 'NÃO' END as tem_certificado_crt,
       CASE WHEN "cadeiaCrt" IS NOT NULL THEN 'SIM' ELSE 'NÃO' END as tem_cadeia_crt
FROM dadosempresa;
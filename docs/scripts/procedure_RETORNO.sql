================================================================================
📦 PACKAGE RETORNO - SPEC (Declarações)
================================================================================
package RETORNO is
package RETORNO is

  -- Author  : ANDRE
  -- Created : 13/08/2008 10:40:26
  -- Purpose :

  procedure CONSULTA (
    vORIGEMDADOS in varchar2,
    vBANCO       in varchar2,
    vCOD_RECEB   in dbReceb.Nro_Banco%type,
    vCursorSaida out cursorgenerico.tipocursorgenerico
  );

  procedure CONSULTA_BODERO
  (
    vORIGEMDADOS in varchar2,
    vCOD_RECEB   in dbReceb.Nro_Banco%type,
    vCursorSaida out cursorgenerico.tipocursorgenerico
  );

  procedure CONSULTA_OCORRENCIA
  (
    vBANCO       in varchar2,
    vCODIGO      in varchar2,
    vCursorSaida out cursorgenerico.tipocursorgenerico
  );

  procedure CONSULTA_COD_CONTA
  (
    vConta in varchar2,
    vParam in varchar2,
    vCursorSaida out cursorgenerico.TIPOCURSORGENERICO
  );


  procedure ANALISA_TITULO(pCod_Receb in varchar2,
                           pDataOcorrencia in date,
                           pValorPago in number,
                           pValorJuros in number,
                           pStatus    out varchar2);

  PROCEDURE navega_RetornoDetalhe( codigo  IN  number,
                                   cur_ret OUT cursorgenerico.tipocursorgenerico) ;

    procedure ARQUIVO_INC
  (
    vbanco                        in varchar2,
    vdata_importacao              in date,
    vnome_arquivo                 in varchar2,
    vusuario_importacao           in varchar2,
    vqtd_mao                      in number,
    vqtd_pvh                      in number,
    vqtd_rec                      in number,
    vqtd_flz                      in number,
    vqtd_bmo                      in number,
    vqtd_csac                     in number,
    vqtd_jps                      in number,
    vDataGeracaoArquivo           in varchar2,
    vNumeroSequencialArquivo      in varchar2,
    vNomeBanco                    in varchar2,
    vNumeroBancoCamaraCompensacao in varchar2,
    codigo                        OUT number
  );

  procedure DETALHE_INC
  (
    vcodretorno        in dbretorno_detalhe.codretorno%type,
    vcodreceb          in dbretorno_detalhe.codreceb%type,
    vcodcli            in dbretorno_detalhe.codcli %type,
    vnomecli           in dbretorno_detalhe.nomecli%type,
    vtipo_empresa      in dbretorno_detalhe.tipo_empresa%type,
    vcnpj              in dbretorno_detalhe.cnpj%type,
    vnro_docbanco      in dbretorno_detalhe.nro_docbanco%type,
    vcodocorrencia     in dbretorno_detalhe.codocorrencia%type,
    vocorrencia        in dbretorno_detalhe.ocorrencia%type,
    vnro_doc           in dbretorno_detalhe.nro_doc%type,
    vdt_ocorrencia     in dbretorno_detalhe.dt_ocorrencia%type,
    vdt_venc           in dbretorno_detalhe.dt_venc%type,
    vvalor_titulo      in dbretorno_detalhe.valor_titulo%type,
    vbanco_cobrador    in dbretorno_detalhe.banco_cobrador%type,
    vagencia_cobradora in dbretorno_detalhe.agencia_cobradora%type,
    vvalor_pago        in dbretorno_detalhe.valor_pago%type,
    vvalor_desconto    in dbretorno_detalhe.valor_desconto%type,
    vvalor_juros       in dbretorno_detalhe.valor_desconto%type,
    vcarteira          in dbretorno_detalhe.carteira%type,
    vprotesto          in dbretorno_detalhe.protesto%type,
    vmotivo            in dbretorno_detalhe.motivo%type,
    vSITUACAO          in dbretorno_detalhe.Situacao%type
  );

  PROCEDURE DETALHE_CONSULTA
  (
    vcodretorno  in dbretorno_detalhe.codretorno%type,
    vCursorSaida out cursorgenerico.TIPOCURSORGENERICO
  );
  
  PROCEDURE VALIDA_ARQUIVO(
    vDataGeracaoArquivo           in varchar2,
    vNumeroSequencialArquivo      in varchar2,
    vNomeBanco                    in varchar2,
    vNumeroBancoCamaraCompensacao in varchar2,
    vArquivoExistente             out number
  );  
  
  procedure CONSULTA_ARQUIVO
  (
    vBANCO          in varchar2,
    vNOME_ARQUIVO   in VARCHAR2,
    vResp           out varchar2
  );

  procedure CONSULTA_CONVENIOBB
  (
    pcursor out cursorgenerico.TIPOCURSORGENERICO
  );

end RETORNO;

 

 

 
 

 

 

 
 

================================================================================
📦 PACKAGE RETORNO - BODY (Implementação)
================================================================================
package body RETORNO is
package body RETORNO is



  procedure CONSULTA
  (
    vORIGEMDADOS in varchar2,
    vBANCO       in varchar2,
    vCOD_RECEB   in dbReceb.Nro_Banco%type,
    vCursorSaida out cursorgenerico.tipocursorgenerico
  )
  IS

    xselect  LONG;
    xfrom    LONG;
    xwhere   LONG;
    xorder   LONG;


    xsel long;
    xcont number;
    xCod_Receb dbreceb.nro_banco%type;

  BEGIN

    xselect :=  'Select r.COD_RECEB,
                        r.CODCLI,
                        r.NRO_DOC,
                        r.DT_VENC ,
                        c.NOME,
                        R.NRO_BANCO ,
                        R.DT_EMISSAO,
                        r.cod_conta,
                        r.valor_pgto,
                        r.cancel,
                        (select b.cod_bc 
                         from DBCONTA cc ,  DBBANCO b  
                         where cc.cod_banco = b.cod_banco 
                           and cc.cod_conta = r.cod_conta) 
                         as codBc
                ';
    xfrom   :=  'from dbReceb r, dbClien c ';
    xwhere  :=  'where r.CodCli=c.CodCli ';

    --escreve condicao xwhere apartir do banco informado...

    --- BRADESCO ----------------------------
    if(vBANCO = 'BANCO BRADESCO' ) then

      select count(r.COD_RECEB) into xcont
      from dbReceb r
      where r.Nro_Banco = vCod_Receb;

      if (xcont > 0)
        then xsel := xsel || 'and r.Nro_Banco = ''' || vCod_Receb || ''' ';
        else xsel := xsel || 'and r.Cod_Receb = ''' || substr(vCod_Receb,3,9) || ''' ';
      end if;
      xselect := xselect || ',''' || to_char(xcont) || ''' as QUANT ' ;
      xwhere  := xwhere  || xsel;

    --- BANCO DO BRASIL ----------------------
    elsif(vBANCO = 'BANCO DO BRASIL') or (vBANCO = 'BANCO DO BRASIL ANTIGO') then

      if (vBANCO = 'BANCO DO BRASIL') then

        xwhere := xwhere  || 'AND r.nro_banco = ''' || vCod_Receb || ''' ';
        xorder := 'order by dt_emissao desc';

      elsif (vBANCO = 'BANCO DO BRASIL ANTIGO') then

        xwhere := xwhere  || 'AND r.nro_docbanco = ''' || vCod_Receb || ''' and Substr(r.nro_docbanco,1,1)<>''1'' ';

      end if;
      xselect := xselect || ',''0'' as QUANT ' ;
    --- ITAU ---------------------------------
    elsif(vBANCO = 'BANCO ITAU') then

      select count(r.COD_RECEB) into xcont
      from dbReceb r
      where r.Nro_Banco = vCod_Receb;

      if xcont > 0
      then xsel := xsel || ' and r.Nro_Banco = ''' || vCod_Receb || ''' ';
      else
          xCod_Receb := '0' || vCod_Receb;
          xsel := xsel || ' and r.Cod_Receb = ''' || xCod_Receb || ''' ';
      end if;
      xselect := xselect || ',''' || to_char(xcont) || ''' as QUANT ' ;
      xwhere := xwhere  || xsel;
    --- RURAL ---------------------------------
    elsif (vBANCO = 'BANCO RURAL') then
      xwhere := xwhere  || ' and r.Nro_Banco = ''' || vCod_Receb || ''' ';
    --- SAFRA --------------------------------- 
    elsif (vBANCO = 'BANCO SAFRA') then
      xwhere := xwhere  || ' and r.Nro_Banco = ''' || vCod_Receb || ''' ';      
    --- SANTANDER -----------------------------
    elsif (vBANCO = 'BANCO SANTANDER') then 
      xwhere := xwhere  || ' and r.banco=''5'' and r.Nro_Banco = ''' || vCod_Receb || ''' and r.Cod_Conta <> ''0147'' ';
    --- CITIBANK ------------------------------
    elsif (vBANCO = 'BANCO CITIBANK') then 
      xwhere := xwhere  || ' and r.banco=''7'' and r.Nro_Banco = ''' || vCod_Receb || ''' ';
    elsif (vBANCO = 'BANCO CAIXA ECONOMICA') then 
      xwhere := xwhere  || ' and r.banco=''8'' and r.Nro_Banco = ''' || vCod_Receb || ''' ';  
    end if;
    xselect := xselect || xfrom || xwhere || xorder;
    dbms_output.put_line(xselect);
    open vCursorSaida for xselect;

    EXCEPTION
        WHEN OTHERS THEN
           raise_application_error(-20001,'SQL:' || xselect );

  END CONSULTA;


  procedure CONSULTA_BODERO
  (
    vORIGEMDADOS in varchar2,
    vCOD_RECEB   in dbReceb.Nro_Banco%type,
    vCursorSaida out cursorgenerico.tipocursorgenerico
  )
  IS
    xselect    LONG;
  BEGIN

    xselect := 'select cod_receb,digito
                from dbdocbodero d
                where d.cod_receb = '''|| vCOD_RECEB||''' ';

    open vCursorSaida for xselect;

  END;


  procedure CONSULTA_OCORRENCIA
  (
    vBANCO       in varchar2,
    vCODIGO      in varchar2,
    vCursorSaida out cursorgenerico.tipocursorgenerico
  )
  IS

  BEGIN

    open vCursorSaida for
      select  R.CODOCORRENCIA,
              R.DESCRICAO,
              S.CODSITUACAO,
              S.SITUACAO

        from  dbretorno_ocorrencias r,
              DBRETORNO_SITUACAO S
        where
              s.codsituacao = r.situacao
          AND r.banco = vBANCO
          and r.codocorrencia = vCODIGO;

  END;

  procedure CONSULTA_COD_CONTA
  (
    vConta in varchar2,
    vParam in varchar2,
    vCursorSaida out cursorgenerico.TIPOCURSORGENERICO
  )
  is
  begin
    open vCursorSaida for
      select c.cod_conta as COD_CONTA
      from dbconta c
      where c.nro_conta || c.digito  = vConta;

  end;
  
  procedure ANALISA_TITULO(pCod_Receb in varchar2,
                           pDataOcorrencia in date,
                           pValorPago in number,
                           pValorJuros in number,
                           pStatus    out varchar2) is
   /*
   retorna 0 para baixa automatica;
           1 para baixa manual*/
   vResult number:=0;
   vCount number;
   vRowReceb      dbreceb%rowtype;
   vDiasAtraso    NUMBER;
   vJuros         number;
  begin
    pStatus := 'OK';
    
    select * into vRowReceb 
    from dbreceb r where cod_receb = pCod_Receb;
    
    if vRowReceb.Cancel = 'S' then
      pStatus := 'CA'; --titulo cancelado
    elsif vRowReceb.Valor_Rec > 0 then
      pStatus := 'VR'; --titulo com valor recebido
    elsif vRowReceb.Valor_Pgto > pValorPago then
      pStatus := 'V+'; --titulo com valor maior que o recebido
    elsif vRowReceb.Valor_Pgto < pValorPago then
      pStatus := 'V-'; --titulo com valor menor que o recebido
    end if;
    
    select case
             when to_date(pDataOcorrencia,'dd/mm/yyyy') > r.dt_venc
               then 
                 case 
                  when (to_date(pDataOcorrencia,'dd/mm/yyyy')  >= fluxocxx3.RETORNA_DIA_ATRASO(r.dt_venc,0,0))
                    then (to_date(pDataOcorrencia,'dd/mm/yyyy') - case when (r.dt_venc>= r.dt_pgto ) then r.dt_venc else nvl(r.dt_pgto, r.dt_venc)end) 
                  else 0
                 end     
             else 0
           end diasAtraso into vDiasAtraso    
    from dbreceb r where cod_receb = pCod_Receb;

    select caixa.CALULAR_JUROS(pCod_Receb,vDiasAtraso) into vJuros from dual;
    
    if pStatus = 'OK' then
      if (pValorJuros < (vJuros * 0.99)) then
        pStatus := 'JE'; 
      end if;
    end if;
   
  end;

  --- consulta Retorno detalhe
  PROCEDURE navega_RetornoDetalhe( codigo  IN  number,
                                   cur_ret OUT cursorgenerico.tipocursorgenerico)
  IS

  BEGIN
        OPEN cur_ret FOR
          select rd.codretorno_detalhe, rd.codretorno, rd.codreceb, rd.codcli,
                 rd.nomecli, rd.tipo_empresa, rd.cnpj, rd.nro_docbanco, rd.codocorrencia,
                 rd.ocorrencia, rd.nro_doc, rd.dt_ocorrencia, rd.dt_venc, rd.valor_titulo,
                 rd.banco_cobrador, rd.agencia_cobradora, rd.valor_pago, rd.valor_desconto,
                 rd.valor_juros, rd.carteira, rd.protesto, rd.motivo, rd.situacao,
                 r.dt_emissao, r.cod_conta, r.cancel
          from dbretorno_detalhe  rd, dbreceb r
          where rd.codretorno = codigo
            and r.cod_receb = rd.codreceb
          ORDER BY rd.nomecli;

  END navega_RetornoDetalhe;



  procedure ARQUIVO_INC
  (
    vbanco                        in varchar2,
    vdata_importacao              in date,
    vnome_arquivo                 in varchar2,
    vusuario_importacao           in varchar2,
    vqtd_mao                      in number,
    vqtd_pvh                      in number,
    vqtd_rec                      in number,
    vqtd_flz                      in number,
    vqtd_bmo                      in number,
    vqtd_csac                     in number,
    vqtd_jps                      in number,
    vDataGeracaoArquivo           in varchar2,
    vNumeroSequencialArquivo      in varchar2,
    vNomeBanco                    in varchar2,
    vNumeroBancoCamaraCompensacao in varchar2,
    codigo                        OUT number
  )
  IS

  BEGIN

    insert into dbretorno_arquivo
    (banco, data_importacao, nome_arquivo, usuario_importacao,
     qtd_mao, qtd_pvh, qtd_rec, qtd_flz, qtd_cccc, qtd_csac, qtd_jps,
     DataGeracaoArquivo, NumeroSequencialArquivo, NomeBanco, NumeroBancoCamaraCompensacao)
    values
    (vbanco, vdata_importacao, vnome_arquivo, vusuario_importacao,
     vqtd_mao, vqtd_pvh, vqtd_rec, vqtd_flz, vqtd_bmo, vqtd_csac, vqtd_jps,
     vDataGeracaoArquivo, vNumeroSequencialArquivo, vNomeBanco, vNumeroBancoCamaraCompensacao)
    returning codretorno into codigo;

    EXCEPTION
      WHEN OTHERS THEN
       raise_application_error(-20001, To_char( 'banco = ' || vbanco || ' dt.imp = ' || 
               vdata_importacao || ' nomeArquivo =' ||  vnome_arquivo || ' usuImportacao =' || 
               vusuario_importacao || ' qtdMao = ' || vqtd_mao || ' qtdPvh = ' || vqtd_pvh 
               || ' qtdRec = ' || vqtd_rec || ' qtdFlz = ' || vqtd_flz || ' qtdCCCC = ' || vqtd_bmo
               || ' qtdCSAC = ' || vqtd_csac || ' qtdJps = ' || vqtd_jps));

  END;

  procedure DETALHE_INC
  (
    vcodretorno        in dbretorno_detalhe.codretorno%type,
    vcodreceb          in dbretorno_detalhe.codreceb%type,
    vcodcli            in dbretorno_detalhe.codcli %type,
    vnomecli           in dbretorno_detalhe.nomecli%type,
    vtipo_empresa      in dbretorno_detalhe.tipo_empresa%type,
    vcnpj              in dbretorno_detalhe.cnpj%type,
    vnro_docbanco      in dbretorno_detalhe.nro_docbanco%type,
    vcodocorrencia     in dbretorno_detalhe.codocorrencia%type,
    vocorrencia        in dbretorno_detalhe.ocorrencia%type,
    vnro_doc           in dbretorno_detalhe.nro_doc%type,
    vdt_ocorrencia     in dbretorno_detalhe.dt_ocorrencia%type,
    vdt_venc           in dbretorno_detalhe.dt_venc%type,
    vvalor_titulo      in dbretorno_detalhe.valor_titulo%type,
    vbanco_cobrador    in dbretorno_detalhe.banco_cobrador%type,
    vagencia_cobradora in dbretorno_detalhe.agencia_cobradora%type,
    vvalor_pago        in dbretorno_detalhe.valor_pago%type,
    vvalor_desconto    in dbretorno_detalhe.valor_desconto%type,
    vvalor_juros       in dbretorno_detalhe.valor_desconto%type,
    vcarteira          in dbretorno_detalhe.carteira%type,
    vprotesto          in dbretorno_detalhe.protesto%type,
    vmotivo            in dbretorno_detalhe.motivo%type,
    vSITUACAO          in dbretorno_detalhe.Situacao%type
  )
  IS
  BEGIN


    insert into dbretorno_detalhe
    (codretorno, codreceb, codcli, nomecli, tipo_empresa, cnpj, nro_docbanco, codocorrencia , ocorrencia, nro_doc, dt_ocorrencia, dt_venc, valor_titulo, banco_cobrador, agencia_cobradora, valor_pago, valor_desconto, valor_juros, carteira, protesto, motivo, SITUACAO)
    values
    (vcodretorno, vcodreceb, vcodcli, vnomecli, vtipo_empresa, vcnpj, vnro_docbanco,vcodocorrencia ,vocorrencia, vnro_doc, vdt_ocorrencia, vdt_venc, vvalor_titulo, vbanco_cobrador, vagencia_cobradora, vvalor_pago, vvalor_desconto, vvalor_juros, vcarteira, vprotesto, vmotivo, VSITUACAO);

    ---EXCEPTION
    --  WHEN OTHERS THEN
    --    RETURN TO_CHAR(SQLCODE) || ' - '|| SQLERRM;

  END;


  PROCEDURE DETALHE_CONSULTA
  (
    vcodretorno  in dbretorno_detalhe.codretorno%type,
    vCursorSaida out cursorgenerico.TIPOCURSORGENERICO
  )
  IS
  BEGIN

    open vCursorSaida for
      Select rd.codreceb,
             rd.nomecli,
             rd.tipo_empresa,
             rd.cnpj, rd.nro_docbanco,
             rd.codocorrencia, rd.ocorrencia,
             rd.nro_doc,
             rd.dt_ocorrencia,
             rd.dt_venc,
             rd.valor_titulo,
             rd.banco_cobrador,
             rd.agencia_cobradora,
             rd.valor_pago,
             rd.valor_desconto,
             rd.valor_juros, rd.carteira,
             rd.protesto,
             rd.motivo,
             CASE rd.situacao
               WHEN 'P' THEN 'PAGO'
               WHEN '1' THEN 'NAO PAGO TOTALMENTE'
               WHEN '2' THEN 'PAGO ATRASO JX CORRETO'
               WHEN '3' THEN 'PAGO ATRASO JX MENOR'
               WHEN '4' THEN 'TITULO NAO LOCALIZADO'
             END AS SITUACAO

      from dbretorno_detalhe rd
      where rd.codretorno = vcodretorno;

  END;
  
  
  PROCEDURE VALIDA_ARQUIVO(
    vDataGeracaoArquivo           in varchar2,
    vNumeroSequencialArquivo      in varchar2,
    vNomeBanco                    in varchar2,
    vNumeroBancoCamaraCompensacao in varchar2,
    vArquivoExistente             out number
  ) is
  BEGIN
    select count(*) into vArquivoExistente  from dbretorno_arquivo z 
    where z.datageracaoarquivo = vdatageracaoarquivo and z.numerosequencialarquivo = vnumerosequencialarquivo and 
          z.nomebanco = vnomebanco and z.numerobancocamaracompensacao = vnumerobancocamaracompensacao;
  END;
  
  
  procedure CONSULTA_ARQUIVO
  (
    vBANCO          in varchar2,
    vNOME_ARQUIVO   in VARCHAR2,
    vResp           out varchar2
  )
  IS
    Qtde Number;
  BEGIN

    select count(*) into qtde
    from dbretorno_arquivo r
    where r.banco = vBANCO and r.nome_arquivo = vNOME_ARQUIVO and 
          trunc(r.data_importacao) = trunc(sysdate);
          
    if Qtde > 0 then
       vResp := 'NOK';
    else
       vResp := 'OK';
    end if;
    
  END;
  
  procedure CONSULTA_CONVENIOBB(pcursor out cursorgenerico.TIPOCURSORGENERICO) is
  begin
    open pcursor for
    select substr(bb.cgc,12,1) melo, bb.* from dbconveniobb bb;
  end CONSULTA_CONVENIOBB;

end RETORNO;


end RETORNO;

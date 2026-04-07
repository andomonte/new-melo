package BBRASIL is
package body BBRASIL is

 ------------------------------------------------------------
 ------------------------------------------------------------------------
 -- para preparac?o do arquivo de remessa --
 -- Author  : PATRIANE                                                 --
 ------------------------------------------------------------
 -- Created : 17/04/2003 14:18:16                                      --
 
 -- Purpose : Procedures e Functions para layout de Cobranca Brandesco --
 --carrega titulos para envio que n?o tenha sido alterada a data de vencto.
 ------------------------------------------------------------------------
 PROCEDURE BBrasil_Titulo_Cadastro(
  
                                    vDt1 in Date,
 -- carrega titulos para envio que n?o tenha sido alterada a data de vencto.
                                    vDt2 in Date,
 PROCEDURE BBrasil_Titulo_Cadastro(
                                    vTipo in varchar2,
                                    vDt1 in Date,
                                    vCodConta in dbConta.Cod_Conta%type,
                                    vDt2 in Date,
                                    cur_titulos out cursorgenerico.tipocursorgenerico) is
                                    vTipo in varchar2,
 BEGIN
                                    vCodConta in dbConta.Cod_Conta%type,
  if vTipo='17' then 
                                    cur_titulos out cursorgenerico.tipocursorgenerico);
     Open cur_titulos for

        Select R.COD_RECEB, R.NRO_DOC, R.DT_VENC, R.DT_EMISSAO,
 -- carrega titulos para envio que tenha sido alterada a data de vencto. 
                   R.VALOR_PGTO, R.NRO_DOCBANCO AS NRO_BANCO,
 PROCEDURE BBrasil_Titulo_AltVencto(
                   C.CODCLI, C.NOME, C.CPFCGC AS CNPJ, C. TIPO,
                                     vDt1 in Date,                                     
                   C.ENDERCOBR AS ENDER, C.CEPCOBR AS CEP,
                                     vDt2 in Date,
                   B.DESCR AS BAIRRO, B.CIDADE, B.UF,
                                     vTipo in varchar2,
                   R.NRO_DOCBANCO AS NRO_BANCO
                                     vCodConta in dbConta.Cod_Conta%type,
        From DbReceb r, DbConta ct, Dbclien c, DbBairro b
                                     cur_titulos out cursorgenerico.tipocursorgenerico);
        Where 
 
             --(r.dt_emissao<='16/09/2004') 
 -- carrega titulos para envio que tenha sido alterado o valor do docto. 
              r.dt_venc<=vdt2 and               
 PROCEDURE BBrasil_Titulo_AltValor(
              r.cancel='N' and r.valor_rec = 0 and r.rec='N' and 
                                    vDt1 in Date,
              r.forma_fat = '2' and 
                                    vDt2 in Date,
              r.bradesco = 'N' and r.banco='1' and             
                                    vTipo in varchar2,
              r.dt_venc = r.venc_ant and 
                                    vCodConta in dbConta.Cod_Conta%type,
              r.cod_conta = vcodconta and r.cod_conta = ct.cod_conta and 
                                    vCodCli in dbReceb.Codcli%type,
              r.codcli = c.codcli and c.codbairrocobr = b.codbairro
                                    vTpFiltro in varchar2,
        Order by R.DT_VENC, R.CODCLI;
                                    cur_titulos out cursorgenerico.tipocursorgenerico);
  else 
                                    
  if vTipo='31' then 
 -- carrega titulos para envio para pedido de protesto
     Open cur_titulos for
 PROCEDURE BBrasil_Titulo_Protesto(
        Select R.COD_RECEB, R.NRO_DOC, R.DT_VENC, R.DT_EMISSAO,
                                    vDt1 in Date,
                   R.VALOR_PGTO, R.NRO_DOCBANCO AS NRO_BANCO,
                                    vDt2 in Date,
                   C.CODCLI, C.NOME, C.CPFCGC AS CNPJ, C. TIPO,
                                    vCodCli in dbClien.CodCli%type,
                   C.ENDERCOBR AS ENDER, C.CEPCOBR AS CEP,
                                    cur_titulos out cursorgenerico.tipocursorgenerico);
                   B.DESCR AS BAIRRO, B.CIDADE, B.UF,

                   R.NRO_DOCBANCO AS NRO_BANCO
 -- carrega todos os clientes
        From DbReceb r, DbConta ct, Dbclien c, DbBairro b
 PROCEDURE Clientes(curCliente out cursorgenerico.tipocursorgenerico);
        Where r.dt_emissao >= '17/09/2004' and  r.dt_emissao <= vdt2 and 

              r.cancel='N' and r.valor_rec = 0 and r.rec='N' and 
 -- pesquisa se o docto ja foi incluido no bodero
              r.forma_fat = '2' and 
 PROCEDURE Pesquisa_DocBodero(vCod_Receb in dbReceb.Cod_Receb%type,                       
              r.bradesco = 'N' and r.banco='1' and             
              r.dt_venc = r.venc_ant and 
                               vNro out integer);

              r.cod_conta = vcodconta and r.cod_conta = ct.cod_conta and 
 -- devolve o valor de abatimento a ser concedido                               
              r.codcli = c.codcli and c.codbairrocobr = b.codbairro
 PROCEDURE Valor_Abatimento(vCod_Receb in dbReceb.Cod_Receb%type,
        Order by R.DT_VENC, R.CODCLI;
                            vValor out dbReceb.Valor_Pgto%type);
   end if; end if;   
                               
 END BBrasil_Titulo_Cadastro;
 -- inclui cabecalho do bodero

 PROCEDURE Inc_Boderobb (vCodConta in dbBodero.Cod_Conta%type,
 -- carrega titulos para envio que tenha sido alterada a data de vencto. 
                       vDtInicial in dbBodero.Dtinicial%type,
 PROCEDURE BBrasil_Titulo_AltVencto(
                       vDtFinal in dbBodero.Dtfinal%type,
                                     vDt1 in Date,
                       vDtEmissao in dbBodero.Dtemissao%type,
                                     vDt2 in Date,
                       vCodBodero out dbBodero.Cod_bodero%type);
                                     vTipo in varchar2,
 
                                     vCodConta in dbConta.Cod_Conta%type,
 -- inclui doctos do bodero
                                     cur_titulos out cursorgenerico.tipocursorgenerico) is
 PROCEDURE Inc_DocBoderobb (vCodBodero in dbDocBodero.Cod_bodero%type,
 BEGIN
                         vCodReceb in dbDocBodero.Cod_Receb%type,
  if vTipo='17' then  
                         vDigito in dbDocBodero.Digito%type,
       Open cur_titulos for
                         vOperacao in dbDocBodero.Operacao%type);
          Select R.COD_RECEB, R.NRO_DOC, R.DT_VENC, R.DT_EMISSAO,

                     R.VENC_ANT, R.VALOR_PGTO, R.NRO_DOCBANCO AS NRO_BANCO,
 PROCEDURE Dados_Receb(vNro_Banco in dbReceb.Nro_DocBanco%type,
                     C.CODCLI, C.NOME, C.CPFCGC AS CNPJ, C. TIPO,
                                          curReceb out cursorgenerico.tipocursorgenerico);
                     C.ENDERCOBR AS ENDER, C.CEPCOBR AS CEP,
                       
                     B.DESCR AS BAIRRO, B.CIDADE, B.UF,
 PROCEDURE Navega_Bodero(vDt_Emissao in dbBodero.Dtemissao%type,
                     R.NRO_DOCBANCO AS NRO_BANCO
                                           vCod_Conta in dbBodero.Cod_Conta%type,
          From DbReceb r, DbConta ct, Dbclien c, dbBairro b
                                           curBodero out cursorgenerico.tipocursorgenerico);
          Where r.dt_venc >= vdt1 and r.dt_venc <= vdt2 and

                --r.dt_emissao<='16/09/2004' and 
 PROCEDURE Navega_DocBodero(vCod_Bodero in dbBodero.Cod_Bodero%type,
                r.cancel = 'N' and r.dt_venc <> r.venc_ant and
                                                 curBodero out cursorgenerico.tipocursorgenerico);
                r.cod_conta = vcodconta and r.forma_fat = '2' and 
                                           
                r.bradesco = 'N' and r.banco='1' and 
 end BBRASIL;
                r.cod_conta = ct.cod_conta and

                r.codcli = c.codcli and c.codbairrocobr = b.codbairro
 
          Order by R.DT_VENC, R.CODCLI;          
 
  else 
 
  if vTipo='31' then 
 
     Open cur_titulos for
           Select R.COD_RECEB, R.NRO_DOC, R.DT_VENC, R.DT_EMISSAO,
                     R.VENC_ANT, R.VALOR_PGTO, R.NRO_DOCBANCO AS NRO_BANCO,
                     C.CODCLI, C.NOME, C.CPFCGC AS CNPJ, C. TIPO,
                     C.ENDERCOBR AS ENDER, C.CEPCOBR AS CEP,
                     B.DESCR AS BAIRRO, B.CIDADE, B.UF,
                     R.NRO_DOCBANCO AS NRO_BANCO
          From DbReceb r, DbConta ct, Dbclien c, dbBairro b
          Where r.dt_emissao>='17/09/2004' and r.dt_emissao <= vdt2 and                
                r.cancel = 'N' and r.dt_venc <> r.venc_ant and
                r.cod_conta = vcodconta and r.forma_fat = '2' and 
                r.bradesco = 'N' and r.banco='1' and 
                r.cod_conta = ct.cod_conta and
                r.codcli = c.codcli and c.codbairrocobr = b.codbairro
          Order by R.DT_VENC, R.CODCLI;          
   end if; end if;             
 END BBrasil_Titulo_AltVencto;
 
 -- carrega titulos para envio que tenha sido alterado o valor do docto. 
 PROCEDURE BBrasil_Titulo_AltValor(
                                    vDt1 in Date,
                                    vDt2 in Date,
                                    vTipo in varchar2,
                                    vCodConta in dbConta.Cod_Conta%type,
                                    vCodCli in dbReceb.Codcli%type,
                                    vTpFiltro in varchar2,
                                    cur_titulos out cursorgenerico.tipocursorgenerico) is
 BEGIN
  if vTipo = '17' then
   if vTpFiltro = 'P' then -- filtro todos do periodo
      Open cur_titulos for
        Select R.COD_RECEB, R.NRO_DOC, R.DT_VENC, R.DT_EMISSAO, 
                   R.VALOR_PGTO, R.NRO_DOCBANCO AS NRO_BANCO,
                   C.CODCLI, C.NOME, C.CPFCGC AS CNPJ, C. TIPO,
                   C.ENDERCOBR AS ENDER, C.CEPCOBR AS CEP,
                   B.DESCR AS BAIRRO, B.CIDADE, B.UF,
                   R.NRO_DOCBANCO AS NRO_BANCO
        From DbReceb r, Dbclien c, dbFReceb fr, dbBairro b
        Where r.dt_venc >= vdt1 and r.dt_venc <= vdt2 and 
              --r.dt_emissao <= '16/09/2004' and
              r.rec = 'N' and 
              r.cod_conta=vcodconta and 
              r.cancel = 'N' and
              r.forma_fat = '2' and 
              r.banco = '1' and                   
              r.bradesco <> 'B' and
              r.cod_receb = fr.cod_receb and 
              fr.tipo = '05' and fr.brandesco = 'N' and 
              fr.brandesco= 'N'  and 
              r.codcli = c.codcli and c.codbairrocobr=b.codbairro
        Order by R.DT_VENC, R.CODCLI;       
   end if;
   if vTpFiltro = 'C' then -- filtro pelo cliente
      Open cur_titulos for
        Select R.COD_RECEB, R.NRO_DOC, R.DT_VENC, R.DT_EMISSAO, 
               R.VALOR_PGTO, R.NRO_DOCBANCO AS DIG_BOLETO,
               C.CODCLI, C.NOME, C.CPFCGC AS CNPJ, C. TIPO,
               C.ENDERCOBR AS ENDER, C.CEPCOBR AS CEP,
               B.DESCR AS BAIRRO, B.CIDADE, B.UF,
               R.NRO_DOCBANCO AS NRO_BANCO
        From DbReceb r, Dbclien c, dbFReceb fr, dbBairro b
        Where r.codcli = vCodCli and              
              r.dt_emissao <= '16/09/2004' and
              r.cod_conta=vcodconta and 
              r.forma_fat = '2' and 
              r.cancel = 'N' and
              r.banco='1' and 
              r.cod_receb = fr.cod_receb and 
              fr.tipo = '05' and 
              fr.brandesco = 'N' and 
              fr.brandesco = 'N'  and 
              r.codcli = c.codcli and c.codbairrocobr = b.codbairro
        Order by R.DT_VENC, R.CODCLI;     
   end if; 
  end if;
  if vTipo = '31' then
   if vTpFiltro = 'P' then -- filtro todos do periodo
      Open cur_titulos for
        Select R.COD_RECEB, R.NRO_DOC, R.DT_VENC, R.DT_EMISSAO, 
               R.VALOR_PGTO, R.NRO_DOCBANCO AS NRO_BANCO,
               C.CODCLI, C.NOME, C.CPFCGC AS CNPJ, C. TIPO,
               C.ENDERCOBR AS ENDER, C.CEPCOBR AS CEP,
               B.DESCR AS BAIRRO, B.CIDADE, B.UF,
               R.NRO_DOCBANCO AS NRO_BANCO
        From DbReceb r, Dbclien c, dbFReceb fr, dbBairro b
        Where r.dt_venc >= vdt1 and r.dt_venc <= vdt2 and 
              r.dt_emissao >='17/09/2004' and        
              r.rec = 'N' and 
              r.cod_conta=vcodconta and 
              r.cancel = 'N' and
              r.forma_fat = '2' and 
              r.banco = '1' and                   
              r.bradesco <> 'B' and
              r.cod_receb = fr.cod_receb and 
              fr.tipo = '05' and fr.brandesco = 'N' and 
              fr.brandesco= 'N'  and 
              r.codcli = c.codcli and c.codbairrocobr=b.codbairro
        Order by R.DT_VENC, R.CODCLI;       
   end if;
   if vTpFiltro = 'C' then -- filtro pelo cliente
      Open cur_titulos for
        Select R.COD_RECEB, R.NRO_DOC, R.DT_VENC, R.DT_EMISSAO, 
                   R.VALOR_PGTO, R.NRO_DOCBANCO AS DIG_BOLETO,
                   C.CODCLI, C.NOME, C.CPFCGC AS CNPJ, C. TIPO,
                   C.ENDERCOBR AS ENDER, C.CEPCOBR AS CEP,
                   B.DESCR AS BAIRRO, B.CIDADE, B.UF,
                   R.NRO_DOCBANCO AS NRO_BANCO
        From DbReceb r, Dbclien c, dbFReceb fr, dbBairro b
        Where r.codcli = vCodCli and              
              r.dt_emissao >='17/09/2004' and        
              r.cod_conta=vcodconta and 
                  r.forma_fat = '2' and 
                  r.cancel = 'N' and
                  r.banco='1' and 
                  r.cod_receb = fr.cod_receb and 
                  fr.tipo = '05' and 
                  fr.brandesco = 'N' and 
                  fr.brandesco = 'N'  and 
                  r.codcli = c.codcli and c.codbairrocobr = b.codbairro
        Order by R.DT_VENC, R.CODCLI;     
   end if; 
 end if;
 END BBrasil_Titulo_AltValor;

 -- carrega titulos para envio para pedido de protesto
 PROCEDURE BBrasil_Titulo_Protesto(
                                    vDt1 in Date,
                                    vDt2 in Date,
                                    vCodCli in dbClien.CodCli%type,
                                    cur_titulos out cursorgenerico.tipocursorgenerico) is
 BEGIN
   Open cur_titulos for
    Select R.COD_RECEB, R.NRO_DOC, R.DT_VENC, R.DT_EMISSAO,
               R.VENC_ANT, R.VALOR_PGTO, R.NRO_DOCBANCO AS DIG_BOLETO,
               C.CODCLI, C.NOME, C.CPFCGC AS CNPJ, C. TIPO,
               C.ENDERCOBR AS ENDER, C.CEPCOBR AS CEP,
               B.DESCR AS BAIRRO, B.CIDADE, B.UF,
               R.NRO_DOCBANCO AS NRO_BANCO
    From DbReceb r, DbConta ct, Dbclien c, dbBairro b
    Where r.dt_venc >= vdt1 and r.dt_venc <= vdt2 and
          r.forma_fat = '2' and r.bradesco = 'S' and 
          r.banco = '1' and r.bradesco = 'S' and 
          r.cancel = 'N' and r.rec = 'N' and 
          r.codcli = vCodCli and r.codcli = c.codcli and           
          r.cod_conta = ct.cod_conta and c.codbairrocobr = b.codbairro
    Order by R.DT_VENC, R.CODCLI;
 END BBrasil_Titulo_Protesto;

 -- carrega todos os clientes
 PROCEDURE Clientes(curCliente out cursorgenerico.tipocursorgenerico) is
 BEGIN
   Open curCliente for
     Select CodCli, Nome From dbClien Order by Nome;
 END Clientes;
 
 -- pesquisa se o docto ja foi incluido no bodero
 PROCEDURE Pesquisa_DocBodero(vCod_Receb in dbReceb.Cod_Receb%type,                       
                               vNro out integer) is           
 BEGIN
   Select count(*) into vNro 
   from dbDocBoderoBB
   where Cod_Receb = vCod_Receb;
   if vNro is null then vNro := 0;
   end if;
 END Pesquisa_DocBodero;

 -- devolve o valor de abatimento a ser concedido
 PROCEDURE Valor_Abatimento(vCod_Receb in dbReceb.Cod_Receb%type,
                            vValor out dbReceb.Valor_Pgto%type) is
 BEGIN
   Select Sum(fr.Valor) Into vValor
    From dbFReceb fr
    Where Cod_Receb = vCod_Receb and fr.tipo = '05' and SF = 'S';
   if vValor is null then vValor := 0; 
   end if;
 END Valor_Abatimento;                                       

 -- inclui cabecalho do bodero
 PROCEDURE Inc_Boderobb (vCodConta in dbBodero.Cod_Conta%type,
                       vDtInicial in dbBodero.Dtinicial%type,
                       vDtFinal in dbBodero.Dtfinal%type,
                       vDtEmissao in dbBodero.Dtemissao%type,
                       vCodBodero out dbBodero.Cod_bodero%type) is 
      nro integer;                       
 BEGIN
      Select count(*) into nro from dbBoderoBB;
      if nro > 0 then 
         Select Max(To_Number(Cod_Bodero)) Into vCodBodero From dbBoderobb;
      else 
         vCodBodero := '0';  
      end if;
      nro := To_Number(vCodBodero) + 1;
      vCodBodero := Geral.Strzero(nro,9);
      Insert Into dbBoderobb(Cod_bodero,Cod_Conta,Dtinicial,Dtfinal,Dtemissao,Cancel)
                               Values(vCodBodero,vCodConta,vDtInicial,vDtFinal,vDtEmissao,'N');
 END Inc_Boderobb;
 
 -- inclui doctos do bodero
 PROCEDURE Inc_DocBoderobb(
                         vCodBodero in dbDocBodero.Cod_bodero%type,
                         vCodReceb in dbDocBodero.Cod_Receb%type,
                         vDigito in dbDocBodero.Digito%type,
                         vOperacao in dbDocBodero.Operacao%type) is                                    
      vValor dbReceb.Valor_Pgto%type;
      vData  dbReceb.Dt_Venc%type;                         
 BEGIN
   If (vOperacao = 'I') or (vOperacao = 'D') then
       Select Valor_Pgto, Dt_Venc Into vValor, vData 
         From dbReceb Where Cod_Receb = vCodReceb;
       Update dbReceb Set Bradesco = 'S' where Cod_Receb = vCodReceb;
       Insert into dbDocBoderoBB(Cod_bodero, Cod_Receb, Operacao, Valor, Dt_Venc, Digito)
                                     Values(vCodbodero, vCodReceb, vOperacao, vValor, vData, vDigito);
   end if;
   if vOperacao = 'V' then
       Select Dt_Venc Into vData 
        From dbReceb Where Cod_Receb = vCodReceb;
       Select Sum(Valor) Into vValor From dbFReceb
        Where Cod_Receb = vCodReceb and Tipo = '05' and SF = 'S';

       Update dbFReceb Set Brandesco = 'S' 
       where Cod_Receb = vCodReceb and Tipo = '05' and SF = 'S';
  
       Insert into dbDocBoderobb(Cod_bodero, Cod_Receb, Operacao, Valor, Dt_Venc, Digito)
                                     Values(vCodbodero, vCodReceb, vOperacao, vValor, vData, vDigito);
   end if;
 END Inc_DocBoderobb;
 
 PROCEDURE Dados_Receb(vNro_Banco in dbReceb.Nro_DocBanco%type,
                                          curReceb out cursorgenerico.tipocursorgenerico) is           
 BEGIN
   Open curReceb for
    Select r.COD_RECEB, r.CODCLI, r.NRO_DOC, r.DT_VENC , c.NOME
    from dbReceb r, dbClien c
    where r.nro_docbanco = vNro_Banco and r.CodCli=c.CodCli and Substr(r.nro_docbanco,1,1)<>'1';--Eu...;
 END Dados_Receb;

 PROCEDURE Navega_Bodero(vDt_Emissao in dbBodero.Dtemissao%type,
                                           vCod_Conta in dbBodero.Cod_Conta%type,
                                           curBodero out cursorgenerico.tipocursorgenerico) is
 BEGIN
    Open curBodero for 
     Select b.cod_bodero, b.cod_conta, b.dtinicial, b.dtfinal, b.dtemissao, b.cancel
     from dbBoderoBB b where DtEmissao=vDt_Emissao and Cod_Conta=vCod_Conta;
 END Navega_Bodero;

 PROCEDURE Navega_DocBodero(vCod_Bodero in dbBodero.Cod_Bodero%type,
                                                 curBodero out cursorgenerico.tipocursorgenerico) is
 BEGIN
    Open curBodero for     
     Select b.cod_bodero, b.cod_conta, b.dtinicial, b.dtfinal, b.dtemissao, b.cancel,
                r.cod_receb, r.nro_doc, r.valor_pgto as valor_doc, r.dt_venc, r.dt_emissao,
                r.nro_docbanco as nro_banco, r.venc_ant,
                c.cpfcgc, c.codcli, c.nome as nomecli, c.tipo, 
                c.ender, c.cepcobr as cep, bai.cidade, bai.uf,                
                bai.descr as bairro,
                db.digito, db.operacao, db.valor as valor_operacao, db.digito
     from dbDocBoderoBB db, dbBoderoBB b, dbReceb r, dbClien c, dbBairro bai
     where  b.cod_bodero = vCod_Bodero and 
                 b.cod_bodero = db.cod_bodero and
                 db.cod_receb = r.cod_receb and 
                 r.codcli = c.codcli and c.codbairrocobr=bai.codbairro
     order by db.operacao;
 END Navega_DocBodero;

end BBRASIL;

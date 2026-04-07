package BRADESCO is
package body BRADESCO is

 ------------------------------------------------------------
 ------------------------------------------------------------------------
 -- para preparac?o do arquivo de remessa --
 -- Author  : PATRIANE                                                 --
 ------------------------------------------------------------
 -- Created : 17/04/2003 14:18:16                                      --
 
 -- Purpose : Procedures e Functions para layout de Cobranca Brandesco --
 -- carrega titulos para envio que n?o tenha sido alterada a data de vencto.
 ------------------------------------------------------------------------
 PROCEDURE Bradesco_Titulo_Cadastro(vDt1 in Date,
  
                                    vDt2 in Date,
 -- carrega titulos para envio que n?o tenha sido alterada a data de vencto.
                                    vCodConta in dbConta.Cod_Conta%type,
 PROCEDURE Bradesco_Titulo_Cadastro(vDt1 in Date,
                                    cur_titulos out cursorgenerico.tipocursorgenerico) is
                                    vDt2 in Date,
 BEGIN
                                    vCodConta in dbConta.Cod_Conta%type,
   Open cur_titulos for
                                    cur_titulos out cursorgenerico.tipocursorgenerico);
    Select R.COD_RECEB, R.NRO_DOC, R.DT_VENC, R.DT_EMISSAO, 

           R.VALOR_PGTO, R.NRO_DOCBANCO AS DIG_BOLETO, R.NRO_BANCO,
 -- carrega titulos para envio que tenha sido alterada a data de vencto. 
           C.CODCLI, C.NOME, C.CPFCGC AS CNPJ, C. TIPO,
 PROCEDURE Bradesco_Titulo_AltVencto(vDt1 in Date,
           C.ENDER, C.BAIRRO, C.CIDADE, C.UF, C.CEP           
                                     vDt2 in Date,
    From DbReceb r, DbConta ct, Dbclien c
                                     vCodConta in dbConta.Cod_Conta%type,
    Where --r.dt_venc >= vdt1 and           
                                     cur_titulos out cursorgenerico.tipocursorgenerico);
          r.dt_venc <= vdt2 and 
 
          r.forma_fat = '2' and r.bradesco = 'N' and
 -- carrega titulos para envio que tenha sido alterado o valor do docto. 
          r.cancel='N' and r.valor_rec = 0 and r.rec='N' and 
 PROCEDURE Bradesco_Titulo_AltValor(vDt1 in Date,
          r.dt_venc = r.venc_ant and 
                                    vDt2 in Date,
          r.cod_conta = vcodconta and r.cod_conta = ct.cod_conta and 
                                    vCodConta in dbConta.Cod_Conta%type,
          r.codcli = c.codcli and r.nro_banco is not null
                                    vCodCli in dbReceb.Codcli%type,
    Order by R.DT_VENC, R.CODCLI;
                                    vTpFiltro in varchar2,
 END Bradesco_Titulo_Cadastro;
                                    cur_titulos out cursorgenerico.tipocursorgenerico);

                                    
 -- carrega titulos para envio que tenha sido alterada a data de vencto. 
 -- carrega titulos para envio para pedido de protesto
 PROCEDURE Bradesco_Titulo_AltVencto(vDt1 in Date,
 PROCEDURE Bradesco_Titulo_Protesto(vDt1 in Date,
                                     vDt2 in Date,
                                    vDt2 in Date,
                                     vCodConta in dbConta.Cod_Conta%type,
                                    vCodCli in dbClien.CodCli%type,
                                     cur_titulos out cursorgenerico.tipocursorgenerico) is
                                    cur_titulos out cursorgenerico.tipocursorgenerico);                                   
 BEGIN

   Open cur_titulos for
 -- carrega todos os clientes
    Select R.COD_RECEB, R.NRO_DOC, R.DT_VENC, R.DT_EMISSAO,
 PROCEDURE Clientes(curCliente out cursorgenerico.tipocursorgenerico);
           R.VENC_ANT, R.VALOR_PGTO, R.NRO_DOCBANCO AS DIG_BOLETO,R.NRO_BANCO,

           C.CODCLI, C.NOME, C.CPFCGC AS CNPJ, C. TIPO,
 -- pesquisa se o docto ja foi incluido no bodero
           C.ENDER, C.BAIRRO, C.CIDADE, C.UF, C.CEP
 PROCEDURE Pesquisa_DocBodero(vCod_Receb in dbReceb.Cod_Receb%type,                       
    From DbReceb r, DbConta ct, Dbclien c
                               vNro out integer);
    Where r.dt_venc >= vdt1 and r.dt_venc <= vdt2 and

          r.forma_fat = '2' and r.bradesco = 'N' and
 -- devolve o valor de abatimento a ser concedido                               
          r.cancel = 'N' and r.dt_venc <> r.venc_ant and
 PROCEDURE Valor_Abatimento(vCod_Receb in dbReceb.Cod_Receb%type,
          r.cod_conta = vcodconta and r.cod_conta = ct.cod_conta and
                            vValor out dbReceb.Valor_Pgto%type);
          r.codcli = c.codcli and r.nro_banco is not null
                               
    Order by R.DT_VENC, R.CODCLI;          
 -- inclui cabecalho do bodero
 END Bradesco_Titulo_AltVencto;
 PROCEDURE Inc_Bodero (vCodConta in dbBodero.Cod_Conta%type,
 
                       vDtInicial in dbBodero.Dtinicial%type,
 -- carrega titulos para envio que tenha sido alterado o valor do docto. 
                       vDtFinal in dbBodero.Dtfinal%type,
 PROCEDURE Bradesco_Titulo_AltValor(vDt1 in Date,
                       vDtEmissao in dbBodero.Dtemissao%type,
                                    vDt2 in Date,
                       vCodBodero in dbBodero.Cod_bodero%type);
                                    vCodConta in dbConta.Cod_Conta%type,
 
                                    vCodCli in dbReceb.Codcli%type,
 -- inclui doctos do bodero
                                    vTpFiltro in varchar2,
 PROCEDURE Inc_DocBodero(vCodBodero in dbDocBodero.Cod_bodero%type,
                                    cur_titulos out cursorgenerico.tipocursorgenerico) is
                         vCodReceb in dbDocBodero.Cod_Receb%type,
 BEGIN
                         vDigito in dbDocBodero.Digito%type,
   if vTpFiltro = 'P' then -- filtro todos do periodo
                         vOperacao in dbDocBodero.Operacao%type);
      Open cur_titulos for

        Select R.COD_RECEB, R.NRO_DOC, R.DT_VENC, R.DT_EMISSAO, R.VALOR_PGTO, R.NRO_DOCBANCO AS DIG_BOLETO,
 PROCEDURE Dados_Receb(vCod_Receb in dbReceb.Nro_Banco%type,
               C.CODCLI, C.NOME, C.CPFCGC AS CNPJ, C. TIPO,R.NRO_BANCO,
                       curReceb out cursorgenerico.tipocursorgenerico);
               C.ENDER, C.BAIRRO, C.CIDADE, C.UF, C.CEP
                       
        From DbReceb r, Dbclien c, dbFReceb fr
 PROCEDURE Navega_Bodero(vDt_Emissao in dbBodero.Dtemissao%type,
        Where r.dt_venc >= vdt1 and r.dt_venc <= vdt2 and 
                                           vCod_Conta in dbBodero.Cod_Conta%type,
              r.forma_fat = '2' and r.cancel = 'N' and 
                                           curBodero out cursorgenerico.tipocursorgenerico);
              r.rec = 'N' and 

              r.cod_conta=vcodconta and 
 PROCEDURE Navega_DocBodero(vCod_Bodero in dbBodero.Cod_Bodero%type,
              r.cod_receb = fr.cod_receb and r.bradesco <> 'B' and
                                                 curBodero out cursorgenerico.tipocursorgenerico);
              fr.tipo = '05' and fr.brandesco = 'N' and              
                                           
              r.codcli = c.codcli and r.nro_banco is not null
 end BRADESCO;
        Order by R.DT_VENC, R.CODCLI;       

   end if;
 
   if vTpFiltro = 'C' then -- filtro pelo cliente
 
      Open cur_titulos for
 
        Select R.COD_RECEB, R.NRO_DOC, R.DT_VENC, R.DT_EMISSAO, R.VALOR_PGTO, R.NRO_DOCBANCO AS DIG_BOLETO,
 
               C.CODCLI, C.NOME, C.CPFCGC AS CNPJ, C. TIPO,R.NRO_BANCO,
                C.ENDER, C.BAIRRO, C.CIDADE, C.UF, C.CEP
        From DbReceb r, Dbclien c, dbFReceb fr
        Where r.codcli = vCodCli and              
              r.cod_conta=vcodconta and 
              r.forma_fat = '2' and r.cancel = 'N' and               
              r.cod_receb = fr.cod_receb and 
              fr.tipo = '05' and fr.brandesco = 'N' and              
              r.codcli = c.codcli and r.nro_banco is not null
        Order by R.DT_VENC, R.CODCLI;     
   end if; 
 END Bradesco_Titulo_AltValor;

 -- carrega titulos para envio para pedido de protesto
 PROCEDURE Bradesco_Titulo_Protesto(vDt1 in Date,
                                    vDt2 in Date,
                                    vCodCli in dbClien.CodCli%type,
                                    cur_titulos out cursorgenerico.tipocursorgenerico) is
 BEGIN
   Open cur_titulos for
    Select R.COD_RECEB, R.NRO_DOC, R.DT_VENC, R.DT_EMISSAO,
           R.VENC_ANT, R.VALOR_PGTO, R.NRO_DOCBANCO AS DIG_BOLETO,
           C.CODCLI, C.NOME, C.CPFCGC AS CNPJ, C. TIPO,R.NRO_BANCO,
           C.ENDER, C.BAIRRO, C.CIDADE, C.UF, C.CEP
    From DbReceb r, DbConta ct, Dbclien c
    Where r.dt_venc >= vdt1 and r.dt_venc <= vdt2 and
          r.forma_fat = '2' and r.bradesco = 'S' and
          r.cancel = 'N' and r.rec = 'N' and 
          r.codcli = vCodCli and r.codcli = c.codcli and 
          r.cod_conta = ct.cod_conta 
    Order by R.DT_VENC, R.CODCLI;
 END Bradesco_Titulo_Protesto;

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
   from dbDocBodero 
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
 PROCEDURE Inc_Bodero (vCodConta in dbBodero.Cod_Conta%type,
                       vDtInicial in dbBodero.Dtinicial%type,
                       vDtFinal in dbBodero.Dtfinal%type,
                       vDtEmissao in dbBodero.Dtemissao%type,
                       vCodBodero in dbBodero.Cod_bodero%type) is 
-- nro integer;                       
 BEGIN
  /* Select count(*) into nro from dbBodero;
   if nro > 0 then 
     Select Max(To_Number(Cod_Bodero)) Into vCodBodero From dbBodero;
   else 
     vCodBodero := '0';  
   end if;
   nro := To_Number(vCodBodero) + 1;
   vCodBodero := Geral.Strzero(nro,9);
  */ 
   Insert Into dbBodero(Cod_bodero,Cod_Conta,Dtinicial,Dtfinal,Dtemissao,Cancel)
                 Values(vCodBodero,vCodConta,vDtInicial,vDtFinal,vDtEmissao,'N');
 END Inc_Bodero;
 
 -- inclui doctos do bodero
 PROCEDURE Inc_DocBodero(vCodBodero in dbDocBodero.Cod_bodero%type,
                         vCodReceb in dbDocBodero.Cod_Receb%type,
                         vDigito in dbDocBodero.Digito%type,
                         vOperacao in dbDocBodero.Operacao%type) is                                    
 vValor dbReceb.Valor_Pgto%type;
 vData  dbReceb.Dt_Venc%type;                         
 xCount number;
 BEGIN
   select count(*)into xCount from dbDocBoderobb where cod_bodero = vCodBodero and cod_receb = vCodReceb;
   if (xCount = 0)
     then
       If (vOperacao = 'I') or (vOperacao = 'D') then
         Select Valor_Pgto, Dt_Venc Into vValor, vData 
          From dbReceb Where Cod_Receb = vCodReceb;
         Update dbReceb Set Bradesco = 'S' where Cod_Receb = vCodReceb;
         Insert into dbDocBodero(Cod_bodero, Cod_Receb, Operacao, Valor, Dt_Venc, Digito)
                          Values(vCodbodero, vCodReceb, vOperacao, vValor, vData, vDigito);
       end if;
       if vOperacao = 'V' then
         Select Dt_Venc Into vData 
          From dbReceb Where Cod_Receb = vCodReceb;
         Select Sum(Valor) Into vValor From dbFReceb
          Where Cod_Receb = vCodReceb and Tipo = '05' and SF = 'S';
         Update dbFReceb Set Brandesco = 'S'
          where Cod_Receb = vCodReceb and Tipo = '05' and SF = 'S';
         Insert into dbDocBodero(Cod_bodero, Cod_Receb, Operacao, Valor, Dt_Venc, Digito)
                          Values(vCodbodero, vCodReceb, vOperacao, vValor, vData, vDigito);
       end if;
    end if;
 END Inc_DocBodero;
 
 PROCEDURE Dados_Receb(vCod_Receb in dbReceb.Nro_Banco%type,
                       curReceb out cursorgenerico.tipocursorgenerico) is           
 xsel long;
 xcont number;
 BEGIN
   select count(r.COD_RECEB) into xcont
   from dbReceb r
   where r.Nro_Banco = vCod_Receb;
  
   xsel := 'Select r.COD_RECEB, r.CODCLI, r.NRO_DOC, r.DT_VENC , c.NOME,R.NRO_BANCO ' ||
           'from dbReceb r, dbClien c ' ||
           'where r.CodCli=c.CodCli and ';
   if xcont > 0
     then xsel := xsel || 'r.Nro_Banco = ''' || vCod_Receb || ''' ';
     else xsel := xsel || 'r.Cod_Receb = ''' || substr(vCod_Receb,3,9) || ''' ';
   end if;
   Open curReceb for
     xsel;
 END Dados_Receb;

 PROCEDURE Navega_Bodero(vDt_Emissao in dbBodero.Dtemissao%type,
                                           vCod_Conta in dbBodero.Cod_Conta%type,
                                           curBodero out cursorgenerico.tipocursorgenerico) is
 BEGIN
    Open curBodero for 
     Select b.cod_bodero, b.cod_conta, b.dtinicial, b.dtfinal, b.dtemissao, b.cancel
     from dbBodero b where DtEmissao=vDt_Emissao and Cod_Conta=vCod_Conta;
 END Navega_Bodero;

 PROCEDURE Navega_DocBodero(vCod_Bodero in dbBodero.Cod_Bodero%type,
                                                 curBodero out cursorgenerico.tipocursorgenerico) is
 BEGIN
    Open curBodero for     
     Select --b.cod_bodero, b.cod_conta, b.dtinicial, b.dtfinal, b.dtemissao, b.cancel,                            
                r.cod_receb, r.nro_doc, r.valor_pgto, r.dt_venc, r.dt_emissao,R.NRO_BANCO,
                c.cpfcgc, c.codcli, c.nome, c.tipo, c.ender, c.cepcobr as cep,
                db.digito, db.operacao, db.valor as valor_operacao
       from dbDocBodero db, dbReceb r, dbClien c, dbBairro b
     where db.cod_bodero = vCod_Bodero and db.cod_receb = r.cod_receb and 
                r.codcli = c.codcli and c.codbairrocobr=b.codbairro;
 END Navega_DocBodero;

end BRADESCO;

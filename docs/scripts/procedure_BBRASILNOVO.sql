package BBRASILNOVO is
package body BBRASILNOVO is

 ------------------------------------------------------------
 ------------------------------------------------------------------------
 -- para preparac?o do arquivo de remessa --
 -- Author  : PATRIANE                                                 --
 ------------------------------------------------------------
 -- Created : 17/04/2003 14:18:16                                      --
 
 -- Purpose : Procedures e Functions para layout de Cobranca Brandesco --
 --carrega titulos para envio que n?o tenha sido alterada a data de vencto.
 ------------------------------------------------------------------------
 PROCEDURE BBrasilNovo_Titulo_Cadastro(
  
                                    vDt1 in Date,
 -- carrega titulos para envio que n?o tenha sido alterada a data de vencto.
                                    vDt2 in Date,
 PROCEDURE BBrasilNovo_Titulo_Cadastro(
                                    vTipo in varchar2,
                                    vDt1 in Date,
                                    vCodConta in dbConta.Cod_Conta%type,
                                    vDt2 in Date,
                                    cur_titulos out cursorgenerico.tipocursorgenerico) is
                                    vTipo in varchar2,
 Sel LONG;
                                    vCodConta in dbConta.Cod_Conta%type,
 tabela LONG;
                                    cur_titulos out cursorgenerico.tipocursorgenerico);
 onde LONG;

 ordem LONG;
 -- carrega titulos para envio que tenha sido alterada a data de vencto. 
 BEGIN
 PROCEDURE BBrasilNovo_Titulo_AltVencto(
  Sel := 'SELECT R.COD_RECEB, R.NRO_DOC, R.DT_VENC, R.DT_EMISSAO, ' ||
                                     vDt1 in Date,                                     
         'R.VALOR_PGTO, R.NRO_BANCO AS NRO_BANCO, ' ||
                                     vDt2 in Date,
         'C.CODCLI, C.NOME, C.CPFCGC AS CNPJ, C. TIPO, ' ||
                                     vTipo in varchar2,
         'C.ENDERCOBR AS ENDER, C.CEPCOBR AS CEP, ' ||
                                     vCodConta in dbConta.Cod_Conta%type,
         'B.DESCR AS BAIRRO, B.CIDADE, B.UF ';
                                     cur_titulos out cursorgenerico.tipocursorgenerico);
  Tabela := 'FROM DbReceb r, DbConta ct, Dbclien c, DbBairro b ';
 
  Onde := 'WHERE r.cancel=''N'' and r.valor_rec = 0 and r.rec = ''N'' and ' ||
 -- carrega titulos para envio que tenha sido alterado o valor do docto. 
          'r.forma_fat = ''2'' and r.bradesco = ''N'' and r.banco = ''1'' and ' ||
 PROCEDURE BBrasilNovo_Titulo_AltValor(
          'r.dt_venc = r.venc_ant and r.cod_conta = ''' || vcodconta || ''' and '||
                                    vDt1 in Date,
          'r.cod_conta = ct.cod_conta and r.codcli = c.codcli and ' ||
                                    vDt2 in Date,
          'c.codbairrocobr = b.codbairro and R.NRO_BANCO is not null and ';
                                    vTipo in varchar2,
  Ordem := 'ORDER BY R.DT_VENC, R.CODCLI';
                                    vCodConta in dbConta.Cod_Conta%type,
 
                                    vCodCli in dbReceb.Codcli%type,
  if vTipo = 'V'
                                    vTpFiltro in varchar2,
   then Onde := Onde || 'r.dt_venc <= ''' || vdt2 || ''' ';
                                    cur_titulos out cursorgenerico.tipocursorgenerico);
  else if vTipo = 'E'
                                    
   then Onde := Onde || 'r.dt_emissao <= ''' || vdt2 || ''' ';
 -- carrega titulos para envio para pedido de protesto
  end if; end if;
 PROCEDURE BBrasilNovo_Titulo_Protesto(
  
                                    vDt1 in Date,
  OPEN cur_titulos FOR
                                    vDt2 in Date,
    sel || tabela || onde || ordem;
                                    vCodCli in dbClien.CodCli%type,
   
                                    cur_titulos out cursorgenerico.tipocursorgenerico);
 END BBrasilNovo_Titulo_Cadastro;


 -- carrega todos os clientes
 -- carrega titulos para envio que tenha sido alterada a data de vencto. 
 PROCEDURE Clientes(curCliente out cursorgenerico.tipocursorgenerico);
 PROCEDURE BBrasilNovo_Titulo_AltVencto(

                                     vDt1 in Date,
 -- pesquisa se o docto ja foi incluido no bodero
                                     vDt2 in Date,
 PROCEDURE Pesquisa_DocBodero(vCod_Receb in dbReceb.Cod_Receb%type,                       
                                     vTipo in varchar2,
                               vNro out integer);
                                     vCodConta in dbConta.Cod_Conta%type,

                                     cur_titulos out cursorgenerico.tipocursorgenerico) is
 -- devolve o valor de abatimento a ser concedido                               
 Sel LONG;
 PROCEDURE Valor_Abatimento(vCod_Receb in dbReceb.Cod_Receb%type,
 tabela LONG;
                            vValor out dbReceb.Valor_Pgto%type);
 onde LONG;
                               
 ordem LONG;
 -- inclui cabecalho do bodero
 BEGIN
 PROCEDURE Inc_Boderobb (vCodConta in dbBodero.Cod_Conta%type,
  Sel := 'SELECT R.COD_RECEB, R.NRO_DOC, R.DT_VENC, R.DT_EMISSAO, ' ||
                       vDtInicial in dbBodero.Dtinicial%type,
         'R.VENC_ANT, R.VALOR_PGTO, R.NRO_BANCO AS NRO_BANCO, ' ||
                       vDtFinal in dbBodero.Dtfinal%type,
         'C.CODCLI, C.NOME, C.CPFCGC AS CNPJ, C. TIPO, ' ||
                       vDtEmissao in dbBodero.Dtemissao%type,
         'C.ENDERCOBR AS ENDER, C.CEPCOBR AS CEP, ' ||
                       vCodBodero out dbBodero.Cod_bodero%type);
         'B.DESCR AS BAIRRO, B.CIDADE, B.UF ';
 
  Tabela := 'FROM DbReceb r, DbConta ct, Dbclien c, DbBairro b ';
 -- inclui doctos do bodero
  Onde := 'WHERE r.cancel = ''N'' and r.cod_conta = ''' || vcodconta || ''' and ' ||
 PROCEDURE Inc_DocBoderobb (vCodBodero in dbDocBodero.Cod_bodero%type,
          'r.dt_venc <> r.venc_ant and ' ||
                         vCodReceb in dbDocBodero.Cod_Receb%type,
          'r.forma_fat = ''2'' and r.bradesco = ''N'' and r.banco = ''1'' and ' ||
                         vDigito in dbDocBodero.Digito%type,
          'r.cod_conta = ct.cod_conta and r.codcli = c.codcli and ' ||
                         vOperacao in dbDocBodero.Operacao%type);
          'c.codbairrocobr = b.codbairro and R.NRO_BANCO is not null and ';

  Ordem := 'ORDER BY R.DT_VENC, R.CODCLI';
 PROCEDURE Dados_Receb(vNro_Banco in dbReceb.Nro_Banco%type,
 
                                          curReceb out cursorgenerico.tipocursorgenerico);
  if vTipo = 'V'
                       
   then Onde := Onde || 'r.dt_venc >= ''' || vdt1 ||''' and r.dt_venc <= ''' || vdt2 || ''' ';
 PROCEDURE Navega_Bodero(vDt_Emissao in dbBodero.Dtemissao%type,
  else if vTipo = 'E'
                                           vCod_Conta in dbBodero.Cod_Conta%type,
   then Onde := Onde || 'r.dt_emissao >= ''' || vdt1 ||''' and r.dt_emissao <= ''' || vdt2 || ''' ';
                                           curBodero out cursorgenerico.tipocursorgenerico);
  end if; end if;

  
 PROCEDURE Navega_DocBodero(vCod_Bodero in dbBodero.Cod_Bodero%type,
  OPEN cur_titulos FOR
                                                 curBodero out cursorgenerico.tipocursorgenerico);
    sel || tabela || onde || ordem; 
                                           

 end BBRASILNOVO;
 END BBrasilNovo_Titulo_AltVencto;

 
 
 -- carrega titulos para envio que tenha sido alterado o valor do docto. 
 
 PROCEDURE BBrasilNovo_Titulo_AltValor(
 
                                    vDt1 in Date,
 
                                    vDt2 in Date,
                                     vTipo in varchar2,
                                    vCodConta in dbConta.Cod_Conta%type,
                                    vCodCli in dbReceb.Codcli%type,
                                    vTpFiltro in varchar2,
                                    cur_titulos out cursorgenerico.tipocursorgenerico) is
Sel LONG;
 tabela LONG;
 onde LONG;
 ordem LONG;
 BEGIN
  Sel := 'SELECT R.COD_RECEB, R.NRO_DOC, R.DT_VENC, R.DT_EMISSAO, ' ||
         'R.VALOR_PGTO, R.NRO_BANCO AS NRO_BANCO, ' ||
         'C.CODCLI, C.NOME, C.CPFCGC AS CNPJ, C. TIPO, ' ||
         'C.ENDERCOBR AS ENDER, C.CEPCOBR AS CEP, ' ||
         'B.DESCR AS BAIRRO, B.CIDADE, B.UF ';
  Tabela := 'FROM DbReceb r, Dbclien c, dbFReceb fr, DbBairro b ';
  Onde := 'WHERE r.cod_conta = ''' || vcodconta || ''' and ' ||
          'r.forma_fat = ''2'' and r.cancel = ''N'' and ' ||
          'r.banco = ''1'' and r.cod_receb = fr.cod_receb and ' ||
          'fr.tipo = ''05'' and fr.brandesco = ''N'' and ' ||
          'fr.brandesco = ''N''  and r.codcli = c.codcli and ' ||
          'c.codbairrocobr = b.codbairro and R.NRO_BANCO is not null and ';
  Ordem := 'ORDER BY R.DT_VENC, R.CODCLI';

  if vTpFiltro = 'C'
   then Onde := Onde || 'r.codcli = ''' || vCodCli ||''' ';
  else if vTpFiltro = 'P'
   then if vTipo = 'V'
   then Onde := Onde || 'r.dt_venc >= ''' || vdt1 ||''' and r.dt_venc <= ''' || vdt2 || ''' and r.bradesco <> ''B'' and r.rec = ''N'' ';
  else if vTipo = 'E'
   then Onde := Onde || 'r.dt_emissao >= ''' || vdt1 ||''' and r.dt_emissao <= ''' || vdt2 || ''' and r.bradesco <> ''B'' and r.rec = ''N'' ';
  end if; end if; end if; end if;
  
  OPEN cur_titulos FOR
    sel || tabela || onde || ordem; 

 END BBrasilNovo_Titulo_AltValor;

 -- carrega titulos para envio para pedido de protesto
 PROCEDURE BBrasilNovo_Titulo_Protesto(
                                    vDt1 in Date,
                                    vDt2 in Date,
                                    vCodCli in dbClien.CodCli%type,
                                    cur_titulos out cursorgenerico.tipocursorgenerico) is
 BEGIN
   Open cur_titulos for
    Select R.COD_RECEB, R.NRO_DOC, R.DT_VENC, R.DT_EMISSAO,
               R.VENC_ANT, R.VALOR_PGTO, R.NRO_BANCO AS DIG_BOLETO,
               C.CODCLI, C.NOME, C.CPFCGC AS CNPJ, C. TIPO,
               C.ENDERCOBR AS ENDER, C.CEPCOBR AS CEP,
               B.DESCR AS BAIRRO, B.CIDADE, B.UF,
               R.NRO_BANCO AS NRO_BANCO
    From DbReceb r, DbConta ct, Dbclien c, dbBairro b
    Where r.dt_venc >= vdt1 and r.dt_venc <= vdt2 and
          r.forma_fat = '2' and r.bradesco = 'S' and 
          r.banco = '1' and r.bradesco = 'S' and 
          r.cancel = 'N' and r.rec = 'N' and 
          r.codcli = vCodCli and r.codcli = c.codcli and           
          r.cod_conta = ct.cod_conta and c.codbairrocobr = b.codbairro and
                R.NRO_BANCO is not null
    Order by R.DT_VENC, R.CODCLI;
 END BBrasilNovo_Titulo_Protesto;

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
      xCount number;
 BEGIN
   select count(*)into xCount from dbDocBoderobb where cod_bodero = vCodBodero and cod_receb = vCodReceb;
   if (xCount = 0)
     then
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
   end if;
 END Inc_DocBoderobb;
 
 PROCEDURE Dados_Receb(vNro_Banco in dbReceb.Nro_Banco%type,
                                          curReceb out cursorgenerico.tipocursorgenerico) is           
 BEGIN
   Open curReceb for
    Select r.COD_RECEB, r.CODCLI, r.NRO_DOC, r.DT_VENC , c.NOME, r.dt_emissao
    from dbReceb r, dbClien c
    where r.nro_banco = vNro_Banco and r.CodCli=c.CodCli
    order by dt_emissao;
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
                r.nro_banco as nro_banco, r.venc_ant,
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

end BBRASILNOVO;

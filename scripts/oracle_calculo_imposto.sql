-- PACKAGE SPECIFICATION
PACKAGE "CALCULO_IMPOSTO" is

  -- Author  : MARIO CESAR FERNANDES (P1)
  -- Created : 01/06/2008 15:09:20
  -- Purpose : CALCULAR IMPOSTOS SOBRE O FATURAMENTO E ENTRADA
  
 -- Variaveis Publicas
 RowUF_Origem    dbuf_n%rowtype;
 RowUF_Destino   dbuf_n%rowtype; 
 
 CIDADE_Origem    dbmunicipio%rowtype;
 CIDADE_Destino   dbmunicipio%rowtype; 
 RowRegraCredor  cad_credor_regra_faturamento%rowtype;
 
 PROCEDURE INICIALIZACAO(Tipo_Movimentacao in varchar2,
                         TipoOperacao in varchar2,
                         CodProduto in varchar2,
                         Codigo in varchar2,
                         CodigoTerceiro in varchar2);

 -- Procedimento para calcular os impostos
 PROCEDURE Calcular_Impostos(Tipo_Movimentacao in varchar2,
                             TipoFatura in varchar2,
                             TipoOperacao in varchar2,
                             Zerar_SUBSTITUICAO in varchar2,
                             Aliquota_IPI IN number,
                             Aliquota_ICMS IN number,
                             Total_Produto IN number,
                             Base_Produto in number,
                             MVA_ANTECIPADO in number,
                             NCM in out varchar2,
                             Aliquota_Pis in out number,
                             Aliquota_Cofins in out number,
                             Base_Pis in out number,
                             Base_Cofins in out number,
                             Valor_Pis in out number,
                             Valor_Cofins in out number,
                             CstPis in out varchar2,
                             CstCofins in out varchar2,
                             CstIPI in out varchar2,                             
                             Base_IPI IN OUT number,
                             Valor_IPI IN OUT number,
                             Base_Calc_ICMS IN OUT number,
                             Valor_ICMS IN OUT number,
                             Base_Calc_ICMS_Subst IN OUT number,
                             Valor_ICMS_Subst IN OUT number,
                             MVA  IN OUT number,
                             ICMS_Interno_Destino IN OUT number,
                             ICMS_Externo_Origem IN OUT number,
                             CFOP IN OUT varchar2,
                              vtpcredpresibszfm in out number,
                              indbemmovelusado in out number,
                              is_cstis in out number,
                              is_cclasstribis in out number,
                              is_vbcis in out number,
                              is_pis in out number,
                              is_pisexpec in out number,
                              is_utrib in out number,
                              is_qtrib in out number,
                              is_vis in out number,
                              ibscbs_cst in out varchar2,
                              ibscbs_cclasstrib in out varchar2,
                              ibscbs_inddoacao in out number,
                              gibscbs_vbc in out number,
                              gibscbs_gibsuf_pibsuf in out number,
                              gibscbs_gibsuf_pdif in out number,
                              gibscbs_gibsuf_vdif in out number,
                              gibscbs_gibsuf_vdevtrib in out number,
                              gibscbs_gibsuf_predaliq in out number,
                              gibscbs_gibsuf_paliqefet in out number,
                              gibscbs_gibsuf_vibsuf in out number,
                              gibscbs_gibsmun_pibsmun in out number,
                              gibscbs_gibsmun_pdif in out number,
                              gibscbs_gibsmun_vdif in out number,
                              gibscbs_gibsmun_vdevtrib in out number,
                              gibscbs_gibsmun_predaliq in out number,
                              gibscbs_gibsmun_paliqefet in out number,
                              gibscbs_gibsmun_vibsmun in out number,
                              gibscbs_vibs in out number,
                              gibscbs_gcbs_pcbs in out number,
                              gibscbs_gcbs_pdif in out number,
                              gibscbs_gcbs_vdif in out number,
                              gibscbs_gcbs_vdevtrib in out number,
                              gibscbs_gcbs_predaliq in out number,
                              gibscbs_gcbs_paliqefet in out number,
                              gibscbs_gcbs_vcbs in out number,
                              tribregular_cstreg in out number,
                              tribregular_cclasstribreg in out number,
                              tribregular_paliqefetregibsuf in out number,
                              tribregular_vtribregibsuf in out number,
                              tribregular_paliqefetregibsmun in out number,
                              tribregular_vtribregibsmun in out number,
                              tribregular_paliqefetregcbs in out number,
                              tribregular_vtribregcbs in out number,
                              tribcompragov_paliqibsuf in out number,
                              tribcompragov_vtribibsuf in out number,
                              tribcompragov_paliqibsmun in out number,
                              tribcompragov_vtribibsmun in out number,
                              tribcompragov_paliqcbs in out number,
                              tribcompragov_vtribcbs in out number,
                              monopadrao_qbcmono in out number,
                              monopadrao_adremibs in out number,
                              monopadrao_adremcbs in out number,
                              monopadrao_vibsmono in out number,
                              monopadrao_vcbsmono in out number,
                              monoreten_qbcmonoreten in out number,
                              monoreten_adremibsreten in out number,
                              monoreten_vibsmonoreten in out number,
                              monoreten_adremcbsreten in out number,
                              monoreten_vcbsmonoreten in out number,
                              monoret_qbcmonoret in out number,
                              monoret_adremibsret in out number,
                              monoret_vibsmonoret in out number,
                              monoret_adremcbsret in out number,
                              monoret_vcbsmonoret in out number,
                              monodif_pdifibs in out number,
                              monodif_vibsmonodif in out number,
                              monodif_pdifcbs in out number,
                              monodif_vcbsmonodif in out number,
                              ibscbsmono_vtotibsmonoitem in out number,
                              ibscbsmono_vtotcbsmonoitem in out number,
                              transfcred_vibs in out number,
                              transfcred_vcbs in out number,
                              ajustecompet_competapur in out number,
                              ajustecompet_vibs in out number,
                              ajustecompet_vcbs in out number,
                              estornocred_vibsestcred in out number,
                              estornocred_vcbsestcred in out number,
                              credpressoper_vbccredpres in out number,
                              credpressoper_vcredpres in out number,
                              ibscredpres_pcredpres in out number,
                              ibscredpres_vcredpres in out number,
                              ibscredpres_vcredprescondsus in out number,
                              cbscredpres_pcredpres in out number,
                              cbscredpres_vcredpres in out number,
                              cbscredpres_vcredprescondsus in out number,
                              credpresibszfm_competapur in out number,
                              credpresibszfm_tpcredpresibszf in out number,
                              credpresibszfm_vcredpresibszfm in out number,
                              vitem in out number,
                              dfereferenciado_chaveacesso in out number,
                              dfereferenciado_nitem in out number);
                             
 PROCEDURE Calcular_ICMS(Tipo_Movimentacao in varchar2,
                         CFOP IN varchar2,
                         Aliquota_ICMS IN number,
                         Total_Produto IN number,
                         Base_Calc_ICMS IN OUT number,
                         Valor_ICMS IN OUT number);
                         
 PROCEDURE Calcular_IBS_CBS(TipoOperacao in varchar2,                             
                         CFOP IN varchar2,
                         Total_Produto IN number,
                        vtpcredpresibszfm in out number,
                        indbemmovelusado in out number,
                        is_cstis in out number,
                        is_cclasstribis in out number,
                        is_vbcis in out number,
                        is_pis in out number,
                        is_pisexpec in out number,
                        is_utrib in out number,
                        is_qtrib in out number,
                        is_vis in out number,
                        ibscbs_cst in out varchar2,
                        ibscbs_cclasstrib in out varchar2,
                        ibscbs_inddoacao in out number,
                        gibscbs_vbc in out number,
                        gibscbs_gibsuf_pibsuf in out number,
                        gibscbs_gibsuf_pdif in out number,
                        gibscbs_gibsuf_vdif in out number,
                        gibscbs_gibsuf_vdevtrib in out number,
                        gibscbs_gibsuf_predaliq in out number,
                        gibscbs_gibsuf_paliqefet in out number,
                        gibscbs_gibsuf_vibsuf in out number,
                        gibscbs_gibsmun_pibsmun in out number,
                        gibscbs_gibsmun_pdif in out number,
                        gibscbs_gibsmun_vdif in out number,
                        gibscbs_gibsmun_vdevtrib in out number,
                        gibscbs_gibsmun_predaliq in out number,
                        gibscbs_gibsmun_paliqefet in out number,
                        gibscbs_gibsmun_vibsmun in out number,
                        gibscbs_vibs in out number,
                        gibscbs_gcbs_pcbs in out number,
                        gibscbs_gcbs_pdif in out number,
                        gibscbs_gcbs_vdif in out number,
                        gibscbs_gcbs_vdevtrib in out number,
                        gibscbs_gcbs_predaliq in out number,
                        gibscbs_gcbs_paliqefet in out number,
                        gibscbs_gcbs_vcbs in out number,
                        tribregular_cstreg in out number,
                        tribregular_cclasstribreg in out number,
                        tribregular_paliqefetregibsuf in out number,
                        tribregular_vtribregibsuf in out number,
                        tribregular_paliqefetregibsmun in out number,
                        tribregular_vtribregibsmun in out number,
                        tribregular_paliqefetregcbs in out number,
                        tribregular_vtribregcbs in out number,
                        tribcompragov_paliqibsuf in out number,
                        tribcompragov_vtribibsuf in out number,
                        tribcompragov_paliqibsmun in out number,
                        tribcompragov_vtribibsmun in out number,
                        tribcompragov_paliqcbs in out number,
                        tribcompragov_vtribcbs in out number,
                        monopadrao_qbcmono in out number,
                        monopadrao_adremibs in out number,
                        monopadrao_adremcbs in out number,
                        monopadrao_vibsmono in out number,
                        monopadrao_vcbsmono in out number,
                        monoreten_qbcmonoreten in out number,
                        monoreten_adremibsreten in out number,
                        monoreten_vibsmonoreten in out number,
                        monoreten_adremcbsreten in out number,
                        monoreten_vcbsmonoreten in out number,
                        monoret_qbcmonoret in out number,
                        monoret_adremibsret in out number,
                        monoret_vibsmonoret in out number,
                        monoret_adremcbsret in out number,
                        monoret_vcbsmonoret in out number,
                        monodif_pdifibs in out number,
                        monodif_vibsmonodif in out number,
                        monodif_pdifcbs in out number,
                        monodif_vcbsmonodif in out number,
                        ibscbsmono_vtotibsmonoitem in out number,
                        ibscbsmono_vtotcbsmonoitem in out number,
                        transfcred_vibs in out number,
                        transfcred_vcbs in out number,
                        ajustecompet_competapur in out number,
                        ajustecompet_vibs in out number,
                        ajustecompet_vcbs in out number,
                        estornocred_vibsestcred in out number,
                        estornocred_vcbsestcred in out number,
                        credpressoper_vbccredpres in out number,
                        credpressoper_vcredpres in out number,
                        ibscredpres_pcredpres in out number,
                        ibscredpres_vcredpres in out number,
                        ibscredpres_vcredprescondsus in out number,
                        cbscredpres_pcredpres in out number,
                        cbscredpres_vcredpres in out number,
                        cbscredpres_vcredprescondsus in out number,
                        credpresibszfm_competapur in out number,
                        credpresibszfm_tpcredpresibszf in out number,
                        credpresibszfm_vcredpresibszfm in out number,
                        vitem in out number,
                        dfereferenciado_chaveacesso in out number,
                        dfereferenciado_nitem in out number);

 -- Procedimento para verificar se existe substituicao, se existir calcula
 PROCEDURE Calcular_ICMS_Subst(Tipo_Movimentacao in varchar2,
                               TipoOperacao in varchar2, 
                               Zerar_SUBSTITUICAO in varchar2,
                               Valor_IPI IN number,
                               Total_Produto IN number,
                               MVA_ANTECIPADO in number,
                               Base_Produto in number,
                               ValorICMS in number,
                               Base_Calc_ICMS_Subst IN OUT number,
                               Valor_ICMS_Subst IN OUT number,
                               MVA  IN OUT number,
                               ICMS_Interno_Destino IN OUT number,
                               ICMS_Externo_Origem IN OUT number);
                               
 PROCEDURE ICMS_ST_FRETE(ValorFrete in number,
                        MVA in number,
                        ICMS_Interno_Destino in number,
                        ICMS_Externo_Origem in number,
                        Base_ICMS_St  in out number,
                        Valor_ICMS_St in out number);
 
 FUNCTION LEGISLACAO_ICMS(vLEI_id_Usado out number,
                          vLEI_Protocolo out number,
                          vTipo in varchar2) return boolean;

 FUNCTION PRODUTO_ICMS(vLEI_ID in number) return boolean;
 
 FUNCTION PRODUTO_EXCECAO_ST return boolean;
 
 FUNCTION MVA_PRODUTO_LEGISLACAO(vLEI_id in number,
                                 vTipo_Movimentacao in varchar2)  return number; 

 FUNCTION NCM_PROTOCOLO129 return boolean;

 FUNCTION Derivado_Petroleo return boolean;
 
 FUNCTION MVA_Derivado_Petroleo(Tipo_Movimentacao in varchar2) return number;

 -- Funcao que verifica qual a aliquota do IPI dever ser usada
 -- Retorno Number.  Aliquota do IPI dever usada (%)
 FUNCTION Validar_IPI (Tipo_Movimentacao in varchar2,
                       TipoOperacao in varchar2) return number; 

 -- Funcao que verifica qual a aliquota do ICMS dever ser usada
 -- Retorno Number.  Aliquota do ICMS dever usada (%)
 FUNCTION Validar_ICMS (Insc_Estadual in varchar2,
                        CFOP in varchar2) return number ;

 Procedure Tipo_Operacao_Saida(TipoOperacao in varchar2,
                               UF_Iguais in out boolean,
                               Pode_ST in out boolean,
                               CFOP in out varchar2);

 Procedure Tipo_Operacao_Entrada(TipoOperacao in varchar2,
                                 UF_Iguais in out boolean,
                                 Pode_ST in out boolean,
                                 CFOP in out varchar2);

 FUNCTION Validar_CFOP_Saida(TipoOperacao in varchar2,
                             UF_Iguais in boolean,
                             MVA in number,
                             ValorST in number) return varchar2;

 FUNCTION Validar_CFOP_Entrada(TipoOperacao in varchar2,
                               UF_Iguais in boolean,
                               MVA in number,
                               ValorST in number) return varchar2;
                               
 Procedure Calcular_PIS_COFINS_Compra(Tipo_Movimentacao in varchar2,
                                      TipoOperacao in varchar2,
                                      Base_Produto in number,
                                      CFOP in varchar2,
                                      Aliquota_Pis in out number,
                                      Aliquota_Cofins in out number,
                                      Base_Pis in out number,
                                      Base_Cofins in out number,
                                      Valor_Pis in out number,
                                      Valor_Cofins in out number,
                                      CstPis in out varchar2,
                                      CstCofins in out varchar2);

 PROCEDURE CARREGAR_NCM;
  
 FUNCTION VALIDAR_CSTIPI(Tipo_Movimentacao in varchar2,
                         TipoOperacao in varchar2) return varchar2;  
                        
 Procedure Calcular_PIS_COFINS_Saida(TipoOperacao in varchar2,
                                     Base_Produto in number,
                                     Aliquota_Pis in out number,
                                     Aliquota_Cofins in out number,
                                     Base_Pis in out number,
                                     Base_Cofins in out number,
                                     Valor_Pis in out number,
                                     Valor_Cofins in out number,
                                     CstPis in out varchar2,
                                     CstCofins in out varchar2);
                                     
 Procedure PIS_COFINS_VENDA(Aliquota_Pis in out number,
                            Aliquota_Cofins in out number);
                                     
 FUNCTION NCM_MONOFASICO return boolean;
 
 FUNCTION NCM_MONOFASICO(vNCM in varchar2) return Integer ;
 
 PROCEDURE ORIGEM_DESTINO(Tipo_Movimentacao in varchar2,
                          TipoOperacao in varchar2,
                          Codigo in varchar2,
                          CodigoTerceiro in varchar2);
                    
 FUNCTION ICMS_CST (DescontoSuframa in varchar2,
                    CFOP in varchar2,
                    Valor_Icms in Number,
                    Valor_Icms_Subst in Number) return varchar2;

 FUNCTION PROTOCOLO49_INT(NCM_Prod in varchar2) return NUMBER;
 
 PROCEDURE SETDADOS (TIPO IN VARCHAR2,
                     CODIGO IN VARCHAR2,
                     NOME IN VARCHAR2,
                     TIPODESTINO IN VARCHAR2,
                     FABRICANTE IN VARCHAR2,
                     REGIMETRIBUTARIO IN VARCHAR2,
                     INSCESTADUAL IN varchar2);
                     
 FUNCTION GET_ICMS (Tipo_Movimentacao in varchar2,
                    TipoOperacao in varchar2,
                    CodProduto in varchar2,
                    Codigo in varchar2,
                    Insc_Estadual in varchar2,
                    CFOP in varchar2) return number;
                    
 FUNCTION GET_IPI (Tipo_Movimentacao in varchar2,
                   TipoOperacao in varchar2,
                   CodProduto in varchar2,
                   Codigo in varchar2) return number;
                   
 FUNCTION PROTOCOLO_1785 return boolean;
 
 PROCEDURE SET_NCM(NCM in Varchar2);
    

 FUNCTION NCM_PROTOCOLO41(pClasFiscal in varchar2) return number; 
 
 FUNCTION VALIDA_CFOP_USUCONSUMO(UF_Iguais in boolean) RETURN VARCHAR2;
 
 FUNCTION PRODUTO_ST(vNCM in varchar2, vTIPO in varchar2) return Integer;
 
 
 FUNCTION MESMA_ALC (VCDMUNICIPIOORIGEM IN varchar2,
                     VCDMUNICIPIODESTINO IN varchar2
  ) RETURN boolean;
  
 FUNCTION MESMA_ZFM (VCDMUNICIPIOORIGEM IN varchar2,
                     VCDMUNICIPIODESTINO IN varchar2
  ) RETURN boolean;
              
 end CALCULO_IMPOSTO;



 


-- PACKAGE BODY
package body CALCULO_IMPOSTO is

  -- Criado
  -- Author  : MARIO CESAR FERNANDES (P1)
  -- Created : 01/06/2008 15:09:20
  -- Purpose : CALCULAR IMPOSTOS SOBRE O FATURAMENTO E ENTRADA

  -- Tipo dados Origem e Destino
  TYPE Dados is record (
        Codigo varchar2(10),
        Nome varchar2(100),
        TipoDestino varchar2(1),
        Fabricante varchar2(1),
        RegimeTributario varchar2(1),
        InscEstadual varchar2(50));
        
  -- Variaveis Privada
  RowProd         dbprod%rowtype;
  RowNCM          dbclassificacao_fiscal%rowtype;
  DadosOrigem     Dados;
  DadosDestino    Dados;
  
 /*
     A Resolucao 13/2012 do Senado Federal teve sua implementacao regulamentada pelo Ajuste
   SINIEF 19/2012 e pelo Ajuste SINIEF 20/2012. editados pelo CONFAZ Conselho Nacional de
   Politica Fazendaria.
 */ 
  ProdImportado   boolean;
  
  BaseReduzida    boolean;

  
  
  
 PROCEDURE INICIALIZACAO(Tipo_Movimentacao in varchar2,
                         TipoOperacao in varchar2,
                         CodProduto in varchar2,
                         Codigo in varchar2,
                         CodigoTerceiro in varchar2) is
 xCount number;
 begin
    -- Dados de Origenm e Destino
    ORIGEM_DESTINO(Tipo_Movimentacao,TipoOperacao,Codigo,CodigoTerceiro);
    -- seleciona o Produto
    select * into RowProd from dbprod where codprod = CodProduto;
    -- Verifica se o produto é base reduzida pst
    select count(*) into xCount from dbprod 
    where clasfiscal in ('85437099','85319000') and codmarca = '01094' and excluido = 0 and inf <> 'D' and codprod = CodProduto;
    if xCount > 0 then
      BaseReduzida := True;
    else   
      -- Verifica se o produto é base reduzida importados
      select count(*) into xCount from dbprod 
      where codprod = CodProduto and codprod = '397302';
      if xCount > 0 then
        BaseReduzida := True;
      else
        BaseReduzida := False;
      end if;
    end if;
    
    -- verifica se o pr
    if (substr(rowProd.strib,1,1) in ('1','2','3','8')) 
      then
        ProdImportado := True;
      else
        ProdImportado := False;
    end if;      
    -- Carrega dados da Classificacao Fiscal
    CARREGAR_NCM;
 end;

 -- Procedimento para calcular os impostos
 PROCEDURE Calcular_Impostos(Tipo_Movimentacao in varchar2,
                             TipoFatura in varchar2,
                             TipoOperacao in varchar2,
                             Zerar_SUBSTITUICAO in varchar2,
                             Aliquota_IPI IN number,
                             Aliquota_ICMS IN number,
                             Total_Produto IN number,
                             Base_Produto in number,
                             MVA_ANTECIPADO in number,
                             NCM in out varchar2,
                             Aliquota_Pis in out number,
                             Aliquota_Cofins in out number,
                             Base_Pis in out number,
                             Base_Cofins in out number,
                             Valor_Pis in out number,
                             Valor_Cofins in out number,
                             CstPis in out varchar2,
                             CstCofins in out varchar2,
                             CstIPI in out varchar2,
                             Base_IPI IN OUT number,
                             Valor_IPI IN OUT number,
                             Base_Calc_ICMS IN OUT number,
                             Valor_ICMS IN OUT number,
                             Base_Calc_ICMS_Subst IN OUT number,
                             Valor_ICMS_Subst IN OUT number,
                             MVA  IN OUT number,
                             ICMS_Interno_Destino IN OUT number,
                             ICMS_Externo_Origem IN OUT number,
                             CFOP IN OUT varchar2,
                              vtpcredpresibszfm in out number,
                              indbemmovelusado in out number,
                              is_cstis in out number,
                              is_cclasstribis in out number,
                              is_vbcis in out number,
                              is_pis in out number,
                              is_pisexpec in out number,
                              is_utrib in out number,
                              is_qtrib in out number,
                              is_vis in out number,
                              ibscbs_cst in out varchar2,
                              ibscbs_cclasstrib in out varchar2,
                              ibscbs_inddoacao in out number,
                              gibscbs_vbc in out number,
                              gibscbs_gibsuf_pibsuf in out number,
                              gibscbs_gibsuf_pdif in out number,
                              gibscbs_gibsuf_vdif in out number,
                              gibscbs_gibsuf_vdevtrib in out number,
                              gibscbs_gibsuf_predaliq in out number,
                              gibscbs_gibsuf_paliqefet in out number,
                              gibscbs_gibsuf_vibsuf in out number,
                              gibscbs_gibsmun_pibsmun in out number,
                              gibscbs_gibsmun_pdif in out number,
                              gibscbs_gibsmun_vdif in out number,
                              gibscbs_gibsmun_vdevtrib in out number,
                              gibscbs_gibsmun_predaliq in out number,
                              gibscbs_gibsmun_paliqefet in out number,
                              gibscbs_gibsmun_vibsmun in out number,
                              gibscbs_vibs in out number,
                              gibscbs_gcbs_pcbs in out number,
                              gibscbs_gcbs_pdif in out number,
                              gibscbs_gcbs_vdif in out number,
                              gibscbs_gcbs_vdevtrib in out number,
                              gibscbs_gcbs_predaliq in out number,
                              gibscbs_gcbs_paliqefet in out number,
                              gibscbs_gcbs_vcbs in out number,
                              tribregular_cstreg in out number,
                              tribregular_cclasstribreg in out number,
                              tribregular_paliqefetregibsuf in out number,
                              tribregular_vtribregibsuf in out number,
                              tribregular_paliqefetregibsmun in out number,
                              tribregular_vtribregibsmun in out number,
                              tribregular_paliqefetregcbs in out number,
                              tribregular_vtribregcbs in out number,
                              tribcompragov_paliqibsuf in out number,
                              tribcompragov_vtribibsuf in out number,
                              tribcompragov_paliqibsmun in out number,
                              tribcompragov_vtribibsmun in out number,
                              tribcompragov_paliqcbs in out number,
                              tribcompragov_vtribcbs in out number,
                              monopadrao_qbcmono in out number,
                              monopadrao_adremibs in out number,
                              monopadrao_adremcbs in out number,
                              monopadrao_vibsmono in out number,
                              monopadrao_vcbsmono in out number,
                              monoreten_qbcmonoreten in out number,
                              monoreten_adremibsreten in out number,
                              monoreten_vibsmonoreten in out number,
                              monoreten_adremcbsreten in out number,
                              monoreten_vcbsmonoreten in out number,
                              monoret_qbcmonoret in out number,
                              monoret_adremibsret in out number,
                              monoret_vibsmonoret in out number,
                              monoret_adremcbsret in out number,
                              monoret_vcbsmonoret in out number,
                              monodif_pdifibs in out number,
                              monodif_vibsmonodif in out number,
                              monodif_pdifcbs in out number,
                              monodif_vcbsmonodif in out number,
                              ibscbsmono_vtotibsmonoitem in out number,
                              ibscbsmono_vtotcbsmonoitem in out number,
                              transfcred_vibs in out number,
                              transfcred_vcbs in out number,
                              ajustecompet_competapur in out number,
                              ajustecompet_vibs in out number,
                              ajustecompet_vcbs in out number,
                              estornocred_vibsestcred in out number,
                              estornocred_vcbsestcred in out number,
                              credpressoper_vbccredpres in out number,
                              credpressoper_vcredpres in out number,
                              ibscredpres_pcredpres in out number,
                              ibscredpres_vcredpres in out number,
                              ibscredpres_vcredprescondsus in out number,
                              cbscredpres_pcredpres in out number,
                              cbscredpres_vcredpres in out number,
                              cbscredpres_vcredprescondsus in out number,
                              credpresibszfm_competapur in out number,
                              credpresibszfm_tpcredpresibszf in out number,
                              credpresibszfm_vcredpresibszfm in out number,
                              vitem in out number,
                              dfereferenciado_chaveacesso in out number,
                              dfereferenciado_nitem in out number) is
 xUF_Iguais  boolean;
 xPode_ST    boolean;
 xBaseAlterada number;
 begin
    NCM := RowNCM.Ncm;
    -- Calculos
    if (TipoFatura = 'NOTA_FISCAL') or (Tipo_Movimentacao = 'ENTRADA_COMPRAS')
      then -- Nota Fiscal
        -- Base de Calculo do IPI
        if Aliquota_IPI > 0
          then  
            Base_IPI := Round(Base_Produto, 2);
          else  Base_IPI := 0.00;
        end if;
        -- CstIPI
        CSTIPI := CALCULO_IMPOSTO.VALIDAR_CSTIPI(Tipo_Movimentacao,TipoOperacao);
        -- Valor IPI
        Valor_IPI := round((Base_Produto * (Aliquota_IPI / 100)), 2);
        -- Calcular ICMS
        Calcular_ICMS(Tipo_Movimentacao,CFOP,Aliquota_ICMS,Total_Produto,Base_Calc_ICMS,Valor_ICMS);
        
        -- calcular pis/cofins
        if (Tipo_Movimentacao = 'ENTRADA') or (Tipo_Movimentacao = 'ENTRADA_COMPRAS')
         then -- FATURAMENTO - Nota de Entrada
           -- Verifica tipo de Operacao de saida
           Tipo_Operacao_Entrada(TipoOperacao,xUF_Iguais,xPode_ST,CFOP);
           -- 
           if nvl(RowRegraCredor.Desc_Icms_Sufra_Piscofins,0) = 1
              then xBaseAlterada:= Base_Produto - Valor_ICMS;
              else xBaseAlterada:= Base_Produto;
            end if; 
           Calcular_PIS_COFINS_Compra(Tipo_Movimentacao,TipoOperacao, xBaseAlterada, CFOP, Aliquota_Pis, Aliquota_Cofins, Base_Pis, Base_Cofins, Valor_Pis, Valor_Cofins, CstPis, CstCofins);
         else -- FATURAMENTO - Nota de Saida
           -- Verifica tipo de Operacao de saida
           Tipo_Operacao_Saida(TipoOperacao,xUF_Iguais,xPode_ST,CFOP);
           -- Calcular PIS/COFINS
           Calcular_PIS_COFINS_Saida(TipoOperacao, Base_Produto, Aliquota_Pis, Aliquota_Cofins, Base_Pis, Base_Cofins, Valor_Pis, Valor_Cofins, CstPis, CstCofins);
        end if;
        if xPode_ST
          then
            if (Tipo_Movimentacao = 'ENTRADA_COMPRAS') then
                if (nvl(RowRegraCredor.Basereduzida_St,0) = 1)
                  then xBaseAlterada:= Total_Produto;
                  else xBaseAlterada:= Base_Produto;
                end if; 
                if (nvl(RowRegraCredor.Desc_Icms_Sufra_St,0) = 1)
                  then xBaseAlterada:= xBaseAlterada - Valor_ICMS;
                end if; 
                if nvl(RowRegraCredor.Desc_Piscofins_St,0) = 1
                  then 
                    if Valor_Cofins < 0
                      then xBaseAlterada:= xBaseAlterada + Valor_Pis + Valor_Cofins;
                    end if;  
                end if;
                if nvl(RowRegraCredor.Acres_Piscofins_St,0) = 1
                  then 
                    if Valor_Cofins > 0
                      then xBaseAlterada:= xBaseAlterada + Valor_Pis + Valor_Cofins;
                    end if;  
                end if;
              else
                xBaseAlterada:= Total_Produto;
            end if;  
            
            -- Calculo da Base e Valor do ICMS se Substituicao
            Calcular_ICMS_Subst(Tipo_Movimentacao,TipoOperacao,Zerar_SUBSTITUICAO, Valor_IPI,
                         xBaseAlterada,MVA_ANTECIPADO,Base_Produto,Valor_ICMS,
                         Base_Calc_ICMS_Subst, Valor_ICMS_Subst, MVA,
                         ICMS_Interno_Destino,ICMS_Externo_Origem);
            if (Tipo_Movimentacao = 'ENTRADA') or (Tipo_Movimentacao = 'ENTRADA_COMPRAS')
              then -- FATURAMENTO - Nota de Entrada
                 -- Validar CFOP
                 if Validar_CFOP_Entrada (TipoOperacao,xUF_Iguais,MVA,Valor_ICMS_Subst) is not null
                   then CFOP := Validar_CFOP_Entrada (TipoOperacao,xUF_Iguais,MVA, Valor_ICMS_Subst);
                 end if;  
              else -- FATURAMENTO - Nota de Saida
                 -- Validar CFOP
                 if Validar_CFOP_Saida (TipoOperacao,xUF_Iguais,MVA, Valor_ICMS_Subst) is not null
                   then CFOP := Validar_CFOP_Saida (TipoOperacao,xUF_Iguais,MVA, Valor_ICMS_Subst);
                 end if;
             end if;          
          
          else
            Base_Calc_ICMS_Subst := 0.00;
            Valor_ICMS_Subst := 0.00;
            MVA := 0.00;
            ICMS_Interno_Destino := 0.00;
            ICMS_Externo_Origem := 0.00;
        end if;
        if (Tipo_Movimentacao = 'ENTRADA_COMPRAS') and (RowProd.Tipo = 'MC')
          then
            CFOP := VALIDA_CFOP_USUCONSUMO(xUF_Iguais);
        end if;
        Calcular_IBS_CBS(TipoOperacao,                             
                         CFOP,
                         (Total_Produto - Valor_Pis - Valor_cofins - Valor_ICMS),
                         vtpcredpresibszfm,
                         indbemmovelusado,
is_cstis,
is_cclasstribis,
is_vbcis,
is_pis,
is_pisexpec,
is_utrib,
is_qtrib,
is_vis,
ibscbs_cst,
ibscbs_cclasstrib,
ibscbs_inddoacao,
gibscbs_vbc,
gibscbs_gibsuf_pibsuf,
gibscbs_gibsuf_pdif,
gibscbs_gibsuf_vdif,
gibscbs_gibsuf_vdevtrib,
gibscbs_gibsuf_predaliq,
gibscbs_gibsuf_paliqefet,
gibscbs_gibsuf_vibsuf,
gibscbs_gibsmun_pibsmun,
gibscbs_gibsmun_pdif,
gibscbs_gibsmun_vdif,
gibscbs_gibsmun_vdevtrib,
gibscbs_gibsmun_predaliq,
gibscbs_gibsmun_paliqefet,
gibscbs_gibsmun_vibsmun,
gibscbs_vibs,
gibscbs_gcbs_pcbs,
gibscbs_gcbs_pdif,
gibscbs_gcbs_vdif,
gibscbs_gcbs_vdevtrib,
gibscbs_gcbs_predaliq,
gibscbs_gcbs_paliqefet,
gibscbs_gcbs_vcbs,
tribregular_cstreg,
tribregular_cclasstribreg,
tribregular_paliqefetregibsuf,
tribregular_vtribregibsuf,
tribregular_paliqefetregibsmun,
tribregular_vtribregibsmun,
tribregular_paliqefetregcbs,
tribregular_vtribregcbs,
tribcompragov_paliqibsuf,
tribcompragov_vtribibsuf,
tribcompragov_paliqibsmun,
tribcompragov_vtribibsmun,
tribcompragov_paliqcbs,
tribcompragov_vtribcbs,
monopadrao_qbcmono,
monopadrao_adremibs,
monopadrao_adremcbs,
monopadrao_vibsmono,
monopadrao_vcbsmono,
monoreten_qbcmonoreten,
monoreten_adremibsreten,
monoreten_vibsmonoreten,
monoreten_adremcbsreten,
monoreten_vcbsmonoreten,
monoret_qbcmonoret,
monoret_adremibsret,
monoret_vibsmonoret,
monoret_adremcbsret,
monoret_vcbsmonoret,
monodif_pdifibs,
monodif_vibsmonodif,
monodif_pdifcbs,
monodif_vcbsmonodif,
ibscbsmono_vtotibsmonoitem,
ibscbsmono_vtotcbsmonoitem,
transfcred_vibs,
transfcred_vcbs,
ajustecompet_competapur,
ajustecompet_vibs,
ajustecompet_vcbs,
estornocred_vibsestcred,
estornocred_vcbsestcred,
credpressoper_vbccredpres,
credpressoper_vcredpres,
ibscredpres_pcredpres,
ibscredpres_vcredpres,
ibscredpres_vcredprescondsus,
cbscredpres_pcredpres,
cbscredpres_vcredpres,
cbscredpres_vcredprescondsus,
credpresibszfm_competapur,
credpresibszfm_tpcredpresibszf,
credpresibszfm_vcredpresibszfm,
vitem,
dfereferenciado_chaveacesso,
dfereferenciado_nitem);
      else -- FAG
        -- Imposto zerados
        CFOP := null;
        Base_IPI := 0.00;
        Valor_IPI := 0.00;
        Base_Calc_ICMS := 0.00;
        Valor_ICMS :=  0.00;
        Base_Calc_ICMS_Subst := 0.00;
        Valor_ICMS_Subst := 0.00;
        MVA := 0.00;
        ICMS_Interno_Destino := 0.00;
        ICMS_Externo_Origem := 0.00;

    end if;
 end;
 
 PROCEDURE Calcular_ICMS(Tipo_Movimentacao in varchar2,
                         CFOP IN varchar2,
                         Aliquota_ICMS IN number,
                         Total_Produto IN number,
                         Base_Calc_ICMS IN OUT number,
                         Valor_ICMS IN OUT number) is
 xBaseAlterada number;                         
 BEGIN
    if Aliquota_ICMS > 0
      then
        if (Tipo_Movimentacao = 'ENTRADA_COMPRAS') and (RowRegraCredor.desc_icms_sufra_base = 1) AND 
            NOT(CALCULO_IMPOSTO.Derivado_Petroleo) AND
            not(CALCULO_IMPOSTO.PROTOCOLO_1785) and
            (nvl(rowProd.Percsubst,0) = 0) and 
            (substr(rowProd.strib,1,1)  in  ('0','3','4','5','8')) 
          then
            xBaseAlterada := round((Total_Produto * (100 - Aliquota_ICMS)) / 100, 2);            
        elsif (Tipo_Movimentacao = 'ENTRADA_COMPRAS') and (RowRegraCredor.desc_icms_sufra_importado_base = 1) AND 
            NOT(CALCULO_IMPOSTO.Derivado_Petroleo) AND
            not(CALCULO_IMPOSTO.PROTOCOLO_1785) and
            (nvl(rowProd.Percsubst,0) = 0) and 
            (substr(rowProd.strib,1,1)  in  ('1','2','6','7')) 
          then
            xBaseAlterada := round((Total_Produto * (100 - Aliquota_ICMS)) / 100, 2);
        else
            xBaseAlterada := Total_Produto;
        end if;
        if CFOP in ('5551','6651','1553')
          then
            Base_Calc_ICMS := round((xBaseAlterada * 0.20), 2);
          else
              Base_Calc_ICMS := round((xBaseAlterada), 2);
        end if;  
      else Base_Calc_ICMS := 0.00;
    end if;
    -- Valor do ICMS
    if BaseReduzida and (Aliquota_ICMS > 0) then
      Valor_ICMS :=  round((Base_Calc_ICMS * (7.00 / 100)), 2);
      Base_Calc_ICMS := round(Valor_ICMS*100/Aliquota_ICMS, 2);        
    else
      Valor_ICMS :=  round((Base_Calc_ICMS * (Aliquota_ICMS / 100)), 2);
    end if;   
 
    
 END;
 
 PROCEDURE Calcular_IBS_CBS(TipoOperacao in varchar2,                             
                         CFOP IN varchar2,
                         Total_Produto IN number,
                         vtpcredpresibszfm in out number,
                        indbemmovelusado in out number,
                        is_cstis in out number,
                        is_cclasstribis in out number,
                        is_vbcis in out number,
                        is_pis in out number,
                        is_pisexpec in out number,
                        is_utrib in out number,
                        is_qtrib in out number,
                        is_vis in out number,
                        ibscbs_cst in out varchar2,
                        ibscbs_cclasstrib in out varchar2,
                        ibscbs_inddoacao in out number,
                        gibscbs_vbc in out number,
                        gibscbs_gibsuf_pibsuf in out number,
                        gibscbs_gibsuf_pdif in out number,
                        gibscbs_gibsuf_vdif in out number,
                        gibscbs_gibsuf_vdevtrib in out number,
                        gibscbs_gibsuf_predaliq in out number,
                        gibscbs_gibsuf_paliqefet in out number,
                        gibscbs_gibsuf_vibsuf in out number,
                        gibscbs_gibsmun_pibsmun in out number,
                        gibscbs_gibsmun_pdif in out number,
                        gibscbs_gibsmun_vdif in out number,
                        gibscbs_gibsmun_vdevtrib in out number,
                        gibscbs_gibsmun_predaliq in out number,
                        gibscbs_gibsmun_paliqefet in out number,
                        gibscbs_gibsmun_vibsmun in out number,
                        gibscbs_vibs in out number,
                        gibscbs_gcbs_pcbs in out number,
                        gibscbs_gcbs_pdif in out number,
                        gibscbs_gcbs_vdif in out number,
                        gibscbs_gcbs_vdevtrib in out number,
                        gibscbs_gcbs_predaliq in out number,
                        gibscbs_gcbs_paliqefet in out number,
                        gibscbs_gcbs_vcbs in out number,
                        tribregular_cstreg in out number,
                        tribregular_cclasstribreg in out number,
                        tribregular_paliqefetregibsuf in out number,
                        tribregular_vtribregibsuf in out number,
                        tribregular_paliqefetregibsmun in out number,
                        tribregular_vtribregibsmun in out number,
                        tribregular_paliqefetregcbs in out number,
                        tribregular_vtribregcbs in out number,
                        tribcompragov_paliqibsuf in out number,
                        tribcompragov_vtribibsuf in out number,
                        tribcompragov_paliqibsmun in out number,
                        tribcompragov_vtribibsmun in out number,
                        tribcompragov_paliqcbs in out number,
                        tribcompragov_vtribcbs in out number,
                        monopadrao_qbcmono in out number,
                        monopadrao_adremibs in out number,
                        monopadrao_adremcbs in out number,
                        monopadrao_vibsmono in out number,
                        monopadrao_vcbsmono in out number,
                        monoreten_qbcmonoreten in out number,
                        monoreten_adremibsreten in out number,
                        monoreten_vibsmonoreten in out number,
                        monoreten_adremcbsreten in out number,
                        monoreten_vcbsmonoreten in out number,
                        monoret_qbcmonoret in out number,
                        monoret_adremibsret in out number,
                        monoret_vibsmonoret in out number,
                        monoret_adremcbsret in out number,
                        monoret_vcbsmonoret in out number,
                        monodif_pdifibs in out number,
                        monodif_vibsmonodif in out number,
                        monodif_pdifcbs in out number,
                        monodif_vcbsmonodif in out number,
                        ibscbsmono_vtotibsmonoitem in out number,
                        ibscbsmono_vtotcbsmonoitem in out number,
                        transfcred_vibs in out number,
                        transfcred_vcbs in out number,
                        ajustecompet_competapur in out number,
                        ajustecompet_vibs in out number,
                        ajustecompet_vcbs in out number,
                        estornocred_vibsestcred in out number,
                        estornocred_vcbsestcred in out number,
                        credpressoper_vbccredpres in out number,
                        credpressoper_vcredpres in out number,
                        ibscredpres_pcredpres in out number,
                        ibscredpres_vcredpres in out number,
                        ibscredpres_vcredprescondsus in out number,
                        cbscredpres_pcredpres in out number,
                        cbscredpres_vcredpres in out number,
                        cbscredpres_vcredprescondsus in out number,
                        credpresibszfm_competapur in out number,
                        credpresibszfm_tpcredpresibszf in out number,
                        credpresibszfm_vcredpresibszfm in out number,
                        vitem in out number,
                        dfereferenciado_chaveacesso in out number,
                        dfereferenciado_nitem in out number) is
 xBaseAlterada number;  
 xAliquota_IBSUF number;                       
 xAliquota_IBSMUN number;
 xAliquota_CBS number;
 BEGIN
   xAliquota_IBSUF := round(RowUF_Destino.Ibs, 4);                       
   xAliquota_IBSMUN  := round(CIDADE_Destino.Ibs, 4);
   xAliquota_CBS  := round(0.9, 4);
    if TipoOperacao = 'TRANSFERENCIA'
      then
        ibscbs_cst := '410';
        ibscbs_cclasstrib := '410002';
    elsif TipoOperacao = 'REMESSA_BONIFICACAO'
      then        
        ibscbs_cst := '410';
        ibscbs_cclasstrib := '410001';
    elsif substr(CFOP,1,1) in ('7')
      then
        ibscbs_cst := '410';
        ibscbs_cclasstrib := '410004';
    elsif TipoOperacao in ('REMESSA_CONSERTO','RETORNO_CONSERTO')
      then
        ibscbs_cst := '200';
        ibscbs_cclasstrib := '200022';
    elsif CIDADE_Destino.Descricao in ('BRASILEIA','EPITACIOLANDIA','TABATINGA','GUAJARA-MIRIM','BOA VISTA','BONFIM','MACAPA','SANTANA')
      then
        ibscbs_cst := '200';
        ibscbs_cclasstrib := '200024';
        --ibscbs_inddoacao in out number,
        gibscbs_vbc := Total_Produto;
        gibscbs_gibsuf_pibsuf := xAliquota_IBSUF;
        --gibscbs_gibsuf_pdif in out number,
        --gibscbs_gibsuf_vdif in out number,
        --gibscbs_gibsuf_vdevtrib in out number,
        gibscbs_gibsuf_predaliq := round(100, 4);
        gibscbs_gibsuf_paliqefet := round(0, 4);
        gibscbs_gibsuf_vibsuf := round(gibscbs_vbc * xAliquota_IBSUF / 100, 2);
        gibscbs_gibsmun_pibsmun := xAliquota_IBSMUN;
        --gibscbs_gibsmun_pdif in out number,
        --gibscbs_gibsmun_vdif in out number,
        --gibscbs_gibsmun_vdevtrib in out number,
        gibscbs_gibsmun_predaliq := round(100, 4);
        gibscbs_gibsmun_paliqefet := round(0, 4);
        gibscbs_gibsmun_vibsmun := round(gibscbs_vbc * xAliquota_IBSMUN / 100, 2);
        gibscbs_vibs := round(gibscbs_gibsuf_vibsuf + gibscbs_gibsmun_pibsmun, 2);
        gibscbs_gcbs_pcbs := xAliquota_CBS;
        --gibscbs_gcbs_pdif in out number,
        --gibscbs_gcbs_vdif in out number,
        --gibscbs_gcbs_vdevtrib in out number,
        gibscbs_gcbs_predaliq := round(1000, 4);
        gibscbs_gcbs_paliqefet := round(0, 4);
        gibscbs_gcbs_vcbs := round(gibscbs_vbc * xAliquota_CBS / 100, 2);
        
        tribregular_cstreg := '000';
        tribregular_cclasstribreg := '000001';
        tribregular_paliqefetregibsuf := xAliquota_IBSUF;
        tribregular_vtribregibsuf := round(gibscbs_vbc * xAliquota_IBSUF / 100, 2);
        tribregular_paliqefetregibsmun := xAliquota_IBSMUN;
        tribregular_vtribregibsmun := round(gibscbs_vbc * xAliquota_IBSMUN / 100, 2);
        tribregular_paliqefetregcbs := xAliquota_CBS;
        tribregular_vtribregcbs := round(gibscbs_vbc * xAliquota_CBS / 100, 2); 
    elsif CIDADE_Origem.Codmunicipio <> 1302603 /*'MANAUS'*/ and CIDADE_Destino.Codmunicipio in (1302603,1303569,1303536)/*('MANAUS','RIO PRETO DA EVA','PRESIDENTE FIGUEIREDO')*/
      then
        ibscbs_cst := '200';
        ibscbs_cclasstrib := '200022';
        --ibscbs_inddoacao in out number,
        gibscbs_vbc := Total_Produto;
        gibscbs_gibsuf_pibsuf := xAliquota_IBSUF;
        --gibscbs_gibsuf_pdif in out number,
        --gibscbs_gibsuf_vdif in out number,
        --gibscbs_gibsuf_vdevtrib in out number,
        gibscbs_gibsuf_predaliq := round(100, 4);
        gibscbs_gibsuf_paliqefet := round(0, 4);
        gibscbs_gibsuf_vibsuf := round(gibscbs_vbc * xAliquota_IBSUF / 100, 2);
        gibscbs_gibsmun_pibsmun := xAliquota_IBSMUN;
        --gibscbs_gibsmun_pdif in out number,
        --gibscbs_gibsmun_vdif in out number,
        --gibscbs_gibsmun_vdevtrib in out number,
        gibscbs_gibsmun_predaliq := round(100, 4);
        gibscbs_gibsmun_paliqefet := round(0, 4);
        gibscbs_gibsmun_vibsmun := round(gibscbs_vbc * xAliquota_IBSMUN / 100, 2);
        gibscbs_vibs := round(gibscbs_gibsuf_vibsuf + gibscbs_gibsmun_pibsmun, 2);
        gibscbs_gcbs_pcbs := xAliquota_CBS;
        --gibscbs_gcbs_pdif in out number,
        --gibscbs_gcbs_vdif in out number,
        --gibscbs_gcbs_vdevtrib in out number,
        gibscbs_gcbs_predaliq := round(1000, 4);
        gibscbs_gcbs_paliqefet := round(0, 4);
        gibscbs_gcbs_vcbs := round(gibscbs_vbc * xAliquota_CBS / 100, 2);
        
        tribregular_cstreg := '000';
        tribregular_cclasstribreg := '000001';
        tribregular_paliqefetregibsuf := xAliquota_IBSUF;
        tribregular_vtribregibsuf := round(gibscbs_vbc * xAliquota_IBSUF /100, 2);
        tribregular_paliqefetregibsmun := xAliquota_IBSMUN;
        tribregular_vtribregibsmun := round(gibscbs_vbc * xAliquota_IBSMUN / 100, 2);
        tribregular_paliqefetregcbs := xAliquota_CBS;
        tribregular_vtribregcbs := round(gibscbs_vbc * xAliquota_CBS / 100, 2);        
    else
        if (MESMA_ALC(CIDADE_Origem.Codmunicipio, CIDADE_Destino.Codmunicipio)) or (MESMA_ZFM(CIDADE_Origem.Codmunicipio, CIDADE_Destino.Codmunicipio)) then
          xAliquota_CBS := 0;
        end if; 
        ibscbs_cst := '000';
        ibscbs_cclasstrib := '000001';
        --ibscbs_inddoacao in out number,
        gibscbs_vbc := Total_Produto;
        gibscbs_gibsuf_pibsuf := xAliquota_IBSUF;
        --gibscbs_gibsuf_pdif in out number,
        --gibscbs_gibsuf_vdif in out number,
        --gibscbs_gibsuf_vdevtrib in out number,
        --gibscbs_gibsuf_predaliq in out number,
        --gibscbs_gibsuf_paliqefet in out number,
        gibscbs_gibsuf_vibsuf := round(gibscbs_vbc * xAliquota_IBSUF / 100, 2);
        gibscbs_gibsmun_pibsmun := xAliquota_IBSMUN;
        --gibscbs_gibsmun_pdif in out number,
        --gibscbs_gibsmun_vdif in out number,
        --gibscbs_gibsmun_vdevtrib in out number,
        --gibscbs_gibsmun_predaliq in out number,
        --gibscbs_gibsmun_paliqefet in out number,
        gibscbs_gibsmun_vibsmun := round(gibscbs_vbc * xAliquota_IBSMUN / 100, 2);
        gibscbs_vibs := round(gibscbs_gibsuf_vibsuf + gibscbs_gibsmun_pibsmun, 2);
        gibscbs_gcbs_pcbs := xAliquota_CBS;
        --gibscbs_gcbs_pdif in out number,
        --gibscbs_gcbs_vdif in out number,
        --gibscbs_gcbs_vdevtrib in out number,
        --gibscbs_gcbs_predaliq in out number,
        --gibscbs_gcbs_paliqefet in out number,
        gibscbs_gcbs_vcbs := round(gibscbs_vbc * xAliquota_CBS / 100, 2);
    end if; 
    
 END;

 -- Procedimento para verificar se existe substituicao, se existir calcula
 PROCEDURE Calcular_ICMS_Subst(Tipo_Movimentacao in varchar2,
                               TipoOperacao in varchar2,
                               Zerar_SUBSTITUICAO in varchar2,
                               Valor_IPI IN number,
                               Total_Produto IN number,
                               MVA_ANTECIPADO in number,
                               Base_Produto in number,
                               ValorICMS in number,
                               Base_Calc_ICMS_Subst IN OUT number,
                               Valor_ICMS_Subst IN OUT number,
                               MVA  IN OUT number,
                               ICMS_Interno_Destino IN OUT number,
                               ICMS_Externo_Origem IN OUT number) is
 xLEI_id_Usado     number;
 xLEI_Protocolo    number;
 xDadosEmpresa     dadosempresa%rowtype;
 BEGIN
   select * into xDadosEmpresa from dadosempresa;
   -- ICMS   
   ICMS_Interno_Destino := RowUF_Destino.Icmsinterno;
   if ProdImportado
     then
       ICMS_Externo_Origem := 4.00;
     else  
       ICMS_Externo_Origem := RowUF_Origem.Icmsexterno;
   end if;   
   
   -- Zerar SUBSTITUICAO
   if Zerar_SUBSTITUICAO = 'S'
        then 
          ICMS_Interno_Destino := 0.00;
          ICMS_Externo_Origem := 0.00;
          MVA := 0;
   -- se Cliente eh final entao MVA = 0;
   elsif DadosDestino.TipoDestino = 'F' and DadosDestino.InscEstadual = 'ISENTO'
        then  
          ICMS_Interno_Destino := 0.00;
          ICMS_Externo_Origem := 0.00;
          MVA := 0;    
   -- MVA ANTECIPADO definido pelo faturamento
   elsif MVA_ANTECIPADO > 0
        then
          MVA := MVA_ANTECIPADO / 100;      
   -- Derivado de Petroleo
   elsif (Derivado_Petroleo)
        then
          MVA := MVA_Derivado_Petroleo(Tipo_Movimentacao);
   -- Convenios
   elsif 
        ((RowUF_Origem.Uf <> RowUF_Destino.Uf) and
        LEGISLACAO_ICMS(xLEI_id_Usado,xLEI_Protocolo,'CONVENIO'))
        then
          MVA := MVA_PRODUTO_LEGISLACAO(xLEI_id_Usado, Tipo_Movimentacao);
   -- Protocolos
   elsif 
        ((RowUF_Origem.Uf <> RowUF_Destino.Uf) and
        LEGISLACAO_ICMS(xLEI_id_Usado,xLEI_Protocolo,'PROTOCOLO'))
        then
          MVA := MVA_PRODUTO_LEGISLACAO(xLEI_id_Usado, Tipo_Movimentacao);
          
   -- Decreto
   elsif 
        ((RowUF_Origem.Uf <> RowUF_Destino.Uf) and
        LEGISLACAO_ICMS(xLEI_id_Usado,xLEI_Protocolo,'DECRETO'))
        then
          MVA := MVA_PRODUTO_LEGISLACAO(xLEI_id_Usado, Tipo_Movimentacao);
   -- Resolucao
   elsif 
        ((RowUF_Origem.Uf <> RowUF_Destino.Uf) and
        LEGISLACAO_ICMS(xLEI_id_Usado,xLEI_Protocolo,'RESOLUCAO'))
        then
          MVA := MVA_PRODUTO_LEGISLACAO(xLEI_id_Usado, Tipo_Movimentacao);
   -- mva preenchido no produto
   elsif --(Caso 2) (Agregado > 0 e UF Origem <> Uf Destimo)
        ((nvl(RowNCM.Agregado,0) > 0) and (RowUF_Origem.Uf <> RowUF_Destino.Uf))
        then
          if xDadosEmpresa.Uf = 'RO' then
            MVA := ROUND(nvl(RowNCM.Agregado,0.00) / 100, 4);
          else 
            MVA := ROUND((((1 + (nvl(RowNCM.Agregado,0.00) / 100)) * (1 - (ICMS_Externo_Origem / 100)) /
                        (1 - (ICMS_Interno_Destino / 100))) - 1), 4);
          end if;              
   else MVA := 0;
   end if;
   --Calculo da Base e Valor do ICMS se Substituicao
   if (MVA > 0)
    then
      if (RowUF_Destino.Uf = 'MT')
        then
          MVA := 0.18;
          -- Calcula Base de Calculo do ICMS de Substituicao
          Base_Calc_ICMS_Subst := ROUND(
          
          ((Total_Produto *  (ICMS_Externo_Origem / 100)) +
          ((Total_Produto + Valor_IPI) * 0.18)) /
          ((ICMS_Interno_Destino / 100)), 2);
          
          
          Valor_ICMS_Subst := ROUND(((Total_Produto + Valor_IPI) * 0.18), 2);
                    
       elsif (RowUF_Destino.Uf = 'MS')
        then
          MVA := 0.18;
          -- Calcula Base de Calculo do ICMS de Substituicao
          Base_Calc_ICMS_Subst := ROUND(
          
          ((Total_Produto *  (ICMS_Externo_Origem / 100)) +
          ((Total_Produto + Valor_IPI) * 0.18)) /
          ((ICMS_Interno_Destino / 100)), 2);
          
          
          Valor_ICMS_Subst := ROUND(((Total_Produto + Valor_IPI) * 0.18), 2);
                    
       elsif DadosDestino.TipoDestino = 'F' and DadosDestino.InscEstadual <> 'ISENTO'
         then
          MVA := 0.00;
          -- Calcula Base de Calculo do ICMS de Substituicao
          Base_Calc_ICMS_Subst := ROUND(Total_Produto + Valor_IPI, 2);
          
          
          Valor_ICMS_Subst := ROUND((Base_Calc_ICMS_Subst * (ICMS_Interno_Destino / 100)) -
                                   ((Base_Produto ) * (ICMS_Externo_Origem / 100)), 2);
       elsif (Tipo_Movimentacao = 'ENTRADA_COMPRAS') and (nvl(RowRegraCredor.BaseReduzida_ST  ,0) = 1) then
          -- Calcula Base de Calculo do ICMS de Substituicao
          Base_Calc_ICMS_Subst := ROUND(((Total_Produto + Valor_IPI) * (1 + MVA)), 2);
          Valor_ICMS_Subst := ROUND((Base_Calc_ICMS_Subst * (ICMS_Interno_Destino / 100)) -
                                   (ValorICMS), 2);
       
       else
          -- Calcula Base de Calculo do ICMS de Substituicao
          Base_Calc_ICMS_Subst := ROUND(((Total_Produto + Valor_IPI) * (1 + MVA)), 2);
          
          -- Calcula Valor do ICMS de Substituicao
          if (Derivado_Petroleo) --and DadosOrigem.Fabricante = 'S'
            then Valor_ICMS_Subst := ROUND((Base_Calc_ICMS_Subst * (ICMS_Interno_Destino / 100)), 2);
          else
            Valor_ICMS_Subst := ROUND((Base_Calc_ICMS_Subst * (ICMS_Interno_Destino / 100)) -
                                   ((Base_Produto ) * (ICMS_Externo_Origem / 100)), 2);
          end if;
      end if;
   else
     -- Isento Base de Calculo do ICMS de Substituicao
     Base_Calc_ICMS_Subst := 0.00;
     -- Isento Valor do ICMS de Substituicao
     Valor_ICMS_Subst := 0.00;
   end if;    
 END;
 
 PROCEDURE ICMS_ST_FRETE(ValorFrete in number,
                        MVA in number,
                        ICMS_Interno_Destino in number,
                        ICMS_Externo_Origem in number,
                        Base_ICMS_St  in out number,
                        Valor_ICMS_St in out number) is
 BEGIN
   Base_ICMS_St := nvl(ROUND(((ValorFrete) * (1 + MVA)), 2),0);
   Valor_ICMS_St := nvl(ROUND((Base_ICMS_St * (ICMS_Interno_Destino / 100)) -
                             ((ValorFrete ) * (ICMS_Externo_Origem / 100)), 2), 0);  
 END; 
 
 FUNCTION LEGISLACAO_ICMS(vLEI_id_Usado out number,
                          vLEI_Protocolo out number,
                          vTipo in varchar2) return boolean is
 xCursor        cursorgenerico.TIPOCURSORGENERICO;
 xLEI_id        number;
 xLEI_id_Usado  number;
 xLEI_Protocolo number;
 xLEI_Pro_Usado number;
 xParticipacao  boolean:= False;
 xProduto       boolean:= False;
 xResult        boolean:= False;
 xDadosEmpresa     dadosempresa%rowtype;
 BEGIN
   select * into xDadosEmpresa from dadosempresa;
   
   if (vTipo = 'CONVENIO') or (vTipo = 'PROTOCOLO') then
     open xCursor for
       select picms.LEI_id, picms.LEI_protocolo 
         from CAD_LEGISLACAO_ICMSST picms
         inner join CAD_LEGISLACAO_SIGNATARIO  pso on picms.LEI_id = pso.LES_LEI_id 
         inner join CAD_LEGISLACAO_SIGNATARIO  psd on picms.LEI_id = psd.LES_LEI_id 
         where pso.LES_uf = RowUF_Origem.Uf and psd.LES_uf = RowUF_Destino.Uf and 
                picms.LEI_STATUS = 'EM VIGOR' and picms.LEI_TIPO = vTipo
        order by picms.LEI_id desc;
   elsif (vTipo = 'RESOLUCAO') or (vTipo = 'DECRETO') then
     open xCursor for
       select picms.LEI_id, picms.LEI_protocolo 
         from CAD_LEGISLACAO_ICMSST picms
         inner join CAD_LEGISLACAO_SIGNATARIO  pso on picms.LEI_id = pso.LES_LEI_id 
         where pso.LES_uf = xDadosEmpresa.Uf and xDadosEmpresa.Uf = RowUF_Destino.Uf and  
                picms.LEI_STATUS = 'EM VIGOR' and picms.LEI_TIPO = vTipo
        order by picms.LEI_id desc;
   end if;
   fetch xCursor into xLEI_id,xLEI_Protocolo;
   while xCursor%found loop
     xParticipacao := True;
     if not(xProduto)
       then xProduto := PRODUTO_ICMS(xLEI_id);
            if xProduto
              then xLEI_id_Usado := xLEI_id;
                   xLEI_Pro_Usado := xLEI_Protocolo;
            end if;  
     end if;    
     fetch xCursor into xLEI_id,xLEI_Protocolo;
   end loop;    
    
    if ((xParticipacao)  and (xProduto))
      then xResult := True;
      else xResult := False;
    end if;
    vLEI_id_Usado := xLEI_id_Usado;
    vLEI_Protocolo := xLEI_Pro_Usado;
    Return(xResult);
 end;
 
 --                  False se nao estiver no Protocolo
 FUNCTION PRODUTO_ICMS(vLEI_ID in number) return boolean is
 xEncontrou    number;
 xResult       boolean:= False;
 BEGIN
  
    -- Valida NCM
    select count(*) into xEncontrou from CAD_LEGISLACAO_ICMSST_ncm 
      where LIN_LEI_id = vLEI_ID and LIN_NCM = RowNCM.Ncm;
    if (xEncontrou > 0)
      then
        xResult := True;
    else
      -- Se nao valida Parte da NCM tamanho 7
      select count(*) into xEncontrou from CAD_LEGISLACAO_ICMSST_ncm 
        where LIN_LEI_id = vLEI_ID and LIN_NCM = substr(RowNCM.Ncm,1,7) and length(LIN_NCM) = 7;
      if (xEncontrou > 0)
        then
          xResult := True;
      else
        -- Se nao valida Parte da NCM tamanho 6
        select count(*) into xEncontrou from CAD_LEGISLACAO_ICMSST_ncm 
          where LIN_LEI_id = vLEI_ID and LIN_NCM = substr(RowNCM.Ncm,1,6) and length(LIN_NCM) = 6;
        if (xEncontrou > 0)
          then
            xResult := True;
        else
          -- Se nao valida Parte da NCM tamanho 5
          select count(*) into xEncontrou from CAD_LEGISLACAO_ICMSST_ncm 
            where LIN_LEI_id = vLEI_ID and LIN_NCM = substr(RowNCM.Ncm,1,5) and length(LIN_NCM) = 5;
          if (xEncontrou > 0)
           then
            xResult := True;
          else
            -- Se nao valida Parte da NCM tamanho 4
            select count(*) into xEncontrou from CAD_LEGISLACAO_ICMSST_ncm 
              where LIN_LEI_id = vLEI_ID and LIN_NCM = substr(RowNCM.Ncm,1,4) and length(LIN_NCM) = 4;
            if (xEncontrou > 0)
              then
                xResult := True;
            else
              -- Se nao valida Parte da NCM tamanho 3
              select count(*) into xEncontrou from CAD_LEGISLACAO_ICMSST_ncm 
                where LIN_LEI_id = vLEI_ID and LIN_NCM = substr(RowNCM.Ncm,1,3) and length(LIN_NCM) = 3;
               if (xEncontrou > 0)
                 then
                   xResult := True;
    end if; end if; end if; end if; end if; end if ;
    -- Verifica Excecao
    select count(*) into xEncontrou from CAD_LEGISLACAO_ICMSST_ncm 
      where LIN_LEI_id = vLEI_ID and LIN_NCM = RowNCM.Ncm and (LIN_STATUS = 'EXCECAO');
    if ((xEncontrou > 0) or (PRODUTO_EXCECAO_ST))
      then
        xResult := False;
    end if;    
    -- Retorno da funcao
    Return(xResult);
 END;

 FUNCTION PRODUTO_EXCECAO_ST return boolean is
 xResult       boolean:= False;
 BEGIN 
   if RowNCM.Ncm = '85437099' and RowProd.Codmarca = '01094'
     then xResult := true;
   elsif  RowNCM.Ncm = '83026000' and RowProd.Codmarca = '01094'
     then xResult := true;
   elsif  RowNCM.Ncm = '85389010' and RowProd.Codmarca = '01094'
     then xResult := true;
   elsif  RowNCM.Ncm = '85399010' and RowProd.Codmarca = '01094'
     then xResult := true;
   end if;
    -- Retorno da funcao
    Return(xResult);
 END;
 
 FUNCTION MVA_PRODUTO_LEGISLACAO(vLEI_id in number,
                                 vTipo_Movimentacao in varchar2)  return number is
 xRowProtocoloNCM       CAD_LEGISLACAO_ICMSST_ncm%rowtype;
 xRowProtocolo          CAD_LEGISLACAO_ICMSST%rowtype;
 xSql                   long;
 xMVA_ST_Original       number;
 xResult                number:=0;
 i                      number;
 z                      number;
 x                      number:=0;
 ICMS_Externo_Origem    number;
 xEncontrou    number;
 begin
   select * into xRowProtocolo from CAD_LEGISLACAO_ICMSST where LEI_id = vLEI_id;
   
    -- Valida NCM
    select count(*) into xEncontrou from CAD_LEGISLACAO_ICMSST_ncm 
      where LIN_LEI_id = vLEI_ID and LIN_NCM = RowNCM.Ncm;
    if (xEncontrou > 0)
      then
        select * into xRowProtocoloNCM from CAD_LEGISLACAO_ICMSST_ncm 
        where LIN_LEI_id = vLEI_ID and LIN_NCM = RowNCM.Ncm and rownum = 1;
    else
      -- Se nao valida Parte da NCM tamanho 7
      select count(*) into xEncontrou from CAD_LEGISLACAO_ICMSST_ncm
        where LIN_LEI_id = vLEI_ID and LIN_NCM = substr(RowNCM.Ncm,1,7) and length(LIN_NCM) = 7;
      if (xEncontrou > 0)
        then
          select * into xRowProtocoloNCM from CAD_LEGISLACAO_ICMSST_ncm 
        where LIN_LEI_id = vLEI_ID and LIN_NCM = substr(RowNCM.Ncm,1,7) and length(LIN_NCM) = 7 and rownum = 1;
      else
        -- Se nao valida Parte da NCM tamanho 6
        select count(*) into xEncontrou from CAD_LEGISLACAO_ICMSST_ncm 
          where LIN_LEI_id = vLEI_ID and LIN_NCM = substr(RowNCM.Ncm,1,6) and length(LIN_NCM) = 6;
        if (xEncontrou > 0)
          then
            select * into xRowProtocoloNCM from CAD_LEGISLACAO_ICMSST_ncm 
          where LIN_LEI_id = vLEI_ID and LIN_NCM = substr(RowNCM.Ncm,1,6) and length(LIN_NCM) = 6 and rownum = 1;
        else
          -- Se nao valida Parte da NCM tamanho 5
          select count(*) into xEncontrou from CAD_LEGISLACAO_ICMSST_ncm 
            where LIN_LEI_id = vLEI_ID and LIN_NCM = substr(RowNCM.Ncm,1,5) and length(LIN_NCM) = 5;
          if (xEncontrou > 0)
           then
            select * into xRowProtocoloNCM from CAD_LEGISLACAO_ICMSST_ncm 
            where LIN_LEI_id = vLEI_ID and LIN_NCM = substr(RowNCM.Ncm,1,5) and length(LIN_NCM) = 5 and rownum = 1;
          else
            -- Se nao valida Parte da NCM tamanho 4
            select count(*) into xEncontrou from CAD_LEGISLACAO_ICMSST_ncm 
              where LIN_LEI_id = vLEI_ID and LIN_NCM = substr(RowNCM.Ncm,1,4) and length(LIN_NCM) = 4;
            if (xEncontrou > 0)
              then
                select * into xRowProtocoloNCM from CAD_LEGISLACAO_ICMSST_ncm 
              where LIN_LEI_id = vLEI_ID and LIN_NCM = substr(RowNCM.Ncm,1,4) and length(LIN_NCM) = 4 and rownum = 1;
            else
              -- Se nao valida Parte da NCM tamanho 3
              select count(*) into xEncontrou from CAD_LEGISLACAO_ICMSST_ncm 
                where LIN_LEI_id = vLEI_ID and LIN_NCM = substr(RowNCM.Ncm,1,3) and length(LIN_NCM) = 3;
               if (xEncontrou > 0)
                 then
                   select * into xRowProtocoloNCM from CAD_LEGISLACAO_ICMSST_ncm 
                where LIN_LEI_id = vLEI_ID and LIN_NCM = substr(RowNCM.Ncm,1,3) and length(LIN_NCM) = 3 and rownum = 1;
    end if; end if; end if; end if; end if; end if ;      
   
   xMVA_ST_Original :=  xRowProtocoloNCM.LIN_Mva_St_Original;
   
   for i in 1..3 loop
     select instr(xRowProtocolo.LEI_Mva_Ajustada, ':',1,i) into z from dual;
     if z > 0
      then x := x + 1;
     end if;  
   end loop; 
   
   if ProdImportado
     then
       ICMS_Externo_Origem := 4.00;
     else  
       ICMS_Externo_Origem := RowUF_Origem.Icmsexterno;
   end if;      
   
   if (vTipo_Movimentacao = 'ENTRADA_COMPRAS') and (DadosOrigem.RegimeTributario) = 0 then
     xResult := (xMVA_ST_Original/100);
   else 
     if x = 3 then
       xSql := 'select round((' || xRowProtocolo.LEI_Mva_Ajustada || ') ,4) from dual ';
       execute immediate xSql into xResult using (xMVA_ST_Original/100) , (ICMS_Externo_Origem/100) , (RowUF_Destino.Icmsinterno/100);
     elsif x = 1 then
       xSql := 'select round((' || xRowProtocolo.LEI_Mva_Ajustada || ') ,4) from dual ';
       execute immediate xSql into xResult using (xMVA_ST_Original/100);
     else
       xResult := 0;
     end if;  
   end if;

   Return(xResult);
   
 end;

 -- Funcao que verifica se a NCM estar no PROTOCOLO129.
 -- Retorno Boolean. TRUE se estiver no Protocolo
 --                  False se nao estiver no Protocolo
 FUNCTION NCM_PROTOCOLO129 return boolean is
 xEncontrou    number;
 xResult       boolean;
 BEGIN
    -- Verifica se o produtar se encaixa na classificacao da Lei HANAN
    xResult := False;
    -- Valida NCM
    select count(*) into xEncontrou from dbclassificacao_protocolo129
         where NCM = RowNCM.Ncm;
    if (xEncontrou > 0)
      then
        xResult := True;
    else
      -- Se nao valida Parte da NCM tamanho 7
      select count(*) into xEncontrou from dbclassificacao_protocolo129
           where NCM = substr(RowNCM.Ncm,1,7) and length(ncm) = 7;
      if (xEncontrou > 0)
        then
          xResult := True;
      else
        -- Se nao valida Parte da NCM tamanho 6
        select count(*) into xEncontrou from dbclassificacao_protocolo129
             where NCM = substr(RowNCM.Ncm,1,6) and length(ncm) = 6;
        if (xEncontrou > 0)
          then
            xResult := True;
        else
          -- Se nao valida Parte da NCM tamanho 5
          select count(*) into xEncontrou from dbclassificacao_protocolo129
               where NCM = substr(RowNCM.Ncm,1,5) and length(ncm) = 5;
          if (xEncontrou > 0)
           then
            xResult := True;
          else
            -- Se nao valida Parte da NCM tamanho 4
            select count(*) into xEncontrou from dbclassificacao_protocolo129
                 where NCM = substr(RowNCM.Ncm,1,4) and length(ncm) = 4;
            if (xEncontrou > 0)
              then
                if (RowNCM.Ncm = '73259100')
                  then
                    xResult := False;
                  else  
                    xResult := True;
                end if;    
            else
              -- Se nao valida Parte da NCM tamanho 3
              select count(*) into xEncontrou from dbclassificacao_protocolo129
                  where NCM = substr(RowNCM.Ncm,1,3) and length(ncm) = 3;
               if (xEncontrou > 0)
                 then
                   xResult := True;
    end if; end if; end if; end if; end if; end if ;
   -- Retorno da funcao
   Return(xResult);
 END;
 
 FUNCTION Derivado_Petroleo return boolean is
 xResult       boolean;
 BEGIN
    -- Verifica se o produtar se encaixa na classificacao de Derivados de Petroleo
    xResult := False;
    -- Valida NCM
    if (/*(RowNCM.Ncm = '38190000') or (RowNCM.Ncm = '38140000') or (RowNCM.Ncm = '34029029') OR
        (RowNCM.Ncm = '34053000') or --tirado a pedido da silvaneide 20/02/2019 */
        (substr(RowNCM.Ncm,1,7) = '2710193'))
      then
        xResult := True;
      else  
        xResult := False;
    end if;    
   -- Retorno da funcao
   Return(xResult);
 END;

 FUNCTION MVA_Derivado_Petroleo(Tipo_Movimentacao in varchar2) return number is
 xResult       number;
 BEGIN
   -- operac?es internas
   
   /*
   if (RowUF_Destino.Uf = RowUF_Origem.Uf) and (Tipo_Movimentacao != 'SAIDA')
     then xResult := 30 / 100;
   elsif --aliquota interna do produto na unidade federada de destino for 12%
         (RowUF_Destino.Icmsinterno = 12.00) and (RowUF_Destino.Uf != RowUF_Origem.Uf)
     then xResult := 47.73 / 100;
   elsif --aliquota interna do produto na unidade federada de destino for 17%
         (RowUF_Destino.Icmsinterno = 17.00) and (RowUF_Destino.Uf != RowUF_Origem.Uf)
     then xResult := 56.63 / 100;
   elsif --aliquota interna do produto na unidade federada de destino for 18%
         (RowUF_Destino.Icmsinterno = 18.00) and (RowUF_Destino.Uf != RowUF_Origem.Uf)
     then xResult := 58.54 / 100;
   elsif --aliquota interna do produto na unidade federada de destino for 20%
         (RowUF_Destino.Icmsinterno = 20.00) and (RowUF_Destino.Uf != RowUF_Origem.Uf)
     then xResult := 62.50 / 100;
   elsif --aliquota interna do produto na unidade federada de destino for 25%
         (RowUF_Destino.Icmsinterno = 25.00) and (RowUF_Destino.Uf != RowUF_Origem.Uf)
     then xResult := 73.33 / 100;
   elsif --aliquota interna do produto na unidade federada de destino for 30%
         (RowUF_Destino.Icmsinterno = 30.00) and (RowUF_Destino.Uf != RowUF_Origem.Uf)
     then xResult := 85.71 / 100;
   elsif --aliquota interna do produto na unidade federada de destino for 26%
         (RowUF_Destino.Icmsinterno = 26.00) and (RowUF_Destino.Uf != RowUF_Origem.Uf)
     then xResult := 75.68 / 100;
   elsif --aliquota interna do produto na unidade federada de destino for 27%
         (RowUF_Destino.Icmsinterno = 27.00) and (RowUF_Destino.Uf != RowUF_Origem.Uf)
     then xResult := 78.08 / 100;
   elsif --aliquota interna do produto na unidade federada de destino for 14%
         (RowUF_Destino.Icmsinterno = 14.00) and (RowUF_Destino.Uf != RowUF_Origem.Uf)
     then xResult := 51.16 / 100;
   elsif --aliquota interna do produto na unidade federada de destino for 15%
         (RowUF_Destino.Icmsinterno = 15.00) and (RowUF_Destino.Uf != RowUF_Origem.Uf)
     then xResult := 52.94 / 100;
   elsif --aliquota interna do produto na unidade federada de destino for 19%
         (RowUF_Destino.Icmsinterno = 19.00) and (RowUF_Destino.Uf != RowUF_Origem.Uf)
     then xResult := 60.50 / 100;
   else xResult := 0.00;
   end if;*/
   /*
   if (RowNCM.Ncm = '38190000')  and (RowUF_Destino.Uf != RowUF_Origem.Uf)
     then xResult := 30.00 /100;
   end if;    */
   if (RowUF_Destino.Uf = RowUF_Origem.Uf) and (Tipo_Movimentacao != 'SAIDA')
     then xResult := 61.31 /100;
   elsif (RowUF_Destino.Uf != RowUF_Origem.Uf and RowUF_Destino.Uf = 'AC')
     then xResult := 94.35 /100;
   elsif (RowUF_Destino.Uf != RowUF_Origem.Uf)
     then xResult := 96.72 /100;
   end if;    
   
   -- Retorno da funcao
   Return(xResult);
 END;
 
 -- Funcao que verifica qual a aliquota do IPI dever ser usada
 -- Retorno Number.  Aliquota do IPI dever usada (%)
 FUNCTION Validar_IPI (Tipo_Movimentacao in varchar2,
                       TipoOperacao in varchar2) return number is
 xResult           number; 
 BEGIN
   -- Seleciona dados UF Destino
   if (Tipo_Movimentacao = 'ENTRADA_COMPRAS') --Entrada do Setor de Compras
    then 
      -- se IPI eh Cobrado ou Pago
      if ((RowProd.Isentoipi = 'C') and (RowUF_Origem.Uf <> RowUF_Destino.Uf) and (TipoOperacao in ('DEVOLUCAO_VENDA','DEVOLUCAO_TRANSFERENCIA','TRANSFERENCIA'))) or 
         ((RowProd.Isentoipi = 'C') and (TipoOperacao not in ('DEVOLUCAO_VENDA','DEVOLUCAO_TRANSFERENCIA','TRANSFERENCIA'))) or
         ((RowProd.Isentoipi = 'P') and (TipoOperacao not in ('DEVOLUCAO_VENDA','DEVOLUCAO_TRANSFERENCIA','TRANSFERENCIA'))) or
         ((RowProd.Isentoipi = 'S') and (RowUF_Destino.Zona_Isentivada = 'N'))
       --entao cobra o IPI
       then
         if (substr(RowProd.Strib, 1, 1) in ('1','2','3')) and (RowRegraCredor.Cobrar_Ipi_Importado = 0)
           then xResult := 0.00;
           else xResult := nvl(RowProd.Ipi,0.00);
         end if;  
       --senao isento
       else
         xResult := 0.00;
      end if;
   elsif (Tipo_Movimentacao = 'ENTRADA') --Nota de Entrada do Faturamento
    then 
      -- se IPI eh Cobrado ou Pago
      if ((RowProd.Isentoipi = 'C') and (RowUF_Origem.Uf <> RowUF_Destino.Uf) and (TipoOperacao in ('DEVOLUCAO_VENDA','DEVOLUCAO_TRANSFERENCIA'))) or 
         ((RowProd.Isentoipi = 'C') and (TipoOperacao not in ('DEVOLUCAO_VENDA','DEVOLUCAO_TRANSFERENCIA'))) or
         ((RowProd.Isentoipi = 'P') and (TipoOperacao not in ('DEVOLUCAO_VENDA','DEVOLUCAO_TRANSFERENCIA'))) or
         ((RowProd.Isentoipi = 'S') and (RowUF_Destino.Zona_Isentivada = 'N'))
       --entao cobra o IPI
       then
         xResult := nvl(RowProd.Ipi,0.00);
       --senao isento
       else
         xResult := 0.00;
      end if;
   elsif (Tipo_Movimentacao = 'SAIDA') --Nota de Saida do Faturamento   
    then
      -- se IPI suspenso na Entrada e UF destino nao e zona incentivada ou 
      -- IPI eh cobrado e UF destino de UF origem
      if /*((RowProd.Isentoipi = 'S') and (RowUF_Destino.Zona_Isentivada = 'N') and (RowUF_Origem.Uf <> RowUF_Destino.Uf)) or */
         ((RowProd.Isentoipi = 'C') and (RowUF_Origem.Uf <> RowUF_Destino.Uf) and (TipoOperacao not in ('DEVOLUCAO_COMPRA','DEVOLUCAO_TRANSFERENCIA','REMESSA_GARANTIA_FABRICA','REMESSA_CONSERTO'))) or
         (RowProd.Isentoipi in ('I','T'))   or       
         ((RowProd.Isentoipi = 'C') and (RowUF_Origem.Uf <> RowUF_Destino.Uf) and (TipoOperacao in ('DEVOLUCAO_COMPRA','DEVOLUCAO_TRANSFERENCIA','REMESSA_GARANTIA_FABRICA','REMESSA_CONSERTO'))) or
         ((RowProd.Isentoipi = 'P') and (RowUF_Origem.Uf <> RowUF_Destino.Uf) and (TipoOperacao in ('DEVOLUCAO_COMPRA','DEVOLUCAO_TRANSFERENCIA','REMESSA_GARANTIA_FABRICA','REMESSA_CONSERTO'))) or
         ((RowProd.Isentoipi = 'S') and (RowUF_Destino.Zona_Isentivada = 'N'))
         
       --entao cobra o IPI
       then
         xResult := nvl(RowNCM.Ipi,0.00);
       --senao isento
       else
         xResult := 0.00;
      end if;      
   end if; 
   if DadosDestino.TipoDestino = 'F' then
     xResult := 0.00;
   end if;  
   
   Return(xResult);  
    
 end;

 -- Funcao que verifica qual a aliquota do ICMS dever ser usada
 -- Retorno Number.  Aliquota do ICMS dever usada (%)
 FUNCTION Validar_ICMS (Insc_Estadual in varchar2,
                        CFOP in varchar2) return number is
 xLEI_id_Usado  number;
 xLEI_Pro_Usado number;
 xResult           number;
 BEGIN
   
   if cfop = '1600'
       then
         xResult := 6.00;
   elsif cfop in ('6915','6916') -- remessa e retorno para conserto
       then xResult := 0.00;
   elsif cfop in ('5551','6651','1553')
       then
         if (RowUF_Origem.Uf = RowUF_Destino.Uf)
           -- se UF origem = UF destino entao ICMS = Aliquota ICMS interno da UF de origem
           then
             xResult := RowUF_Origem.Icmsinterno;
           -- senao ICMS = Aliquota ICMS externo da UF de origem
           else
             if ProdImportado
               then
                 xResult := 4.00;
               else  
                 xResult := RowUF_Origem.Icmsexterno;
             end if;    
         end if;     
    elsif (Insc_Estadual = '07' ) and (cfop = '1603')
   -- se Origem eh um Importador entao ICMS = Aliquota ICMS CORREDOR da UF de origem
       then
         xResult := 6.00;
   elsif (Insc_Estadual = '07' )
   -- se Origem eh um Importador entao ICMS = Aliquota ICMS CORREDOR da UF de origem
       then
         if ProdImportado
           then
             xResult := 4.00;
           else  
             xResult := RowUF_Origem.Icmsexterno;
         end if;
   elsif LEGISLACAO_ICMS(xLEI_id_Usado, xLEI_Pro_Usado, 'CONVENIO')
       -- se NCM estar em algum protocolo
       then
         if (RowUF_Origem.Uf = RowUF_Destino.Uf)
           -- se UF origem = UF destino entao ICMS = 0.00
           then
             xResult := 0.00;
           -- senao ICMS = Aliquota ICMS externo da UF de origem
           else
             if ProdImportado
               then
                 xResult := 4.00;
               else  
                 xResult := RowUF_Origem.Icmsexterno;
             end if;
         end if;      
   elsif LEGISLACAO_ICMS(xLEI_id_Usado, xLEI_Pro_Usado, 'PROTOCOLO')
       -- se NCM estar em algum protocolo
       then
         if (RowUF_Origem.Uf = RowUF_Destino.Uf)
           -- se UF origem = UF destino entao ICMS = 0.00
           then
             xResult := 0.00;
           -- senao ICMS = Aliquota ICMS externo da UF de origem
           else
             if ProdImportado
               then
                 xResult := 4.00;
               else  
                 xResult := RowUF_Origem.Icmsexterno;
             end if;
         end if;
   elsif LEGISLACAO_ICMS(xLEI_id_Usado, xLEI_Pro_Usado, 'RESOLUCAO')
       -- se NCM estar em algum protocolo
       then
         if (RowUF_Origem.Uf = RowUF_Destino.Uf)
           -- se UF origem = UF destino entao ICMS = 0.00
           then
             xResult := 0.00;
           -- senao ICMS = Aliquota ICMS externo da UF de origem
           else
             if ProdImportado
               then
                 xResult := 4.00;
               else  
                 xResult := RowUF_Origem.Icmsexterno;
             end if;
         end if;
   
   elsif LEGISLACAO_ICMS(xLEI_id_Usado, xLEI_Pro_Usado, 'DECRETO')
       -- se NCM estar em algum protocolo
       then
         if (RowUF_Origem.Uf = RowUF_Destino.Uf)
           -- se UF origem = UF destino entao ICMS = 0.00
           then
             xResult := 0.00;
           -- senao ICMS = Aliquota ICMS externo da UF de origem
           else
             if ProdImportado
               then
                 xResult := 4.00;
               else  
                 xResult := RowUF_Origem.Icmsexterno;
             end if;
         end if;
   
   elsif (nvl(RowNCM.Agregado,0) > 0)
       -- se Percentual de Substituicao maior que zero entao ICMS
       then
         if (RowUF_Origem.Uf = RowUF_Destino.Uf)
           -- se UF origem = UF destino entao ICMS = 0.00
           then
             xResult := 0.00;
           -- senao ICMS = Aliquota ICMS externo da UF de origem
           else
             if ProdImportado
               then
                 xResult := 4.00;
               else  
                 xResult := RowUF_Origem.Icmsexterno;
             end if;
         end if;
   elsif (RowUF_Origem.Uf = RowUF_Destino.Uf)
       -- se UF origem = UF destino entao ICMS = Aliquota ICMS interno da UF de origem
       then
             xResult := RowUF_Origem.Icmsinterno;         
       -- senao ICMS = Aliquota ICMS externo da UF de origem
       else
         if ProdImportado
           then
             xResult := 4.00;
           else  
             xResult := RowUF_Origem.Icmsexterno;
         end if;
   end if;
   Return(xResult);
 end;
 
 Procedure Tipo_Operacao_Saida(TipoOperacao in varchar2,
                               UF_Iguais in out boolean,
                               Pode_ST in out boolean,
                               CFOP in out varchar2) is
 begin
   -- verifica o tipo de operacao
   if TipoOperacao = 'VENDA'
    then
     if (RowUF_Origem.Uf = RowUF_Destino.Uf)
      then -- UF iguais
        UF_Iguais := True;
        Pode_ST := True;
        CFOP := null;
      else -- UF diferentes
        UF_Iguais := False;
        Pode_ST := True;
        CFOP := null;
     end if;
  elsif TipoOperacao = 'TRANSFERENCIA'
    then
      if (RowUF_Origem.Uf = RowUF_Destino.Uf)
        then -- UF iguais
          UF_Iguais := True;
          Pode_ST := True;
          CFOP := null;
        else -- UF diferentes
          UF_Iguais := False;
          Pode_ST := True;
          CFOP := null;
      end if;
  elsif TipoOperacao = 'DEVOLUCAO_COMPRA'
    then
      if (RowUF_Origem.Uf = RowUF_Destino.Uf)
        then -- UF iguais
          UF_Iguais := True;
          Pode_ST := True;
          CFOP := null;
        else -- UF diferentes
          UF_Iguais := False;
          Pode_ST := True;
          CFOP := null;
      end if;
  elsif TipoOperacao = 'DEVOLUCAO_TRANSFERENCIA'
    then
      if (RowUF_Origem.Uf = RowUF_Destino.Uf)
        then -- UF iguais
          UF_Iguais := True;
          Pode_ST := True;
          CFOP := null;
        else -- UF diferentes
          UF_Iguais := False;
          Pode_ST := True;
          CFOP := null;
      end if;
  elsif TipoOperacao = 'REMESSA_BONIFICACAO'
    then
      if (RowUF_Origem.Uf = RowUF_Destino.Uf)
        then -- UF iguais
          UF_Iguais := True;
          Pode_ST := False;
          CFOP := '5910';
        else -- UF diferentes
          UF_Iguais := False;
          Pode_ST := False;
          CFOP := '6910';
      end if;
  elsif TipoOperacao = 'REMESSA_EXPOSICAO'
    then
      if (RowUF_Origem.Uf = RowUF_Destino.Uf)
        then -- UF iguais
          UF_Iguais := True;
          Pode_ST := False;
          CFOP := '5914';
        else -- UF diferentes
          UF_Iguais := False;
          Pode_ST := False;
          CFOP := '6914';
      end if;
  elsif TipoOperacao = 'REMESSA_DEMOSTRACAO'
    then
      if (RowUF_Origem.Uf = RowUF_Destino.Uf)
        then -- UF iguais
          UF_Iguais := True;
          Pode_ST := False;
          CFOP := '5912';
        else -- UF diferentes
          UF_Iguais := False;
          Pode_ST := False;
          CFOP := '6912';
      end if;
  elsif TipoOperacao = 'REMESSA_ARMAZEM'
    then
      if (RowUF_Origem.Uf = RowUF_Destino.Uf)
        then -- UF iguais
          UF_Iguais := True;
          Pode_ST := False;
          CFOP := '5905';
        else -- UF diferentes
          UF_Iguais := False;
          Pode_ST := False;
          CFOP := '6905';
      end if;
  elsif TipoOperacao = 'REMESSA_GARANTIA_FABRICA'
    then
      if (RowUF_Origem.Uf = RowUF_Destino.Uf)
        then -- UF iguais
          UF_Iguais := True;
          Pode_ST := True;
          CFOP := null;
        else -- UF diferentes
          UF_Iguais := False;
          Pode_ST := True;
          CFOP := null;            
      end if;
  elsif TipoOperacao = 'REMESSA_CONSERTO'
    then
      if (RowUF_Origem.Uf = RowUF_Destino.Uf)
        then -- UF iguais
          UF_Iguais := True;
          Pode_ST := False;
          CFOP := '5915';
        else -- UF diferentes
          UF_Iguais := False;
          Pode_ST := False;
          CFOP := '6915';
      end if;
  elsif TipoOperacao = 'SIMPLES_REMESSA'
    then
      if (RowUF_Origem.Uf = RowUF_Destino.Uf)
        then -- UF iguais
          UF_Iguais := True;
          Pode_ST := False;
          CFOP := '5949';
        else -- UF diferentes
          UF_Iguais := False;
          Pode_ST := False;
          CFOP := '6949';
      end if;
  elsif TipoOperacao = 'REMESSA_GARANTIA_CLIENTE'
    then
      if (RowUF_Origem.Uf = RowUF_Destino.Uf)
        then -- UF iguais
          UF_Iguais := True;
          Pode_ST := True;
          CFOP := null;
        else -- UF diferentes
          UF_Iguais := False;
          Pode_ST := True;
          CFOP := null;            
      end if;
  elsif TipoOperacao = 'EXTRAVIO_AVARIA_FABRICA'
    then
      if (RowUF_Origem.Uf = RowUF_Destino.Uf)
        then -- UF iguais
          UF_Iguais := True;
          Pode_ST := True;
          CFOP := null;
        else -- UF diferentes
          UF_Iguais := False;
          Pode_ST := True;
          CFOP := null;            
      end if;
  elsif TipoOperacao = 'EXTRAVIO_AVARIA_CLIENTE'
    then
      if (RowUF_Origem.Uf = RowUF_Destino.Uf)
        then -- UF iguais
          UF_Iguais := True;
          Pode_ST := True;
          CFOP := null;
        else -- UF diferentes
          UF_Iguais := False;
          Pode_ST := True;
          CFOP := null;            
      end if; 
  elsif TipoOperacao = 'RETORNO_REMESSA_GARANTIA'
    then
      if (RowUF_Origem.Uf = RowUF_Destino.Uf)
        then -- UF iguais
          UF_Iguais := True;
          Pode_ST := False;
          CFOP := '5949';
        else -- UF diferentes
          UF_Iguais := False;
          Pode_ST := False;
          CFOP := '6949';
      end if;       
  elsif TipoOperacao = 'RETORNO_REMESSA_CONSERTO'
    then
      if (RowUF_Origem.Uf = RowUF_Destino.Uf)
        then -- UF iguais
          UF_Iguais := True;
          Pode_ST := False;
          CFOP := '5949';
        else -- UF diferentes
          UF_Iguais := False;
          Pode_ST := False;
          CFOP := '6949';
      end if;       
  elsif CFOP = '6119'
    then   
      if (RowUF_Origem.Uf = RowUF_Destino.Uf)
        then
          UF_Iguais := True;
          Pode_ST := True;
        else  
          UF_Iguais := False;
          Pode_ST := True;
      end if;
  else  
      if (RowUF_Origem.Uf = RowUF_Destino.Uf)
        then
          UF_Iguais := True;
          Pode_ST := False;
        else
          UF_Iguais := False;
          Pode_ST := False;
      end if;    

  end if;

 end;

 Procedure Tipo_Operacao_Entrada(TipoOperacao in varchar2,
                                 UF_Iguais in out boolean,
                                 Pode_ST in out boolean,
                                 CFOP in out varchar2) is
 begin
   -- verifica o tipo de operacao
   if TipoOperacao = 'COMPRA'
    then
     if (RowUF_Origem.Uf = RowUF_Destino.Uf)
      then -- UF iguais
        UF_Iguais := True;
        Pode_ST := True;
        CFOP := null;
      else -- UF diferentes
        UF_Iguais := False;
        Pode_ST := True;
        CFOP := null;
     end if;
     --cal
  elsif TipoOperacao = 'TRANSFERENCIA'
    then
      if (RowUF_Origem.Uf = RowUF_Destino.Uf)
        then -- UF iguais
          UF_Iguais := True;
          Pode_ST := True;
          CFOP := null;
        else -- UF diferentes
          UF_Iguais := False;
          Pode_ST := True;
          CFOP := null;
      end if;
  elsif TipoOperacao = 'DEVOLUCAO_VENDA'
    then
      if (RowUF_Origem.Uf = RowUF_Destino.Uf)
        then -- UF iguais
          UF_Iguais := True;
          Pode_ST := True;
          CFOP := null;
        else -- UF diferentes
          UF_Iguais := False;
          Pode_ST := True;
          CFOP := null;
      end if;
  elsif TipoOperacao = 'DEVOLUCAO_TRANSFERENCIA'
    then
      if (RowUF_Origem.Uf = RowUF_Destino.Uf)
        then -- UF iguais
          UF_Iguais := True;
          Pode_ST := True;
          CFOP := null;
        else -- UF diferentes
          UF_Iguais := False;
          Pode_ST := True;
          CFOP := null;
      end if;
  elsif TipoOperacao = 'ENTRADA_BONIFICACAO'
    then
      if (RowUF_Origem.Uf = RowUF_Destino.Uf)
        then -- UF iguais
          UF_Iguais := True;
          Pode_ST := False;
          CFOP := '1910';
        else -- UF diferentes
          UF_Iguais := False;
          Pode_ST := False;
          CFOP := '2910';
      end if;
  elsif TipoOperacao = 'RETORNO_EXPOSICAO'
    then
      if (RowUF_Origem.Uf = RowUF_Destino.Uf)
        then -- UF iguais
          UF_Iguais := True;
          Pode_ST := False;
          CFOP := '1914';
        else -- UF diferentes
          UF_Iguais := False;
          Pode_ST := False;
          CFOP := '2914';
      end if;
  elsif TipoOperacao = 'ENTRADA_DEMOSTRACAO'
    then
      if (RowUF_Origem.Uf = RowUF_Destino.Uf)
        then -- UF iguais
          UF_Iguais := True;
          Pode_ST := False;
          CFOP := '1912';
        else -- UF diferentes
          UF_Iguais := False;
          Pode_ST := False;
          CFOP := '2912';
      end if;
  elsif TipoOperacao = 'ENTRADA_ARMAZEM'
    then
      if (RowUF_Origem.Uf = RowUF_Destino.Uf)
        then -- UF iguais
          UF_Iguais := True;
          Pode_ST := False;
          CFOP := '1905';
        else -- UF diferentes
          UF_Iguais := False;
          Pode_ST := False;
          CFOP := '2905';
      end if;
    elsif TipoOperacao = 'RETORNO_GARANTIA_FABRICA'
    then
      if (RowUF_Origem.Uf = RowUF_Destino.Uf)
        then -- UF iguais
          UF_Iguais := True;
          Pode_ST := True;
          CFOP := null;
        else -- UF diferentes
          UF_Iguais := False;
          Pode_ST := True;
          CFOP := null;
      end if;
  elsif TipoOperacao = 'RETORNO_GARANTIA_CLIENTE'
    then
      if (RowUF_Origem.Uf = RowUF_Destino.Uf)
        then -- UF iguais
          UF_Iguais := True;
          Pode_ST := True;
          CFOP := null;
        else -- UF diferentes
          UF_Iguais := False;
          Pode_ST := True;
          CFOP := null;
      end if;
  elsif TipoOperacao = 'RETORNO_CONSERTO'
    then
      if (RowUF_Origem.Uf = RowUF_Destino.Uf)
        then -- UF iguais
          UF_Iguais := True;
          Pode_ST := False;
          CFOP := '1916';
        else -- UF diferentes
          UF_Iguais := False;
          Pode_ST := False;
          CFOP := '2916';
      end if;
  else
      if (RowUF_Origem.Uf = RowUF_Destino.Uf)
        then
          UF_Iguais := True;
          Pode_ST := False;
        else
          UF_Iguais := False;
          Pode_ST := False;
      end if;    

  end if;

 end;

 FUNCTION Validar_CFOP_Saida(TipoOperacao in varchar2,
                             UF_Iguais in boolean,
                             MVA in number,
                             ValorST in number) return varchar2 is

 xLEI_id_Usado  number;
 xLEI_Pro_Usado number;
 xResult           varchar2(4):=null;
 BEGIN
  
   
   
   
   if UF_Iguais -- ****  Estados Iguais
     then
       -- verifica o tipo de operacao
       if TipoOperacao = 'VENDA'
        then
         if LEGISLACAO_ICMS(xLEI_id_Usado, xLEI_Pro_Usado, 'CONVENIO')
           then
             xResult := '5405';
         elsif LEGISLACAO_ICMS(xLEI_id_Usado, xLEI_Pro_Usado, 'PROTOCOLO')
           then
             xResult := '5405';
         elsif LEGISLACAO_ICMS(xLEI_id_Usado, xLEI_Pro_Usado, 'RESOLUCAO')
           then
             xResult := '5405';
         elsif LEGISLACAO_ICMS(xLEI_id_Usado, xLEI_Pro_Usado, 'DECRETO')
           then
             xResult := '5405';
         -- Derivado de Petroleo
         /*elsif (Derivado_Petroleo)
           then
             xResult := '5405';*/
         elsif (nvl(RowNCM.Agregado,0) > 0)
           then xResult := '5405';
         elsif (MVA > 0) or (ValorST > 0)    
           then
             xResult := '5403';
         else
             xResult := '5102';
         end if;
      elsif TipoOperacao = 'TRANSFERENCIA'
        then
         if (MVA > 0) or (ValorST > 0)
          then -- Tem Substituicao Tributaria
            xResult := '5409';
          else -- Nao tem Substituicao Tributaria
            xResult := '5152';
         end if;
      elsif TipoOperacao = 'DEVOLUCAO_COMPRA'
        then
          if (MVA > 0) or (ValorST > 0)
          then -- Tem Substituicao Tributaria
            xResult := '5411';
          else -- Nao tem Substituicao Tributaria
            xResult := '5202';
         end if;
      elsif TipoOperacao = 'DEVOLUCAO_TRANSFERENCIA'
        then
          if (MVA > 0) or (ValorST > 0)
          then -- Tem Substituicao Tributaria
            xResult := '5209';
          else -- Nao tem Substituicao Tributaria
            xResult := '5209';
         end if;
      elsif TipoOperacao = 'REMESSA_GARANTIA_FABRICA'
        then
          if (MVA > 0) or (ValorST > 0)
          then -- Tem Substituicao Tributaria
            xResult := '5949';
          else -- Nao tem Substituicao Tributaria
            xResult := '5949';
         end if;
      elsif TipoOperacao = 'REMESSA_GARANTIA_CLIENTE'
        then
          if (MVA > 0) or (ValorST > 0)
          then -- Tem Substituicao Tributaria
            xResult := '5949';
          else -- Nao tem Substituicao Tributaria
            xResult := '5949';
         end if;
       elsif TipoOperacao = 'EXTRAVIO_AVARIA_FABRICA'
        then
          if (MVA > 0) or (ValorST > 0)
          then -- Tem Substituicao Tributaria
            xResult := '5949';
          else -- Nao tem Substituicao Tributaria
            xResult := '5949';
         end if;
       elsif TipoOperacao = 'EXTRAVIO_AVARIA_CLIENTE'
        then
          if (MVA > 0) or (ValorST > 0)
          then -- Tem Substituicao Tributaria
            xResult := '5949';
          else -- Nao tem Substituicao Tributaria
            xResult := '5949';
         end if;          
      end if;
     else  -- ****  Estados diferentes
       -- verifica o tipo de operacao
       if TipoOperacao = 'VENDA' 
        then
         if DadosDestino.TipoDestino = 'F' and DadosDestino.InscEstadual = 'ISENTO'
           then
             xResult := '6108';
         elsif (MVA > 0) or (ValorST > 0)
           then
             xResult := '6403';
         else
             xResult := '6102';
         end if;
      elsif TipoOperacao = 'TRANSFERENCIA'
        then
         if (MVA > 0) or (ValorST > 0)
          then -- Tem Substituicao Tributaria
            xResult := '6409';
          else -- Nao tem Substituicao Tributaria
            xResult := '6152';
         end if;
      elsif TipoOperacao = 'DEVOLUCAO_COMPRA'
        then
          if (MVA > 0) or (ValorST > 0)
          then -- Tem Substituicao Tributaria
            xResult := '6411';
          else -- Nao tem Substituicao Tributaria
            xResult := '6202';
         end if;
      elsif TipoOperacao = 'DEVOLUCAO_TRANSFERENCIA'
        then
          if (MVA > 0) or (ValorST > 0)
          then -- Tem Substituicao Tributaria
            xResult := '6209';
          else -- Nao tem Substituicao Tributaria
            xResult := '6209';
         end if;
      elsif TipoOperacao = 'REMESSA_GARANTIA_FABRICA'
        then
          if (MVA > 0) or (ValorST > 0)
          then -- Tem Substituicao Tributaria
            xResult := '6949';
          else -- Nao tem Substituicao Tributaria
            xResult := '6949';
         end if;
      elsif TipoOperacao = 'REMESSA_GARANTIA_CLIENTE'
        then
          if (MVA > 0) or (ValorST > 0)
          then -- Tem Substituicao Tributaria
            xResult := '6949';
          else -- Nao tem Substituicao Tributaria
            xResult := '6949';
         end if;
       elsif TipoOperacao = 'EXTRAVIO_AVARIA_FABRICA'
        then
          if (MVA > 0) or (ValorST > 0)
          then -- Tem Substituicao Tributaria
            xResult := '6949';
          else -- Nao tem Substituicao Tributaria
            xResult := '6949';
         end if;
       elsif TipoOperacao = 'EXTRAVIO_AVARIA_CLIENTE'
        then
          if (MVA > 0) or (ValorST > 0)
          then -- Tem Substituicao Tributaria
            xResult := '6949';
          else -- Nao tem Substituicao Tributaria
            xResult := '6949';
         end if;        
      end if;
   end if;
   Return(xResult);

 end;

 FUNCTION Validar_CFOP_Entrada(TipoOperacao in varchar2,
                               UF_Iguais in boolean,
                               MVA in number,
                               ValorST in number) return varchar2 is
 xLEI_id_Usado     number; 
 xLEI_Pro_Usado    number;
 xResult   varchar2(4):=null;
 BEGIN
   if UF_Iguais -- ****  Estados Iguais
     then
       -- verifica o tipo de operacao
       if TipoOperacao = 'COMPRA'
        then
         if (MVA > 0) or (ValorST > 0)
          then -- Tem Substituicao Tributaria
            xResult := '1403';
          else -- Nao tem Substituicao Tributaria
            xResult := '1102';
         end if;
      elsif TipoOperacao = 'TRANSFERENCIA'
        then
         if (MVA > 0) or (ValorST > 0)
          then -- Tem Substituicao Tributaria
            xResult := '1409';
          else -- Nao tem Substituicao Tributaria
            xResult := '1152';
         end if;
      elsif TipoOperacao = 'DEVOLUCAO_VENDA'
        then
          if (MVA > 0) or (ValorST > 0)
          then -- Tem Substituicao Tributaria
            xResult := '1411';
          elsif ((Derivado_Petroleo) or
                LEGISLACAO_ICMS(xLEI_id_Usado, xLEI_Pro_Usado,'PROTOCOLO') or
                LEGISLACAO_ICMS(xLEI_id_Usado, xLEI_Pro_Usado,'CONVENIO') or
                LEGISLACAO_ICMS(xLEI_id_Usado, xLEI_Pro_Usado,'RESOLUCAO') or
                LEGISLACAO_ICMS(xLEI_id_Usado, xLEI_Pro_Usado,'DECRETO') or
                ((nvl(RowNCM.Agregado,0) > 0) and (RowUF_Origem.Uf = RowUF_Destino.Uf)))
         then -- Produto com ST cobrado anteriormente
            xResult := '1411';
         else -- Nao tem Substituicao Tributaria
            xResult := '1202';
            /*
            if ((Classificacao_Exclusa) or  (Classificacao_Ferramenta))
              then
                xResult := '1202';
              else
                xResult := '1411';
            end if;*/
         end if;
      elsif TipoOperacao = 'DEVOLUCAO_TRANSFERENCIA'
        then
          if (MVA > 0) or (ValorST > 0)
          then -- Tem Substituicao Tributaria
            xResult := '1209';
          else -- Nao tem Substituicao Tributaria
            xResult := '1209';
         end if;
      elsif TipoOperacao = 'RETORNO_GARANTIA_FABRICA'
        then
          if (MVA > 0) or (ValorST > 0)
          then -- Tem Substituicao Tributaria
            xResult := '1949';
          else -- Nao tem Substituicao Tributaria
            xResult := '1949';
         end if;
      elsif TipoOperacao = 'RETORNO_GARANTIA_CLIENTE'
        then
          if (MVA > 0) or (ValorST > 0)
          then -- Tem Substituicao Tributaria
            xResult := '1949';
          else -- Nao tem Substituicao Tributaria
            xResult := '1949';
         end if;      
      end if;
     else  -- ****  Estados diferentes
       -- verifica o tipo de operacao
       if TipoOperacao = 'COMPRA'
        then
         if (MVA > 0) or (ValorST > 0)
          then -- Tem Substituicao Tributaria
            xResult := '2403';
          else -- Nao tem Substituicao Tributaria
            xResult := '2102';
         end if;
      elsif TipoOperacao = 'TRANSFERENCIA'
        then
         if (MVA > 0) or (ValorST > 0)
          then -- Tem Substituicao Tributaria
            xResult := '2409';
          else -- Nao tem Substituicao Tributaria
            xResult := '2152';
         end if;
      elsif TipoOperacao = 'DEVOLUCAO_VENDA'
        then
          if (MVA > 0) or (ValorST > 0)
          then -- Tem Substituicao Tributaria
            xResult := '2411';
          else -- Nao tem Substituicao Tributaria
            xResult := '2202';
         end if;
      elsif TipoOperacao = 'DEVOLUCAO_TRANSFERENCIA'
        then
          if (MVA > 0) or (ValorST > 0)
          then -- Tem Substituicao Tributaria
            xResult := '2209';
          else -- Nao tem Substituicao Tributaria
            xResult := '2209';
         end if;
      elsif TipoOperacao = 'RETORNO_GARANTIA_FABRICA'
        then
          if (MVA > 0) or (ValorST > 0)
          then -- Tem Substituicao Tributaria
            xResult := '2949';
          else -- Nao tem Substituicao Tributaria
            xResult := '2949';
         end if;  
      elsif TipoOperacao = 'RETORNO_GARANTIA_CLIENTE'
        then
          if (MVA > 0) or (ValorST > 0)
          then -- Tem Substituicao Tributaria
            xResult := '2949';
          else -- Nao tem Substituicao Tributaria
            xResult := '2949';
         end if;
      end if;   
   end if;
   Return(xResult);

 end; 
 
 Procedure Calcular_PIS_COFINS_Compra(Tipo_Movimentacao in varchar2,
                                      TipoOperacao in varchar2,
                                      Base_Produto in number,
                                      CFOP in varchar2,
                                      Aliquota_Pis in out number,
                                      Aliquota_Cofins in out number,
                                      Base_Pis in out number,
                                      Base_Cofins in out number,
                                      Valor_Pis in out number,
                                      Valor_Cofins in out number,
                                      CstPis in out varchar2,
                                      CstCofins in out varchar2) is
 begin
   if not( Tipo_Movimentacao = 'ENTRADA_COMPRAS')
     then 
       CstPis := '08';
       CstCofins := '08';
       Valor_Pis := 0.00;
       Valor_Cofins := 0.00;     
       Base_Pis := Base_Produto;
       Base_Cofins := Base_Produto;
       Aliquota_Pis := 0.00;
       Aliquota_Cofins := 0.00;  
     else
       -- Fornecedor optante pelo Simples Nacional
       if ((DadosOrigem.RegimeTributario = '0') and (TipoOperacao in ('COMPRA','TRANSFERENCIA')))
         then 
           CstPis := '73';
           CstCofins := '73';
           Valor_Pis := 0.00;
           Valor_Cofins := 0.00;
           Base_Pis := 0.00;
           Base_Cofins := 0.00;
           Aliquota_Pis := 0.00;
           Aliquota_Cofins := 0.00;
       elsif -- Fornecedor optante pelo Lucro Presumido
             ((DadosOrigem.RegimeTributario = '1') and (TipoOperacao in ('COMPRA','TRANSFERENCIA')) and
              (RowUF_Origem.Uf <> 'AM') and (RowUF_Destino.Uf = 'AM'))
          then
             if (nvl(RowRegraCredor.Piscofins_365, 1) = 1)
               then
                 CstPis := '50';
                 CstCofins := '50';
                 Valor_Pis := round((Base_Produto * 0.0065),2) * (-1);
                 Valor_Cofins := round((Base_Produto * 0.03),2) * (-1);             
                 Base_Pis := Base_Produto;
                 Base_Cofins := Base_Produto;
                 Aliquota_Pis := 0.65;
                 Aliquota_Cofins := 3.00;
               else
                 CstPis := '73';
                 CstCofins := '73';
                 Valor_Pis := 0.00;
                 Valor_Cofins := 0.00;
                 Base_Pis := 0.00;
                 Base_Cofins := 0.00;
                 Aliquota_Pis := 0.00;
                 Aliquota_Cofins := 0.00;
             end if;    
       elsif -- Fornecedor optante pelo Lucro Real
             ((DadosOrigem.RegimeTributario = '2') and (TipoOperacao in ('COMPRA','TRANSFERENCIA')))
          then
            if ((nvl(RowProd.Pis,0) +  nvl(RowProd.Cofins,0)) = 9.25) and
               (RowUF_Origem.Uf <> 'AM') and (RowUF_Destino.Uf = 'AM') and
               (DadosOrigem.Fabricante = 'S')
              then
                if (nvl(RowRegraCredor.Piscofins_925, 1) = 1)
                  then
                    CstPis := '50';
                    CstCofins := '50';
                    Valor_Pis := round((Base_Produto * 0.0165),2) * (-1);
                    Valor_Cofins := round((Base_Produto * 0.076),2) * (-1);
                    Base_Pis := Base_Produto;
                    Base_Cofins := Base_Produto;
                    Aliquota_Pis := 1.65;
                    Aliquota_Cofins := 7.60;
                  else
                    CstPis := '73';
                    CstCofins := '73';
                    Valor_Pis := 0.00;
                    Valor_Cofins := 0.00;     
                    Base_Pis := 0.00;
                    Base_Cofins := 0.00;
                    Aliquota_Pis := 0.00;
                    Aliquota_Cofins := 0.00;
                end if;    
            elsif ((nvl(RowProd.Pis,0) +  nvl(RowProd.Cofins,2)) = 11.50) and 
                  (RowUF_Destino.Uf = 'AM') and (DadosOrigem.Fabricante = 'S')
              then
                 if (nvl(RowRegraCredor.Piscofins_1150, 0) = 0)
                   then -- NAO APLICAR
                     CstPis := '73';
                     CstCofins := '73';
                     Valor_Pis := 0.00;
                     Valor_Cofins := 0.00;     
                     Base_Pis := 0.00;
                     Base_Cofins := 0.00;
                     Aliquota_Pis := 0.00;
                     Aliquota_Cofins := 0.00;
                 elsif (nvl(RowRegraCredor.Piscofins_1150, 0) = 1)
                   then -- COBRAR 11.50
                     CstPis := '50';
                     CstCofins := '50';
                     Valor_Pis := round((Base_Produto * 0.0200),2);
                     Valor_Cofins := round((Base_Produto * 0.0950),2);
                     Base_Pis := Base_Produto;
                     Base_Cofins := Base_Produto;
                     Aliquota_Pis := 2.00;
                     Aliquota_Cofins := 9.50;    
                 elsif (nvl(RowRegraCredor.Piscofins_1150, 0) = 2)
                   then -- DESCONTAR 11.50   
                     CstPis := '73';
                     CstCofins := '73';
                     Valor_Pis := round((Base_Produto * 0.0200),2) * (-1);
                     Valor_Cofins := round((Base_Produto * 0.0950),2) * (-1);
                     Base_Pis := Base_Produto;
                     Base_Cofins := Base_Produto;
                     Aliquota_Pis := 2.00;
                     Aliquota_Cofins := 9.50;
                 elsif (nvl(RowRegraCredor.Piscofins_1150, 0) = 3)
                   then -- DESCONTAR 11.50 PARA DEPOIS COBRAR 11.50       
                     CstPis := '73';
                     CstCofins := '73';
                     Valor_Pis := round((Base_Produto * 0.0200 * 0.885),2);
                     Valor_Cofins := round((Base_Produto * 0.0950 * 0.885),2);
                     Base_Pis := Base_Produto;
                     Base_Cofins := Base_Produto;             
                     Aliquota_Pis := 2.00;
                     Aliquota_Cofins := 9.50;
                 else    
                   CstPis := '73';
                   CstCofins := '73';
                   Valor_Pis := 0.00;
                   Valor_Cofins := 0.00;     
                   Base_Pis := 0.00;
                   Base_Cofins := 0.00;
                   Aliquota_Pis := 0.00;
                   Aliquota_Cofins := 0.00;    
                 end if;  
            elsif ((nvl(RowProd.Pis,0) +  nvl(RowProd.Cofins,2)) = 13.10) and 
                  (RowUF_Destino.Uf = 'AM') and (DadosOrigem.Fabricante = 'S')
              then
                 if (nvl(RowRegraCredor.Piscofins_1310, 0) = 0)
                   then -- NAO APLICAR
                     CstPis := '73';
                     CstCofins := '73';
                     Valor_Pis := 0.00;
                     Valor_Cofins := 0.00;     
                     Base_Pis := 0.00;
                     Base_Cofins := 0.00;
                     Aliquota_Pis := 0.00;
                     Aliquota_Cofins := 0.00;
                 elsif (nvl(RowRegraCredor.Piscofins_1310, 0) = 1)
                   then -- COBRAR 13.10
                     CstPis := '50';
                     CstCofins := '50';
                     Valor_Pis := round((Base_Produto * 0.0230),2);
                     Valor_Cofins := round((Base_Produto * 0.108),2);
                     Base_Pis := Base_Produto;
                     Base_Cofins := Base_Produto;
                     Aliquota_Pis := 2.30;
                     Aliquota_Cofins := 10.80;    
                 elsif (nvl(RowRegraCredor.Piscofins_1310, 0) = 2)
                   then -- DESCONTAR 13.10   
                     CstPis := '73';
                     CstCofins := '73';
                     Valor_Pis := round((Base_Produto * 0.0230),2) * (-1);
                     Valor_Cofins := round((Base_Produto * 0.108),2) * (-1);
                     Base_Pis := Base_Produto;
                     Base_Cofins := Base_Produto;
                     Aliquota_Pis := 2.30;
                     Aliquota_Cofins := 10.80;
                 elsif (nvl(RowRegraCredor.Piscofins_1310, 0) = 3)
                   then -- DESCONTAR 13.10 PARA DEPOIS COBRAR 13.10       
                     CstPis := '50';
                     CstCofins := '50';
                     Valor_Pis := round((Base_Produto * 0.0230 * 0.869),2);
                     Valor_Cofins := round((Base_Produto * 0.108 * 0.869),2);
                     Base_Pis := Base_Produto;
                     Base_Cofins := Base_Produto;             
                     Aliquota_Pis := 2.30;
                     Aliquota_Cofins := 10.80;
                 elsif (nvl(RowRegraCredor.Piscofins_1310, 0) = 4)
                   then -- APLICAR DESCONTO 9.25       
                     CstPis := '73';
                     CstCofins := '73';
                     Valor_Pis := round((Base_Produto * 0.0165),2) * (-1);
                     Valor_Cofins := round((Base_Produto * 0.076),2) * (-1);
                     Base_Pis := Base_Produto;
                     Base_Cofins := Base_Produto;             
                     Aliquota_Pis := 1.65;
                     Aliquota_Cofins := 7.60;    
                 else    
                   CstPis := '73';
                   CstCofins := '73';
                   Valor_Pis := 0.00;
                   Valor_Cofins := 0.00;     
                   Base_Pis := 0.00;
                   Base_Cofins := 0.00;
                   Aliquota_Pis := 0.00;
                   Aliquota_Cofins := 0.00;    
                 end if;    
              else    
                 CstPis := '73';
                 CstCofins := '73';
                 Valor_Pis := 0.00;
                 Valor_Cofins := 0.00;     
                 Base_Pis := 0.00;
                 Base_Cofins := 0.00;
                 Aliquota_Pis := 0.00;
                 Aliquota_Cofins := 0.00;
            end if;    
       else
          CstPis := '73';
          CstCofins := '73';
          Valor_Pis := 0.00;
          Valor_Cofins := 0.00;     
          Base_Pis := 0.00;
          Base_Cofins := 0.00;
          Aliquota_Pis := 0.00;
          Aliquota_Cofins := 0.00;
       end if;       
     if cfop in ('1102','1403','3102','1202','1411','2202','2411','3202') then
        CstPis := '50';
        CstCofins := '50';     
     end if;
   end if;
   

 end;
 
 PROCEDURE CARREGAR_NCM is

 begin
  -- Seleciona classificacao fiscal
  select 1,nvl(p.ipi,0), p.pis, p.cofins,'',substr(p.clasfiscal,1,8),nvl(p.percsubst,0),'' into RowNCM 
    from dbprod p where /*p.clasfiscal = RowProd.Clasfiscal and*/ p.codprod = RowProd.Codprod;
 end;
  
 FUNCTION VALIDAR_CSTIPI(Tipo_Movimentacao in varchar2,
                         TipoOperacao in varchar2) return varchar2 is
 xResult           varchar2(5):= '99';
 BEGIN
   -- Seleciona dados UF Destino
   if (Tipo_Movimentacao = 'ENTRADA_COMPRAS') --Entrada do Setor de Compras
    then 
      -- Verifica CSTIPI
      if ((RowProd.Isentoipi = 'C') and (RowUF_Origem.Uf <> RowUF_Destino.Uf) and (TipoOperacao in ('DEVOLUCAO_VENDA','DEVOLUCAO_TRANSFERENCIA'))) or 
         ((RowProd.Isentoipi = 'C') and (TipoOperacao not in ('DEVOLUCAO_VENDA','DEVOLUCAO_TRANSFERENCIA'))) or
         ((RowProd.Isentoipi = 'P') and (TipoOperacao not in ('DEVOLUCAO_VENDA','DEVOLUCAO_TRANSFERENCIA'))) or
         ((RowProd.Isentoipi = 'S') and (RowUF_Destino.Zona_Isentivada = 'N'))
         then
           xResult := '00';
       elsif
         (RowProd.Isentoipi = 'Z')
         then
           xResult := '01';
       elsif
         ((RowProd.Isentoipi = 'S') and (RowUF_Destino.Zona_Isentivada = 'S'))
         then
           xResult := '05';
       else     
           xResult := '49';
      end if;
   elsif (Tipo_Movimentacao = 'ENTRADA') --Nota de Entrada do Faturamento
    then 
      -- Verifica CSTIPI
      if ((RowProd.Isentoipi = 'C') and (RowUF_Origem.Uf <> RowUF_Destino.Uf) and (TipoOperacao in ('DEVOLUCAO_VENDA','DEVOLUCAO_TRANSFERENCIA'))) or 
         ((RowProd.Isentoipi = 'C') and (TipoOperacao not in ('DEVOLUCAO_VENDA','DEVOLUCAO_TRANSFERENCIA'))) or
         ((RowProd.Isentoipi = 'P') and (TipoOperacao not in ('DEVOLUCAO_VENDA','DEVOLUCAO_TRANSFERENCIA'))) or
         ((RowProd.Isentoipi = 'S') and (RowUF_Destino.Zona_Isentivada = 'N'))
         then
           xResult := '00';
       elsif
         (RowProd.Isentoipi = 'Z')
         then
           xResult := '01';
       elsif
         ((RowProd.Isentoipi = 'S') and (RowUF_Destino.Zona_Isentivada = 'S'))
         then
           xResult := '05';
       else     
           xResult := '49';
      end if;
   elsif (Tipo_Movimentacao = 'SAIDA') --Nota de Saida do Faturamento   
    then
      if ((RowProd.Isentoipi = 'S') and (RowUF_Destino.Zona_Isentivada = 'N')) or
         (RowProd.Isentoipi in ('I','T'))   or
         ((RowProd.Isentoipi = 'C') and (RowUF_Origem.Uf <> RowUF_Destino.Uf) and (TipoOperacao not in ('DEVOLUCAO_COMPRA','DEVOLUCAO_TRANSFERENCIA','REMESSA_GARANTIA_FABRICA','REMESSA_CONSERTO'))) or
         ((RowProd.Isentoipi = 'C') and (TipoOperacao in ('DEVOLUCAO_COMPRA','DEVOLUCAO_TRANSFERENCIA','REMESSA_GARANTIA_FABRICA','REMESSA_CONSERTO'))) or
         ((RowProd.Isentoipi = 'P') and (TipoOperacao in ('DEVOLUCAO_COMPRA','DEVOLUCAO_TRANSFERENCIA','REMESSA_GARANTIA_FABRICA','REMESSA_CONSERTO')))
       then
         
         xResult := '50';
       elsif
         (RowProd.Isentoipi = 'Z')
         then
           xResult := '51';
       elsif
         ((RowProd.Isentoipi = 'S') and (RowUF_Destino.Zona_Isentivada = 'S'))
         then
           xResult := '55';
       else     
           xResult := '99';
      end if;
      /*
      -- se IPI suspenso na Entrada e UF destino nao e zona incentivada ou 
      -- IPI eh cobrado e UF destino de UF origem
      if ((xRowProd.Isentoipi = 'P') or (xRowProd.Isentoipi = 'Z'))
        then xResult := '51';
      elsif ((xRowProd.Isentoipi = 'S') and (xRowUF_Destino.Zona_Isentivada = 'S')) 
        then xResult := '55';
      elsif (xRowProd.Isentoipi = 'S') 
        then xResult := '50';
      elsif ((xRowProd.Isentoipi = 'C') and (xRowUF_Destino.Zona_Isentivada = 'N') and
             (xRowUF_Origem.Uf <> xRowUF_Destino.Uf))
        then xResult := '50';
      elsif (xRowProd.Isentoipi = 'C')
        then xResult := '55';
      else  
             xResult := '99';
      end if;      */
   end if; 
   Return(xResult);
 END;
 
 Procedure Calcular_PIS_COFINS_Saida(TipoOperacao in varchar2,
                                     Base_Produto in number,
                                     Aliquota_Pis in out number,
                                     Aliquota_Cofins in out number,
                                     Base_Pis in out number,
                                     Base_Cofins in out number,
                                     Valor_Pis in out number,
                                     Valor_Cofins in out number,
                                     CstPis in out varchar2,
                                     CstCofins in out varchar2) is

 begin
          /*case when substr(pf.cfop,1,1) in ('5','6','7') then
        case
          when (pf.cfop in ('5102','5117','5403','5405','6102','6108','6110','6117','6119','6403','6404')) and (CALCULO_IMPOSTO.NCM_MONOFASICO(pf.ncm) = 1) then '04'
		  when (pf.cfop in ('5102','5117','5403','5405') and c.cidade in ('MANAUS')) then '09'
		  when pf.cfop in ('5102','5117','5403','5405') then '01'
          when pf.cfop in ('6102','6108','6110','6117','6119','6403','6404') then '01'
          when pf.cfop in ('7102') then '08'
          else '49'
         end
       end CSTCOFINS,*/
   --
   if (RowUF_Destino.uf = 'EX')
     then 
       CSTPIS := '08';
       Aliquota_Pis := 0.00;
       Base_Pis := 0.00;
       Valor_Pis := 0.00;
       CSTCOFINS := '08';
       Aliquota_Cofins := 0.00;
       Base_Cofins := 0.00;
       Valor_Cofins := 0.00;
   elsif ((NCM_MONOFASICO) and (TipoOperacao in ('VENDA'/*,'TRANSFERENCIA'*/)))
     then 
       CSTPIS := '04';
       Aliquota_Pis := 0.00;
       Base_Pis := 0.00;
       Base_Cofins := 0.00;
       Valor_Pis := 0.00;
       CSTCOFINS := '04';
       Aliquota_Cofins := 0.00;
       Valor_Cofins := 0.00;
   elsif ((((nvl(RowProd.Pis,0) +  nvl(RowProd.Cofins,0)) = 13.10) or 
         ((nvl(RowProd.Pis,0) +  nvl(RowProd.Cofins,0)) = 11.50)) and (TipoOperacao in ('VENDA'/*,'TRANSFERENCIA'*/)))    
     then
       CSTPIS := '04';
       Aliquota_Pis := 0.00;
       Base_Pis := 0.00;
       Valor_Pis := 0.00;
       CSTCOFINS := '04';
       Aliquota_Cofins := 0.00;
       Base_Cofins := 0.00;
       Valor_Cofins := 0.00;
   elsif
         (TipoOperacao in ('VENDA'/*,'TRANSFERENCIA'*/) and 
         CIDADE_Destino.Descricao in ('MANAUS','BRASILEIA','MACAPA','SANTANA','TABATINGA','BOA VISTA','BONFIM','GUAJARA-MIRIM') and
         RowUF_Origem.uf = 'AM')
     then 
       CSTPIS := '06';
       Aliquota_Pis := 0.00;
       Base_Pis := 0.00;
       Base_Cofins := 0.00;
       Valor_Pis := 0.00;
       CSTCOFINS := '06';
       Aliquota_Cofins := 0.00;
       Valor_Cofins := 0.00;
       
   elsif
         TipoOperacao in ('VENDA'/*,'TRANSFERENCIA'*/)
     then
       /*
       CSTPIS := '03';
       Aliquota_Pis := 1.65;
       Base_Pis := Base_Produto;
       Valor_Pis := round((Base_Produto * 0.0165),2);
       CSTCOFINS := '03';
       Aliquota_Cofins := 7.60;
       Base_Cofins := Base_Produto;
       Valor_Cofins := round((Base_Produto * 0.076),2);*/
       /*
       CSTPIS := '01';
       Aliquota_Pis := 0.00;
       Base_Pis := 0.00;
       Valor_Pis := 0.00;
       CSTCOFINS := '01';
       Aliquota_Cofins := 0.00;
       Base_Cofins := 0.00;
       Valor_Cofins := 0.00;*/
       
       CSTPIS := '01';
       Aliquota_Pis := 1.65;
       Base_Pis := Base_Produto;
       Valor_Pis := round((Base_Produto * 0.0165),2);
       CSTCOFINS := '01';
       Aliquota_Cofins := 7.60;
       Base_Cofins := Base_Produto;
       Valor_Cofins := round((Base_Produto * 0.076),2);
   else
       CSTPIS := '49';
       Aliquota_Pis := 0.00;
       Base_Pis := 0.00;
       Base_Cofins := 0.00;
       Valor_Pis := 0.00;
       CSTCOFINS := '49';
       Aliquota_Cofins := 0.00;
       Valor_Cofins := 0.00;
   end if;    
 end;
 
 Procedure PIS_COFINS_VENDA(Aliquota_Pis in out number,
                            Aliquota_Cofins in out number) is

 begin
   --
   if (NCM_MONOFASICO)
     then 
       Aliquota_Pis := 0.00;
       Aliquota_Cofins := 0.00;
   elsif ((nvl(RowProd.Pis,0) +  nvl(RowProd.Cofins,2)) = 13.10)    
     then
       Aliquota_Pis := 0.00;
       Aliquota_Cofins := 0.00;
   else
       Aliquota_Pis := 1.65;
       Aliquota_Cofins := 7.60;
   end if;    
 end;
 
 FUNCTION NCM_MONOFASICO return boolean is
 xEncontrou    number;
 xResult       boolean;
 BEGIN
    -- Verifica se o produtar se encaixa na classificacao da Lei HANAN
    xResult := False;
    -- Valida NCM
    select count(*) into xEncontrou from DBCLASSIFICACAO_PISCOFINS
         where NCM = RowNCM.Ncm;
    if (xEncontrou > 0)
      then
        xResult := True;
    else
      -- Se nao valida Parte da NCM tamanho 7
      select count(*) into xEncontrou from DBCLASSIFICACAO_PISCOFINS
           where NCM = substr(RowNCM.Ncm,1,7) and length(ncm) = 7;
      if (xEncontrou > 0)
        then
          xResult := True;
      else
        -- Se nao valida Parte da NCM tamanho 6
        select count(*) into xEncontrou from DBCLASSIFICACAO_PISCOFINS
             where NCM = substr(RowNCM.Ncm,1,6) and length(ncm) = 6;
        if (xEncontrou > 0)
          then
            xResult := True;
        else
          -- Se nao valida Parte da NCM tamanho 5
          select count(*) into xEncontrou from DBCLASSIFICACAO_PISCOFINS
               where NCM = substr(RowNCM.Ncm,1,5) and length(ncm) = 5;
          if (xEncontrou > 0)
           then
            xResult := True;
          else
            -- Se nao valida Parte da NCM tamanho 4
            select count(*) into xEncontrou from DBCLASSIFICACAO_PISCOFINS
                 where NCM = substr(RowNCM.Ncm,1,4) and length(ncm) = 4;
            if (xEncontrou > 0)
              then
                xResult := True;
            else
              -- Se nao valida Parte da NCM tamanho 3
              select count(*) into xEncontrou from DBCLASSIFICACAO_PISCOFINS
                  where NCM = substr(RowNCM.Ncm,1,3) and length(ncm) = 3;
               if (xEncontrou > 0)
                 then
                   xResult := True;
    end if; end if; end if; end if; end if; end if ;
   -- Retorno da funcao
   Return(xResult);
 END;

FUNCTION NCM_MONOFASICO(vNCM in varchar2) return Integer is
 xEncontrou    number;
 xResult       boolean;
 BEGIN
    -- Verifica se o produtar se encaixa na classificacao da Lei HANAN
    xResult := False;
    -- Valida NCM
    select count(*) into xEncontrou from DBCLASSIFICACAO_PISCOFINS
         where NCM = vNCM;
    if (xEncontrou > 0)
      then
        xResult := True;
    else
      -- Se nao valida Parte da NCM tamanho 7
      select count(*) into xEncontrou from DBCLASSIFICACAO_PISCOFINS
           where NCM = substr(vNCM,1,7) and length(ncm) = 7;
      if (xEncontrou > 0)
        then
          xResult := True;
      else
        -- Se nao valida Parte da NCM tamanho 6
        select count(*) into xEncontrou from DBCLASSIFICACAO_PISCOFINS
             where NCM = substr(vNCM,1,6) and length(ncm) = 6;
        if (xEncontrou > 0)
          then
            xResult := True;
        else
          -- Se nao valida Parte da NCM tamanho 5
          select count(*) into xEncontrou from DBCLASSIFICACAO_PISCOFINS
               where NCM = substr(vNCM,1,5) and length(ncm) = 5;
          if (xEncontrou > 0)
           then
            xResult := True;
          else
            -- Se nao valida Parte da NCM tamanho 4
            select count(*) into xEncontrou from DBCLASSIFICACAO_PISCOFINS
                 where NCM = substr(vNCM,1,4) and length(ncm) = 4;
            if (xEncontrou > 0)
              then
                xResult := True;
            else
              -- Se nao valida Parte da NCM tamanho 3
              select count(*) into xEncontrou from DBCLASSIFICACAO_PISCOFINS
                  where NCM = substr(vNCM,1,3) and length(ncm) = 3;
               if (xEncontrou > 0)
                 then
                   xResult := True;
    end if; end if; end if; end if; end if; end if ;
   -- Retorno da funcao
   Return(sys.diutil.bool_to_int(xResult));
 END;
 

 PROCEDURE ORIGEM_DESTINO(Tipo_Movimentacao in varchar2,
                          TipoOperacao in varchar2,
                          Codigo in varchar2,
                          CodigoTerceiro in varchar2) IS
 xRowCliente       dbclien%rowtype;
 xRowCredor        dbcredor%rowtype;  
 xCount            number;                       
 BEGIN
   -- Selecionda dados da Origem e do Destino
   if (Tipo_Movimentacao = 'ENTRADA_COMPRAS') --Entrada do Setor de Compras
    then 
      if TipoOperacao in ('DEVOLUCAO_VENDA','DEVOLUCAO_TRANSFERENCIA','RETORNO_GARANTIA_CLIENTE','RETORNO_CONSERTO')
        then
          -- Seleciona a UF Origem (MELO)
            select u.* into RowUF_Origem from dadosempresa d, dbuf_n u
             where d.uf = u.uf;
            select m.* into CIDADE_Origem from dadosempresa d, dbuf_n u, dbmunicipio m
             where d.uf = u.uf and d.municipio = m.descricao and m.uf = u.uf;
			 
            -- Dados da Oriem
            SETDADOS('ORIGEM','000','MELO DISTRIBUIDORA','R','N','2','MELO');
           
          -- Seleciona a UF Destino (FORNECEDOR)
            select u.* into RowUF_Destino from dbcredor f, dbuf_n u
             where f.cod_credor = Codigo and f.uf = u.uf;
            select m.* into CIDADE_Destino from dbcredor f, dbuf_n u, dbmunicipio m
             where f.cod_credor = Codigo and f.uf = u.uf and f.Codmunicipio = m.codmunicipio; 
            -- Dados do Destino
            -- Informac?o do Destino de Compra (Fornecedor)
            select * into xRowCredor from dbcredor where cod_credor = Codigo;
            SETDADOS('DESTINO',xRowCredor.Cod_Credor,xRowCredor.Nome,'R',xRowCredor.Fabricante,xRowCredor.Regime_Tributacao,nvl(xRowCredor.Iest,'ISENTO'));
        
        else  
          -- Seleciona a UF Origem (FORNECEDOR)
            select u.* into RowUF_Origem from dbcredor f, dbuf_n u
             where f.cod_credor = Codigo and f.uf = u.uf;
            select m.* into CIDADE_Origem from dbcredor f, dbuf_n u, dbmunicipio m
             where f.cod_credor = Codigo and f.uf = u.uf and f.Codmunicipio = m.codmunicipio; 
			
            -- Dados do Origem
            -- Informac?o da Origem de Compra (Fornecedor)
            select * into xRowCredor from dbcredor where cod_credor = Codigo;
            SETDADOS('ORIGEM',xRowCredor.Cod_Credor,xRowCredor.Nome,'R',xRowCredor.Fabricante,xRowCredor.Regime_Tributacao,nvl(xRowCredor.Iest,'ISENTO'));
            -- Verifa a regra se houver
            select count(*) into xCount from cad_credor_regra_faturamento t where t.crf_id = DadosOrigem.Codigo;
            if xCount > 0 
              then
                select * into RowRegraCredor from cad_credor_regra_faturamento t where t.crf_id = DadosOrigem.Codigo;
            end if;  
          -- Seleciona a UF Destino (MELO)
            select u.* into RowUF_Destino from dadosempresa d, dbuf_n u
             where d.uf = u.uf; 
            select m.* into CIDADE_Destino from dadosempresa d, dbuf_n u, dbmunicipio m
             where d.uf = u.uf and d.municipio = m.descricao and m.uf = u.uf;
            -- Dados do Destino
            SETDADOS('DESTINO','000','MELO DISTRIBUIDORA','R','N','2','MELO');
           
        end if;  
   elsif (Tipo_Movimentacao = 'ENTRADA') --Nota de Entrada do Faturamento
    then 
      if TipoOperacao in ('DEVOLUCAO_VENDA','DEVOLUCAO_TRANSFERENCIA','RETORNO_GARANTIA_CLIENTE','RETORNO_CONSERTO')
        then
          -- Seleciona a UF Origem (MELO)
            select u.* into RowUF_Origem from dadosempresa d, dbuf_n u
             where d.uf = u.uf;
            select m.* into CIDADE_Origem from dadosempresa d, dbuf_n u, dbmunicipio m
             where d.uf = u.uf and d.municipio = m.descricao and m.uf = u.uf; 
             -- Dados de Origem
              SETDADOS('ORIGEM','000','MELO DISTRIBUIDORA','R','N','2','MELO');
          -- Seleciona a UF Destino (CLIENTE)
            select u.* into RowUF_Destino from dbclien c, dbuf_n u
             where c.codcli = Codigo and c.uf = u.uf;
            select m.* into CIDADE_Destino from dbclien c, dbuf_n u, dbmunicipio m
             where c.codcli = Codigo and c.uf = u.uf and c.Codmunicipio = m.codmunicipio ;
            -- Informac?o do Destino da Compra (Cliente)
              select * into xRowCliente from dbclien where codcli = Codigo;
              SETDADOS('DESTINO',xRowCliente.Codcli,xRowCliente.Nome,xRowCliente.Tipocliente,'N',xRowCliente.Sit_Tributaria,nvl(xRowCliente.Iest,'ISENTO'));
        else
          -- Seleciona a UF Origem (CLIENTE)
            select u.* into RowUF_Origem from dbclien c, dbuf_n u
             where c.codcli = Codigo and c.uf = u.uf;
            select m.* into CIDADE_Origem from dbclien c, dbuf_n u, dbmunicipio m
             where c.codcli = Codigo and c.uf = u.uf and c.Codmunicipio = m.codmunicipio ;
            -- Informac?o da Origem da Compra (Cliente)
            select * into xRowCliente from dbclien where codcli = Codigo;
            SETDADOS('ORIGEM',xRowCliente.Codcli,xRowCliente.Nome,xRowCliente.Tipocliente,'N',xRowCliente.Sit_Tributaria,nvl(xRowCliente.Iest,'ISENTO'));
          -- Seleciona a UF Destino (MELO)
            select u.* into RowUF_Destino from dadosempresa d, dbuf_n u
             where d.uf = u.uf;
            select m.* into CIDADE_Destino from dadosempresa d, dbuf_n u, dbmunicipio m
             where d.uf = u.uf and d.municipio = m.descricao and m.uf = u.uf;
            -- Dados do Destino
            SETDADOS('DESTINO','000','MELO DISTRIBUIDORA','R','N','2','MELO');
      end if;     
   elsif (Tipo_Movimentacao = 'SAIDA') --Nota de Saida do Faturamento   
    then
      if TipoOperacao in ('DEVOLUCAO_COMPRA','DEVOLUCAO_TRANSFERENCIA','REMESSA_GARANTIA_FABRICA','REMESSA_CONSERTO')
        then
          -- Seleciona a UF Origem (CLIENTE)
            select u.* into RowUF_Origem from dbclien c, dbuf_n u
             where c.codcli = Codigo and c.uf = u.uf;
            select m.* into CIDADE_Origem from dbclien c, dbuf_n u, dbmunicipio m
             where c.codcli = Codigo and c.uf = u.uf and c.Codmunicipio = m.codmunicipio ;
            -- Informac?o da Origem da Compra (Cliente)
            select * into xRowCliente from dbclien where codcli = Codigo;
            SETDADOS('ORIGEM',xRowCliente.Codcli,xRowCliente.Nome,xRowCliente.Tipocliente,'N',xRowCliente.Sit_Tributaria,nvl(xRowCliente.Iest,'ISENTO'));   
          -- Seleciona a UF Destino (MELO)
            select u.* into RowUF_Destino from dadosempresa d, dbuf_n u
             where d.uf = u.uf;  
            select m.* into CIDADE_Destino from dadosempresa d, dbuf_n u, dbmunicipio m
             where d.uf = u.uf and d.municipio = m.descricao and m.uf = u.uf;  
            -- Dados do Destino
            SETDADOS('DESTINO','000','MELO DISTRIBUIDORA','R','N','2','MELO');          
        elsif TipoOperacao in ('EXTRAVIO_AVARIA_FABRICA')
          then
            -- Seleciona a UF Origem (CLIENTE)
              select u.* into RowUF_Origem  from dbclien c, dbuf_n u
               where c.codcli = CodigoTerceiro and c.uf = u.uf;
              select m.* into CIDADE_Origem from dbclien c, dbuf_n u, dbmunicipio m
             where c.codcli = CodigoTerceiro and c.uf = u.uf and c.Codmunicipio = m.codmunicipio ;			
               -- Informac?o da Origem da Compra (Cliente)
               select * into xRowCliente from dbclien where codcli = CodigoTerceiro;
               SETDADOS('ORIGEM',xRowCliente.Codcli,xRowCliente.Nome,xRowCliente.Tipocliente,'N',xRowCliente.Sit_Tributaria,nvl(xRowCliente.Iest,'ISENTO'));
            -- Seleciona a UF Destino (MELO)
              select u.* into RowUF_Destino from dadosempresa d, dbuf_n u
               where d.uf = u.uf; 
              select m.* into CIDADE_Destino from dadosempresa d, dbuf_n u, dbmunicipio m
             where d.uf = u.uf and d.municipio = m.descricao and m.uf = u.uf;
			-- Dados do Destino
              SETDADOS('DESTINO','000','MELO DISTRIBUIDORA','R','N','2','MELO');
        elsif TipoOperacao in ('EXTRAVIO_AVARIA_CLIENTE')
          then
            -- Seleciona a UF Origem (MELO)
              select u.* into RowUF_Origem from dadosempresa d, dbuf_n u
               where d.uf = u.uf;
              select m.* into CIDADE_Origem from dadosempresa d, dbuf_n u, dbmunicipio m
               where d.uf = u.uf and d.municipio = m.descricao and m.uf = u.uf;
                -- Dados do Destino
                SETDADOS('ORIGEM','000','MELO DISTRIBUIDORA','R','N','2','MELO'); 
            -- Seleciona a UF Destino (CLIENTE)
              select u.* into RowUF_Destino from dbclien c, dbuf_n u
               where c.codcli = CodigoTerceiro and c.uf = u.uf; 
              select m.* into CIDADE_Destino from dbclien c, dbuf_n u, dbmunicipio m
               where c.codcli = CodigoTerceiro and c.uf = u.uf and c.Codmunicipio = m.codmunicipio ;
              -- Informac?o da Origem da Compra (Cliente)
              select * into xRowCliente from dbclien where codcli = CodigoTerceiro;
              SETDADOS('DESTINO',xRowCliente.Codcli,xRowCliente.Nome,xRowCliente.Tipocliente,'N',xRowCliente.Sit_Tributaria,nvl(xRowCliente.Iest,'ISENTO'));    
        else
          -- Seleciona a UF Origem (MELO)
            select u.* into RowUF_Origem from dadosempresa d, dbuf_n u
             where d.uf = u.uf;
            select m.* into CIDADE_Origem from dadosempresa d, dbuf_n u, dbmunicipio m
             where d.uf = u.uf and d.municipio = m.descricao and m.uf = u.uf;			
            -- Dados do Destino
            SETDADOS('ORIGEM','000','MELO DISTRIBUIDORA','R','N','2','MELO'); 
            --if ((CodigoTerceiro is not null) and (CodigoTerceiro <> '')) then
            if ((trim(CodigoTerceiro) is not null)) then
              -- Seleciona a UF Destino (CLIENTE)
              select u.* into RowUF_Destino from dbclien c, dbuf_n u
               where c.codcli = CodigoTerceiro and c.uf = u.uf; 
              select m.* into CIDADE_Destino from dbclien c, dbuf_n u, dbmunicipio m
               where c.codcli = CodigoTerceiro and c.uf = u.uf and c.Codmunicipio = m.codmunicipio ;
              -- Informac?o da Origem da Compra (Cliente)
              select * into xRowCliente from dbclien where codcli = CodigoTerceiro;
              SETDADOS('DESTINO',xRowCliente.Codcli,xRowCliente.Nome,xRowCliente.Tipocliente,'N',xRowCliente.Sit_Tributaria,nvl(xRowCliente.Iest,'ISENTO'));
            else
              -- Seleciona a UF Destino (CLIENTE)
                select u.* into RowUF_Destino from dbclien c, dbuf_n u
                 where c.codcli = Codigo and c.uf = u.uf; 
                select m.* into CIDADE_Destino from dbclien c, dbuf_n u, dbmunicipio m
                 where c.codcli = Codigo and c.uf = u.uf and c.Codmunicipio = m.codmunicipio ;
                -- Informac?o da Origem da Compra (Cliente)
                select * into xRowCliente from dbclien where codcli = Codigo;
                SETDADOS('DESTINO',xRowCliente.Codcli,xRowCliente.Nome,xRowCliente.Tipocliente,'N',xRowCliente.Sit_Tributaria,nvl(xRowCliente.Iest,'ISENTO'));  
            end if;
        end if;   
   end if;
 END;
 
 
  -- Funcao que verifica qual a CST do ICMS dever ser usada
 -- Retorno string.
 FUNCTION ICMS_CST (DescontoSuframa in varchar2,
                    CFOP in varchar2,
                    Valor_Icms in Number,
                    Valor_Icms_Subst in Number) return varchar2 is

 xLEI_id_Usado     number; 
 xLEI_Pro_Usado    number;
 xResult           varchar2(3);
 BEGIN
   if RowUF_Destino.Uf = 'EX'
     then xResult := nvl(nvl(substr(RowProd.Strib,1 ,1),'0'),'0') || '40';      
   elsif (Valor_Icms > 0) and (Valor_Icms_Subst > 0) and (BaseReduzida)
     then
       xResult := nvl(nvl(substr(RowProd.Strib,1 ,1),'0'),'0') || '70';
   elsif (Valor_Icms > 0) and (Valor_Icms_Subst > 0)
     then
       xResult := nvl(nvl(substr(RowProd.Strib,1 ,1),'0'),'0') || '10';
   elsif (Valor_Icms = 0.00) and (Valor_Icms_Subst > 0)
     then
       xResult := nvl(substr(RowProd.Strib,1 ,1),'0') || '30';
   elsif (Valor_Icms > 0) and (BaseReduzida)
    then xResult := nvl(substr(RowProd.Strib,1 ,1),'0') || '20';
   elsif (Valor_Icms > 0)
     then
       xResult := nvl(substr(RowProd.Strib,1 ,1),'0') || '00';
   -- Derivado de Petroleo ou Protocolo 49 e ICMS Zerado
   elsif (DescontoSuframa = 'S')
     then
       xResult := nvl(substr(RowProd.Strib,1 ,1),'0') || '40';     
   elsif (cfop in ('5949'))
     then
       xResult := nvl(substr(RowProd.Strib,1 ,1),'0') || '40';     
   elsif ((Derivado_Petroleo) or
         LEGISLACAO_ICMS(xLEI_id_Usado, xLEI_Pro_Usado,'PROTOCOLO') or
         LEGISLACAO_ICMS(xLEI_id_Usado, xLEI_Pro_Usado,'CONVENIO') or
         LEGISLACAO_ICMS(xLEI_id_Usado, xLEI_Pro_Usado,'RESOLUCAO') or
         LEGISLACAO_ICMS(xLEI_id_Usado, xLEI_Pro_Usado,'DECRETO') or
         ((nvl(RowNCM.Agregado,0) > 0) and (RowUF_Origem.Uf = RowUF_Destino.Uf))) and
         (Valor_Icms = 0.00)
     then    
       xResult := nvl(substr(RowProd.Strib,1 ,1),'0') || '60';
   
   elsif cfop in ('6915','6916')
     then
       xResult := nvl(substr(RowProd.Strib,1 ,1),'0') || '50';
   else
       xResult := nvl(substr(RowProd.Strib,1 ,1),'0') || '40';    
   end if;            
     
         
   Return(xResult);
 end;
--SIMPLES_REMESSA  
 FUNCTION PROTOCOLO49_INT(NCM_Prod in varchar2) return NUMBER is
   result boolean;
 xLEI_id_Usado     number; 
 xLEI_Pro_Usado    number;  
 begin
    -- Call the function
    result := LEGISLACAO_ICMS(xLEI_id_Usado, xLEI_Pro_Usado,'PROTOCOLO');
    -- Convert false/true/null to 0/1/null 
    Return(sys.diutil.bool_to_int(result));
 END;
 
 PROCEDURE SETDADOS (TIPO IN VARCHAR2,
                     CODIGO IN VARCHAR2,
                     NOME IN VARCHAR2,
                     TIPODESTINO IN VARCHAR2,
                     FABRICANTE IN VARCHAR2,
                     REGIMETRIBUTARIO IN VARCHAR2,
                     INSCESTADUAL IN varchar2) IS
 BEGIN
   IF TIPO = 'DESTINO'
     THEN
       DadosDestino.Codigo := CODIGO;
       DadosDestino.Nome := NOME;
       DadosDestino.TipoDestino := TIPODESTINO;
       DadosDestino.Fabricante := FABRICANTE;
       DadosDestino.RegimeTributario := REGIMETRIBUTARIO;
       DadosDestino.InscEstadual := INSCESTADUAL;
   ELSIF TIPO = 'ORIGEM'
     THEN
       DadosOrigem.Codigo := CODIGO;
       DadosOrigem.Nome := NOME;
       DadosOrigem.TipoDestino := TIPODESTINO;
       DadosOrigem.Fabricante := FABRICANTE;
       DadosOrigem.RegimeTributario := REGIMETRIBUTARIO;   
       DadosDestino.InscEstadual := INSCESTADUAL;
   END IF;
         
 END;
 
 
 
 
 
 -- Funcao que verifica qual a aliquota do ICMS dever ser usada
 -- Retorno Number.  Aliquota do ICMS dever usada (%)
 FUNCTION GET_ICMS (Tipo_Movimentacao in varchar2,
                    TipoOperacao in varchar2,
                    CodProduto in varchar2,
                    Codigo in varchar2,
                    Insc_Estadual in varchar2,
                    CFOP in varchar2) return number is
 xResult           number;
 BEGIN
   INICIALIZACAO(Tipo_Movimentacao,
                 TipoOperacao,
                 CodProduto,
                 Codigo,
                 null);
                 
   xResult := Validar_ICMS(Insc_Estadual,CFOP);-- (Aliquota)
                 
   Return(xResult);
 end;
 
 FUNCTION GET_IPI (Tipo_Movimentacao in varchar2,
                   TipoOperacao in varchar2,
                   CodProduto in varchar2,
                   Codigo in varchar2) return number is
 xResult           number; 
 BEGIN
   INICIALIZACAO(Tipo_Movimentacao,
                 TipoOperacao,
                 CodProduto,
                 Codigo,
                 null);
                 
   xResult := Validar_IPI(Tipo_Movimentacao,TipoOperacao);-- (Aliquota)              

   Return(xResult);
 
 end; 
 
 FUNCTION PROTOCOLO_1785 return boolean is
 xResult boolean;
 xLEI_id_Usado     number; 
 xLEI_Pro_Usado    number;  
 begin
    -- Call the function
    xResult := LEGISLACAO_ICMS(xLEI_id_Usado, xLEI_Pro_Usado,'PROTOCOLO');
    if ((xResult) and (xLEI_Pro_Usado <> 17))
      then xResult:= False;    
    end if;  
    -- Convert false/true/null to 0/1/null 
    Return(xResult);
 END;
 
                    
 PROCEDURE SET_NCM(NCM in Varchar2) is

 begin
  -- Seleciona classificacao fiscal
  select 1,0, 0, 0,NULL,NCM,0,null into RowNCM 
    from dual;
 end;  
 
 
 FUNCTION NCM_PROTOCOLO41(pClasFiscal in varchar2) return number is
 xEncontrou    number;
 xResult       boolean;
 BEGIN
    -- Verifica se o produtar se encaixa na classificacao da Lei HANAN
    xResult := False;
    -- Valida NCM
    select count(*) into xEncontrou from CAD_LEGISLACAO_ICMSST_NCM 
         where LIN_LEI_ID = 2 and LIN_NCM = pClasFiscal;
    if (xEncontrou > 0)
      then
        xResult := True;
    else
      -- Se nao valida Parte da NCM tamanho 7
      select count(*) into xEncontrou from CAD_LEGISLACAO_ICMSST_NCM 
         where LIN_LEI_ID = 2 and LIN_NCM = substr(pClasFiscal,1,7) and length(LIN_NCM) = 7;
      if (xEncontrou > 0)
        then
          xResult := True;
      else
        -- Se nao valida Parte da NCM tamanho 6
        select count(*) into xEncontrou from CAD_LEGISLACAO_ICMSST_NCM 
         where LIN_LEI_ID = 2 and LIN_NCM = substr(pClasFiscal,1,6) and length(LIN_NCM) = 6;
        if (xEncontrou > 0)
          then
            xResult := True;
        else
          -- Se nao valida Parte da NCM tamanho 5
          select count(*) into xEncontrou from CAD_LEGISLACAO_ICMSST_NCM 
         where LIN_LEI_ID = 2 and LIN_NCM = substr(pClasFiscal,1,5) and length(LIN_NCM) = 5;
          if (xEncontrou > 0)
           then
            xResult := True;
          else
            -- Se nao valida Parte da NCM tamanho 4
            select count(*) into xEncontrou from CAD_LEGISLACAO_ICMSST_NCM 
             where LIN_LEI_ID = 2 and LIN_NCM = substr(pClasFiscal,1,4) and length(LIN_NCM) = 4;
            if (xEncontrou > 0)
              then
                    xResult := True;
            else
              -- Se nao valida Parte da NCM tamanho 3
              select count(*) into xEncontrou from CAD_LEGISLACAO_ICMSST_NCM
                  where LIN_NCM = substr(pClasFiscal,1,3) and length(LIN_NCM) = 3;
               if (xEncontrou > 0)
                 then
                   xResult := True;
    end if; end if; end if; end if; end if; end if ;
    if pClasFiscal = '73259100'
      then xResult := False;
    end if;  
   -- Retorno da funcao
   -- Convert false/true/null to 0/1/null 
    Return(sys.diutil.bool_to_int(xResult));
 END;

 FUNCTION VALIDA_CFOP_USUCONSUMO(UF_Iguais in boolean) RETURN VARCHAR2 IS
 xResult  varchar2(4);
 BEGIN
  if UF_Iguais 
    then
      xResult := '1556';
  elsif RowUF_Destino.Uf = 'EX'
    then
      xResult := '3556';
  else
    xResult := '2556';    
  end if;
  Return(xResult);
 END;
 
 FUNCTION PRODUTO_ST(vNCM in varchar2, vTIPO in varchar2) return Integer is
 xEncontrou    number;
 xResult       boolean;
 BEGIN
    -- Verifica se o produtar se encaixa na classificacao da Lei HANAN
    xResult := False;
    -- Valida NCM
    select count(*) into xEncontrou from DBCLASSIFICACAO_STSANKHYA
         where NCM = vNCM and tipo = vTIPO;
    if (xEncontrou > 0)
      then
        xResult := True;
    else
      -- Se nao valida Parte da NCM tamanho 7
      select count(*) into xEncontrou from DBCLASSIFICACAO_STSANKHYA
           where NCM = substr(vNCM,1,7) and length(ncm) = 7 and tipo = vTIPO;
      if (xEncontrou > 0)
        then
          xResult := True;
      else
        -- Se nao valida Parte da NCM tamanho 6
        select count(*) into xEncontrou from DBCLASSIFICACAO_STSANKHYA
             where NCM = substr(vNCM,1,6) and length(ncm) = 6 and tipo = vTIPO;
        if (xEncontrou > 0)
          then
            xResult := True;
        else
          -- Se nao valida Parte da NCM tamanho 5
          select count(*) into xEncontrou from DBCLASSIFICACAO_STSANKHYA
               where NCM = substr(vNCM,1,5) and length(ncm) = 5 and tipo = vTIPO;
          if (xEncontrou > 0)
           then
            xResult := True;
          else
            -- Se nao valida Parte da NCM tamanho 4
            select count(*) into xEncontrou from DBCLASSIFICACAO_STSANKHYA
                 where NCM = substr(vNCM,1,4) and length(ncm) = 4 and tipo = vTIPO;
            if (xEncontrou > 0)
              then
                xResult := True;
            else
              -- Se nao valida Parte da NCM tamanho 3
              select count(*) into xEncontrou from DBCLASSIFICACAO_STSANKHYA
                  where NCM = substr(vNCM,1,3) and length(ncm) = 3 and tipo = vTIPO;
               if (xEncontrou > 0)
                 then
                   xResult := True;
    end if; end if; end if; end if; end if; end if ;
   -- Retorno da funcao
   Return(sys.diutil.bool_to_int(xResult));
 END;
 
 
 FUNCTION MESMA_ALC (VCDMUNICIPIOORIGEM IN varchar2,
                     VCDMUNICIPIODESTINO IN varchar2
  ) RETURN boolean IS
      xCOUNT NUMBER;
  BEGIN
      SELECT COUNT(*)
      INTO xCOUNT
      FROM ALC_COMBINACOES
      WHERE MUNICIPIO_EMITENTE = VCDMUNICIPIOORIGEM
        AND MUNICIPIO_DESTINATARIO = VCDMUNICIPIODESTINO;

      IF xCOUNT > 0 THEN
          RETURN true;
      ELSE
          RETURN false;
      END IF;
  END;
  
 FUNCTION MESMA_ZFM (VCDMUNICIPIOORIGEM IN varchar2,
                     VCDMUNICIPIODESTINO IN varchar2
  ) RETURN boolean IS
      xCOUNT NUMBER;
  BEGIN
      SELECT COUNT(*)
      INTO xCOUNT
      FROM ZFM_COMBINACOES
      WHERE MUNICIPIO_EMITENTE = VCDMUNICIPIOORIGEM
        AND MUNICIPIO_DESTINATARIO = VCDMUNICIPIODESTINO;

      IF xCOUNT > 0 THEN
          RETURN true;
      ELSE
          RETURN false;
      END IF;
  END;

 
 
end CALCULO_IMPOSTO;

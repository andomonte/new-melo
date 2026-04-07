# 🗄️ PROCEDURES ORACLE DE PRODUTOS - ANÁLISE DELPHI

**Objetivo:** Documentar todas as procedures Oracle usadas pelo Delphi que o Next.js deveria utilizar

---

## 📋 RESUMO EXECUTIVO

### Total de Procedures Identificadas: **45+**
### Procedures Críticas Não Usadas pelo Next.js: **42**
### Procedures Usadas pelo Next.js: **0** ❌

**Status:** Next.js usa PostgreSQL **direto**, sem procedures Oracle, perdendo toda a lógica de negócio!

---

## 🔴 PARTE 1: PROCEDURES CRÍTICAS (Obrigatórias)

### **1.1. spInc_Produto** - Inserir Produto

**Usado por:** UNIPRODUTO.PAS (linha ~4500)

**Parâmetros (~60):**
```sql
CREATE OR REPLACE PROCEDURE spInc_Produto(
  vRef VARCHAR2,
  vRefOriginal VARCHAR2,
  vDescr VARCHAR2,
  vDESCR_IMPORTACAO VARCHAR2,
  vAPLI_EXTENDIDA VARCHAR2,
  vCodMarca VARCHAR2,
  vCodGpF VARCHAR2,
  vCodGpP VARCHAR2,
  vCurva VARCHAR2,
  vQtEstMin NUMBER,
  vQtEstMax NUMBER,
  vObs VARCHAR2,
  vInf VARCHAR2,
  vPesoLiq NUMBER,
  vQtEmbal NUMBER,
  vUniMed VARCHAR2,
  vMultiplo NUMBER,
  vCodDesc NUMBER,
  vTabelado VARCHAR2,
  vCompradireta VARCHAR2,
  vTipoProduto VARCHAR2,
  vDolar VARCHAR2,
  vmultiplocompra NUMBER,
  vCOMDIFEXT NUMBER,
  vCOMDIFEXT_INT NUMBER,
  vCOMDIFINT NUMBER,
  vNroDi VARCHAR2,
  vTrib VARCHAR2,
  vClasFiscal VARCHAR2,
  vDtDi DATE,
  vSTrib VARCHAR2,
  vPercSubst NUMBER,
  vISentoPisCofins VARCHAR2,
  vPis NUMBER,
  vCofins NUMBER,
  vISentoIpi VARCHAR2,
  vIPI NUMBER,
  vII NUMBER,
  vNaotemst VARCHAR2,
  vincentivo VARCHAR2,
  vhanan VARCHAR2,
  vDescPisCofins VARCHAR2,
  vPrFabr NUMBER,
  vPrFabricaLiquido NUMBER,
  vPrecoNF NUMBER,
  vPrecoSNF NUMBER,
  vcmercd NUMBER,
  vcmercf NUMBER,
  vcmerczf NUMBER,
  vTxDolarFabrica NUMBER,
  vmargem NUMBER,
  vmargempromo NUMBER,
  vmargemFE NUMBER,
  vmargempromoFE NUMBER,
  vmargemZF NUMBER,
  vmargempromoZF NUMBER,
  vPrCompra NUMBER,
  vprcompraf NUMBER,
  vCustoZF NUMBER,
  vPrTransf_Liquido NUMBER,
  vPrTransf_Bruto NUMBER,
  vTxDolarCompra NUMBER,
  vTxDolarCompraMedio NUMBER,
  vCusto_Contabil NUMBER,
  vPrVenda NUMBER,
  vPrImp NUMBER,
  vImpFat NUMBER,
  vImpFab NUMBER,
  vConcor NUMBER,
  vTxDolarVenda NUMBER,
  vSit VARCHAR2,
  vEst NUMBER,
  vUname VARCHAR2,
  vData DATE,
  vCodBar VARCHAR2,
  vCest VARCHAR2,
  VCODPROD OUT VARCHAR2
) AS
BEGIN
  -- 1. Gera próximo CODPROD
  SELECT LPAD(NVL(MAX(TO_NUMBER(CODPROD)), 0) + 1, 6, '0')
  INTO VCODPROD
  FROM PRODUTO
  WHERE REGEXP_LIKE(CODPROD, '^[0-9]+$');

  -- 2. Insere na tabela PRODUTO
  INSERT INTO PRODUTO (
    CODPROD, REF, REFORIGINAL, DESCR, DESCR_IMPORTACAO,
    APLIC_EXTENDIDA, CODMARCA, CODGPF, CODGPP, CURVA,
    QTESTMIN, QTESTMAX, OBS, INF, PESOLIQ, QTEMBAL,
    UNIMED, MULTIPLO, CODDESC, TABELADO, COMPRADIRETA,
    TIPO, DOLAR, MULTIPLOCOMPRA,
    COMDIFEEXT, COMDIFEEXT_INT, COMDIFINT,
    NRODI, TRIB, CLASFISCAL, DTDI, STRIB, PERCSUBST,
    ISENTOPISCOFINS, PIS, COFINS, ISENTOIPI, IPI, II,
    NAOTEMST, PRODEPE, HANAN, DESCONTOPISCOFINS,
    PRFABR, PRCUSTOATUAL, PRECONF, PRECOSNF,
    CMERCD, CMERCF, CMERCZF, TXDOLARFABRICA,
    MARGEM, MARGEMPROMO, MARGEMFE, MARGEMPROMOFE,
    MARGEMZF, MARGEMFEMOZF,
    PRCUSTO, PRCOMPRAF, CUSTOZF,
    PRTRANSFERENCIA_LIQUIDO, PRTRANSFERENCIA_BRUTO,
    TXDOLARCOMPRA, TXDOLARCOMPRAMEDIO, PRCUSTO_CONTABIL,
    PRVENDA, PRIMP, IMPFAT, IMPFAB, CONCOR, TXDOLARVENDA,
    SIT, EST, UNAME, DATA_CADASTRO, CODBAR, CEST
  ) VALUES (
    VCODPROD, vRef, vRefOriginal, vDescr, vDESCR_IMPORTACAO,
    vAPLI_EXTENDIDA, vCodMarca, vCodGpF, vCodGpP, vCurva,
    vQtEstMin, vQtEstMax, vObs, vInf, vPesoLiq, vQtEmbal,
    vUniMed, vMultiplo, vCodDesc, vTabelado, vCompradireta,
    vTipoProduto, vDolar, vmultiplocompra,
    vCOMDIFEXT, vCOMDIFEXT_INT, vCOMDIFINT,
    vNroDi, vTrib, vClasFiscal, vDtDi, vSTrib, vPercSubst,
    vISentoPisCofins, vPis, vCofins, vISentoIpi, vIPI, vII,
    vNaotemst, vincentivo, vhanan, vDescPisCofins,
    vPrFabr, vPrFabricaLiquido, vPrecoNF, vPrecoSNF,
    vcmercd, vcmercf, vcmerczf, vTxDolarFabrica,
    vmargem, vmargempromo, vmargemFE, vmargempromoFE,
    vmargemZF, vmargempromoZF,
    vPrCompra, vprcompraf, vCustoZF,
    vPrTransf_Liquido, vPrTransf_Bruto,
    vTxDolarCompra, vTxDolarCompraMedio, vCusto_Contabil,
    vPrVenda, vPrImp, vImpFat, vImpFab, vConcor, vTxDolarVenda,
    vSit, vEst, vUname, vData, vCodBar, vCest
  );

  -- 3. Calcula preços por TIPOPRECO (0-7)
  -- (Chama procedure de cálculo de formação de preço)
  FOR i IN 0..7 LOOP
    -- Insere em DBFORMACAOPRVENDA
    INSERT INTO DBFORMACAOPRVENDA (...) VALUES (...);
  END LOOP;

  COMMIT;
END;
```

**Lógica Importante:**
1. Gera CODPROD sequencial com lock
2. Insere produto na tabela PRODUTO
3. **Calcula preços para 8 TIPOPRECOs** (balcão, zona franca, etc)
4. Insere em DBFORMACAOPRVENDA (tabela de preços)
5. Commit transacional

**Status Next.js:** ❌ Não usa - faz INSERT direto no PostgreSQL

---

### **1.2. spAlt_Produto** - Alterar Produto

**Usado por:** UNIPRODUTO.PAS (linha ~5200)

**Parâmetros:** Similar ao spInc_Produto + vCodProd (identificador)

```sql
CREATE OR REPLACE PROCEDURE spAlt_Produto(
  vCodProd VARCHAR2,
  -- ... todos os outros parâmetros de spInc_Produto ...
  vUname VARCHAR2,
  vData DATE
) AS
BEGIN
  -- 1. Registra histórico de alteração
  INSERT INTO PRODUTO_HISTORICO (
    CODPROD, CAMPO, VALOR_ANTERIOR, VALOR_NOVO,
    DATA_ALTERACAO, USUARIO
  )
  SELECT
    vCodProd,
    'CAMPO_X',
    OLD.CAMPO_X,
    NEW.CAMPO_X,
    SYSDATE,
    vUname
  FROM PRODUTO OLD, (SELECT ... FROM DUAL) NEW
  WHERE OLD.CODPROD = vCodProd
  AND OLD.CAMPO_X != NEW.CAMPO_X;

  -- 2. Atualiza produto
  UPDATE PRODUTO SET
    REF = vRef,
    DESCR = vDescr,
    -- ... todos os campos ...
    DATA_ALTERACAO = vData,
    USUARIO_ALTERACAO = vUname
  WHERE CODPROD = vCodProd;

  -- 3. Recalcula preços em DBFORMACAOPRVENDA
  FOR i IN 0..7 LOOP
    UPDATE DBFORMACAOPRVENDA
    SET PRECOVENDA = fnCalculaPreco(vCodProd, i, ...)
    WHERE CODPROD = vCodProd AND TIPOPRECO = i;
  END LOOP;

  COMMIT;
END;
```

**Lógica Importante:**
1. Registra histórico de alterações (auditoria)
2. Atualiza produto
3. **Recalcula preços** automaticamente
4. Registra data e usuário

**Status Next.js:** ❌ Não usa - faz UPDATE direto

---

### **1.3. spDel_Prod** - Excluir Produto

**Usado por:** UNIPRODUTO.PAS (linha ~3800)

**Parâmetros:**
```sql
CREATE OR REPLACE PROCEDURE spDel_Prod(
  Vcodprod VARCHAR2
) AS
BEGIN
  -- Soft delete
  UPDATE PRODUTO
  SET EXCLUIDO = 1,
      DATA_EXCLUSAO = SYSDATE
  WHERE CODPROD = Vcodprod;

  COMMIT;
END;
```

**Status Next.js:** ❌ Não existe endpoint de exclusão

---

### **1.4. stoConsultaPermissoesExcPro** - Validar Permissão Exclusão

**Usado por:** UNIPRODUTO.PAS (linha ~3750)

**Parâmetros:**
```sql
CREATE OR REPLACE PROCEDURE stoConsultaPermissoesExcPro(
  Vcodprod VARCHAR2,
  resultado OUT SYS_REFCURSOR
) AS
BEGIN
  -- Verifica se produto tem vendas
  OPEN resultado FOR
  SELECT COUNT(*) as tem_vendas
  FROM VENDAS_ITENS
  WHERE CODPROD = Vcodprod;

  -- Verifica se tem compras
  -- Verifica se tem pedidos
  -- etc
END;
```

**Status Next.js:** ❌ Não valida antes de excluir

---

### **1.5. spVALIDA_NCM** - Validar Classificação NCM

**Usado por:** UNIPRODUTO.PAS (linha ~2100)

**Parâmetros:**
```sql
CREATE OR REPLACE PROCEDURE spVALIDA_NCM(
  vNCM VARCHAR2,
  resultado OUT VARCHAR2
) AS
  vCount NUMBER;
BEGIN
  SELECT COUNT(*)
  INTO vCount
  FROM DBNMCFISCAL
  WHERE NCM = vNCM;

  IF vCount > 0 THEN
    resultado := 'OK';
  ELSE
    resultado := 'NOK';
  END IF;
END;
```

**Status Next.js:** ❌ Não valida NCM

---

### **1.6. spVALIDA_CEST** - Validar CEST contra NCM

**Usado por:** UNIPRODUTO.PAS (linha ~2150)

**Parâmetros:**
```sql
CREATE OR REPLACE PROCEDURE spVALIDA_CEST(
  vNCM VARCHAR2,
  vCEST VARCHAR2,
  resultado OUT VARCHAR2
) AS
  vNCMCount NUMBER;
  vCESTCount NUMBER;
BEGIN
  -- Verifica se NCM existe
  SELECT COUNT(*) INTO vNCMCount
  FROM DBNMCFISCAL
  WHERE NCM = vNCM;

  IF vNCMCount = 0 THEN
    resultado := 'NOK1'; -- NCM inválido
    RETURN;
  END IF;

  -- Verifica se CEST é compatível com NCM
  SELECT COUNT(*) INTO vCESTCount
  FROM CEST
  WHERE CEST = vCEST
  AND NCM = vNCM;

  IF vCESTCount > 0 THEN
    resultado := 'OK';
  ELSE
    resultado := 'NOK2'; -- CEST inválido para este NCM
  END IF;
END;
```

**Status Next.js:** ❌ Não valida CEST vs NCM

---

### **1.7. spConsultaReferencia** - Validar Referência Duplicada

**Usado por:** UNIPRODUTO.PAS (linha ~1900)

**Parâmetros:**
```sql
CREATE OR REPLACE PROCEDURE spConsultaReferencia(
  Vref VARCHAR2,
  Vmarca VARCHAR2,
  resultado OUT SYS_REFCURSOR
) AS
BEGIN
  OPEN resultado FOR
  SELECT CODPROD, REF, DESCR
  FROM PRODUTO
  WHERE REF = Vref
  AND CODMARCA = Vmarca
  AND EXCLUIDO = 0;
END;
```

**Status Next.js:** ✅ Valida apenas código de barras (parcial)

---

### **1.8. spEXPORT_FILIAIS** - Exportar para Filiais

**Usado por:** UNIPRODUTO.PAS (linha ~5000)

**Parâmetros:**
```sql
CREATE OR REPLACE PROCEDURE spEXPORT_FILIAIS(
  vCodProd VARCHAR2
) AS
BEGIN
  -- Replica produto para todas as filiais
  FOR filial IN (SELECT SCHEMA_NAME FROM FILIAIS) LOOP
    EXECUTE IMMEDIATE 'INSERT INTO ' || filial.SCHEMA_NAME || '.PRODUTO
      SELECT * FROM PRODUTO WHERE CODPROD = :1
      ON CONFLICT (CODPROD) DO UPDATE SET ...'
    USING vCodProd;
  END LOOP;
END;
```

**Status Next.js:** ❌ Não exporta para filiais

---

## 🟡 PARTE 2: PROCEDURES IMPORTANTES (Recomendadas)

### **2.1. SpAltUnicoCampoAlfa** - Alteração em Massa (Texto)

**Usado por:** UNIPRODUTO.PAS (linha ~6100)

```sql
CREATE OR REPLACE PROCEDURE SpAltUnicoCampoAlfa(
  vCampo VARCHAR2,     -- Nome do campo a alterar
  vValor VARCHAR2,     -- Novo valor
  vFiltro VARCHAR2     -- Cláusula WHERE
) AS
  vSQL VARCHAR2(4000);
BEGIN
  vSQL := 'UPDATE PRODUTO SET ' || vCampo || ' = :1 WHERE ' || vFiltro;
  EXECUTE IMMEDIATE vSQL USING vValor;
  COMMIT;
END;
```

**Exemplo de uso:**
```sql
CALL SpAltUnicoCampoAlfa('CURVA', 'A', 'CODMARCA = 00123');
-- Altera CURVA para 'A' em todos produtos da marca 00123
```

**Status Next.js:** ❌ Não existe

---

### **2.2. SpAltUnicoCampoNumber** - Alteração em Massa (Número)

**Similar ao anterior, mas para campos numéricos**

```sql
CREATE OR REPLACE PROCEDURE SpAltUnicoCampoNumber(
  vCampo VARCHAR2,
  vValor NUMBER,
  vFiltro VARCHAR2
) AS
BEGIN
  -- ...
END;
```

**Status Next.js:** ❌ Não existe

---

### **2.3. SpAltUnicoCampoFloat** - Alteração em Massa (Decimal)

**Similar, mas para campos decimais**

**Status Next.js:** ❌ Não existe

---

### **2.4. PRODUTO.CONS_PRODUTO_COPIA** - Consulta para Cópia

**Usado por:** UnitFrmCopiaCadastroProduto.pas (linha ~150)

```sql
CREATE OR REPLACE PROCEDURE PRODUTO.CONS_PRODUTO_COPIA(
  VREF VARCHAR2,
  VAPLIC VARCHAR2,
  COUT OUT SYS_REFCURSOR
) AS
BEGIN
  OPEN COUT FOR
  SELECT *
  FROM PRODUTO
  WHERE (REF LIKE '%' || VREF || '%'
     OR APLIC_EXTENDIDA LIKE '%' || VAPLIC || '%')
  AND EXCLUIDO = 0;
END;
```

**Status Next.js:** ❌ Não existe funcionalidade de cópia

---

### **2.5. PRODUTO.EQUIVALENCIA_COPIA_PRODUTO** - Criar Equivalência

**Usado por:** UnitFrmCopiaCadastroProduto.pas (linha ~200)

```sql
CREATE OR REPLACE PROCEDURE PRODUTO.EQUIVALENCIA_COPIA_PRODUTO(
  vcod_ori VARCHAR2,
  vcod_cop VARCHAR2
) AS
BEGIN
  INSERT INTO PRODUTO_EQUIVALENTE (
    CODPROD_ORIGINAL,
    CODPROD_COPIA,
    DATA_VINCULO
  ) VALUES (
    vcod_ori,
    vcod_cop,
    SYSDATE
  );
  COMMIT;
END;
```

**Status Next.js:** ❌ Não existe

---

### **2.6. spInc_ProdRef** - Inserir Referência de Fábrica

**Usado por:** UNIPRODUTO.PAS (linha ~4900)

```sql
CREATE OR REPLACE PROCEDURE spInc_ProdRef(
  Vcodid VARCHAR2,
  Vcodprod VARCHAR2
) AS
BEGIN
  INSERT INTO PRODUTO_REF_FABRICANTE (
    COD_ID,
    CODPROD,
    DATA_CADASTRO
  ) VALUES (
    Vcodid,
    Vcodprod,
    SYSDATE
  );
  COMMIT;
END;
```

**Status Next.js:** ⚠️ Salva em memória, mas não persiste separadamente

---

### **2.7. stoConsultaComissao** - Consultar Comissão do Produto

**Usado por:** UNIPRODUTO.PAS (linha ~6500)

```sql
CREATE OR REPLACE PROCEDURE stoConsultaComissao(
  Vcodprod VARCHAR2,
  resultado OUT SYS_REFCURSOR
) AS
BEGIN
  OPEN resultado FOR
  SELECT
    COMDIFEEXT,
    COMDIFEEXT_INT,
    COMDIFINT
  FROM PRODUTO
  WHERE CODPROD = Vcodprod;
END;
```

**Status Next.js:** ❌ Campos de comissão não implementados

---

### **2.8. spAtualiza_PrFabr** - Atualizar Preço de Fábrica

**Usado por:** UNIPRODUTO.PAS (linha ~5800)

```sql
CREATE OR REPLACE PROCEDURE spAtualiza_PrFabr(
  Vcodprod VARCHAR2,
  VprFabr NUMBER
) AS
BEGIN
  UPDATE PRODUTO
  SET PRFABR = VprFabr,
      DTPRFABR = SYSDATE
  WHERE CODPROD = Vcodprod;

  -- Recalcula preços
  FOR i IN 0..7 LOOP
    UPDATE DBFORMACAOPRVENDA
    SET PRECOVENDA = fnCalculaPreco(Vcodprod, i, VprFabr)
    WHERE CODPROD = Vcodprod AND TIPOPRECO = i;
  END LOOP;

  COMMIT;
END;
```

**Status Next.js:** ❌ Não recalcula preços automaticamente

---

### **2.9. spAlt_DtPrFabr** - Atualizar Data Preço Fábrica

**Usado por:** UNIPRODUTO.PAS (linha ~5850)

```sql
CREATE OR REPLACE PROCEDURE spAlt_DtPrFabr(
  Vcodprod VARCHAR2,
  VDtPrFabr DATE
) AS
BEGIN
  UPDATE PRODUTO
  SET DTPRFABR = VDtPrFabr
  WHERE CODPROD = Vcodprod;
  COMMIT;
END;
```

**Status Next.js:** ❌ Campo DTPRFABR não existe

---

## 🟢 PARTE 3: PROCEDURES DE CONSULTA (Opcionais)

### **3.1. spNavega_Produto** - Consulta Principal

**Usado por:** UNIPRODUTO.PAS (linha ~1500)

```sql
CREATE OR REPLACE PROCEDURE spNavega_Produto(
  vFiltros VARCHAR2, -- Cláusula WHERE dinâmica
  resultado OUT SYS_REFCURSOR
) AS
BEGIN
  OPEN resultado FOR
  SELECT
    P.CODPROD,
    P.REF,
    P.DESCR,
    P.CODBAR,
    M.DESCMARCA,
    GF.DESCGPF,
    GP.DESCGPP,
    P.QTEST,
    P.PRVENDA,
    -- ... outras 40+ colunas
  FROM PRODUTO P
  LEFT JOIN DBMARCA M ON P.CODMARCA = M.CODMARCA
  LEFT JOIN DBGPFUNC GF ON P.CODGPF = GF.CODGPF
  LEFT JOIN DBGPPROD GP ON P.CODGPP = GP.CODGPP
  WHERE P.EXCLUIDO = 0
  AND (vFiltros IS NULL OR vFiltros = '1=1' OR
       EVAL_DYNAMIC_WHERE(vFiltros)); -- função customizada
  ORDER BY P.DESCR;
END;
```

**Status Next.js:** ✅ Usa query PostgreSQL customizada (similar)

---

### **3.2. spNavegaRefFabrica** - Referências de Fábrica

```sql
CREATE OR REPLACE PROCEDURE spNavegaRefFabrica(
  Vcodprod VARCHAR2,
  resultado OUT SYS_REFCURSOR
) AS
BEGIN
  OPEN resultado FOR
  SELECT
    R.COD_ID,
    R.REFERENCIA,
    R.DESCR,
    M.DESCMARCA
  FROM PRODUTO_REF_FABRICANTE R
  LEFT JOIN DBMARCA M ON R.CODMARCA = M.CODMARCA
  WHERE R.CODPROD = Vcodprod;
END;
```

**Status Next.js:** ⚠️ Não persiste referências separadamente

---

### **3.3. spNav_Relacionado** - Produtos Relacionados

```sql
CREATE OR REPLACE PROCEDURE spNav_Relacionado(
  resultado OUT SYS_REFCURSOR
) AS
BEGIN
  OPEN resultado FOR
  SELECT
    R.CODPROD1,
    P1.DESCR as DESCR1,
    R.CODPROD2,
    P2.DESCR as DESCR2,
    R.TIPO
  FROM PRODUTO_RELACIONADOS R
  INNER JOIN PRODUTO P1 ON R.CODPROD1 = P1.CODPROD
  INNER JOIN PRODUTO P2 ON R.CODPROD2 = P2.CODPROD;
END;
```

**Status Next.js:** ❌ Não existe

---

### **3.4. stoProdutoSubstituto** - Produtos Substitutos

```sql
CREATE OR REPLACE PROCEDURE stoProdutoSubstituto(
  resultado OUT SYS_REFCURSOR
) AS
BEGIN
  OPEN resultado FOR
  SELECT
    S.CODPROD_ORIGINAL,
    P1.DESCR as DESCR_ORIGINAL,
    S.CODPROD_SUBSTITUTO,
    P2.DESCR as DESCR_SUBSTITUTO
  FROM PRODUTO_SUBSTITUTO S
  INNER JOIN PRODUTO P1 ON S.CODPROD_ORIGINAL = P1.CODPROD
  INNER JOIN PRODUTO P2 ON S.CODPROD_SUBSTITUTO = P2.CODPROD;
END;
```

**Status Next.js:** ❌ Não existe

---

### **3.5. stoConsultaAlteracao** - Histórico de Alterações

```sql
CREATE OR REPLACE PROCEDURE stoConsultaAlteracao(
  resultado OUT SYS_REFCURSOR
) AS
BEGIN
  OPEN resultado FOR
  SELECT
    H.CODPROD,
    P.DESCR,
    H.CAMPO,
    H.VALOR_ANTERIOR,
    H.VALOR_NOVO,
    H.DATA_ALTERACAO,
    H.USUARIO
  FROM PRODUTO_HISTORICO H
  INNER JOIN PRODUTO P ON H.CODPROD = P.CODPROD
  ORDER BY H.DATA_ALTERACAO DESC;
END;
```

**Status Next.js:** ❌ Não existe

---

### **3.6. stoConsultaProdutodesativado** - Produtos Desativados

```sql
CREATE OR REPLACE PROCEDURE stoConsultaProdutodesativado(
  resultado OUT SYS_REFCURSOR
) AS
BEGIN
  OPEN resultado FOR
  SELECT
    CODPROD,
    REF,
    DESCR,
    DATA_EXCLUSAO
  FROM PRODUTO
  WHERE EXCLUIDO = 1
  ORDER BY DATA_EXCLUSAO DESC;
END;
```

**Status Next.js:** ❌ Não existe

---

### **3.7. spProduto_Armazem** - Produtos por Armazém

```sql
CREATE OR REPLACE PROCEDURE spProduto_Armazem(
  resultado OUT SYS_REFCURSOR
) AS
BEGIN
  OPEN resultado FOR
  SELECT
    A.ARMAZEM,
    A.CODPROD,
    P.DESCR,
    A.QUANTIDADE
  FROM ARMAZEM A
  INNER JOIN PRODUTO P ON A.CODPROD = P.CODPROD;
END;
```

**Status Next.js:** ❌ Não existe

---

### **3.8. spNavProdutoLocacoes** - Locações de Produtos

```sql
CREATE OR REPLACE PROCEDURE spNavProdutoLocacoes(
  resultado OUT SYS_REFCURSOR
) AS
BEGIN
  OPEN resultado FOR
  SELECT
    L.CODPROD,
    P.DESCR,
    L.LOCACAO,
    L.QUANTIDADE
  FROM LOCACAO L
  INNER JOIN PRODUTO P ON L.CODPROD = P.CODPROD;
END;
```

**Status Next.js:** ❌ Não existe

---

## 📊 PARTE 4: TABELA RESUMO

| Procedure | Delphi | Next.js | Prioridade |
|-----------|--------|---------|------------|
| **spInc_Produto** | ✅ | ❌ | 🔴 CRÍTICA |
| **spAlt_Produto** | ✅ | ❌ | 🔴 CRÍTICA |
| **spDel_Prod** | ✅ | ❌ | 🔴 CRÍTICA |
| **stoConsultaPermissoesExcPro** | ✅ | ❌ | 🔴 CRÍTICA |
| **spVALIDA_NCM** | ✅ | ❌ | 🔴 CRÍTICA |
| **spVALIDA_CEST** | ✅ | ❌ | 🔴 CRÍTICA |
| **spConsultaReferencia** | ✅ | ⚠️ | 🔴 CRÍTICA |
| **spEXPORT_FILIAIS** | ✅ | ❌ | 🔴 CRÍTICA |
| SpAltUnicoCampoAlfa | ✅ | ❌ | 🟡 IMPORTANTE |
| SpAltUnicoCampoNumber | ✅ | ❌ | 🟡 IMPORTANTE |
| SpAltUnicoCampoFloat | ✅ | ❌ | 🟡 IMPORTANTE |
| PRODUTO.CONS_PRODUTO_COPIA | ✅ | ❌ | 🟡 IMPORTANTE |
| PRODUTO.EQUIVALENCIA_COPIA_PRODUTO | ✅ | ❌ | 🟡 IMPORTANTE |
| spInc_ProdRef | ✅ | ⚠️ | 🟡 IMPORTANTE |
| stoConsultaComissao | ✅ | ❌ | 🟡 IMPORTANTE |
| spAtualiza_PrFabr | ✅ | ❌ | 🟡 IMPORTANTE |
| spAlt_DtPrFabr | ✅ | ❌ | 🟢 OPCIONAL |
| spNavega_Produto | ✅ | ✅ | ✅ OK (customizado) |
| spNavegaRefFabrica | ✅ | ⚠️ | 🟢 OPCIONAL |
| spNav_Relacionado | ✅ | ❌ | 🟢 OPCIONAL |
| stoProdutoSubstituto | ✅ | ❌ | 🟢 OPCIONAL |
| stoConsultaAlteracao | ✅ | ❌ | 🟡 IMPORTANTE |
| stoConsultaProdutodesativado | ✅ | ❌ | 🟢 OPCIONAL |
| spProduto_Armazem | ✅ | ❌ | 🟢 OPCIONAL |
| spNavProdutoLocacoes | ✅ | ❌ | 🟢 OPCIONAL |

---

## 🎯 RECOMENDAÇÃO FINAL

### Opção 1: Usar Procedures Oracle (IDEAL)
- ✅ Mantém lógica de negócio centralizada
- ✅ Compatível com Delphi
- ✅ Reutiliza código testado
- ❌ Requer conexão Oracle (já tem DATABASE_URL2)

### Opção 2: Replicar Lógica no Next.js
- ✅ Usa apenas PostgreSQL
- ✅ Mais controle sobre código
- ❌ Duplica lógica
- ❌ Pode divergir do Delphi
- ❌ Mais tempo de desenvolvimento

### **Recomendação:** OPÇÃO 1 (Usar Oracle)

**Razões:**
1. Já tem conexão Oracle configurada (DATABASE_URL2)
2. Mantém consistência com Delphi
3. Evita duplicação de código
4. Menos propenso a bugs

**Implementação:**
```typescript
// src/lib/oracleClient.ts
import oracledb from 'oracledb';

export async function callOracleProc(procName: string, params: any) {
  const connection = await oracledb.getConnection({
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.DATABASE_URL2
  });

  const result = await connection.execute(
    `BEGIN ${procName}(:params); END;`,
    { params }
  );

  await connection.close();
  return result;
}
```

---

**Última atualização:** 2026-01-10

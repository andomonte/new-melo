# 📊 COMPARAÇÃO: CADASTRO DE PRODUTOS - DELPHI vs NEXT.JS

**Data de Análise:** 2026-01-10
**Objetivo:** Identificar lacunas, correções e melhorias necessárias no cadastro Next.js

---

## 🎯 RESUMO EXECUTIVO

### ✅ Implementado no Next.js: **63+ campos** (~70% do Delphi)
### ⚠️ Faltando no Next.js: **27+ campos** (~30% do Delphi)
### 🔧 Correções necessárias: **8 itens críticos**
### ➕ Funcionalidades ausentes: **15+ features**

---

## 📋 PARTE 1: CAMPOS IMPLEMENTADOS (✅ OK)

### **Dados Cadastrais** (24/30 campos)

| Campo Delphi | Campo Next.js | Status | Observações |
|--------------|---------------|--------|-------------|
| edtRef | ref | ✅ | OK - Máx 20 chars |
| edtRefOriginal | reforiginal | ✅ | OK - Máx 20 chars |
| edtDescr | descr | ✅ | OK - Máx 200 chars (Delphi: 60) |
| edtDescrImportacao | descr_importacao | ✅ | OK |
| edtCodBarra | codbar | ✅ | OK - Máx 15 chars (Delphi: 40) |
| meAplicExtendida | aplic_extendida | ✅ | OK - Máx 255 chars |
| edtMarca | codmarca | ✅ | OK - Select dinâmico |
| edtGrupoFuncao | codgpf | ✅ | OK - Select dinâmico |
| edtGrupoProd | codgpp | ✅ | OK - Select dinâmico |
| cboCurvaABC | curva | ✅ | OK - A/B/C/D |
| edtEstMinimo | qtestmin | ✅ | OK |
| edtEstMaximo | qtestmax | ✅ | OK |
| edtObs | obs | ✅ | OK - Máx 100 chars (Delphi: 40) |
| cboInfo | inf | ✅ | OK - A/B/C/D (Delphi: A-Z) |
| edtPesoLiq | pesoliq | ✅ | OK |
| edtQtdEmbal | qtembal | ✅ | OK |
| cboUnidMed | unimed | ✅ | OK - Lista completa |
| edtMultiplo | multiplo | ✅ | OK - Padrão 1 |
| edtMultiploCompra | multiplocompra | ✅ | OK - Padrão 1 |
| edtDesconto | coddesc | ✅ | OK |
| cboTabelado | tabelado | ✅ | OK - 0/1 (Delphi: S/N) |
| cbxCompraDireta | compradireta | ✅ | OK - S/N |
| cbxTipoProduto | tipo | ✅ | OK - ME/MC |
| cboMoedaCompra | dolar | ✅ | OK - N(R$)/S(US$) |

**Faltando (6 campos):**
- ❌ consumo_interno (implementado como boolean, mas não no Delphi)
- ❌ COMDIFEEXT (Comissão Diferenciada Externa)
- ❌ COMDIFEEXT_INT (Comissão Diferenciada Externa Internacional)
- ❌ COMDIFINT (Comissão Diferenciada Interna)
- ❌ Campos de margem calculados no Delphi

---

### **Dados Fiscais** (14/15 campos)

| Campo Delphi | Campo Next.js | Status | Observações |
|--------------|---------------|--------|-------------|
| edtNroDi | nrodi | ✅ | OK - Máx 15 chars |
| cboTributado | trib | ✅ | OK - S/N |
| edtClassFiscal | clasfiscal | ✅ | OK - Select dinâmico NCM |
| edt_Data_DI | dtdi | ✅ | OK - Date picker |
| edtSitTrib | strib | ✅ | OK - 2 dropdowns (Delphi: 2 campos) |
| edtPercSubst | percsubst | ✅ | OK - 0-100% |
| cboIsentoPisCofins | isentopiscofins | ✅ | OK - S/N |
| edtPIS | pis | ✅ | OK - 0-100% |
| edtCOFINS | cofins | ✅ | OK - 0-100% |
| cboIsentoIPI | isentoipi | ✅ | OK - Select com opções |
| edtIPI | ipi | ✅ | OK - 0-100% |
| edtII | ii | ✅ | OK |
| cbxDescPisCofins | descontopiscofins | ✅ | OK - S/N |
| edtCest | cest | ✅ | OK - Select dinâmico |

**Faltando (3 campos):**
- ❌ ChkNaoTemST (naotemst) - Implementado na interface mas não no form
- ❌ ChkIncentivado (prodepe) - Implementado na interface mas não no form
- ❌ cnkHANAN (hanan) - Implementado na interface mas não no form

---

### **Dados de Custos** (14/25+ campos)

| Campo Delphi | Campo Next.js | Status | Observações |
|--------------|---------------|--------|-------------|
| edtPrCompra | prcompra | ✅ | OK - OBRIGATÓRIO |
| edtPrTransfLiquido | prcomprasemst | ✅ | OK (nome diferente) |
| edtPrTransfBruto | pratualdesp | ✅ | OK (nome diferente) |
| EdtTxDolarCompra | txdolarcompra | ✅ | OK |
| edtPrFabrica | prfabr | ✅ | OK |
| edtPrFabricaLiquido | prcustoatual | ✅ | OK (nome diferente) |
| edtPrNF | preconf | ✅ | OK (nome diferente) |
| edtPrSNF | precosnf | ✅ | OK (nome diferente) |
| edtPrVenda | prvenda | ✅ | OK |
| edtPrImportacao | primp | ✅ | OK |
| edtPrImportacaoFatura | impfat | ✅ | OK |
| edtPrImportacaoFabrica | impfab | ✅ | OK |
| edtPrConcorrecia | concor | ✅ | OK |
| EdtTxDolarVenda | txdolarvenda | ✅ | OK |

**Faltando (11+ campos importantes do Delphi):**
- ❌ edtCustoContabil - Custo contábil
- ❌ Margens calculadas:
  - margem (Nacional)
  - margempromo (Promo Nacional)
  - margemFE (Fora Estado)
  - margempromoFE (Promo Fora Estado)
  - margemZF (Zona Franca)
  - margempromoZF (Promo Zona Franca)
- ❌ Custos de mercado:
  - cmercd (Custo Mercado Nacional)
  - cmercf (Custo Mercado Filial)
  - cmerczf (Custo Mercado Zona Franca)
- ❌ EdtTxDolarFabrica - Taxa Dólar Fábrica
- ❌ EdtTxDolarCompraMedio - Taxa Dólar Compra Médio

**⚠️ Observação Crítica:**
O Next.js **NÃO calcula margens automaticamente** como o Delphi faz!

---

### **Referências de Fábrica** (✅ Implementado)

| Funcionalidade | Next.js | Delphi | Status |
|----------------|---------|--------|--------|
| Adicionar referência | ✅ | ✅ | OK |
| Remover referência | ✅ | ✅ | OK |
| Campos: codigo, referencia, marca | ✅ | ✅ | OK |

---

## ❌ PARTE 2: CAMPOS FALTANTES NO NEXT.JS

### **2.1. Campos de Comissão (3 campos)**

```typescript
// Faltam no Next.js:
COMDIFEEXT: number       // Comissão Diferenciada Externa
COMDIFEEXT_INT: number   // Comissão Diferenciada Externa Internacional
COMDIFINT: number        // Comissão Diferenciada Interna
```

**Impacto:** Alto - afeta cálculo de comissão de vendedores

---

### **2.2. Campos de Margem (6 campos)**

```typescript
// Faltam no Next.js (mas existem na interface Produto):
margem: number           // Margem lucro nacional
margempromo: number      // Margem promo nacional
margemfe: number         // Margem fora do estado (inexistente)
margempromofe: number    // Margem promo fora do estado (inexistente)
margemzf: number         // Margem zona franca (inexistente)
margemfemozf: number     // Margem promo zona franca (inexistente)
```

**Impacto:** CRÍTICO - margens não são calculadas no cadastro!

---

### **2.3. Campos de Custo de Mercado (3 campos)**

```typescript
// Faltam no Next.js (mas existem na interface):
cmercd: string           // Custo Mercado Nacional
cmercf: string           // Custo Mercado Filial
cmerczf: string          // Custo Mercado Zona Franca
```

**Impacto:** Alto - afeta análise de competitividade

---

### **2.4. Campos Fiscais Especiais (3 campos)**

```typescript
// Implementados na interface mas NÃO no formulário:
naotemst: string         // Não tem Substituição Tributária (S/N)
prodepe: string          // Produto Incentivado PRODEPE (S/N)
hanan: string            // Produto SAP/HANAN (S/N)
```

**Impacto:** Médio - afeta tributação especial

---

### **2.5. Campos de Taxa de Câmbio (2 campos)**

```typescript
// Faltam no Next.js:
txdolarfabrica: number   // Taxa Dólar Fábrica
txdolarcompramedio: number // Taxa Dólar Compra Médio (usado em spInc_Produto)
```

**Impacto:** Médio - afeta produtos importados

---

### **2.6. Campo de Custo Contábil (1 campo)**

```typescript
// Falta no Next.js:
custo_contabil: number   // Custo Contábil (usado em relatórios)
```

**Impacto:** Alto - usado em contabilidade

---

### **2.7. Campos de Data (2 campos)**

```typescript
// Faltam no Next.js:
dtprfabr: Date           // Data do Preço de Fábrica (atualização)
data_cadastro: Date      // Data de cadastro do produto
data_alteracao: Date     // Data última alteração
uname: string            // Usuário que cadastrou/alterou
```

**Impacto:** Médio - auditoria e controle

---

## 🔧 PARTE 3: CORREÇÕES NECESSÁRIAS

### **3.1. Validações Faltantes** ⚠️ CRÍTICO

**Delphi tem, Next.js NÃO:**

```typescript
// 1. Validação de Grupo de Produto vs Tipo
// REGRA DELPHI:
if (tipo === 'MC' && codgpp.startsWith('Z')) {
  // ERRO: Mercadoria Comercial não pode começar com Z
}
if (tipo === 'ME' && !codgpp.startsWith('Z')) {
  // ERRO: Mercadoria Especial DEVE começar com Z
}

// 2. Validação de CEST vs NCM
// REGRA DELPHI: chama spVALIDA_CEST
const validacao = await validarCEST(ncm, cest)
if (validacao === 'NOK1') {
  // NCM inválido
}
if (validacao === 'NOK2') {
  // CEST inválido para este NCM
}

// 3. Validação de múltiplo mínimo
if (multiplo < 1) {
  // ERRO: Múltiplo não pode ser menor que 1
}

// 4. Validação de referência duplicada
// REGRA DELPHI: chama spConsultaReferencia
const existe = await verificarReferenciaDuplicada(ref, codmarca)
if (existe) {
  // ERRO: Referência já existe para esta marca
}
```

**STATUS ATUAL NEXT.JS:**
- ❌ Não valida regra de grupo vs tipo
- ❌ Não valida CEST vs NCM (apenas carrega lista)
- ❌ Não valida múltiplo < 1 (schema permite qualquer número)
- ✅ Valida código de barras duplicado (apenas)

---

### **3.2. Stored Procedures Oracle Não Utilizadas** ⚠️ CRÍTICO

**Delphi usa ~45 procedures, Next.js usa ZERO!**

O Next.js usa **PostgreSQL direto** sem procedures, perdendo:

```sql
-- PROCEDURES CRÍTICAS NÃO UTILIZADAS:

-- 1. INSERÇÃO (Delphi: spInc_Produto)
-- Next.js faz INSERT direto, sem:
--   - Cálculo de margens
--   - Exportação para filiais (spEXPORT_FILIAIS)
--   - Validações de negócio
--   - Geração automática de preços por zona

-- 2. ALTERAÇÃO (Delphi: spAlt_Produto)
-- Next.js faz UPDATE direto, sem:
--   - Log de alterações (tabela de histórico)
--   - Recálculo de margens
--   - Atualização de data de alteração
--   - Registro de usuário

-- 3. VALIDAÇÕES
-- Next.js NÃO usa:
--   - spVALIDA_NCM (validar NCM)
--   - spVALIDA_CEST (validar CEST vs NCM)
--   - spConsultaReferencia (validar duplicação)
--   - stoConsultaPermissoesExcPro (permissões exclusão)

-- 4. EXCLUSÃO
-- Next.js não tem endpoint de exclusão!
--   - Sem spDel_Prod
--   - Sem validação de itens dependentes
--   - Sem soft delete (campo excluido)
```

**IMPACTO:** CRÍTICO - Perde toda lógica de negócio do Oracle!

---

### **3.3. Diferenças de Tipos de Dados**

| Campo | Delphi | Next.js | Problema |
|-------|--------|---------|----------|
| tabelado | S/N | 0/1 | ⚠️ Incompatível com Oracle |
| compradireta | S/N | S/N | ✅ OK |
| dolar | S/N | N/S | ✅ OK |
| descr | 60 chars | 200 chars | ⚠️ Pode truncar no Oracle |
| codbar | 40 chars | 15 chars | ⚠️ Limite menor |
| obs | 40 chars | 100 chars | ⚠️ Pode truncar no Oracle |
| inf | A-Z | A/B/C/D | ⚠️ Limite menor de opções |

---

### **3.4. Normalização de Valores Padrão** ✅ Parcialmente OK

**Next.js define padrões na edição, mas não no cadastro:**

```typescript
// modalEditar.tsx (✅ OK)
codmarca: produto.codmarca || '00000',
codgpf: produto.codgpf || '00000',
codgpp: produto.codgpp || '00000',

// add.ts API (❌ Valores fixos sem validação)
qtdreservada: 0,
qtest_filial: 0,
cmercd: '0.00',
margem: 0,
// ... etc

// PROBLEMA: não valida se campos obrigatórios vieram vazios!
```

**Correção necessária:** Validar campos obrigatórios antes de definir padrões

---

### **3.5. Geração de Código de Produto** ⚠️ Risco de Concorrência

```typescript
// add.ts - ATUAL (potencial race condition)
const ultimoCodprod = await client.query(`
  SELECT codprod FROM dbprod
  WHERE codprod ~ '^[0-9]+$'
  ORDER BY CAST(codprod AS INTEGER) DESC
  LIMIT 1
`);
const proximoCodigo = (parseInt(ultimoCodprod.rows[0].codprod) + 1)
  .toString()
  .padStart(6, '0');
```

**PROBLEMA:** Se dois usuários cadastrarem ao mesmo tempo, pode gerar código duplicado!

**Solução Delphi:** Usa sequence do Oracle ou lock de tabela

**Correção necessária:**
```sql
-- Opção 1: Usar SEQUENCE PostgreSQL
CREATE SEQUENCE seq_codprod START WITH 1;
SELECT LPAD(nextval('seq_codprod')::text, 6, '0');

-- Opção 2: Usar SERIAL/BIGSERIAL
ALTER TABLE dbprod ALTER COLUMN codprod TYPE BIGSERIAL;

-- Opção 3: Lock de linha (atual com lock)
SELECT codprod FROM dbprod
WHERE codprod ~ '^[0-9]+$'
ORDER BY CAST(codprod AS INTEGER) DESC
LIMIT 1
FOR UPDATE; -- adicionar lock
```

---

### **3.6. Tamanho de Campos (Inconsistências)**

| Campo | Delphi (Oracle) | Next.js (PG) | Ação |
|-------|-----------------|--------------|------|
| ref | VARCHAR2(20) | VARCHAR(20) | ✅ OK |
| descr | VARCHAR2(60) | VARCHAR(200) | ⚠️ Ajustar para 60 |
| codbar | VARCHAR2(40) | VARCHAR(15) | ❌ Aumentar para 40 |
| obs | VARCHAR2(40) | VARCHAR(100) | ⚠️ Ajustar para 40 |
| aplic_extendida | VARCHAR2(255) | VARCHAR(255) | ✅ OK |

---

### **3.7. Campos de Sistema (Auditoria)**

**Delphi registra, Next.js NÃO:**

```typescript
// Faltam no Next.js:
data_cadastro: Date        // Data de criação
data_alteracao: Date       // Data última alteração
usuario_cadastro: string   // Quem cadastrou
usuario_alteracao: string  // Quem alterou
```

**Correção:** Adicionar campos de auditoria no schema

---

### **3.8. Soft Delete vs Hard Delete**

**Delphi:**
```sql
-- spDel_Prod faz SOFT DELETE
UPDATE PRODUTO SET excluido = 1 WHERE codprod = ?
```

**Next.js:**
```typescript
// NÃO TEM ENDPOINT DE EXCLUSÃO!
// Se tivesse, provavelmente seria hard delete:
DELETE FROM dbprod WHERE codprod = ?
```

**Correção:** Implementar soft delete com campo `excluido`

---

## ➕ PARTE 4: FUNCIONALIDADES FALTANTES

### **4.1. Funcionalidades do Delphi NÃO implementadas no Next.js**

| # | Funcionalidade Delphi | Next.js | Prioridade |
|---|-----------------------|---------|------------|
| 1 | Cópia de cadastro (TFrmCopiaCadastroProduto) | ❌ | 🔴 ALTA |
| 2 | Produtos relacionados/equivalentes | ❌ | 🔴 ALTA |
| 3 | Produtos substitutos | ❌ | 🟡 MÉDIA |
| 4 | Alteração em massa (SpAltUnicoCampo*) | ❌ | 🔴 ALTA |
| 5 | Exclusão de produto | ❌ | 🔴 ALTA |
| 6 | Histórico de alterações | ❌ | 🔴 ALTA |
| 7 | Análise de margem de preços | ❌ | 🟡 MÉDIA |
| 8 | Importação de preço de fábrica | ❌ | 🟡 MÉDIA |
| 9 | Exportação de preço de fábrica | ❌ | 🟡 MÉDIA |
| 10 | Atualização Bosch (stoATUALIZAPRFAB_BOSCH) | ❌ | 🟢 BAIXA |
| 11 | Exportar para filiais | ❌ | 🔴 ALTA |
| 12 | Consulta de comissão (stoConsultaComissao) | ❌ | 🟡 MÉDIA |
| 13 | Consulta de demanda | ❌ | 🟡 MÉDIA |
| 14 | Consulta de pendências | ❌ | 🟡 MÉDIA |
| 15 | Produtos desativados | ❌ | 🟡 MÉDIA |
| 16 | Locações em armazém | ❌ | 🟢 BAIXA |

---

### **4.2. Funcionalidade: Cópia de Produto** 🔴 ALTA

**Delphi:**
```pascal
// UnitFrmCopiaCadastroProduto.pas
procedure TFrmCopiaCadastroProduto.CopiarProduto;
begin
  // 1. Busca produto original via PRODUTO.CONS_PRODUTO_COPIA
  // 2. Copia TODOS os campos
  // 3. Abre formulário de cadastro preenchido
  // 4. Ao salvar, cria equivalência: PRODUTO.EQUIVALENCIA_COPIA_PRODUTO
end;
```

**Next.js:** ❌ NÃO EXISTE

**Implementação sugerida:**
```typescript
// Novo componente: modalCopiar.tsx
async function copiarProduto(codprodOriginal: string) {
  // 1. GET /api/produtos/get/{codprodOriginal}
  const produtoOriginal = await getProduto(codprodOriginal)

  // 2. Limpar campos únicos
  delete produtoOriginal.codprod
  delete produtoOriginal.codbar // opcional
  produtoOriginal.ref = '' // usuário define nova ref

  // 3. Abrir modalCadastrar com dados preenchidos
  setDadosIniciais(produtoOriginal)
  setCadastrarOpen(true)

  // 4. Ao salvar, criar equivalência
  await POST('/api/produtos/equivalencia', {
    cod_original: codprodOriginal,
    cod_copia: novoCodprod
  })
}
```

---

### **4.3. Funcionalidade: Alteração em Massa** 🔴 ALTA

**Delphi:**
```pascal
// SpAltUnicoCampoAlfa, SpAltUnicoCampoNumber, SpAltUnicoCampoFloat
// Permite alterar um campo em múltiplos produtos de uma vez

Exemplo:
  Campo: CURVA
  Novo valor: A
  Produtos: Todos com filtro "MARCA = 00123"

  -> Atualiza CURVA = 'A' em todos os produtos da marca 00123
```

**Next.js:** ❌ NÃO EXISTE

**Implementação sugerida:**
```typescript
// Novo endpoint: PUT /api/produtos/updateMassa
interface UpdateMassaRequest {
  campo: keyof Produto
  valor: any
  filtros: Filtro[] // mesmo formato de buscaComFiltro
}

async function updateMassa(req: UpdateMassaRequest) {
  // 1. Construir WHERE clause com filtros
  // 2. UPDATE dbprod SET {campo} = {valor} WHERE {filtros}
  // 3. Retornar quantidade de registros alterados
}
```

---

### **4.4. Funcionalidade: Histórico de Alterações** 🔴 ALTA

**Delphi:**
```sql
-- stoConsultaAlteracao
-- Registra TODAS as alterações em tabela de log
-- Campos: data, usuario, campo_alterado, valor_anterior, valor_novo
```

**Next.js:** ❌ NÃO EXISTE

**Implementação sugerida:**
```sql
-- Criar tabela de log
CREATE TABLE dbprod_historico (
  id SERIAL PRIMARY KEY,
  codprod VARCHAR(20),
  campo VARCHAR(50),
  valor_anterior TEXT,
  valor_novo TEXT,
  data_alteracao TIMESTAMP DEFAULT NOW(),
  usuario VARCHAR(100)
);

-- Trigger para registrar alterações
CREATE TRIGGER trg_dbprod_audit
BEFORE UPDATE ON dbprod
FOR EACH ROW EXECUTE FUNCTION fn_audit_produto();
```

```typescript
// Novo endpoint: GET /api/produtos/historico/{codprod}
async function getHistorico(codprod: string) {
  return await query(`
    SELECT * FROM dbprod_historico
    WHERE codprod = $1
    ORDER BY data_alteracao DESC
  `, [codprod])
}
```

---

### **4.5. Funcionalidade: Exclusão de Produto** 🔴 ALTA

**Delphi:**
```pascal
// Validações antes de excluir:
// 1. stoConsultaPermissoesExcPro (usuário tem permissão?)
// 2. stoConsulta_item_excl (produto tem vendas/compras?)
// 3. Se aprovado: spDel_Prod (soft delete: excluido = 1)
```

**Next.js:** ❌ NÃO EXISTE

**Implementação sugerida:**
```typescript
// Novo endpoint: DELETE /api/produtos/delete/{codprod}
async function deleteProduto(codprod: string, userId: string) {
  // 1. Verificar permissão do usuário
  const permissao = await verificarPermissaoExclusao(userId)
  if (!permissao) throw new Error('Sem permissão')

  // 2. Verificar se tem vendas/compras vinculadas
  const temVendas = await query(`
    SELECT COUNT(*) FROM vendas_itens WHERE codprod = $1
  `, [codprod])
  if (temVendas.rows[0].count > 0) {
    throw new Error('Produto tem vendas vinculadas')
  }

  // 3. Soft delete
  await query(`
    UPDATE dbprod SET excluido = 1, data_exclusao = NOW()
    WHERE codprod = $1
  `, [codprod])
}
```

---

### **4.6. Funcionalidade: Exportar para Filiais** 🔴 ALTA

**Delphi:**
```pascal
// spEXPORT_FILIAIS
// Ao cadastrar/alterar produto, replica para filiais
```

**Next.js:** ❌ NÃO EXISTE

**Implementação sugerida:**
```typescript
// Em add.ts e update.ts, após inserção/atualização:
async function exportarParaFiliais(produto: Produto) {
  const filiais = ['db_roraima', 'db_rondonia'] // schemas

  for (const filial of filiais) {
    await query(`
      INSERT INTO ${filial}.dbprod (...)
      VALUES (...)
      ON CONFLICT (codprod) DO UPDATE SET ...
    `, [...])
  }
}
```

---

### **4.7. Funcionalidade: Produtos Relacionados/Equivalentes** 🔴 ALTA

**Delphi:**
```pascal
// spNav_Relacionado - lista produtos relacionados
// stoEQUIVALENCIA_COPIA_PRODUTO - cria equivalência
```

**Next.js:** ❌ NÃO EXISTE

**Implementação sugerida:**
```sql
-- Nova tabela
CREATE TABLE dbprod_relacionados (
  id SERIAL PRIMARY KEY,
  codprod1 VARCHAR(20),
  codprod2 VARCHAR(20),
  tipo VARCHAR(20), -- 'equivalente', 'substituto', 'acessorio'
  UNIQUE(codprod1, codprod2, tipo)
);
```

```typescript
// Novo endpoint: GET /api/produtos/relacionados/{codprod}
// Novo endpoint: POST /api/produtos/relacionados
```

---

## 📊 PARTE 5: RESUMO DE PRIORIDADES

### 🔴 CRÍTICO (Implementar AGORA)

1. ✅ **Validações de negócio:**
   - Regra Grupo vs Tipo (MC/ME com Z)
   - Validação CEST vs NCM
   - Múltiplo >= 1
   - Referência duplicada

2. ✅ **Campos faltantes críticos:**
   - Margens (margem, margempromo, margemfe, etc)
   - Custos de mercado (cmercd, cmercf, cmerczf)
   - Campos fiscais (naotemst, prodepe, hanan)

3. ✅ **Funcionalidades essenciais:**
   - Exclusão de produto (soft delete)
   - Histórico de alterações
   - Exportar para filiais
   - Cálculo automático de margens

4. ✅ **Correções de segurança:**
   - Race condition em geração de código
   - Auditoria (usuário, data)

---

### 🟡 IMPORTANTE (Implementar em seguida)

5. ✅ **Funcionalidades de produtividade:**
   - Cópia de produto
   - Alteração em massa
   - Produtos relacionados

6. ✅ **Integrações:**
   - Usar procedures Oracle (ou replicar lógica)
   - Importação/exportação de preços

7. ✅ **Melhorias de UX:**
   - Validação em tempo real de NCM
   - Auto-completar CEST baseado em NCM

---

### 🟢 DESEJÁVEL (Backlog)

8. ✅ **Relatórios e análises:**
   - Análise de margem
   - Consulta de demanda
   - Produtos desativados

9. ✅ **Integrações especiais:**
   - Atualização Bosch
   - Locações em armazém

---

## 📝 PARTE 6: PLANO DE AÇÃO RECOMENDADO

### **Fase 1: Correções Críticas (1-2 semanas)**

```markdown
□ Adicionar campos faltantes na interface Produto
□ Implementar validações de negócio (Grupo vs Tipo, CEST vs NCM)
□ Corrigir race condition na geração de código
□ Adicionar campos de auditoria (data, usuário)
□ Implementar soft delete
□ Adicionar campos de margem e custo de mercado
□ Criar procedure/função de cálculo de margens
```

### **Fase 2: Funcionalidades Essenciais (2-3 semanas)**

```markdown
□ Implementar exclusão de produto
□ Criar histórico de alterações (tabela + trigger)
□ Implementar exportação para filiais
□ Criar funcionalidade de cópia de produto
□ Implementar alteração em massa
□ Adicionar produtos relacionados/equivalentes
```

### **Fase 3: Integrações e Melhorias (2-4 semanas)**

```markdown
□ Criar procedures Oracle ou replicar lógica no Next.js
□ Implementar importação/exportação de preços
□ Adicionar validação em tempo real de NCM
□ Implementar auto-completar CEST
□ Criar relatórios de análise
□ Integrar com sistema Bosch (se aplicável)
```

---

## 🎯 CONCLUSÃO

### Situação Atual:
- ✅ **Next.js tem 70% das funcionalidades básicas**
- ❌ **Falta 30% dos campos críticos**
- ❌ **Falta 80% das funcionalidades avançadas**
- ⚠️ **Tem bugs críticos de segurança e validação**

### Recomendação:
**Priorizar Fase 1** (correções críticas) antes de usar em produção!

---

**Última atualização:** 2026-01-10

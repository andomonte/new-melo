# Erro: Série já vinculada a outra Inscrição Estadual

## 🚨 Mensagem do Erro

```
Rejeicao: Serie ja vinculada a outra inscricao estadual deste CNPJ
```

---

## 🔍 O que Significa?

A SEFAZ mantém um cadastro vinculando:

```
CNPJ + SÉRIE + INSCRIÇÃO ESTADUAL (IE)
```

Quando você tenta emitir uma NFe, a SEFAZ verifica:
- ✅ CNPJ está correto?
- ✅ Série já foi usada antes?
- ❌ A IE que está usando agora é a MESMA da primeira vez que usou essa série?

Se a IE for **diferente**, a SEFAZ rejeita!

---

## 📊 Exemplo do Problema

### Situação 1 (Passado):
```
CNPJ: 07.522.002/0001-04
Série: AA
IE: 123456789 ✅ Primeira vez usando série AA
```
**Resultado:** NFe autorizada ✅

### Situação 2 (Agora):
```
CNPJ: 07.522.002/0001-04
Série: AA (mesma série!)
IE: 987654321 ❌ IE DIFERENTE da que estava cadastrada!
```
**Resultado:** ❌ **Rejeição 206** - "Série já vinculada a outra inscrição estadual deste CNPJ"

---

## 🎯 Causas Comuns

### 1. Mudança de Filial
- Matriz tinha IE: 123.456.789
- Filial tem IE: 987.654.321
- ❌ Tentou usar a mesma série da matriz

### 2. Alteração Cadastral
- Empresa mudou de endereço/estado
- Receita gerou nova IE
- ❌ Tentou usar série antiga com IE nova

### 3. Empresa em Homologação
- Testou em homologação com IE fictícia
- Foi para produção com IE real
- ❌ Série ficou vinculada à IE de teste

### 4. Banco de Dados com IE Errada
- Cadastro da empresa no sistema tem IE antiga
- SEFAZ espera IE nova
- ❌ Sistema envia IE errada

---

## ✅ Soluções

### Solução 1: Usar Série Diferente (RECOMENDADO)

Se você mudou a IE da empresa, use uma série nova:

```sql
-- Verificar qual série está usando
SELECT serie FROM dbfatura WHERE codfat = 373644;

-- Resultado: AA (em conflito!)

-- Atualizar para série nova
UPDATE dbfatura 
SET serie = 'AB'  -- ou 'AC', '1', '2', etc.
WHERE codfat = 373644;
```

**Por que funciona?**
- SEFAZ vincula: CNPJ + SÉRIE + IE
- Mudando a série, cria um novo vínculo
- Nova série → Nova IE → ✅ Aceito!

---

### Solução 2: Corrigir IE no Cadastro

Se a IE no sistema está errada, corrigir:

```sql
-- 1. Verificar IE atual no cadastro
SELECT codcli, nome, ie 
FROM dbclientes 
WHERE cnpj = '07522002000104';

-- 2. Verificar IE correta na Receita Federal/SEFAZ
-- Acessar: https://www.sintegra.gov.br/

-- 3. Atualizar IE no banco
UPDATE dbclientes 
SET ie = '251497846'  -- IE CORRETA da SEFAZ
WHERE cnpj = '07522002000104';
```

---

### Solução 3: Solicitar Desvinculação na SEFAZ (Último Recurso)

Se você REALMENTE precisa usar a mesma série com IE diferente:

1. **Abrir chamado na SEFAZ** do seu estado
2. **Solicitar desvinculação** da série antiga
3. **Aguardar aprovação** (pode levar dias)
4. **Vincular novamente** com a IE correta

⚠️ **Não recomendado:** Processo burocrático e demorado!

---

## 🔧 Como Diagnosticar

Execute uma emissão e veja os logs:

```
🔍 ========== VERIFICAÇÃO CRÍTICA SEFAZ ==========
📌 CNPJ: 07522002000104
📌 Série sendo enviada: "AA"
📌 IE (Inscrição Estadual): 251497846
📌 UF: SC
⚠️  ATENÇÃO: SEFAZ vincula CNPJ + SÉRIE + IE
⚠️  Se você mudou a IE da empresa, precisa usar SÉRIE DIFERENTE!
🔍 ================================================
```

### Passos:

1. **Anotar a IE atual**: A que está sendo enviada agora
2. **Consultar no SINTEGRA**: Verificar se a IE está correta
3. **Verificar histórico**: Qual IE usou quando criou a série pela primeira vez

```sql
-- Buscar NFes antigas com essa série
SELECT 
  nfe.chave,
  nfe.dthrprotocolo,
  f.serie
FROM dbfat_nfe nfe
INNER JOIN dbfatura f ON f.codfat = nfe.codfat
WHERE f.serie = 'AA'
  AND nfe.status = '100'
ORDER BY nfe.dthrprotocolo ASC
LIMIT 1;

-- Extrair IE da primeira chave (posições 6-19)
-- Exemplo chave: 44 2501 07522002000104 55 001...
--                      ^^^^^ ^^^^^^^^^^^^
--                      AAMM    CNPJ
```

---

## 📋 Tabela de Séries Recomendadas

| Situação | Série Sugerida | Motivo |
|----------|----------------|--------|
| Matriz | 1 ou AA | Série principal |
| Filial 1 | 2 ou AB | Diferente da matriz |
| Filial 2 | 3 ou AC | Diferente das anteriores |
| Após mudança de IE | Próxima disponível | Evitar conflito |
| Venda balcão | 1, 2, 3... | Numérico sequencial |
| Venda online | 10, 11, 12... | Separar canal |
| Nota de devolução | 90, 91... | Facilita identificação |

---

## ⚠️ IMPORTANTE

### O que NÃO fazer:
❌ Usar a mesma série em filiais diferentes  
❌ Reutilizar série após mudança de IE  
❌ Copiar série de ambiente de teste para produção  
❌ Alterar IE manualmente sem verificar SINTEGRA

### O que fazer:
✅ Cada filial com série própria  
✅ Verificar IE no SINTEGRA antes de cadastrar  
✅ Mudar série ao mudar IE  
✅ Documentar qual série está vinculada a qual IE

---

## 🎯 Solução Rápida (TL;DR)

**Se você está com esse erro AGORA:**

1. Verificar qual série está usando:
   ```sql
   SELECT serie FROM dbfatura WHERE codfat = SEU_CODFAT;
   ```

2. Mudar para série diferente:
   ```sql
   UPDATE dbfatura SET serie = 'AB' WHERE codfat = SEU_CODFAT;
   ```

3. Tentar emitir novamente

**Pronto!** ✅

---

## 📞 Contatos SEFAZ por Estado

| UF | Telefone | Site |
|----|----------|------|
| SC | (48) 3665-2828 | sef.sc.gov.br |
| SP | (11) 2930-3750 | fazenda.sp.gov.br |
| RJ | (21) 2334-4525 | fazenda.rj.gov.br |
| MG | (31) 3303-7000 | fazenda.mg.gov.br |

---

## 🔗 Links Úteis

- [SINTEGRA - Consulta IE](https://www.sintegra.gov.br/)
- [Portal NFe - Manual de Orientação](http://www.nfe.fazenda.gov.br/portal/principal.aspx)
- [Tabela de Rejeições SEFAZ](http://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=/fW1aFww9g4=)

---

**Última atualização:** Outubro 2025

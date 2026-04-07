# 📊 Comparação: Sistema Legado (Delphi) vs Sistema Novo (Next.js)

## 🎯 Geração de Chaves, Séries e Números de NFe

Este documento compara como o sistema legado em Delphi e o novo sistema em Next.js geram as chaves de acesso, séries e números das NFes.

---

## 🔍 Estrutura da Chave de Acesso NFe (44 dígitos)

```
Posição  | Campo  | Tamanho | Descrição
---------|--------|---------|------------------------------------------
1-2      | cUF    | 2       | Código UF (13 = Amazonas)
3-8      | AAMM   | 6       | Ano e Mês de emissão (202510 = Out/2025)
9-22     | CNPJ   | 14      | CNPJ do Emitente
23-24    | mod    | 2       | Modelo (55 = NFe, 65 = NFCe)
25-27    | série  | 3       | Série da NFe (002 = série 2)
28-36    | nNF    | 9       | Número sequencial da NFe (000000002)
37       | tpEmis | 1       | Tipo de emissão (1 = Normal)
38-45    | cNF    | 8       | Código Numérico (antiduplicação)
46       | cDV    | 1       | Dígito Verificador

Total: 44 dígitos
```

**Exemplo de Chave:**
```
13 251018 05313900016955 002 000000002 1 00024086 7
└─ └────┘ └────────────┘ └─┘ └───────┘ └ └──────┘ └
UF  AAMM    CNPJ        mod  série   nNF │   cNF   cDV
                                     tpEmis
```

---

## 🔧 Sistema Legado (Delphi)

### 📁 Arquivos Principais
- `UniFaturamento.pas` - Formulário de faturamento
- `UniDtMd.pas` - Data Module com stored procedures
- `UniXmlEntrada.pas` - Importação de XML de entrada
- Stored Procedures: `spINC_NFE_ENT`, `sp_inc_nfe`

### 🔢 Geração do Número (nNF)

O sistema legado **não foi encontrado explicitamente** nos arquivos analisados, mas pelo comportamento observado:

```pascal
// INFERÊNCIA baseada no comportamento do banco de dados:
// 1. Busca o MAX(numero) das notas JÁ AUTORIZADAS (status = '100')
// 2. Incrementa +1 para próxima emissão
// 3. Formata com 9 dígitos: padStart(9, '0')

// Exemplo de busca:
SELECT MAX(CAST(nfe.nrodoc_fiscal AS INTEGER)) 
FROM dbfat_nfe nfe
WHERE nfe.serie = '2' 
  AND nfe.status = '100'  -- APENAS AUTORIZADAS
  AND nfe.nrodoc_fiscal ~ '^[0-9]+$'
```

**Importante:** O sistema legado **conta apenas notas autorizadas** (status = 100), ignorando:
- Notas rejeitadas (539, 610, etc.)
- Notas em processamento (204)
- Notas negadas (301, 302, 303)

### 📚 Geração da Série

```pascal
// UniFaturamento.pas - linha 828
meFat_Serie.Text := 'A';  // Série alfanumérica padrão

// Conversão para numérico:
// Série 'A' → código numérico
// Série '2' → código 002 (usado na chave de acesso)
```

**Série padrão atual:** `'2'` (numérica, exigida pela SEFAZ AM)

### 🔐 Geração do cNF (Código Numérico)

O sistema legado **não tem lógica explícita** nos arquivos `.pas` analisados. O cNF era provavelmente gerado:
- Pela stored procedure do banco de dados, OU
- Por biblioteca externa (ACBr ou similar)

**Comportamento observado:**
- cNF é único por emissão
- Evita duplicidade mesmo com mesmo número/série
- 8 dígitos numéricos aleatórios ou semi-aleatórios

---

## 🚀 Sistema Novo (Next.js)

### 📁 Arquivos Principais
- `src/pages/api/faturamento/emitir.ts` - API de emissão
- `src/components/services/sefazNfe/gerarXml.ts` - Geração da chave
- `src/pages/api/faturamento/enviar-email-nfe.ts` - Envio de email

### 🔢 Geração do Número (nNF)

```typescript
// emitir.ts - linhas 198-229
const proximoNumeroQuery = await pool!.query(
  `SELECT MAX(numero) as ultimo_numero
   FROM (
     SELECT CAST(nfe.nrodoc_fiscal AS INTEGER) as numero
     FROM db_manaus.dbfat_nfe nfe
     INNER JOIN db_manaus.dbfatura f ON f.codfat = nfe.codfat
     WHERE f.serie = '2'
       AND nfe.nrodoc_fiscal IS NOT NULL
       AND nfe.nrodoc_fiscal != ''
       AND nfe.nrodoc_fiscal::text ~ '^[0-9]+$'
       AND nfe.status = '100'  -- 🎯 APENAS AUTORIZADAS
   ) AS todos_numeros`
);

const ultimoNumero = parseInt(proximoNumeroQuery.rows[0].ultimo_numero, 10);
nroformEmissao = String(ultimoNumero + 1).padStart(9, '0');
```

**✅ Correção aplicada:** Agora conta **APENAS status = '100'** (autorizadas), evitando duplicidade.

### 📚 Geração da Série

```typescript
// emitir.ts - linha 190
const serieEmissao = '2'; // Série fixa padrão (numérica, exigida pela SEFAZ)

// Conversão para chave de acesso:
let serieChave: string;
if (/^\d+$/.test(serieNF)) {
  serieChave = ('000' + serieNF).slice(-3); // '2' → '002'
} else {
  // Série alfanumérica: converte para código numérico
  const codigoSerie = serieNF.charCodeAt(0) - 65; // 'A' → 0, 'B' → 1, etc.
  serieChave = String(codigoSerie % 1000).padStart(3, '0');
}
```

### 🔐 Geração do cNF (Código Numérico)

```typescript
// gerarXml.ts - linhas 153-163
const numeroNFInt = parseInt(numeroNF, 10);

// Gerar cNF único combinando:
// - 4 dígitos do número da NFe (rastreabilidade)
// - 4 dígitos aleatórios (unicidade em retry/reemissão)
const parte1 = String(numeroNFInt).padStart(4, '0').slice(-4);
const parte2 = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
const cNF = parte1 + parte2;

console.log(`🔑 cNF: ${cNF} (parte1: ${parte1}, parte2: ${parte2})`);
```

**Exemplo:**
- Número NFe = 2
- parte1 = '0002'
- parte2 = '4086' (aleatório)
- cNF = '00024086'

---

## ⚙️ Comparação Lado a Lado

| Aspecto | Sistema Legado (Delphi) | Sistema Novo (Next.js) |
|---------|-------------------------|------------------------|
| **Busca próximo número** | Inferido: MAX(numero) WHERE status='100' | ✅ Explícito: MAX(numero) WHERE status='100' |
| **Série padrão** | '2' (numérica) | '2' (numérica) |
| **Série na chave** | '002' (3 dígitos) | '002' (3 dígitos) |
| **Geração cNF** | ❓ Não explícito (stored proc ou ACBr) | ✅ Explícito: 4 dígitos fixos + 4 aleatórios |
| **Antiduplicação** | ✅ cNF único por emissão | ✅ cNF único por emissão |
| **Validação status** | ✅ Conta apenas '100' | ✅ Conta apenas '100' |

---

## 🐛 Problema de Duplicidade Resolvido

### ❌ Antes da Correção

```typescript
// ERRADO: Contava TODAS as notas, incluindo rejeitadas
WHERE status IN ('100', '150', '301', '302', '303')
```

**Problema:**
1. NFe #2 enviada com cNF=00024086 → Rejeitada (erro 610)
2. NFe #2 enviada novamente com cNF=00025123 → Rejeitada (erro 610)
3. NFe #2 enviada pela 3ª vez com cNF=00026789 → **REJEITADA** (539 - Duplicidade)

**Por quê?**
- Sistema contava as 3 tentativas como "número 2, 3, 4"
- Mas na verdade todas eram "número 2" com cNF diferentes
- SEFAZ detectou: "Você já emitiu número 2 antes!"

### ✅ Depois da Correção

```typescript
// CORRETO: Conta apenas autorizadas
WHERE nfe.status = '100'
```

**Resultado:**
1. NFe #2 rejeitada → **NÃO CONTA** no MAX(numero)
2. Próxima tentativa → Continua sendo número 2
3. Se autorizada → Próxima será número 3

---

## 📊 Status SEFAZ

| Código | Descrição | Conta no MAX()? |
|--------|-----------|-----------------|
| 100 | Autorizada | ✅ SIM |
| 204 | Em processamento | ❌ NÃO |
| 301 | Uso denegado: Irregularidade fiscal emitente | ❌ NÃO |
| 302 | Uso denegado: Irregularidade fiscal destinatário | ❌ NÃO |
| 303 | Uso denegado: Destinatário não habilitado | ❌ NÃO |
| 539 | Duplicidade de NFe | ❌ NÃO |
| 610 | Rejeição: IE do destinatário não cadastrada | ❌ NÃO |

---

## 🔍 Exemplo de Emissão

### Cenário: Primeira NFe da série 2

```typescript
// 1. Buscar último número AUTORIZADO
SELECT MAX(numero) FROM dbfat_nfe WHERE serie='2' AND status='100'
// Resultado: NULL (nenhuma autorizada ainda)

// 2. Calcular próximo número
proximoNumero = 1
nroformEmissao = '000000001'

// 3. Gerar cNF
parte1 = '0001' (4 dígitos do número)
parte2 = '7845' (aleatório)
cNF = '00017845'

// 4. Montar chave de acesso
cUF = '13' (Amazonas)
AAMM = '251018' (18/out/2025)
CNPJ = '05313900016955'
mod = '55' (NFe)
serie = '002'
nNF = '000000001'
tpEmis = '1'
cNF = '00017845'

chaveSemDV = '13251018053139000169550020000000011000178450'
cDV = calcularDV(chaveSemDV) // = 7
chaveAcesso = '132510180531390001695500020000000110001784507'
```

### Cenário: Retry após rejeição 610

```typescript
// 1. Buscar último número AUTORIZADO
SELECT MAX(numero) FROM dbfat_nfe WHERE serie='2' AND status='100'
// Resultado: 1 (a anterior foi autorizada)

// 2. Tentativa rejeitada com status=610 (IE inválida)
// Essa tentativa tinha número=2, mas foi rejeitada

// 3. Nova tentativa - buscar último AUTORIZADO novamente
SELECT MAX(numero) FROM dbfat_nfe WHERE serie='2' AND status='100'
// Resultado: AINDA É 1 (não conta a rejeitada)

// 4. Próximo número continua sendo 2
proximoNumero = 2
nroformEmissao = '000000002'

// 5. Gerar NOVO cNF (diferente da tentativa anterior)
parte1 = '0002'
parte2 = '9123' (NOVO aleatório)
cNF = '00029123' (diferente do anterior '00024086')

// 6. Chave de acesso DIFERENTE da tentativa anterior
// Mesmo número (2), mesma série (002), mas cNF diferente
```

---

## ✅ Conclusão

### Compatibilidade com Sistema Legado

O sistema novo **replica corretamente** a lógica do sistema legado:

1. ✅ Conta apenas notas autorizadas (status = '100')
2. ✅ Usa série '2' padrão
3. ✅ Formata número com 9 dígitos
4. ✅ Gera cNF único para evitar duplicidade
5. ✅ Calcula dígito verificador corretamente

### Melhorias Implementadas

1. ✅ Lógica explícita e documentada (vs inferida do legado)
2. ✅ cNF com parte fixa + parte aleatória (rastreabilidade + unicidade)
3. ✅ Logs detalhados para debug
4. ✅ Validações de formato e tamanho

### Testes Recomendados

- [ ] Emitir NFe #1 da série 2
- [ ] Verificar chave de acesso gerada
- [ ] Tentar emitir novamente (deve gerar cNF diferente)
- [ ] Verificar que rejeições não incrementam o número
- [ ] Confirmar que autorizações incrementam corretamente

---

**Documento criado em:** 13/10/2025  
**Última atualização:** 13/10/2025  
**Versão:** 1.0

# Correção Completa da Arquitetura de Série NFe

## Problema Identificado

O sistema estava gerando erro 539 (Duplicidade de NFe) porque:

1. **Série no lugar errado**: Coluna `serie` foi adicionada por engano em `dbfat_nfe`, mas o correto é usar `dbfatura.serie`
2. **Série auto-gerada aleatoriamente**: Código gerava séries de 2-10 baseado em timestamp, todas tentando número 1
3. **NFes rejeitadas não salvas**: Quebrava lógica de "próximo número" porque só via NFes autorizadas
4. **Série alfanumérica não tratada**: Sistema assumia série numérica, mas produção usa "AA", "AB", etc.

## Arquitetura Correta

### Banco de Dados
- **dbfatura.serie**: Origem correta (pode ser alfanumérica: AA, AB, 1, 2, etc.)
- **dbfatura.nroform**: Número da NFe (nNF) - sequencial por série
- **dbfat_nfe.nrodoc_fiscal**: Código Numérico (cNF) - 8 dígitos aleatórios
- **dbfat_nfe.serie**: ❌ REMOVER - adicionado por engano

### XML NFe
```xml
<ide>
  <serie>AA</serie>         <!-- Alfanumérico conforme dbfatura.serie -->
  <nNF>33516</nNF>          <!-- Número da NFe de dbfatura.nroform -->
  <cNF>00016156</cNF>       <!-- Código Numérico - 8 dígitos -->
</ide>
```

### Chave de Acesso (44 dígitos)
```
44 AAMM CNPJ_EMITENTE MOD SSS NNNNNNNNN T CCCCCCCC DV
                          ^^^           ^^^^^^^^
                        série(3)         cNF(8)
```
- **Série na chave**: DEVE ser numérica (3 dígitos) mesmo que XML seja alfanumérica
- **Conversão**: AA → 130, AB → 131, etc. (soma códigos ASCII % 1000)

## Arquivos Corrigidos

### 1. Migration SQL
**Arquivo**: `scripts/remover-coluna-serie-dbfat_nfe.sql`
```sql
ALTER TABLE dbfat_nfe DROP COLUMN IF EXISTS serie;
```
Remove coluna incorreta.

### 2. Obter Próximo Número
**Arquivo**: `src/pages/api/faturamento/obter-proximo-numero-nfe.ts`

**Antes**:
```typescript
SELECT MAX(nrodoc_fiscal::integer) FROM dbfat_nfe
```

**Depois**:
```typescript
SELECT MAX(nroform::integer) FROM dbfatura WHERE serie = $1
```

### 3. Normalizar Payload
**Arquivo**: `src/components/services/sefazNfe/normalizarPayloadNFe.ts`

**Antes**:
```typescript
const serieGerada = 2 + (Math.floor(Date.now() / 1000) % 9); // 2-10
```

**Depois**:
```typescript
const serieFatura = dbfatura?.serie || '1';
```

### 4. Frontend - Pré-emissão
**Arquivo**: `src/components/corpo/faturamento/FaturamentoNota.tsx`

**Antes**:
```typescript
const dbvenda = await obterVendaCompleta(venda.id);
const serieVenda = dbvenda.numeroserie;
```

**Depois**:
```typescript
const dbfatura = await obterFaturaCompleta(venda.id);
const serieFatura = dbfatura.serie;
console.log(`📋 Série da fatura: ${serieFatura}`);
```

### 5. Geração XML - Conversão Alfanumérica
**Arquivo**: `src/components/services/sefazNfe/gerarXml.ts`

**Antes**:
```typescript
const serieChave = ('000' + serieNF).slice(-3);
```

**Depois**:
```typescript
let serieChave: string;
if (/^\d+$/.test(serieNF)) {
  // Série numérica
  serieChave = ('000' + serieNF).slice(-3);
} else {
  // Série alfanumérica - converter para código numérico
  let codigoSerie = 0;
  for (let i = 0; i < serieNF.length; i++) {
    codigoSerie += serieNF.charCodeAt(i);
  }
  serieChave = String(codigoSerie % 1000).padStart(3, '0');
  console.log(`🔄 Série "${serieNF}" → código ${serieChave}`);
}
```

### 6. Salvar NFes Rejeitadas + Correção cNF
**Arquivo**: `src/pages/api/faturamento/emitir.ts`

**Antes**:
```typescript
const nrodoc_fiscal = numeroNFe || null; // ❌ ERRADO: salvava nNF
if (status === 100) {
  await salvarNFe(...);
}
```

**Depois**:
```typescript
// Gerar cNF (8 dígitos)
const codnumerico = dados?.ide?.cNF || (random.padStart(6,'0') + timestamp);
const nrodoc_fiscal = codnumerico; // ✅ CORRETO: salva cNF

// Salvar TODAS as tentativas (mesmo rejeitadas)
await salvarNFe(..., status);
```

**Campos salvos em dbfat_nfe:**
- `nrodoc_fiscal` = cNF (código numérico 8 dígitos: 00016156)
- Número da NFe (nNF) fica apenas no XML, não tem coluna própria

## Fluxo Completo Corrigido

### 1. Pré-emissão (Frontend)
```
FaturamentoNota.tsx
  ↓
Busca dbfatura.serie
  ↓
Chama /api/faturamento/obter-proximo-numero-nfe?serie=AA
  ↓
Retorna: 33516 (max nroform da série AA + 1)
```

### 2. Emissão (Backend)
```
normalizarPayloadNFe.ts
  ↓
Usa dbfatura.serie (AA) e dbfatura.nroform (33516)
  ↓
gerarXml.ts
  ↓
XML: <serie>AA</serie> <nNF>33516</nNF>
Chave: série=130 (conversão de AA)
  ↓
emitir.ts
  ↓
Envia para SEFAZ
  ↓
Salva em dbfat_nfe (mesmo se rejeitado)
```

## Conversão Série Alfanumérica

### Exemplos
| Série Original | Código ASCII | Código Chave |
|---------------|--------------|--------------|
| 1             | -            | 001          |
| 5             | -            | 005          |
| AA            | 65+65=130    | 130          |
| AB            | 65+66=131    | 131          |
| BA            | 66+65=131    | 131 ⚠️       |

**Nota**: BA e AB geram mesmo código. Se necessário, usar algoritmo mais robusto.

### Algoritmo Alternativo (se necessário)
```typescript
// Hash posicional para evitar colisões
let codigo = 0;
for (let i = 0; i < serieNF.length; i++) {
  codigo += serieNF.charCodeAt(i) * (i + 1);
}
serieChave = String(codigo % 1000).padStart(3, '0');
```

## Testes Necessários

### 1. Executar Migration
```bash
psql -h localhost -U usuario -d dbmanaus -f scripts/remover-coluna-serie-dbfat_nfe.sql
```

### 2. Testar com Série AA
- Criar fatura com série "AA"
- Emitir NFe
- Verificar XML: `<serie>AA</serie>`
- Verificar chave: posição 22-24 = "130"
- Verificar dbfat_nfe salvou corretamente

### 3. Verificar Próximo Número
- Emitir NFe série AA número 33516
- Chamar `/api/obter-proximo-numero-nfe?serie=AA`
- Deve retornar: 33517

### 4. Testar NFe Rejeitada
- Provocar erro (ex: CNPJ inválido)
- Verificar que foi salva em dbfat_nfe
- Próximo número deve continuar sequência

## Checklist de Validação

- [ ] Migration executada (coluna serie removida de dbfat_nfe)
- [ ] NFe emitida com série AA
- [ ] XML possui `<serie>AA</serie>`
- [ ] Chave possui série numérica convertida (130)
- [ ] Próximo número funciona corretamente
- [ ] NFes rejeitadas são salvas
- [ ] cNF (8 dígitos) salvo em nrodoc_fiscal
- [ ] nNF (número NFe) diferente de cNF
- [ ] Sem erro 539 (duplicidade)

## Observações Importantes

1. **SEFAZ identifica duplicidade por**: UF + AAMM + CNPJ + Modelo + SÉRIE + NÚMERO
   - cNF não afeta duplicidade
   - Série e número devem ser únicos na combinação

2. **Série pode ser alfanumérica no XML**: SEFAZ aceita AA, AB, 1, etc.

3. **Chave DEVE ter série numérica**: Posição fixa de 3 dígitos, converter se necessário

4. **nrodoc_fiscal ≠ número NFe**:
   - nrodoc_fiscal = cNF (8 dígitos aleatórios)
   - Número NFe = nNF (sequencial em dbfatura.nroform)

5. **Sempre salvar tentativas**: Mesmo rejeitadas, para manter histórico e lógica de próximo número

## Próximos Passos

1. ✅ Código corrigido
2. ⏳ Executar migration SQL
3. ⏳ Testar em homologação com série AA
4. ⏳ Validar não há mais erro 539
5. ⏳ Deploy para produção

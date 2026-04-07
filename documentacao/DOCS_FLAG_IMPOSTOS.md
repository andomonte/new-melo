# Flag de Configuração: Cálculo de PIS/COFINS

## Visão Geral

Foi implementado um flag de configuração que permite escolher entre dois modos de cálculo de PIS/COFINS:

### **Modo 1: Valores do Produto (Compatibilidade Delphi)**
- **Flag:** `usar_regras_oracle_procedimento = false` (ou `undefined`)
- **Comportamento:** Usa as alíquotas cadastradas diretamente no produto (tabela `dbprod`)
- **Exemplo:** Se o produto tem PIS = 2.3% e COFINS = 10.8%, usa esses valores
- **Quando usar:** Para manter compatibilidade com o sistema Delphi atual

### **Modo 2: Regras do Procedimento Oracle**
- **Flag:** `usar_regras_oracle_procedimento = true`
- **Comportamento:** Aplica as regras complexas do procedimento Oracle `CALCULO_IMPOSTO.Calcular_PIS_COFINS_Saida`
- **Regras implementadas:**
  1. **Exportação (UF = 'EX'):** PIS = 0%, COFINS = 0%, CST = 08
  2. **NCM Monofásico:** PIS = 0%, COFINS = 0%, CST = 04
  3. **Produtos com soma PIS+COFINS = 13.10% ou 11.50%:** PIS = 0%, COFINS = 0%, CST = 04
  4. **Zona Franca (AM para cidades específicas):** PIS = 0%, COFINS = 0%, CST = 06
     - Cidades: Manaus, Brasileia, Macapá, Santana, Tabatinga, Boa Vista, Bonfim, Guajará-Mirim
  5. **Venda Normal:** PIS = 1.65%, COFINS = 7.60%, CST = 01
- **Quando usar:** Para cálculos fiscalmente corretos conforme procedimento Oracle

---

## Como Usar

### 1. **Na API `/api/impostos`**

Adicione o parâmetro `usarRegrasOracleProcedimento` no body da requisição:

```typescript
// Modo 1: Usar valores do produto (Delphi)
const response = await fetch('/api/impostos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    codProd: '414068',
    codCli: '18786',
    quantidade: 1,
    valorUnitario: 7.64,
    usarRegrasOracleProcedimento: false, // ou omitir
  }),
});

// Modo 2: Usar regras do procedimento Oracle
const response = await fetch('/api/impostos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    codProd: '414068',
    codCli: '18786',
    quantidade: 1,
    valorUnitario: 7.64,
    usarRegrasOracleProcedimento: true,
  }),
});
```

### 2. **Na API de Comparação `/api/impostos/comparar-oracle-pg`**

A API de comparação também suporta o flag:

```typescript
const response = await fetch('/api/impostos/comparar-oracle-pg', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    codProd: '414068',
    codCli: '18786',
    quantidade: 1,
    valorUnitario: 7.64,
    usarRegrasOracleProcedimento: true, // Teste com regras Oracle
  }),
});
```

### 3. **Uso Direto da CalculadoraImpostos**

Se você estiver usando a classe `CalculadoraImpostos` diretamente:

```typescript
import { CalculadoraImpostos } from '@/lib/impostos/calculadoraImpostos';
import type { DadosCalculoImposto } from '@/lib/impostos/types';

const dados: DadosCalculoImposto = {
  produto_id: 414068,
  ncm: '85044090',
  valor_produto: 7.64,
  quantidade: 1,
  desconto: 0,
  cliente_id: 18786,
  tipo_operacao: 'VENDA',
  usar_regras_oracle_procedimento: true, // ← Adicione aqui
};

const calculadora = new CalculadoraImpostos(pgClient);
const resultado = await calculadora.calcular(dados);
```

---

## Exemplo de Diferença

Para o produto **414068** (NCM: 85044090) com valor R$ 7,64:

### Alíquotas cadastradas no produto:
- IPI: 15%
- PIS: 2.3%
- COFINS: 10.8%

### Modo 1 (Valores do Produto):
```
PIS: R$ 0,18 (2.3%)
COFINS: R$ 0,83 (10.8%)
Total PIS+COFINS: R$ 1,01
```

### Modo 2 (Regras Oracle):
```
PIS: R$ 0,13 (1.65%)
COFINS: R$ 0,58 (7.60%)
Total PIS+COFINS: R$ 0,71
```

**Diferença:** R$ 0,30 a menos usando as regras Oracle

---

## Recomendações

1. **Para produção atual:** Use `usar_regras_oracle_procedimento = false` (ou omita) para manter compatibilidade com Delphi

2. **Para transição:** Consulte o cliente sobre qual modo usar:
   - Se querem continuar exatamente como está no Delphi: `false`
   - Se querem usar cálculos fiscalmente corretos do Oracle: `true`

3. **Para novos sistemas:** Recomenda-se usar `true` para seguir as regras fiscais corretas

4. **Para teste:** Use a API `/api/impostos/comparar-oracle-pg` com ambos os valores do flag para ver as diferenças

---

## Arquivos Modificados

1. **src/lib/impostos/types.ts**
   - Adicionado `usar_regras_oracle_procedimento?: boolean` em `DadosCalculoImposto`
   - Adicionado `usarRegrasOracleProcedimento?: boolean` em `ImpostoRequest`

2. **src/lib/impostos/calculadoraImpostos.ts**
   - Métodos `calcularPIS()` e `calcularCOFINS()` agora verificam o flag
   - Se `true`, chamam `determinarAliquotasPISCOFINSVenda()` (regras Oracle)
   - Se `false` ou `undefined`, usam valores do produto (comportamento atual)

3. **src/pages/api/impostos/index.ts**
   - Aceita `usarRegrasOracleProcedimento` do body
   - Passa para a calculadora via `dados.usar_regras_oracle_procedimento`

4. **src/pages/api/impostos/comparar-oracle-pg.ts**
   - Aceita `usarRegrasOracleProcedimento` do body
   - Permite testar ambos os modos na comparação

---

## Próximos Passos

1. ✅ Implementação concluída
2. ⏳ Definir com o cliente qual modo usar
3. ⏳ Atualizar frontend para incluir opção de escolha (se necessário)
4. ⏳ Testar em ambiente de homologação
5. ⏳ Migrar para produção com o modo escolhido

---

## Suporte

Para dúvidas ou problemas, consulte:
- Código fonte: `src/lib/impostos/calculadoraImpostos.ts` (linhas 630-746)
- Procedimento Oracle original: `scripts/oracle_calculo_imposto.sql` (linhas 2821-2929)

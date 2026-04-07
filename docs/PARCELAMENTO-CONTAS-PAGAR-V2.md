# Sistema de Parcelamento de Contas a Pagar - V2

## 📋 Visão Geral

Implementação do sistema de parcelamento de contas a pagar seguindo o padrão da interface de **Faturamento/Cobrança**. Permite criar múltiplas parcelas com vencimentos personalizados para uma mesma conta.

## 🎯 Padrão de Interface (Faturamento)

O novo design segue o padrão estabelecido em `CobrancaFatura/index.tsx`:

- ✅ Input único de **prazo em dias** + botão **"Adicionar"**
- ✅ Lista visual de parcelas com **botão "Remover"** individual
- ✅ Scroll automático quando há muitas parcelas
- ✅ Preview em tempo real com valores e datas calculadas
- ✅ Resumo do parcelamento com total e valor por parcela

## 🧩 Arquitetura

### Frontend (`ContasAPagar.tsx`)

```typescript
// Estados principais
const [parcelas, setParcelas] = useState<{ dias: number; vencimento: string }[]>([]);
const [prazoSelecionado, setPrazoSelecionado] = useState('');

const [novaContaDados, setNovaContaDados] = useState({
  parcelado: false,
  // ... outros campos
});
```

### Backend (`criar.ts`)

```typescript
const {
  parcelado = false,
  parcelas = [], // Array de { dias: number, vencimento: string }
  // ... outros campos
} = req.body;

const totalParcelas = parcelado && parcelas.length > 0 ? parcelas.length : 1;
```

## 🎨 Interface de Usuário

### 1. Checkbox de Ativação
```tsx
<input
  type="checkbox"
  id="parcelado"
  checked={novaContaDados.parcelado}
  onChange={(e) => {
    setNovaContaDados({ ...novaContaDados, parcelado: e.target.checked });
    if (!e.target.checked) {
      setParcelas([]);
      setPrazoSelecionado('');
    }
  }}
/>
<Label htmlFor="parcelado">Parcelar Conta</Label>
```

### 2. Input de Prazo + Botão Adicionar
```tsx
<Input
  type="number"
  min="1"
  value={prazoSelecionado}
  onChange={(e) => setPrazoSelecionado(e.target.value)}
  placeholder="Ex: 30"
/>

<button
  onClick={() => {
    const dias = parseInt(prazoSelecionado);
    if (!dias || dias <= 0) {
      toast.error('Insira um prazo válido em dias.');
      return;
    }
    if (!novaContaDados.dt_venc) {
      toast.error('Selecione a data de vencimento base primeiro.');
      return;
    }
    const vencimento = new Date(novaContaDados.dt_venc);
    vencimento.setDate(vencimento.getDate() + dias);
    setParcelas([
      ...parcelas,
      {
        dias,
        vencimento: vencimento.toISOString().split('T')[0],
      },
    ]);
    setPrazoSelecionado('');
  }}
>
  + Adicionar
</button>
```

### 3. Lista de Parcelas
```tsx
<ul className="space-y-1 max-h-32 overflow-y-auto bg-gray-50 dark:bg-gray-800 p-2 rounded">
  {parcelas.map((p, i) => (
    <li key={i} className="flex justify-between items-center">
      <span>
        Parcela {i + 1}: {p.dias} dias → {new Date(p.vencimento).toLocaleDateString('pt-BR')}
        {novaContaDados.valor_pgto > 0 && (
          <span className="ml-2 text-blue-600 font-medium">
            R$ {(novaContaDados.valor_pgto / parcelas.length).toFixed(2)}
          </span>
        )}
      </span>
      <button
        onClick={() => setParcelas(parcelas.filter((_, idx) => idx !== i))}
        className="text-red-500 hover:text-red-600 text-xs"
      >
        Remover
      </button>
    </li>
  ))}
</ul>
```

### 4. Resumo do Parcelamento
```tsx
{parcelas.length > 0 && novaContaDados.valor_pgto > 0 && (
  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
      Resumo do Parcelamento:
    </p>
    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
      • {parcelas.length}x de R$ {(novaContaDados.valor_pgto / parcelas.length).toFixed(2)}
    </p>
    <p className="text-xs text-blue-700 dark:text-blue-300">
      • Total: R$ {novaContaDados.valor_pgto.toFixed(2)}
    </p>
  </div>
)}
```

## 🔄 Fluxo de Uso

### Cenário 1: Parcelamento Simples (3x de 30 em 30 dias)

1. ✅ Selecione a data base de vencimento: `2024-01-15`
2. ✅ Marque o checkbox **"Parcelar Conta"**
3. ✅ Digite **30** no campo de prazo → Clique **"+ Adicionar"**
4. ✅ Repita mais 2 vezes (ou ajuste o prazo para 60, 90)

**Resultado:**
```
Parcela 1: 30 dias → 14/02/2024 → R$ 333,33
Parcela 2: 60 dias → 16/03/2024 → R$ 333,33  
Parcela 3: 90 dias → 15/04/2024 → R$ 333,34
```

### Cenário 2: Parcelamento Irregular

1. ✅ Data base: `2024-01-15`
2. ✅ Adicione **7 dias** (vencimento em 22/01)
3. ✅ Adicione **30 dias** (vencimento em 14/02)
4. ✅ Adicione **60 dias** (vencimento em 16/03)
5. ✅ Adicione **120 dias** (vencimento em 15/05)

**Flexibilidade:** Você define exatamente quando cada parcela vence!

## 📡 API Request

```json
POST /api/contas-pagar/criar

{
  "tipo": "F",
  "cod_credor": "00123",
  "cod_conta": "1001",
  "cod_ccusto": "001",
  "dt_venc": "2024-01-15",
  "valor_pgto": 1000,
  "nro_nf": "12345",
  "tem_nota": "S",
  "parcelado": true,
  "parcelas": [
    { "dias": 30, "vencimento": "2024-02-14" },
    { "dias": 60, "vencimento": "2024-03-16" },
    { "dias": 90, "vencimento": "2024-04-15" }
  ]
}
```

## 💾 Processamento Backend

```typescript
// 1. Validar parcelas
if (parcelado && parcelas.length === 0) {
  return res.status(400).json({ erro: 'Adicione ao menos uma parcela' });
}

// 2. Calcular total de parcelas
const totalParcelas = parcelado && parcelas.length > 0 ? parcelas.length : 1;

// 3. Distribuir valor
const valorParcela = parseFloat(valor_pgto) / totalParcelas;
const valorParcelaFormatado = Math.floor(valorParcela * 100) / 100;
const restocentavos = parseFloat(valor_pgto) - (valorParcelaFormatado * totalParcelas);

// 4. Gerar base do nro_dup
let baseDup = nro_dup || nro_nf || `DUP${Date.now().toString().slice(-8)}`;

// 5. Criar cada parcela
for (let i = 0; i < totalParcelas; i++) {
  const dataVencFormatada = parcelado && parcelas[i] 
    ? parcelas[i].vencimento 
    : dt_venc;
    
  const valorDestaParcela = i === totalParcelas - 1 
    ? valorParcelaFormatado + restocentavos
    : valorParcelaFormatado;
    
  const nroDupParcela = totalParcelas > 1 
    ? `${baseDup}/${String(i + 1).padStart(2, '0')}` 
    : (baseDup || null);
    
  // INSERT INTO dbpgto ...
}
```

## 🗄️ Estrutura no Banco de Dados

### Exemplo: Conta de R$ 1.000,00 parcelada em 3x

```sql
-- DBPGTO
cod_pgto  | nro_dup        | dt_venc    | valor_pgto
----------|----------------|------------|------------
000123001 | 12345/01       | 2024-02-14 | 333.33
000123002 | 12345/02       | 2024-03-16 | 333.33
000123003 | 12345/03       | 2024-04-15 | 333.34  -- ← Recebe centavos
```

### Identificação de Parcelas Relacionadas

```sql
-- Buscar todas as parcelas de um nro_dup base
SELECT * FROM dbpgto 
WHERE nro_dup LIKE '12345/%'
ORDER BY nro_dup;

-- Resultado:
-- 12345/01, 12345/02, 12345/03
```

## ✨ Vantagens da V2

### Comparação com V1

| Característica | V1 (Antiga) | V2 (Nova) |
|----------------|-------------|-----------|
| Interface | 2 inputs numéricos | Lista interativa |
| Flexibilidade | Intervalo fixo | Vencimentos customizados |
| Preview | Texto simples | Lista com valores |
| Remoção | Recomeçar tudo | Remover individual |
| Padrão | Próprio | Segue faturamento |
| UX | Básica | Profissional |

### Benefícios

✅ **Visual:** Lista de parcelas com scroll  
✅ **Interativo:** Adicionar/remover parcelas individualmente  
✅ **Flexível:** Vencimentos personalizados (não apenas intervalos fixos)  
✅ **Consistente:** Mesmo padrão do faturamento  
✅ **Intuitivo:** Botões claros, feedback imediato  
✅ **Preview:** Vê valores e datas antes de salvar  

## 🔍 Validações

### Frontend
```typescript
// 1. Verificar se checkbox está marcado
if (novaContaDados.parcelado && parcelas.length === 0) {
  toast.error('Adicione ao menos uma parcela');
  return;
}

// 2. Validar prazo antes de adicionar
if (!dias || dias <= 0) {
  toast.error('Insira um prazo válido em dias.');
  return;
}

// 3. Exigir data base
if (!novaContaDados.dt_venc) {
  toast.error('Selecione a data de vencimento base primeiro.');
  return;
}
```

### Backend
```typescript
// Validação implícita
const totalParcelas = parcelado && parcelas.length > 0 ? parcelas.length : 1;
// Se parcelado=true mas parcelas=[], totalParcelas=1 (conta única)
```

## 📊 Exemplo Completo

### Input do Usuário
```
Valor Total: R$ 1.500,00
Data Base: 15/01/2024
Parcelado: ✓

Parcelas adicionadas:
- 30 dias → 14/02/2024
- 45 dias → 01/03/2024  
- 60 dias → 16/03/2024
```

### Preview Calculado
```
Parcela 1: 30 dias → 14/02/2024 → R$ 500,00
Parcela 2: 45 dias → 01/03/2024 → R$ 500,00
Parcela 3: 60 dias → 16/03/2024 → R$ 500,00

Resumo:
• 3x de R$ 500,00
• Total: R$ 1.500,00
```

### Registros Criados
```sql
INSERT INTO dbpgto (cod_pgto, nro_dup, dt_venc, valor_pgto, ...) VALUES
('000123001', 'DUP12345678/01', '2024-02-14', 500.00, ...),
('000123002', 'DUP12345678/02', '2024-03-01', 500.00, ...),
('000123003', 'DUP12345678/03', '2024-03-16', 500.00, ...);
```

## 🎯 Casos de Uso

### 1. Fornecedor com Prazo Fixo
**Cenário:** Compra de R$ 3.000,00 para pagar em 30, 60, 90 dias

**Ação:**
- Data base: hoje
- Adicionar 30 → primeira parcela
- Adicionar 60 → segunda parcela
- Adicionar 90 → terceira parcela

### 2. Aluguel Mensal
**Cenário:** Aluguel de R$ 5.000,00 por 12 meses

**Ação:**
- Data base: 05/02/2024
- Adicionar 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360 dias

### 3. Parcelamento Irregular
**Cenário:** Acordo de pagamento com entrada e 2 parcelas

**Ação:**
- Criar conta 1: R$ 500,00 (entrada) → vencimento hoje
- Criar conta 2: R$ 1.000,00 parcelada em 2x
  - Adicionar 30 dias → R$ 500,00
  - Adicionar 60 dias → R$ 500,00

## 🛠️ Manutenção

### Arquivos Modificados

1. **ContasAPagar.tsx** (Frontend)
   - Adicionados estados `parcelas` e `prazoSelecionado`
   - Nova seção de UI com lista interativa
   - Validação antes do submit

2. **criar.ts** (Backend)
   - Parâmetro `parcelas` substituindo `num_parcelas` e `intervalo_dias`
   - Loop usa `parcelas[i].vencimento` diretamente
   - Mantida lógica de distribuição de centavos

### Compatibilidade

✅ **V1 → V2:** Mantém funcionamento sem parcelas (conta única)  
✅ **Banco de Dados:** Nenhuma alteração de schema necessária  
✅ **API:** Retrocompatível (parcelado=false funciona normalmente)  

## 📚 Referências

- **Padrão Original:** `src/components/corpo/faturamento/CobrancaFatura/index.tsx`
- **Documentação V1:** `SISTEMA-PARCELAMENTO-CONTAS-PAGAR.md`
- **Oracle Patterns:** `investigar-parcelas-dbpgto.js`

---

**Versão:** 2.0  
**Data:** 2024  
**Autor:** Sistema Melo - Implementação de Parcelamento Avançado

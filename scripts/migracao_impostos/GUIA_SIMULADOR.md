# Guia Rápido - Simulador Comparativo de Impostos

## 📋 Índice

1. [Introdução](#introdução)
2. [Instalação](#instalação)
3. [Modo Interativo](#modo-interativo)
4. [Modo Batch](#modo-batch)
5. [Interpretando Resultados](#interpretando-resultados)
6. [Troubleshooting](#troubleshooting)

---

## Introdução

O **Simulador Comparativo** é uma ferramenta que valida se os cálculos de impostos estão idênticos entre:

- **Sistema Antigo:** Oracle Database (Delphi)
- **Sistema Novo:** PostgreSQL (Next.js)

**Use quando:**
- Alterar lógica de cálculo de impostos
- Antes de fazer deploy em produção
- Para documentar homologação
- Debugar divergências de valores

---

## Instalação

### Pré-requisitos

✅ Node.js instalado
✅ Acesso aos bancos Oracle e PostgreSQL
✅ Dependências já instaladas:

```bash
cd E:\src\next\sistemas\clones\melo\site-melo
npm install
# oracledb e pg já estão no package.json
```

### Verificar Conexão

```bash
# Testar conexão PostgreSQL
node scripts/migracao_impostos/debug_tables.js

# Se funcionar, você está pronto!
```

---

## Modo Interativo

### Quando usar?

- Testar um produto/cliente específico
- Debug de divergência pontual
- Validação rápida

### Como executar?

```bash
cd E:\src\next\sistemas\clones\melo\site-melo
node scripts/migracao_impostos/simulador-comparativo.js
```

### Exemplo Completo

```
╔═══════════════════════════════════════════╗
║  SIMULADOR COMPARATIVO DE IMPOSTOS       ║
║  Oracle (Delphi) vs PostgreSQL (Next.js) ║
╚═══════════════════════════════════════════╝

🔌 Conectando aos bancos de dados...
   → Conectando Oracle...
   ✓ Oracle conectado
   → Conectando PostgreSQL...
   ✓ PostgreSQL conectado

✓ Conexões estabelecidas com sucesso!

══════════════════════════════════════════════════
DADOS DE ENTRADA
══════════════════════════════════════════════════

Produto (código ou descrição): 123
🔍 Buscando produto: "123"...
   ✓ Produto encontrado: [123] AR CONDICIONADO AUTOMOTIVO
   NCM: 84213920 | IPI: 15% | UF Origem: AM

Cliente (código ou nome): DISTRIBUIDORA
🔍 Buscando cliente: "DISTRIBUIDORA"...
   ✓ Cliente encontrado: [456] DISTRIBUIDORA XYZ LTDA
   UF: SP | IE: 123456789

Valor unitário (R$): 1000
Quantidade (padrão 1): 1

══════════════════════════════════════════════════

⚙️  Calculando impostos Oracle...
   → Consultando tabelas Oracle diretamente...
   ✓ Cálculo direto concluído

⚙️  Calculando impostos PostgreSQL...
   → Consultando tabelas PostgreSQL diretamente...
   ✓ Cálculo direto concluído

📊 COMPARAÇÃO DE RESULTADOS:

══════════════════════════════════════════════════════════════════════════════════════
Campo                     | Oracle             | PostgreSQL         | Status
══════════════════════════════════════════════════════════════════════════════════════
CFOP                      | 6102               | 6102               | ✓
CST ICMS                  | 10                 | 10                 | ✓
Alíquota ICMS             | 12%                | 12%                | ✓
Base ICMS                 | R$ 1000.00         | R$ 1000.00         | ✓
Valor ICMS                | R$ 120.00          | R$ 120.00          | ✓
MVA Original              | 71.78%             | 71.78%             | ✓
MVA Ajustado              | 71.78%             | 71.78%             | ✓
Base ST                   | R$ 1717.80         | R$ 1717.80         | ✓
Valor ST                   | R$ 86.14           | R$ 86.14           | ✓
Alíquota IPI              | 15%                | 15%                | ✓
Valor IPI                 | R$ 150.00          | R$ 150.00          | ✓
Alíquota PIS              | 1.65%              | 1.65%              | ✓
Valor PIS                 | R$ 16.50           | R$ 16.50           | ✓
Alíquota COFINS           | 7.6%               | 7.6%               | ✓
Valor COFINS              | R$ 76.00           | R$ 76.00           | ✓
Alíquota IBS (2026)       | N/A                | 0.1%               | NOVO
Alíquota CBS (2026)       | N/A                | 0.9%               | NOVO
══════════════════════════════════════════════════════════════════════════════════════

📈 RESUMO:
   ✓ Compatíveis: 14 campos (100%)
   ✗ Divergentes: 0 campos
   ✨ Novos (PG): 2 campos (IBS/CBS)

✅ RESULTADO: SISTEMAS COMPATÍVEIS!

💾 Relatório salvo:
   • JSON: E:\src\next\...\teste_2026-01-09_164523.json
   • MD: E:\src\next\...\teste_2026-01-09_164523.md

══════════════════════════════════════════════════
✅ Simulação concluída com sucesso!
══════════════════════════════════════════════════

✓ Conexão Oracle fechada
✓ Pool PostgreSQL fechado
```

### Dicas

**Busca por código:**
```
Produto: 123
Cliente: 456
```

**Busca por descrição (case-insensitive):**
```
Produto: ar condicionado
Cliente: distribuidora xyz
```

**Se múltiplos resultados:**
```
📋 Múltiplos produtos encontrados (Oracle):
   1. [123] AR CONDICIONADO AUTOMOTIVO
   2. [124] AR CONDICIONADO RESIDENCIAL
   3. [125] AR CONDICIONADO SPLIT

Digite o número do produto desejado: 1
```

---

## Modo Batch

### Quando usar?

- Executar múltiplos testes de uma vez
- Testes de regressão antes de deploy
- Documentar homologação completa
- Validar após mudanças em lote

### Como executar?

```bash
# Usar casos de teste inclusos
node scripts/migracao_impostos/simulador-batch.js

# Ou especificar seu próprio arquivo
node scripts/migracao_impostos/simulador-batch.js meus-casos.json
```

### Exemplo de Saída

```
╔═══════════════════════════════════════════════════╗
║  SIMULADOR COMPARATIVO - MODO BATCH              ║
╚═══════════════════════════════════════════════════╝

🔌 Conectando aos bancos de dados...
✓ 3 casos de teste carregados

════════════════════════════════════════════════════════════════════════════════
CASO 1/3: Caso 1 - Venda Interestadual com ST
════════════════════════════════════════════════════════════════════════════════
Descrição: Venda de ar condicionado de AM para SP com substituição tributária

🔍 Buscando produto: "AR CONDICIONADO"...
   ✓ Produto encontrado: [123] AR CONDICIONADO AUTOMOTIVO

🔍 Buscando cliente: "DISTRIBUIDORA"...
   ✓ Cliente encontrado: [456] DISTRIBUIDORA XYZ LTDA

⚙️  Calculando impostos Oracle...
   ✓ Cálculo direto concluído

⚙️  Calculando impostos PostgreSQL...
   ✓ Cálculo direto concluído

📊 COMPARAÇÃO DE RESULTADOS:
[Tabela exibida]

✅ RESULTADO: COMPATÍVEL!
💾 Relatório salvo

════════════════════════════════════════════════════════════════════════════════
CASO 2/3: Caso 2 - Venda Interna sem ST
════════════════════════════════════════════════════════════════════════════════
[...]

════════════════════════════════════════════════════════════════════════════════
RESUMO FINAL
════════════════════════════════════════════════════════════════════════════════

Total de casos: 3
✓ Sucessos: 3
✗ Erros: 0
⚠ Incompletos: 0

✅ TODOS OS TESTES PASSARAM!

════════════════════════════════════════════════════════════════════════════════
```

### Criar Casos Customizados

Edite `testes_comparativos/casos-teste.json`:

```json
[
  {
    "nome": "Venda Produto XYZ",
    "descricao": "Cenário específico para validar",
    "produto": {
      "termo_busca": "XYZ",
      "id_produto": 999
    },
    "cliente": {
      "termo_busca": "CLIENTE ABC",
      "id_cliente": 888
    },
    "valores": {
      "valor_unitario": 500.00,
      "quantidade": 2
    },
    "resultado_esperado": {
      "cfop": "5102",
      "tem_st": false,
      "tem_ipi": false,
      "observacoes": [
        "Operação interna",
        "Sem substituição tributária"
      ]
    }
  }
]
```

---

## Interpretando Resultados

### Relatório Individual (JSON)

Arquivo: `teste_2026-01-09_164523.json`

```json
{
  "timestamp": "2026-01-09T16:45:23.000Z",
  "entrada": {
    "produto": {
      "id_produto": 123,
      "descricao": "AR CONDICIONADO AUTOMOTIVO",
      "ncm": "84213920"
    },
    "cliente": {
      "id_cliente": 456,
      "nome": "DISTRIBUIDORA XYZ LTDA",
      "uf": "SP"
    },
    "valor": 1000,
    "quantidade": 1
  },
  "oracle": {
    "cfop": "6102",
    "cst_icms": "10",
    "valor_icms": "120.00",
    "valor_st": "86.14",
    "metodo": "CONSULTA_DIRETA"
  },
  "postgresql": {
    "cfop": "6102",
    "cst_icms": "10",
    "valor_icms": "120.00",
    "valor_st": "86.14",
    "valor_ibs": "1.00",
    "valor_cbs": "9.00",
    "metodo": "CONSULTA_DIRETA"
  },
  "comparacao": {
    "total": 15,
    "compativeis": 15,
    "divergentes": 0,
    "novos": 2,
    "percentual": "100.0"
  }
}
```

### Relatório Individual (Markdown)

Arquivo: `teste_2026-01-09_164523.md`

Contém:
- Dados de entrada (produto, cliente, valores)
- Resultados Oracle (JSON completo)
- Resultados PostgreSQL (JSON completo)
- Tabela comparativa
- Estatísticas
- Observações

**Use para:**
- Documentar homologação
- Anexar em tickets/PRs
- Compartilhar com equipe

### Relatório Consolidado (Batch)

Arquivo: `consolidado_2026-01-09.md`

Contém:
- Resumo executivo (% sucesso)
- Detalhes de cada caso
- Divergências encontradas
- Conclusões e próximos passos

**Use para:**
- Validação geral do sistema
- Relatório de testes de regressão
- Documentação de release

---

## Troubleshooting

### Erro: Cannot connect to Oracle

```
✗ Erro ao conectar: ORA-12541: TNS:no listener
```

**Solução:**
1. Verificar se Oracle está rodando
2. Testar ping: `ping 201.64.221.132`
3. Verificar firewall/VPN
4. Confirmar credenciais no script

---

### Erro: PostgreSQL authentication failed

```
✗ Erro ao conectar: password authentication failed
```

**Solução:**
1. Verificar senha em `PG_CONFIG`
2. Confirmar usuário tem permissão
3. Testar conexão: `psql -h servicos.melopecas.com.br -U postgres`

---

### Warning: Package não encontrado

```
⚠ Package CALCULO_IMPOSTO.Calcular_Impostos não encontrado
Tentando consulta direta nas tabelas...
```

**Status:** ✅ Normal!

O simulador tem **fallback automático**. Se o package Oracle não existir, ele consulta as tabelas diretamente e calcula os impostos usando a mesma lógica.

---

### Warning: Função PG não encontrada

```
⚠ Função calcular_icms_completo não encontrada
Tentando consulta direta nas tabelas...
```

**Solução:**
```bash
# Criar as funções SQL
node scripts/migracao_impostos/executar_direto.js
```

Ou aceitar o fallback (consulta direta).

---

### Produto/Cliente não encontrado

```
✗ Nenhum produto encontrado
```

**Causas possíveis:**
1. Produto não existe no banco
2. Termo de busca incorreto
3. Produto só existe em um banco (não migrado)

**Soluções:**
- Buscar por código numérico exato
- Usar descrição parcial (ex: "AR COND" em vez de "AR CONDICIONADO COMPLETO")
- Verificar em qual banco o produto existe:
  ```bash
  node scripts/migracao_impostos/debug_tables.js
  ```

---

### Divergências de valores

```
⚠️  RESULTADO: DIVERGÊNCIAS ENCONTRADAS

Possíveis causas:
   • MVA diferente entre sistemas
   • Alíquota ICMS divergente
   • Regras de base reduzida diferentes
   • Arredondamentos
```

**Como investigar:**

1. **Verificar MVA:**
   ```sql
   -- Oracle
   SELECT * FROM cad_legislacao_icmsst_ncm
   WHERE "LIN_NCM" = '84213920';

   -- PostgreSQL
   SELECT * FROM db_manaus.cad_legislacao_icmsst_ncm
   WHERE "LIN_NCM" = '84213920';
   ```

2. **Verificar alíquotas ICMS:**
   ```sql
   -- PostgreSQL
   SELECT * FROM db_manaus.fis_tributo_aliquota
   WHERE codigo = 'A001';
   ```

3. **Revisar lógica de cálculo:**
   - Abrir `simulador-comparativo.js`
   - Função `calcularOracleDireto()` vs `calcularPostgreSQLDireto()`
   - Comparar fórmulas

4. **Aceitar margem de erro:**
   - Diferenças < R$ 0,01 são automaticamente aceitas
   - Se diferença for apenas arredondamento, está OK

---

### Performance lenta

```
⚙️  Calculando impostos Oracle...
   ✓ Cálculo direto concluído (3521ms)
```

**Se tempo > 1s:**

1. **Verificar índices:**
   ```bash
   node scripts/migracao_impostos/criar_indices.js
   ```

2. **Checar carga do banco:**
   - Horário de pico?
   - Outros processos rodando?

3. **Otimizar queries:**
   - Adicionar índices específicos
   - Revisar JOINs desnecessários

---

## Fluxo de Trabalho Recomendado

### Antes de Deploy

```bash
# 1. Executar testes batch
node scripts/migracao_impostos/simulador-batch.js

# 2. Verificar relatório consolidado
cat scripts/migracao_impostos/testes_comparativos/consolidado_*.md

# 3. Se 100% sucesso → DEPLOY OK
# 4. Se divergências → INVESTIGAR antes de deploy
```

### Após Alteração de Código

```bash
# 1. Fazer a alteração (ex: mudar cálculo de MVA)

# 2. Testar caso específico
node scripts/migracao_impostos/simulador-comparativo.js
# Testar produto afetado pela mudança

# 3. Se OK, rodar suite completa
node scripts/migracao_impostos/simulador-batch.js

# 4. Documentar no PR
git add scripts/migracao_impostos/testes_comparativos/
git commit -m "chore: validar cálculo de impostos após alteração MVA"
```

### Para Documentar Homologação

```bash
# 1. Criar casos específicos da homologação
cp casos-teste.json casos-homologacao.json
# Editar casos-homologacao.json

# 2. Executar
node scripts/migracao_impostos/simulador-batch.js casos-homologacao.json

# 3. Enviar relatório consolidado
# scripts/migracao_impostos/testes_comparativos/consolidado_2026-01-09.md
```

---

## Arquivos Importantes

```
scripts/migracao_impostos/
├── simulador-comparativo.js        ← Script principal (interativo)
├── simulador-batch.js              ← Script batch (múltiplos testes)
├── GUIA_SIMULADOR.md              ← Este guia
├── README.md                       ← Documentação geral
└── testes_comparativos/
    ├── casos-teste.json            ← 3 casos pré-configurados
    ├── teste_*.json                ← Resultados individuais (JSON)
    ├── teste_*.md                  ← Resultados individuais (MD)
    └── consolidado_*.md            ← Relatório consolidado
```

---

## Exemplos Práticos

### Exemplo 1: Validar Produto Específico

```bash
node simulador-comparativo.js

Produto: 84213920
Cliente: 456
Valor: 1500
Quantidade: 2
```

**Resultado:** Relatório individual comparando Oracle vs PG.

---

### Exemplo 2: Validar Múltiplos Cenários

```bash
node simulador-batch.js
```

**Resultado:** 3 relatórios individuais + 1 consolidado.

---

### Exemplo 3: Debug de Divergência

```bash
# 1. Identificar produto com divergência (via relatório)
# 2. Testar individualmente
node simulador-comparativo.js

Produto: [código do produto]
Cliente: [código do cliente]
Valor: [mesmo valor do erro]

# 3. Analisar relatório JSON/MD gerado
# 4. Investigar causa (MVA, alíquota, etc)
```

---

## Checklist Final

Antes de considerar o simulador pronto:

- [ ] Conexões Oracle e PostgreSQL funcionando
- [ ] Script interativo roda sem erros
- [ ] Script batch executa os 3 casos
- [ ] Relatórios JSON/MD são gerados
- [ ] Documentação lida e compreendida
- [ ] Casos de teste customizados criados (opcional)

---

## Próximos Passos

1. ✅ Executar teste piloto
2. ✅ Validar com produto/cliente real
3. ✅ Revisar relatório gerado
4. ✅ Criar casos de teste específicos do negócio
5. ✅ Integrar no fluxo de CI/CD (opcional)

---

**Última atualização:** 2026-01-09
**Versão:** 1.0

# Integração com a Calculadora Tributária do Governo Federal

Este documento explica como integrar e usar a API da Calculadora Tributária do Governo Federal no sistema.

## 📋 Visão Geral

A integração permite calcular automaticamente os impostos (IBS, CBS, ICMS, PIS, COFINS) utilizando a API oficial do governo em:
```
https://piloto-cbs.tributos.gov.br/servico/calculadora-consumo/api/calculadora/regime-geral
```

## 🖥️ Tela de Cálculo Manual

Foi criada uma tela completa de cálculo manual de impostos, acessível através do menu:

**Menu → Financeiro → Calculadora Tributária**

Rota: `/admin/financeiro/calculadora-tributaria`

### Funcionalidades da Tela:
- ✅ Entrada manual de todos os dados (NCM, valores, UFs)
- ✅ Não depende de consultas ao banco de dados
- ✅ Interface intuitiva com formulário à esquerda e resultado à direita
- ✅ Validação de campos obrigatórios
- ✅ Cálculo automático do valor total
- ✅ Exibição detalhada de cada imposto
- ✅ Percentual de impostos sobre o valor
- ✅ Loading durante o cálculo
- ✅ Tratamento de erros claro

### Campos do Formulário:
- **Descrição do Produto** (opcional)
- **NCM** (obrigatório - 8 dígitos)
- **CEST** (opcional)
- **Quantidade** (obrigatório)
- **Valor Unitário** (obrigatório)
- **UF Origem** (obrigatório - seleção)
- **UF Destino** (obrigatório - seleção)
- **Tipo de Operação** (venda/importação/industrialização)
- **Finalidade** (consumo/revenda/industrialização)
- **Regime Tributário** (Simples Nacional/Lucro Presumido/Lucro Real)

## 🗂️ Arquivos Criados

### 1. Tela de Cálculo Manual
**Arquivo:** `src/components/corpo/admin/calculadora/CalculadoraTributariaManual.tsx`

Tela completa e independente para cálculo de impostos com entrada manual de dados.

### 1. Serviço (`src/services/calculadoraTributaria.ts`)
Serviço base que faz a comunicação direta com a API do governo.

**Principais funções:**
- `calcularImpostosGoverno()` - Calcula impostos para um produto
- `calcularImpostosMultiplosProdutos()` - Calcula para vários produtos de uma vez

### 2. API Endpoint (`src/pages/api/impostos/calculadora-governo.ts`)
Endpoint interno que aceita dados manuais **sem necessidade de consultar banco de dados**.

**Rota:** `POST /api/impostos/calculadora-governo`

**Parâmetros:**
```json
{
  "ncm": "string",             // NCM do produto - 8 dígitos (obrigatório)
  "cest": "string",            // CEST (opcional)
  "quantidade": number,        // Quantidade (padrão: 1)
  "valorUnitario": number,     // Valor unitário (obrigatório)
  "descricaoProduto": "string", // Descrição do produto (opcional)
  "ufOrigem": "string",        // UF de origem (obrigatório)
  "ufDestino": "string",       // UF de destino (obrigatório)
  "tipoOperacao": "venda",     // venda | importacao | industrializacao
  "finalidade": "consumo",     // consumo | revenda | industrializacao
  "regimeTributario": "simples_nacional" // simples_nacional | lucro_presumido | lucro_real
}
```

**Resposta:**
```json
{
  "sucesso": true,
  "produto": {
    "codigo": "string",
    "descricao": "string",
    "ncm": "string",
    "cest": "string",
    "unidade": "string"
  },
  "operacao": {
    "quantidade": number,
    "valorUnitario": number,
    "valorTotal": number,
    "ufOrigem": "string",
    "ufDestino": "string"
  },
  "impostos": [
    {
      "tipo": "IBS",
      "aliquota": 12.5,
      "base": 100.00,
      "valor": 12.50
    }
  ],
  "totalImpostos": 25.00,
  "valorTotalComImpostos": 125.00
}
```

### 3. Hook React (`src/hooks/useCalculadoraTributaria.ts`)
Hook customizado para facilitar o uso no frontend.

**Exemplo de uso:**
```tsx
import { useCalculadoraTributaria } from '@/hooks/useCalculadoraTributaria';

function MeuComponente() {
  const { calcularImpostos, isCalculando, resultado, erro } = useCalculadoraTributaria();

  const handleCalcular = async () => {
    const resultado = await calcularImpostos(
      {
        codProd: '001',
        quantidade: 10,
        valorUnitario: 50.00
      },
      {
        codCli: '1234',
        tipoOperacao: 'venda',
        finalidade: 'consumo'
      }
    );

    if (resultado) {
      console.log('Total de impostos:', resultado.totalImpostos);
    }
  };

  return (
    <div>
      <button onClick={handleCalcular} disabled={isCalculando}>
        {isCalculando ? 'Calculando...' : 'Calcular Impostos'}
      </button>
      
      {resultado && (
        <div>
          <p>Total de impostos: R$ {resultado.totalImpostos.toFixed(2)}</p>
        </div>
      )}
      
      {erro && <p className="text-red-600">{erro}</p>}
    </div>
  );
}
```

### 4. Componente Pronto (`src/components/corpo/vendas/CalculadoraImpostosGoverno.tsx`)
Componente visual completo e pronto para usar.

**Exemplo de uso:**
```tsx
import CalculadoraImpostosGoverno from '@/components/corpo/vendas/CalculadoraImpostosGoverno';

function TelaVenda() {
  const [impostos, setImpostos] = useState(null);

  return (
    <div>
      <CalculadoraImpostosGoverno
        codProd="001"
        descricaoProduto="Notebook Dell"
        quantidade={2}
        valorUnitario={3500.00}
        codCliente="1234"
        autoCalcular={true}
        onImpostosCalculados={(resultado) => {
          setImpostos(resultado);
          console.log('Impostos calculados:', resultado);
        }}
      />
    </div>
  );
}
```

## 🚀 Como Integrar no Fluxo de Vendas

### Opção 1: Cálculo Automático ao Adicionar Produto

```tsx
// Em seu componente de venda
import { useCalculadoraTributaria } from '@/hooks/useCalculadoraTributaria';

function AdicionarProdutoVenda() {
  const { calcularImpostos } = useCalculadoraTributaria();
  
  const handleAdicionarProduto = async (produto) => {
    // Calcular impostos automaticamente
    const impostosCalculados = await calcularImpostos({
      codProd: produto.codigo,
      quantidade: produto.quantidade,
      valorUnitario: produto.preco
    });
    
    if (impostosCalculados) {
      // Adicionar produto com impostos calculados
      adicionarAoCarrinho({
        ...produto,
        impostos: impostosCalculados.impostos,
        totalImpostos: impostosCalculados.totalImpostos,
        valorComImpostos: impostosCalculados.valorTotalComImpostos
      });
    }
  };
  
  return (/* seu JSX */);
}
```

### Opção 2: Botão Manual para Calcular

```tsx
import CalculadoraImpostosGoverno from '@/components/corpo/vendas/CalculadoraImpostosGoverno';

function ItemVenda({ item }) {
  return (
    <div>
      <div>Produto: {item.descricao}</div>
      
      {/* Componente com botão manual */}
      <CalculadoraImpostosGoverno
        codProd={item.codigo}
        descricaoProduto={item.descricao}
        quantidade={item.quantidade}
        valorUnitario={item.preco}
        autoCalcular={false}  // Cálculo manual
      />
    </div>
  );
}
```

### Opção 3: Cálculo em Lote para Todos os Produtos

```tsx
import { calcularImpostosMultiplosProdutos } from '@/services/calculadoraTributaria';

async function calcularTodosImpostos(produtos) {
  const requisicoes = produtos.map(p => ({
    ncm: p.ncm,
    valorOperacao: p.quantidade * p.preco,
    quantidadeComercial: p.quantidade,
    ufOrigem: 'AM',
    ufDestino: 'SP',
  }));
  
  const resultados = await calcularImpostosMultiplosProdutos(requisicoes);
  return resultados;
}
```

## ⚙️ Requisitos

### Dados Necessários
**A tela de cálculo manual NÃO depende do banco de dados.**  
Todos os dados são informados manualmente pelo usuário:
- NCM do produto (8 dígitos)
- Valor unitário e quantidade
- UF de origem e destino
- Tipo de operação e finalidade

### API do Governo
A API do governo deve estar disponível e acessível.

## 🔍 Troubleshooting

### Erro: "NCM é obrigatório e deve ter 8 dígitos"
**Solução:** Informe um NCM válido com exatamente 8 dígitos numéricos.

### Erro: "UF de origem e destino são obrigatórias"
**Solução:** Selecione ambas as UFs nos campos obrigatórios.

### API do Governo Indisponível
**Solução:** A API pode estar fora do ar. Aguarde e tente novamente mais tarde.

## � Notas Importantes

- **Sem dependência de banco:** A tela manual não precisa de dados cadastrados
- A API do governo pode ter limites de requisições
- O cálculo é feito em tempo real, pode haver latência
- Sempre valide o NCM antes de enviar (8 dígitos)
- Os impostos calculados são baseados na legislação atual do governo
- A tela está acessível em: **Menu → Financeiro → Calculadora Tributária**

## 🎯 Resumo da Implementação

✅ **API simplificada** sem consultas ao banco  
✅ **Tela completa** de cálculo manual  
✅ **Menu integrado** em Financeiro  
✅ **Interface intuitiva** com validações  
✅ **Resultados detalhados** por tipo de imposto  
✅ **Pronto para uso** - não precisa de configuração adicional

## 🔗 Links Úteis

- API do Governo: https://piloto-cbs.tributos.gov.br/
- Documentação NCM: https://www.gov.br/receitafederal/pt-br/assuntos/comercio-exterior/negociar/nomenclatura-comum-do-mercosul-ncm

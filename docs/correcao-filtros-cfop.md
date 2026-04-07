# Correção dos Filtros na Tela de Cadastro CFOP

## 🔍 Problema Identificado

A tela de cadastro de CFOP apresentava problemas nos filtros, onde:

- **Filtros rápidos** não funcionavam corretamente
- **Filtros avançados** não retornavam resultados
- **Busca por número de CFOP** não encontrava registros existentes

## 🛠️ Causa Raiz

A API de CFOP (`/api/cfop/index.ts`) estava implementada de forma diferente do padrão usado em outras telas (como Clientes):

1. **Método incorreto**: Usava apenas GET, enquanto os filtros são enviados via POST
2. **Sem processamento de filtros avançados**: Não havia lógica para interpretar os filtros enviados pelo frontend
3. **Busca limitada**: A busca global não estava sendo processada corretamente

## ✅ Solução Implementada

### 1. **Atualização da API** (`src/pages/api/cfop/index.ts`)

#### Alterações principais:

- **Suporte a POST para listagem**: A API agora aceita POST além de GET
- **Processamento de filtros avançados**: Implementada lógica completa para processar filtros com diferentes operadores
- **Diferenciação de requisições**: POST pode ser para listagem (com filtros) ou criação (com dados do CFOP)
- **Busca global aprimorada**: Busca funciona corretamente nos campos `cfop` e `descr`

#### Mapeamento de colunas:

```typescript
const filtroParaColunaSQL: Record<string, string> = {
  cfop: '"cfop"',
  descr: '"descr"',
  cfopinverso: '"cfopinverso"',
  excecao: '"excecao"',
};
```

#### Operadores suportados:

- `igual`: Valor exato (=)
- `diferente`: Diferente de (<>)
- `maior`: Maior que (>)
- `maior_igual`: Maior ou igual (>=)
- `menor`: Menor que (<)
- `menor_igual`: Menor ou igual (<=)
- `contém`: Contém texto (%valor%)
- `começa`: Começa com (valor%)
- `termina`: Termina com (%valor)
- `nulo`: Campo é nulo (IS NULL)
- `nao_nulo`: Campo não é nulo (IS NOT NULL)

### 2. **Atualização do Serviço** (`src/data/cfop/cfop.ts`)

#### Alterações principais:

- **Migração para POST**: Todas as requisições de listagem agora usam POST
- **Envio de filtros**: Filtros são enviados corretamente no corpo da requisição
- **Suporte a busca global**: Busca também é enviada via POST

#### Lógica de decisão:

```typescript
// Se há filtros avançados, usar POST
if (filtros && filtros.length > 0) {
  const response = await api.post('/api/cfop', {
    page,
    perPage,
    filtros,
  });
  return response.data;
}

// Se há busca global sem filtros, usar POST também
if (search) {
  const response = await api.post('/api/cfop', {
    page,
    perPage,
    search,
    filtros: [],
  });
  return response.data;
}
```

## 🎯 Resultado

Agora os filtros funcionam corretamente:

### ✅ Filtros Rápidos

- Pesquisa instantânea nos campos visíveis na tabela
- Suporte a diferentes tipos de comparação (contém, igual, maior que, etc.)

### ✅ Filtros Avançados

- Permite combinar múltiplos filtros
- Filtros do mesmo campo são unidos com OR
- Filtros de campos diferentes são unidos com AND
- Modal de filtros avançados totalmente funcional

### ✅ Busca Global

- Busca por número de CFOP
- Busca por descrição
- Resultados aparecem corretamente

## 📊 Exemplo de Uso

### Buscar CFOP específico:

1. Digite o número do CFOP no campo de pesquisa (ex: "5102")
2. Pressione Enter ou clique fora do campo
3. Resultados aparecem imediatamente

### Usar filtros avançados:

1. Clique em "Opções" → "Filtros avançados"
2. Selecione o campo (ex: "cfop")
3. Escolha o tipo de filtro (ex: "Começa com")
4. Digite o valor (ex: "51")
5. Clique em "Aplicar filtros"
6. Todos os CFOPs que começam com "51" serão exibidos

## 🔧 Padrão Seguido

A implementação segue o mesmo padrão da tela de Clientes, que já estava funcionando corretamente:

- API processa filtros via POST
- Filtros são agrupados por campo
- Múltiplos filtros no mesmo campo usam OR
- Filtros em campos diferentes usam AND
- Parâmetros SQL parametrizados para segurança

## 🚀 Próximos Passos

Esta correção pode ser aplicada a outras telas de cadastro que apresentem problemas similares nos filtros. O padrão agora está consistente em:

- CFOP ✅
- Clientes ✅
- Outras telas (se necessário)

## 📝 Notas Técnicas

- **Segurança**: Queries parametrizadas previnem SQL injection
- **Performance**: Índices nas colunas `cfop` e `descr` melhorariam performance
- **Logs**: Console logs adicionados para debug (🔍, ✅, ❌)
- **Compatibilidade**: Mantém compatibilidade com requisições GET antigas

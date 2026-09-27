# Padrão de Tela de Cadastro (SysMelo)

> Objetivo: padronizar **listagem + modal de cadastro/edição** para não refazer os mesmos
> ajustes toda vez (máscaras, colunas amigáveis, obrigatórios, reset do form, DataTable).
>
> Como usar: peça **"faça a tela de \<X\> seguindo o padrão de cadastro"**. A referência
> canônica implementada é **Vendedores** (`src/components/corpo/admin/cadastro/vendedores/`).

---

## Definition of Done (checklist)

- [ ] **Listagem** usa `DataTablePadrao` (NÃO `DataTableFiltro`), com container flex (sem estourar a tela).
- [ ] **Colunas com nomes amigáveis** via `columnLabels` (nunca a coluna crua do banco).
- [ ] **Máscaras**: valores R$ e percentuais **sempre** mascarados; documento (CPF/CNPJ) dinâmico por tipo; celular e CEP mascarados.
- [ ] **Campos numéricos gravam número** (não string crua) na escala certa do banco.
- [ ] **Obrigatórios validados** (zod) com **mensagem amigável** (nunca "Required") + `*` visual + destaque no campo.
- [ ] **Backend**: mensagens de erro com nome amigável; inserts opcionais (NOT NULL) só quando há valor.
- [ ] **Reset do form** funciona no "Limpar" e ao reabrir "Novo" (factory + `key`).
- [ ] **Comboboxes** (`SelectPadrao`) com busca, teclado (setas+Enter) e sem "travar" a lista.
- [ ] **Confirmações/alertas** via `useConfirmarSalvar` (modal central) — NUNCA `window.confirm`/toast de canto.
- [ ] **Validado contra o Delphi** (`C:\Projetos\SysMelo\Desenvolvimento`): campos existentes, quais são obrigatórios, e máscaras.
- [ ] **maxLength do input = tamanho da coluna** (evita "value too long").

---

## 1. Listagem com `DataTablePadrao`

Modelo: `clientes/index.tsx`, `marcas/index.tsx`, `vendedores/index.tsx`.

```tsx
<main className="flex-1 flex flex-col p-4 w-full overflow-hidden">
  <header className="mb-2 flex-shrink-0"> ... Novo + filtros do topo ... </header>
  <div className="flex-1 min-h-20 flex flex-col overflow-hidden">
    <DataTablePadrao
      screenKey="cadastro-<nome>"
      userName={user?.usuario}
      columnLabels={{ codvend: 'Vendedor', NOMERAZAO: 'Apelido', /* ... */ }}
      semColunaDeAcaoPadrao
      nonsortableColumns={['ações']}
      carregando={loading}
      headers={headers}
      rows={rows || []}
      meta={dados.meta}
      onPageChange={...} onPerPageChange={...}
      onSearch={...} onSearchKeyDown={...}
      searchInputPlaceholder="Pesquisar..."
      colunasFiltro={colunasDb}
      onFiltroChange={...}
    />
  </div>
</main>
```

- **Tamanho/scroll**: o `<main>` precisa de `flex-1 flex flex-col overflow-hidden` e a tabela dentro de `flex-1 min-h-20 flex flex-col overflow-hidden` — senão a grade **estoura** a largura da tela.
- **Nome completo vs apelido**: se o SELECT repetir a mesma coluna, traga o dado certo (ex.: subquery correlacionada em `dbdados_vend` para o nome completo).

## 2. Máscaras (helpers em `@/utils/monetario`)

```ts
import { mascaraInputBRL, desmascarar, formatarDecimalBR } from '@/utils/monetario';
```

- **R$ / %** (2 casas): `value={formatarDecimalBR(v)}`, `onChange={e => setV(desmascarar(mascaraInputBRL(e.target.value)))}`. Percentual: capar no limite (ex.: `Math.min(x, 99.99)`).
- **Documento dinâmico** (CPF/CNPJ), **celular**, **CEP**: guardam **só dígitos** (`replace(/\D/g,'')`) e exibem formatado. Rótulo/máscara mudam pelo Tipo (F→CPF, J→CNPJ). Ver `vendedores/_forms/DadosCadastrais.tsx` (helpers `mascaraCPF/CNPJ/Celular/CEP`, `mascararDoc`, `docLabel`).
- **Regra**: o input é controlado (`value=`), não `defaultValue`, quando há máscara.

## 3. Obrigatórios + mensagens amigáveis (zod)

Helper que evita o "Required" (trata `undefined/null` como vazio):

```ts
const obrigatorio = (msg: string, max: number) =>
  z.preprocess((v) => (v == null ? '' : v),
    z.string().min(1, msg).max(max, `Não pode exceder ${max} caracteres`));
```

- No schema: `nome: obrigatorio('Apelido é obrigatório', 30)`, etc. Objetos aninhados (detalhado): idem por campo.
- **Documento**: `.refine(d => d.tipo==='F' ? validarCPF(doc) : d.tipo==='J' ? validarCNPJ(doc) : true, { message:'CPF/CNPJ inválido', path:['cpf_cnpj'] })` (`@/utils/validarDocumento`).
- No form: `required` (mostra `*`) + `error={error?.['caminho.do.campo']}` (o modal mapeia zod com `path.join('.')`).
- **Sempre conferir no Delphi** quais campos são realmente obrigatórios.

## 4. Backend

- **Nomes amigáveis** no erro 23502 (NOT NULL): `nomesAmigaveis[coluna] || coluna`.
- **Inserts opcionais**: só inserir em tabela relacionada quando o campo-chave existir (ex.: PST só se `codpst`), senão NOT NULL quebra.
- `maxLength` do input = `character_maximum_length` da coluna.

## 5. Reset do form (armadilha clássica)

Sintoma: "Limpar" e "Novo" não limpam os campos.

Causas e correções:
1. **Inputs não-controlados** (`defaultValue`) não zeram ao resetar o state → use uma **`key` que remonta** o form: `key={formKey}`, e `setFormKey(k=>k+1)` no clear/abrir.
2. **Estado inicial mutável**: `handleVendedorChange` faz `{...prev}` (cópia rasa) e **muta objetos aninhados no lugar**; se o estado inicial for um `const` de módulo, ele é mutado. Use uma **factory**: `const criarEstadoInicial = () => ({...})` no `useState(() => criarEstadoInicial())` e no clear.

## 6. Comboboxes (`SelectPadrao searchable`)

- **Lista pequena** (cabe em 1 página): carregue tudo e filtre **client-side** (sem `onInputChange` remoto — senão a lista "trava" no último termo).
- **Lista grande** (> página, ex.: 2000): busca remota **isolada** (efeito só daquela lista; não re-buscar as outras nem `setLoading` — evita "a tela atualiza toda").
- O `SelectPadrao` já tem: rótulo fixado do selecionado (`pinnedLabel`), **setas + Enter**, e comparação por `String()`. Picker de "adicionar à lista": amarre `value=`, resete a busca ao selecionar, limpe após adicionar, e `stopPropagation` no Enter do dropdown se houver Enter-para-adicionar no pai.

## 7. Confirmações / alertas

```ts
const { pedirConfirmacao, ConfirmacaoSalvarModal } = useConfirmarSalvar();
pedirConfirmacao(() => acao(), { title, message, type:'warning', confirmText, cancelText });
// render: {ConfirmacaoSalvarModal}   // é ELEMENTO, não componente
```
Nunca `window.confirm` nem toast de canto para confirmação (ver memória "alertas-modal-estilizado").

## 8. Ativo/Inativo (quando aplicável)

Padrão MELO: inativar por **classe/flag**, sem coluna nova (ex.: vendedor classe `001=INATIVO`). Filtro Ativos/Inativos/Todos via o mecanismo de filtros; ação Inativar/Reativar (reativar pede a nova classe). Ver `vendedores/index.tsx` + `api/vendedores/situacao.ts`.

---

## Referência canônica
`src/components/corpo/admin/cadastro/vendedores/` (listagem, modais, `_forms/DadosCadastrais`, `_components`) + `src/pages/api/vendedores/*` + `src/data/vendedores/schemas.ts`.

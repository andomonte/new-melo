# Regras de Busca - MeloSys

## Dois tipos de busca no sistema

### 1. Busca Geral (input único)
Presente em todas as telas no topo do DataTablePadrao. Busca em **múltiplas colunas** ao mesmo tempo (aplic_extendida, descr, ref, codprod).

### 2. Filtro por Coluna (filtro rápido/avançado)
Presente nas linhas de filtro do DataTablePadrao. Busca em **uma coluna específica** (ex: só na Marca, só na Descrição).

---

## Caracteres especiais

| Caractere | Função | Exemplo |
|-----------|--------|---------|
| (espaço) | E (AND) - todas as palavras | `pneu aro 18` |
| `;` ou `,` | OU (OR) - qualquer uma | `pirelli;skf` ou `pirelli,skf` |
| `\|` | Marca - tudo depois busca só na marca | `pneu\|pirelli` |
| `%` na frente | Contém - acha no meio da palavra | `%pneu` |
| `"aspas"` | Frase exata - busca a frase completa | `"mola grande"` |

---

## Busca Geral - Exemplos

| Digitou | Descrição | Marca | Resultado |
|---------|-----------|-------|-----------|
| `pneu` | começa com "pneu" | qualquer | Todos os pneus |
| `pneu%` | começa com (% final ignorado) | qualquer | Mesmo acima |
| `%pneu` | contém "pneu" | qualquer | KIT PNEU, SUPORTE PNEU, PNEU 275 |
| `%pneu%` | contém (% duplicado limpo) | qualquer | Mesmo acima |
| `pneu aro 18` | começa com "pneu" E contém "aro" E contém "18" | qualquer | PNEU ARO 18 PIRELLI |
| `pneu;rolamento` | "pneu" OU "rolamento" | qualquer | Pneus ou Rolamentos |
| `pneu,rolamento` | "pneu" OU "rolamento" | qualquer | Mesmo acima (`,` = `;`) |
| `pneu\|pirelli` | começa com "pneu" | começa com "pirelli" | Pneus Pirelli |
| `pneu\|pirelli;skf` | começa com "pneu" | "pirelli" OU "skf" | Pneus Pirelli ou SKF |
| `pneu\|pirelli,skf` | começa com "pneu" | "pirelli" OU "skf" | Mesmo acima (`,` = `;`) |
| `%pneu\|%pirelli` | contém "pneu" | contém "pirelli" | KIT PNEU PIRELLI |
| `\|pirelli` | qualquer | começa com "pirelli" | Tudo da Pirelli |
| `\|pirelli;skf` | qualquer | "pirelli" OU "skf" | Tudo Pirelli ou SKF |
| `pneu aro 18\|pirelli;skf` | começa com "pneu" E contém "aro" E contém "18" | "pirelli" OU "skf" | Pneus aro 18 Pirelli ou SKF |
| `"mola grande"` | frase exata (começa com) | qualquer | Produtos que começam com "mola grande" |
| `"%mola grande"` | frase exata (contém) | qualquer | BUCHA JUMELO/MOLA GRANDE, etc |
| `300995` | código exato + prefixo demais | qualquer | Produto código 300995 |

**Regra de palavras múltiplas:** a **primeira palavra** é sempre prefixo (começa com), as **demais** são contém (acha em qualquer posição). Colocar `%` na frente de qualquer palavra força contém.

**Colunas buscadas na parte geral:** aplic_extendida, descr, ref, codprod — todas ao mesmo tempo.

**Coluna buscada após `|`:** somente marca.

**Quando busca:** Somente ao pressionar **Enter** (ou ao sair do campo se tiver 3+ caracteres e ainda não buscou).

---

## Filtro por Coluna - Tipos

O filtro por coluna busca **somente na coluna selecionada**. O tipo de operação é escolhido via select:

| Tipo | O que faz | Exemplo |
|------|-----------|---------|
| Começa com | Prefixo | Marca começa com "PIR" |
| Contém | Qualquer posição | Descrição contém "embreagem" |
| Termina com | Sufixo | Ref termina com "A" |
| Igual | Exato | Código igual "300995" |
| Diferente | Diferente de | Status diferente de "inativo" |
| Maior que | Numérico | Estoque > 10 |
| Maior ou igual | Numérico | Preço >= 50 |
| Menor que | Numérico | Preço < 100 |
| Menor ou igual | Numérico | Estoque <= 5 |
| É nulo | Sem valor | Sem marca definida |
| Não é nulo | Com valor | Tem marca |

**Multi-termo no filtro por coluna:**
- `;` e `,` funcionam como OR: `pirelli;skf` na coluna Marca → marca "pirelli" OU "skf"
- Espaço funciona como AND: `alavanca fiat` na Descrição → contém "alavanca" E "fiat"
- O `|` não se aplica (já está numa coluna específica)
- O `%` manual do usuário é ignorado — o tipo selecionado (Começa/Contém/Termina) define o comportamento

**Quando busca:** Somente ao pressionar **Enter** ou ao sair do campo (com `filtrarSomenteAoConfirmar`).

---

## Comparação com Delphi

| Ação | Delphi | Web - Busca Geral | Web - Filtro Coluna |
|------|--------|-------------------|---------------------|
| Começa com | `pneu` + combobox | `pneu` (todas as colunas) | `pneu` (tipo "Começa com") |
| Contém | `%pneu` + combobox | `%pneu` (todas as colunas) | `pneu` (tipo "Contém") |
| Trocar coluna | Combobox manual | Automático (todas) ou `\|` pra marca | Cada coluna tem seu filtro |
| Peça + marca | Não tinha (um campo por vez) | `pneu\|pirelli` | Filtrar marca + filtrar descrição |
| Uma OU outra | Não tinha | `pneu;rolamento` | `pneu;rolamento` na coluna |
| Enter pra buscar | Sim | Sim | Sim |

**O usuário do Delphi pode usar o sistema web da mesma forma que usava antes.** As funcionalidades novas (espaço para AND, `;` e `,` para OR, `|` para marca, `"aspas"` para frase exata) são extras que ele vai descobrindo com o uso.

---

## Cenários possíveis ainda não mapeados

| Cenário | Situação | Como resolver hoje |
|---------|----------|--------------------|
| Buscar por aplicação do veículo | "civic 2010" | `civic 2010` (AND em aplic_extendida) |
| Buscar peça de carro específico | "pastilha freio civic" | `pastilha freio civic` (AND) |
| Buscar por código de barras | número longo tipo EAN | Seria necessário adicionar coluna `codbar` na busca |
| Buscar por grupo de produto | "freios", "suspensão" | Não implementado - precisaria buscar em `codgpp`/grupo |
| Buscar por faixa de preço | "preço entre 50 e 100" | Usar filtro por coluna (Maior que / Menor que) |
| Buscar só produtos com estoque | "mola" mas só com estoque > 0 | Usar filtro por coluna em Estoque (Maior que 0) |
| Buscar por NCM ou classificação fiscal | código NCM | Não implementado na busca geral |
| Negação (excluir termo) | "mola -bengala" (mola sem bengala) | Não implementado ainda |

---

## Implementação

### Onde já foi feito:
- `src/pages/api/produtos/buscaComFiltro.ts` — multi-termo com `;` e espaço (filtro por coluna)
- `src/pages/api/produtos/listaEnriquecida.ts` — multi-termo + multi-coluna (busca geral)

### Onde falta fazer:
- Adicionar suporte ao `|` (marca) e `,` (OR) na listaEnriquecida e buscaComFiltro
- Adicionar suporte ao `%` do usuário (contém) na busca geral
- Padronizar em todas as APIs de busca do sistema
- Aplicar `filtrarSomenteAoConfirmar={true}` em todos os DataTablePadrao

# Sistema de Permissões, Telas e Menu

## Resumo

O menu do sistema é **dinâmico** - só mostra telas que o perfil do usuário tem permissão. O fluxo é:

```
Usuário → Login → Filial → Perfil (por filial) → Permissões (telas) → Menu filtrado
```

## Tabelas

| Tabela | Descrição |
|--------|-----------|
| `tb_login_user` | Usuários (login, senha bcrypt, nome) |
| `tb_login_filiais` | Vínculo usuário ↔ filiais |
| `tb_user_perfil` | Perfil do usuário POR filial (user_login_id, perfil_name, codigo_filial, codvend) |
| `tb_login_perfil` | Definição de perfis (login_perfil_name) |
| `tb_grupo_Permissao` | Permissões: liga perfil → tela (grupoId, tela, editar, cadastrar, remover, exportar) |
| `tb_telas` | Cadastro de telas (CODIGO_TELA, NOME_TELA, PATH_TELA) |
| `tb_login_functions` | Funções do sistema (sigla, descricao) |
| `tb_login_access_user` | Funções por usuário |
| `tb_login_access_perfil` | Funções por perfil |
| `tb_login_armazem_user` | Armazéns por usuário |

Todas no schema `db_manaus`.

## Hierarquia

```
tb_login_user (Usuário)
  └─ tb_login_filiais (Filiais)
      └─ tb_user_perfil (Perfil POR filial)
          └─ tb_login_perfil (Definição do perfil)
              ├─ tb_grupo_Permissao (Telas permitidas)
              │   └─ tb_telas (PATH_TELA = rota no menu)
              └─ tb_login_access_perfil (Funções do perfil)
```

## Perfis existentes

| Perfil | Escopo |
|--------|--------|
| ADMINISTRAÇÃO | Acesso total |
| COMPRADOR | Módulo de compras |
| COMPRADOR ADMIN | Compras + admin |
| COMPRAS | Compras básico |
| COMPRAS ADMIN | Compras + admin |
| DIRETOR | Acesso amplo |
| FATURAMENTO | Módulo faturamento |
| VENDAS | Módulo vendas |
| VENDEDOR | Vendas básico |

## Como adicionar nova tela ao menu

### Passo 1: Registrar na `tb_telas`

```sql
INSERT INTO db_manaus.tb_telas ("NOME_TELA", "PATH_TELA")
VALUES ('Nome da Tela', '/rota/da/tela')
RETURNING "CODIGO_TELA";
```

Se der erro de PK duplicada, corrigir a sequence:

```sql
SELECT setval(
  'db_manaus."tb_telas_CODIGO_TELA_seq"',
  (SELECT MAX("CODIGO_TELA") FROM db_manaus.tb_telas)
);
```

### Passo 2: Adicionar permissão nos perfis desejados

```sql
INSERT INTO db_manaus."tb_grupo_Permissao"
  ("grupoId", tela, editar, cadastrar, remover, exportar)
VALUES
  ('ADMINISTRAÇÃO', <CODIGO_TELA>, true, true, true, true),
  ('COMPRADOR', <CODIGO_TELA>, true, true, true, true);
-- repetir para cada perfil que deve ver a tela
```

### Passo 3: Adicionar no menu (código)

Em `src/components/menus/padrao.tsx`:

1. Lazy import do componente:
```typescript
const MeuComponente = lazy(() => import('@/components/corpo/...'));
```

2. Item no array `menus`:
```typescript
{
  name: 'Nome no Menu',
  href: '/rota/da/tela',  // DEVE bater com PATH_TELA
  icon: IconeLucide,
  corpo: MeuComponente,
}
```

3. Se for submenu de 3 níveis (tipo "Entrada por XML"), registrar em `encontrarCorpoPorTela`:
```typescript
if (tela === '/rota/da/tela') return MeuComponente;
```

### Passo 4: Criar page route

Em `src/pages/<rota>/index.tsx` seguir o padrão de qualquer outra page (copiar de `src/pages/compras/entradas/index.tsx`).

## Como o menu filtra (código)

Arquivo: `src/components/menus/padrao.tsx`, função `PageSidebar`

```typescript
// user.permissoes vem do AuthContext (fetchPermissoes)
// Extrai os PATH_TELA permitidos
const pathsPermitidos = user.permissoes
  .map((p) => p.tb_telas?.PATH_TELA)
  .filter((p): p is string => !!p);

// Filtra menus: só mostra itens cujo href está em pathsPermitidos
```

A filtragem suporta 3 níveis:
- **Nível 1**: item.href diretamente
- **Nível 2**: item.subItems[].href
- **Nível 3**: item.subItems[].subMenuItems[].href (para hasSubmenu=true)

## Queries úteis

### Ver todas as telas

```sql
SELECT "CODIGO_TELA", "NOME_TELA", "PATH_TELA"
FROM db_manaus.tb_telas
ORDER BY "CODIGO_TELA";
```

### Ver permissões de um perfil

```sql
SELECT gp."grupoId", t."NOME_TELA", t."PATH_TELA",
       gp.editar, gp.cadastrar, gp.remover, gp.exportar
FROM db_manaus."tb_grupo_Permissao" gp
JOIN db_manaus.tb_telas t ON gp.tela = t."CODIGO_TELA"
WHERE gp."grupoId" = 'ADMINISTRAÇÃO'
ORDER BY t."PATH_TELA";
```

### Ver quais perfis têm acesso a uma tela

```sql
SELECT gp."grupoId", t."NOME_TELA"
FROM db_manaus."tb_grupo_Permissao" gp
JOIN db_manaus.tb_telas t ON gp.tela = t."CODIGO_TELA"
WHERE t."PATH_TELA" = '/compras/importacao';
```

### Ver perfil de um usuário

```sql
SELECT user_login_id, perfil_name, nome_filial, codvend
FROM db_manaus.tb_user_perfil
WHERE user_login_id = 'LOGIN_DO_USUARIO';
```

## APIs relevantes

| Endpoint | Método | Função |
|----------|--------|--------|
| `/api/postgresql/verUser` | POST | Validar login |
| `/api/perfilFilial/get` | GET | Buscar perfil por filial |
| `/api/grupoPermissoes/get?grupoId=X` | GET | Buscar telas permitidas do perfil |
| `/api/grupoFuncoes/get` | GET | Buscar funções do usuário/perfil |
| `/api/telas/get` | GET | Listar todas as telas (paginado) |
| `/api/perfis/add` | POST | Criar/editar perfil com permissões |
| `/api/usuarios/add` | POST | Criar usuário com perfis/filiais |

## Telas de gestão (UI)

| Tela | Rota | Função |
|------|------|--------|
| Perfis | `/admin/controleAcesso/perfis` | Criar/editar perfis e selecionar telas |
| Telas | `/admin/controleAcesso/telas` | Gerenciar cadastro de telas |
| Usuários | `/admin/controleAcesso/usuarios` | Associar usuário a perfil/filial |
| Funções | `/admin/controleAcesso/funcoes` | Gerenciar funções do sistema |
| Filiais | `/admin/controleAcesso/filiais` | Gerenciar filiais |

## Exemplo real: tela Importação (fev/2026)

```sql
-- 1. Tela criada
INSERT INTO db_manaus.tb_telas ("NOME_TELA", "PATH_TELA")
VALUES ('Importação', '/compras/importacao');
-- CODIGO_TELA = 73

-- 2. Permissão para 6 perfis
INSERT INTO db_manaus."tb_grupo_Permissao"
  ("grupoId", tela, editar, cadastrar, remover, exportar)
VALUES
  ('ADMINISTRAÇÃO', 73, true, true, true, true),
  ('COMPRADOR', 73, true, true, true, true),
  ('COMPRADOR ADMIN', 73, true, true, true, true),
  ('COMPRAS', 73, true, true, true, true),
  ('COMPRAS ADMIN', 73, true, true, true, true),
  ('DIRETOR', 73, true, true, true, true);

-- 3. Menu: item adicionado em padrao.tsx na seção Compras
-- 4. Page: src/pages/compras/importacao/index.tsx
```

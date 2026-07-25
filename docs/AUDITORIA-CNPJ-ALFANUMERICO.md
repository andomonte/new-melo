# Auditoria — Preparação para CNPJ Alfanumérico

**Data:** 2026-07-25
**Escopo:** todo o `src/` do SysMelo (Next.js).
**Veredito:** o sistema **NÃO está preparado** para o CNPJ alfanumérico. O tratamento de documento assume "somente dígitos" em praticamente todos os fluxos, então um CNPJ com letras seria **corrompido** (letras removidas na gravação/comparação) e **reprovado** na validação.

> Regra nova da Receita: CNPJ = 14 caracteres, máscara `AA.AAA.AAA/AAAA-DV`. As **12 primeiras posições** podem ter **letras maiúsculas A–Z ou dígitos 0–9**; as **2 últimas (DV)** continuam **numéricas**. O novo DV usa o **valor ASCII de cada caractere − 48** (`'0'..'9'` → 0..9, `'A'..'Z'` → 17..42), com os mesmos pesos e módulo 11.

---

## 1. Padrões de falha (causa-raiz)

| Cód. | Padrão | Efeito |
|------|--------|--------|
| **P1** | `replace(/\D/g,'')` / `replace(/[^\d]+/g,'')` / `regexp_replace(col,'[^0-9]','')` | Remove as letras A–Z → corrompe o valor e encurta abaixo de 14. |
| **P2** | DV numérico com `parseInt(char)` | `parseInt('A')` = `NaN` → soma quebra → CNPJ válido é reprovado. Precisa de `charCodeAt(0)-48`. |
| **P3** | Regex/máscara/length baseada em `\d` (`\d{14}`, `length===14`) | Não casa letras → máscara descarta letras, validação rejeita, tipo (CPF/CNPJ) é mal detectado. |
| **P4** | Extração do CNPJ do **certificado** só com `\d{14}` | e-CNPJ alfanumérico não casa → **seleção do emitente falha** → emissão impossível. |
| **P5** | Campo **numérico de largura fixa** (CNAB 400 / Equifax) recebe CNPJ | Não comporta letras → arquivo ao banco/bureau corrompido. |

---

## 2. "Epicentro" — corrigir aqui resolve a maioria

Estes arquivos compartilhados são consumidos por dezenas de telas. **Devem ser o primeiro passo** (novo `limparDocumentoAlfa` mantendo `[0-9A-Z]`, novo `validarCNPJalfa` com DV por ASCII−48, e máscara que aceite letras nas 12 primeiras posições):

1. `src/utils/validarDocumento.ts` — `limparDocumento`, `identificarTipoDocumento`, `validarCNPJ`, `validarDocumento`, `formatarCNPJ`
2. `src/utils/validacoes.ts` — `isValidCpfCnpj` (validador real de fornecedor **e** transportadora)
3. `src/schemas/client.schemas.ts` — 3ª cópia do `validarCNPJ` + transforms `.replace(/\D/g,'')`
4. `src/utils/mascaraDocumento.ts` — `formatarDocumento`/`mascaraCnpj` (máscara dos inputs de fornecedor/transportadora)
5. `src/utils/certificadoExtractor.ts` — extração do CNPJ do certificado (trava toda a emissão)
6. Predicados SQL `regexp_replace(...,'[^0-9]','')` de dedupe/busca (ver seções 4 e 6)

> ⚠️ Há **três implementações distintas** do DV de CNPJ (`validarDocumento.ts`, `validacoes.ts`, `client.schemas.ts`). Idealmente unificar numa só.

---

## 3. Utilitários compartilhados (BLOCKER)

| Arquivo | Linhas | Função | Padrão | Sev. |
|---|---|---|---|---|
| `src/utils/validarDocumento.ts` | L8-10 | `limparDocumento` | P1 | BLOCKER |
| ″ | L17-26 | `identificarTipoDocumento` (length 11/14) | P1/P3 | BLOCKER |
| ″ | L69-107 | `validarCNPJ` (strip + DV numérico) | P1+P2+P3 | BLOCKER |
| ″ | L114-121 | `validarDocumento` (propaga) | — | BLOCKER |
| ″ | L138-141 | `formatarCNPJ` (regex `\d{2}...`) | P1+P3 | HIGH |
| `src/utils/validacoes.ts` | L6-54 | `isValidCpfCnpj` | P1+P2+P3 | BLOCKER |
| `src/utils/mascaraDocumento.ts` | L11, L20-26, L31 | `formatarDocumento`/`mascaraCnpj` | P1+P3 | BLOCKER |
| `src/utils/mascaraCPF.tsx` | L1-8 | `mascaraCpf` (usado p/ `documento` no PDF de venda) | P1+P3 | BLOCKER* |
| `src/schemas/client.schemas.ts` | L15-16, L66-100, L105-115, L370-375, L535-542 | `CNPJ_REGEX`, `validarCNPJ`, `validarCpfCnpj`, transform `cpf_cnpj`, `CpfCnpjUnicoSchema` | P1+P2+P3 | BLOCKER |
| `src/data/fornecedores/schemas.ts` | L8/L120, L98-112/L210-224, L11/L123 | refines + superRefine + guard CNPJ próprio | P1+P3 | BLOCKER |
| `src/data/cnpj/index.ts` | L28-34 | `buscaCnpj` (strip + length 14 + fetch BrasilAPI) | P1+P3 | BLOCKER |
| `src/utils/formatTexto.ts` | L9-11, L31-54, L90-92 | `tiraSinais`, tipo `'N'`, `notChar` (remessa) | P1 | BLOCKER |

\* `mascaraCPF.tsx` é usado em `vendas/novaVenda/gerarPdf.js:56` sobre `cliente.documento` (pode ser CNPJ) → PDF de venda sai truncado.

---

## 4. Cadastro de Cliente + detecção de duplicado

| Arquivo | Linhas | O quê | Sev. |
|---|---|---|---|
| `.../clientes/tabs/RegistrationTab.tsx` | L272-289 | máscara do input strip letras ao digitar | **BLOCKER** |
| ″ | L108-109 | `handleDocumentoBlur` (Buscar CNPJ) no-op p/ alfanumérico | HIGH |
| ″ | L308 | botão limpar (cosmético) | LOW |
| `.../clientes/ClientFormModal.tsx` | **L511 (update), L613 (insert)** | grava `cpfcgc` com `.replace(/\D/g,'')` → **corrompe no banco** | **BLOCKER** |
| ″ | L138-141 | gate do modal de duplicado (length 11/14) suprime aviso | HIGH |
| `.../clientes/schema.ts` | L8-17 | refine `documento` (via utils quebrados; não-determinístico) | HIGH |
| `.../clientes/tabs/DeliveryTab.tsx` | — | sem documento (só CEP/IE/IM) | não afetado |
| `src/components/clientes/DuplicateClientModal.tsx` | L110-124 | `formatCpfCnpj` (display) | LOW |
| `src/pages/api/global/check-document.ts` | L19, L43, L56, L69 | `regexp_replace('[^0-9]')` nos 3 (dbclien/dbcredor/dbtransp) | **BLOCKER** |
| `src/pages/api/clientes/verify-existence.ts` | L35, L46 | idem → permite duplicado | **BLOCKER** |
| `src/pages/api/clientes/get/index.ts` | L29, L40, L52 | strip só de pontuação + `ILIKE` cheio | LOW (degradado) |
| `src/pages/api/clientes/add.ts` | L82 | dup por `cpfcgc = $1` exato (grava o que recebe) | LOW |
| `src/pages/api/clientes/update.ts` | L133 | trunca a 20 (14 cabe) | OK |
| `src/hooks/useGatekeeper.ts` | L30-34, L42 | não dispara lookup p/ alfanumérico | HIGH |
| `src/hooks/useClientVerification.ts` | L103-108 | early-return p/ alfanumérico | HIGH |
| `src/lib/syncPessoaIntegridade.ts` | L36-38, L59-60 | pula sync + `regexp_replace('[^0-9]')` | **BLOCKER** |
| `src/actions/client.actions.ts` | L64, L87, L198, L207 | length 11/14 + `REPLACE(...)` | HIGH |

---

## 5. Fornecedor / Transportadora / Vendedor / Dados Empresa

### Fornecedor
| Arquivo | Linhas | O quê | Sev. |
|---|---|---|---|
| `.../fornecedores/_forms/DadosCadastrais.tsx` | L206-210 | input `onChange` via `formatarDocumento` (strip letras) | **BLOCKER** |
| ″ | L123-134 | `validarCnpjCpf` (via `isValidCpfCnpj`) | HIGH |
| ″ | L59-71 | `formatarCpfCnpj` local | LOW |
| `.../fornecedores/modalCadastrar.tsx` | L225-229 | `buscarPorDocumento` (strip + length) | HIGH |
| `src/data/fornecedores/schemas.ts` | L98-112/L210-224 | superRefine "CNPJ 14 dígitos" bloqueia salvar | **BLOCKER** |
| `src/pages/api/fornecedores/verificar-duplicidade.ts` | L38, L42, L46 | strip vs SQL punctuation-only → não detecta dup | HIGH |
| `src/pages/api/fornecedores/get/index.ts` | L31, L46 | busca por dígitos degradada | LOW |

### Transportadora
| Arquivo | Linhas | O quê | Sev. |
|---|---|---|---|
| `.../transportadoras/_forms/DadosCadastrais.tsx` | L180-186 | input `onChange` (strip letras) | **BLOCKER** |
| ″ | L45-56 | `validarCpfCnpj` | HIGH |
| `.../transportadoras/_forms/transportadoraSchema.ts` | L44-47, L78-95 | refine + superRefine "14 dígitos" | **BLOCKER** |
| `.../transportadoras/modalCadastrar.tsx` | L184-187 | `buscarPorDocumento` | HIGH |
| `src/pages/api/transportadoras/verificar-duplicidade.ts` | L38, L42, L46 | mesma assimetria strip/SQL | HIGH |
| `src/pages/api/transportadoras/get/index.ts` | L29, L34 | busca por dígitos degradada | LOW |

### Vendedor — **não afetado** (modelo não tem CPF/CNPJ; só CEP).
### Dados da Empresa — **não afetado** hoje (`cgc` gravado verbatim, sem validação/strip). Caveat: `dadosEmpresasSchema` só valida `max(18)`; e uma `/` da máscara na rota `/api/dadosEmpresa/[cgc]` pode quebrar rota (pré-existente, não específico de letras).

---

## 6. Compras / Entradas (matching por CNPJ do fornecedor)

| Arquivo | Linhas | O quê | Sev. |
|---|---|---|---|
| `src/lib/compras/ordemCompraHelper.ts` | L15-30 | `extrairFilialDoCNPJ` (substring 8-12 + parseInt) → **não gera ID de OC** se o CNPJ da filial for alfanumérico | **BLOCKER** |
| `src/lib/compras/associacaoOrdemHelper.ts` | L540-541, L622-650 | ordenação/sugestão por CNPJ (JS strip vs SQL mantém letras) | HIGH |
| `.../RequisicoesCompra/utils/formatters.ts` | L29-33, L43-54 | `formatCNPJ` (LOW) + `searchSuppliers` (HIGH) | HIGH |
| `.../RequisicoesCompra/components/FornecedorAutocomplete.tsx` | L139-146 | `formatCNPJ` (display) | LOW |
| `src/pages/api/compras/fornecedores.ts` | L48-55 | busca autocomplete (strip ambos os lados) | HIGH |
| `.../EntradaXml/components/ConfirmNFeDataModal.tsx` | L659-701 | `soDigitos` compara emitente×fornecedor×transportadora | HIGH |
| `.../EntradaXml/components/CadastroConhecimentoModal.tsx` | L294-295 | match transportadora do CTe | HIGH |
| `src/pages/api/entrada-xml/credor-por-cnpj.ts` | L23, L25, L45 | auto-vínculo do credor por CNPJ | HIGH |
| `src/pages/api/entrada-xml/buscar-pagamentos-antecipados.ts` | L98, L114 | assimetria strip/SQL → "não encontrado" | HIGH |
| `src/pages/api/entrada-xml/sugestoes-oc.ts` | L98, L118 | sugestões de OC por CNPJ | HIGH |
| `src/pages/api/entrada-xml/pedidos-disponiveis/[produtoId].ts` | L84-86, L106, L133-135 | pedidos por fornecedor | HIGH |
| `src/pages/api/entrada-xml/ordens-compra-disponiveis.ts` | L53 | OCs por CNPJ | HIGH |
| `src/pages/api/entrada-xml/ordens-compra-disponiveis-v2.ts` | L59-62 | idem | HIGH |
| `src/pages/api/entrada-xml/associar-automatico.ts` | L118-151 | associação automática por emitente | HIGH |
| `src/pages/api/entrada-xml/configurar-pagamento-nfe.ts` | L134 | JOIN por punctuation-only (ambos mantêm letras) | LOW |

---

## 7. Emissão Fiscal (NFe / NFCe) + certificado

| Arquivo | Linhas | O quê | Sev. |
|---|---|---|---|
| `src/utils/certificadoExtractor.ts` | L115, L134-135, L149, L160-162 | extrai só `\d{14}` do e-CNPJ → **emitente nunca casa** (trava toda emissão) | **BLOCKER** |
| `src/components/services/sefazNfe/gerarXml.ts` | L99, L101-102, L192, L183-185 | strip emitente/dest; `length===14` grava emitente na tag `<CPF>`; propaga na chave | **BLOCKER** |
| `src/utils/gerarXmlCupomFiscal.ts` | L214, L309-312 | strip emitente + `padStart(14)` | **BLOCKER** |
| `src/pages/api/faturamento/emitir.ts` | L185, L189 | match `cgc`↔certificado (ambos strip) → sem emitente | **BLOCKER** |
| `src/pages/api/faturamento/emitir-faturado.ts` | L121-124, L161-163 | roteia modelo 55/65 por `length===11` **e** match certificado | **BLOCKER** |
| `src/pages/api/faturamento/emitir-cupom.ts` | L142-149, L305-309 | guard "CNPJ não pode NFC-e" burlado + match certificado | HIGH/BLOCKER |
| `src/services/fiscal/selecionarTipoEmissao.ts` | L29-46 | `identificarTipoDocumento`=null → cai em NFC-e (modelo errado) | **BLOCKER** |
| `src/hooks/useEmissaoFiscal.ts` | L50-51 | roteamento por `identificarTipoDocumento` | **BLOCKER** |
| `src/components/fiscal/BotaoEmitirDocumentoFiscal.tsx` | L34-35, L92 | botão emitir fica **desabilitado** ("documento não identificado") | **BLOCKER** |
| `src/pages/api/faturamento/cancelar-nfe.ts` | L127, L182 | CNPJ do evento hardcoded + strip | HIGH |
| `src/components/corpo/faturamento/NotaFiscalPreviewModal.tsx` | L129-130 | preview 55/65 por `length===11` | HIGH |
| `src/utils/consultarCRTReceita.ts` | L18, L23 | consulta ReceitaWS com CNPJ strippado (define CRT/CSOSN) | HIGH |
| `src/utils/gerarPreviewNF.ts` | L810 | placeholder de chave (preview) | LOW |

---

## 8. Boleto / Remessa / Cobrança

| Arquivo | Linhas | O quê | Sev. |
|---|---|---|---|
| `src/pages/api/remessa/bancaria/gerar.ts` | L295-299 (Bradesco), L431-435 (Santander) | CNPJ pagador em campo numérico de largura fixa (CNAB 400) | **BLOCKER** |
| ″ | L181, L343 | cedente CNPJ hardcoded numérico | HIGH |
| `src/pages/api/remessa/bancaria/gerar-v2.ts` | L362-364, L338 | idem CNAB v2 | **BLOCKER** |
| `src/pages/api/remessa/remessa.ts` | L47, L299 | valida `< 11 dígitos` (rejeita) + concatena raw (layout Equifax) | HIGH |
| `src/pages/api/remessa/remessa-email.ts` | L47, L190 | idem | HIGH |
| `src/pages/api/boleto/gerar.ts` | L58 | `cpfCnpj` strippado → Asaas rejeita | HIGH |
| `src/lib/asaas.ts` | L98, L178 | encaminha `cpfCnpj` ao Asaas (validação externa) | HIGH |
| `src/lib/boleto/calculoBoleto.ts` | — | não usa CNPJ no código de barras | LOW/none |
| `src/pages/api/cobranca/criar-com-boleto.ts` | L77 | arquivo comentado (inerte) | LOW (morto) |

---

## 9. Confirmadamente **NÃO afetado** (não mexer)

- **Chave de acesso NFe/CTe (44 dígitos)** — `entradas/gerar-por-chave.ts`, `entrada/recebimento/iniciar-por-chave.ts`, `GerarEntradaChaveModal.tsx`, chave do CTe. É sempre numérica.
- **NCM / CEST / CFOP** — códigos numéricos (ex.: `finalizarVenda` L706, motores de imposto).
- **CEP, telefone, `codcli`, números de venda** (`codvenda`/`nrovenda`) — não são documento.
- **`vendas/finalizarVenda.ts`** (main e pg) — usa `codcli`; `cnpj_empresa` gravado verbatim.
- **CPF** (11 dígitos) — permanece numérico; `validarCPF`/`formatarCPF` não mudam.

---

## 10. Dimensionamento e recomendação de faseamento

**Total:** ~45 arquivos / ~60 pontos de código. Aproximadamente **~24 BLOCKER**, **~28 HIGH**, **~10 LOW**.

Sugestão de fases (menor risco → maior):

- **Fase 0 — Base (destrava ~70% do resto):** novos `limparDocumentoAlfa` (mantém `[0-9A-Z]`) e `validarCNPJalfa` (DV ASCII−48) unificando as 3 cópias; máscara aceitando letras nas 12 primeiras posições. Arquivos: seção 3 + `certificadoExtractor.ts`.
- **Fase 1 — Cadastro + dedupe Cliente/Fornecedor/Transportadora:** inputs, `onSubmit`/gravação, `regexp_replace('[^0-9]')` → `[^0-9A-Z]`, `syncPessoaIntegridade`, gatekeeper. Seções 4 e 5.
- **Fase 2 — Compras/Entradas:** padronizar todo matching por CNPJ (JS e SQL do mesmo jeito). Seção 6.
- **Fase 3 — Emissão Fiscal:** a mais crítica e de maior risco; **exige teste contra homologação da SEFAZ** e biblioteca de assinatura/geração de XML atualizada para as regras alfanuméricas. Seção 7.
- **Fase 4 — Boleto/Remessa:** validar leiautes CNAB/Equifax com os bancos/bureau; campos de largura fixa podem exigir ajuste de leiaute homologado. Seção 8.

**Riscos externos (fora do código):** BrasilAPI/ReceitaWS, SEFAZ (assinatura/schema XML), bancos (CNAB) e Equifax precisam suportar o alfanumérico — a Fase 3/4 depende deles.

**Migração de dados:** o banco (`varchar(20)`) já comporta letras; nenhuma migração de coluna é necessária. Registros atuais (100% numéricos) continuam válidos.

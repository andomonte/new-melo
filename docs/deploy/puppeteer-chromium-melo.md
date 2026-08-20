# Guia — Chromium/Puppeteer no servidor melo (padronizar DANFE em HTML)

> Objetivo: fazer o `renderHtmlToPdf` (puppeteer) funcionar no servidor Docker do melo,
> para a DANFE/NFC-e sair **sempre no layout HTML** e podermos aposentar o fallback jsPDF
> (o "layout antigo"). Nada aqui muda a lógica fiscal — é só ambiente de renderização.

---

## 1. Causa raiz (por que hoje cai no jsPDF)

O `Dockerfile` usa **`node:20-alpine`**. Alpine Linux usa **musl libc**. O Chromium que o
pacote `puppeteer` baixa no `npm install` é compilado para **glibc** → **não executa no
Alpine**. Resultado: `puppeteer.launch()` lança exceção, e os endpoints de emissão caem no
**fallback jsPDF** (layout antigo). Confirmação no código: `src/lib/danfe/renderHtmlToPdf.ts`
faz `puppeteer.launch()` sem `executablePath`, então ele procura o Chromium glibc que não
roda ali.

A solução no Alpine é usar o **Chromium do próprio Alpine** (`apk add chromium`) e apontar o
puppeteer para ele via `PUPPETEER_EXECUTABLE_PATH`.

Contexto do deploy (já existente):
- `Dockerfile` multi-stage: `deps` → `builder` → `runner` (roda como usuário não-root `nextjs`).
- `next.config.mjs`: `output: 'standalone'` + `serverComponentsExternalPackages: ["oracledb","puppeteer"]` (puppeteer roda de `node_modules` em runtime).
- `docker-compose.yml`: build do Dockerfile, `env_file: .env`, monta `/tmp:/tmp`.

---

## 2. As 3 mudanças

### 2.1 Dockerfile — instalar o Chromium do Alpine e apontar o puppeteer

Aplique este diff no `Dockerfile`:

**(a) No topo (stage `base`)** — não baixar o Chromium glibc no `npm ci`:
```dockerfile
FROM node:20-alpine AS base
# Puppeteer NÃO deve baixar o Chromium glibc (não roda no Alpine); usamos o do apk.
ENV PUPPETEER_SKIP_DOWNLOAD=true
```

**(b) No stage `runner`** — instalar o Chromium do Alpine + fontes e apontar o puppeteer.
Adicione ANTES de `USER nextjs`:
```dockerfile
# Chromium do Alpine (musl) + libs e fontes que a DANFE precisa renderizar
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto \
    font-noto-emoji

# Puppeteer usa o Chromium do sistema
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_DOWNLOAD=true
```

> ⚠️ Confirme o caminho do binário: em algumas versões do Alpine é `/usr/bin/chromium`
> em vez de `/usr/bin/chromium-browser`. Depois do build, rode dentro do container
> `which chromium-browser || which chromium` e ajuste o `PUPPETEER_EXECUTABLE_PATH` se preciso.

**(c) Garantir o puppeteer no standalone.** O `output: standalone` do Next rastreia o
`node_modules/puppeteer`. Confirme que existe `/.next/standalone/node_modules/puppeteer`
na imagem `runner`. Se NÃO existir (às vezes o tracing não o inclui por ser external),
copie explicitamente no `runner`, logo após os `COPY --from=builder`:
```dockerfile
COPY --from=builder /app/node_modules/puppeteer ./node_modules/puppeteer
COPY --from=builder /app/node_modules/puppeteer-core ./node_modules/puppeteer-core
```

### 2.2 Código — `renderHtmlToPdf.ts` (1 ajuste, necessário)

O `puppeteer.launch()` precisa usar o `PUPPETEER_EXECUTABLE_PATH` e o `--disable-dev-shm-usage`
(o `/dev/shm` do Docker é pequeno e derruba o Chromium). Ajuste em
`src/lib/danfe/renderHtmlToPdf.ts`:

```ts
const browser = await puppeteer.launch({
  headless: 'new' as any,
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});
```

- Local (Windows/dev): `PUPPETEER_EXECUTABLE_PATH` fica indefinido → `undefined` → o puppeteer
  usa o Chromium que ele baixou (funciona no Windows). **Nada quebra no dev.**
- Servidor (Alpine): o env aponta pro Chromium do apk. `--no-sandbox` já é obrigatório porque
  roda como usuário não-root.

### 2.3 Rebuild da imagem
```bash
docker compose build --no-cache site-melo
docker compose up -d
```

---

## 3. Verificação (dentro do container)

```bash
# 1. Chromium instalado e no caminho esperado
docker compose exec site-melo sh -lc 'echo $PUPPETEER_EXECUTABLE_PATH; which chromium-browser || which chromium; chromium-browser --version || chromium --version'

# 2. O puppeteer consegue subir o Chromium
docker compose exec site-melo node -e "const p=require('puppeteer'); p.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH, args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']}).then(async b=>{console.log('OK', await b.version()); await b.close()}).catch(e=>{console.error('FALHOU:', e.message); process.exit(1)})"
```
Se o passo 2 imprimir `OK HeadlessChrome/...`, o puppeteer está funcionando.

**Teste fim-a-fim:** emita uma nota e confira que a DANFE saiu no **layout HTML** (MELO, com
IBS/CBS). Antes, quando caía no jsPDF, os logs do container mostravam
`⚠️ HTML→PDF falhou ... usando jsPDF (fallback)` — depois do fix esse aviso some.

---

## 4. Depois que o Chromium estiver confirmado — aposentar o jsPDF

Só faça isto **após** o passo 3 passar, senão a emissão quebra quando o Chromium não sobe:

1. Em `emitir.ts`, `emitir-faturado.ts` e `emitir-cupom.ts`: remover o `catch` que chama
   `gerarNotaFiscalValida` / `gerarPreviewCupomFiscal` (jsPDF) e deixar o erro do
   `gerarPdfNotaHtml` **propagar** (falha explícita > PDF antigo silencioso).
2. Opcional: manter um `catch` que apenas **loga o erro real** e reenvia, sem gerar PDF.

Observação: a **visualização** de nota já foi padronizada em HTML no cliente (não usa mais o
PDF guardado) — ver `NotaFiscalPreviewModal` + `dados-fatura-completos` (anexa chave/protocolo).
O que ainda depende do PDF server-side é o **anexo do e-mail** (`enviar-danfe-email.ts` lê
`dbfat_nfe.imagem`) e o PDF pós-emissão. Com o Chromium funcionando, ambos passam a ser HTML.

---

## 5. Alternativa (se o apk chromium der trabalho)

Usar o pacote **`@sparticuz/chromium`** (build de Chromium empacotado para ambientes
serverless/Alpine) + `puppeteer-core`, apontando `executablePath` para o binário que ele
extrai. É mais pesado de configurar; para um container de longa duração como o do melo, o
`apk add chromium` (seção 2.1) é o caminho mais simples e recomendado.

---

## Resumo do checklist

- [ ] `ENV PUPPETEER_SKIP_DOWNLOAD=true` no `base`
- [ ] `apk add chromium nss freetype harfbuzz ca-certificates ttf-freefont font-noto font-noto-emoji` no `runner`
- [ ] `ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser` (confirmar caminho)
- [ ] `renderHtmlToPdf`: `executablePath` do env + `--disable-dev-shm-usage`
- [ ] Confirmar `puppeteer` em `.next/standalone/node_modules` (copiar se faltar)
- [ ] `docker compose build --no-cache && up -d`
- [ ] Verificar (seção 3) e emitir uma nota de teste
- [ ] (depois) remover o fallback jsPDF

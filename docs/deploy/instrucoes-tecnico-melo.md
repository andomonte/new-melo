# Instruções para o técnico — servidor melo homolog

Duas configurações independentes no servidor. Nenhuma exige mexer no código.

---

## 1. CRYPTO_MASTER_KEY — liberar o certificado para o desenvolvedor testar

**O quê:** o certificado digital fica salvo no banco, **encriptado** com a variável de
ambiente `CRYPTO_MASTER_KEY`. O ambiente do desenvolvedor (máquina local) tem uma chave
**diferente** da do servidor, então ele não consegue usar o certificado que foi subido aqui.

**O que fazer:** enviar ao desenvolvedor, por um canal seguro (é um segredo), o **valor** da
`CRYPTO_MASTER_KEY` que está configurada no servidor melo homolog.

**Como pegar o valor no servidor:**
```bash
# na pasta do projeto:
grep CRYPTO_MASTER_KEY .env

# ou, se roda em container:
docker compose exec site-melo sh -lc 'echo $CRYPTO_MASTER_KEY'
```
Copie a string longa que aparecer e mande para o dev. Ele cola no `.env` local dele e reinicia.

**Recomendado:** usar a **mesma `CRYPTO_MASTER_KEY` em todos os ambientes** (local, homolog,
produção). Assim o certificado subido em qualquer um funciona em todos, sem precisar re-subir.

---

## 2. Chromium — DANFE no layout HTML novo (em vez do PDF antigo)

**O quê:** o sistema monta a DANFE em HTML e converte para PDF com o Chromium (puppeteer).
A imagem Docker é **Alpine**, e o Chromium que o puppeteer baixa não roda no Alpine — por isso
hoje sai um PDF de layout antigo. Basta instalar o Chromium do Alpine e apontar a variável.

**Editar o `Dockerfile`:**

(a) No stage `base` (topo do arquivo), adicionar:
```dockerfile
ENV PUPPETEER_SKIP_DOWNLOAD=true
```

(b) No stage `runner`, **antes** da linha `USER nextjs`, adicionar:
```dockerfile
RUN apk add --no-cache \
    chromium nss freetype harfbuzz ca-certificates \
    ttf-freefont font-noto font-noto-emoji
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_DOWNLOAD=true
```

**Rebuildar:**
```bash
docker compose build --no-cache site-melo
docker compose up -d
```

**Conferir se funcionou (dentro do container):**
```bash
# 1) Chromium instalado e no caminho da variável:
docker compose exec site-melo sh -lc 'echo $PUPPETEER_EXECUTABLE_PATH; which chromium-browser || which chromium; chromium-browser --version || chromium --version'

# 2) O puppeteer consegue subir o Chromium:
docker compose exec site-melo node -e "require('puppeteer').launch({args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']}).then(async b=>{console.log('OK',await b.version());await b.close()}).catch(e=>{console.error('FALHOU:',e.message);process.exit(1)})"
```
Se o passo 2 imprimir `OK HeadlessChrome/...`, está funcionando. Emita uma nota: a DANFE
sai no layout HTML novo.

> Se o binário estiver em `/usr/bin/chromium` (e não `/usr/bin/chromium-browser`), ajuste a
> variável `PUPPETEER_EXECUTABLE_PATH` para o caminho correto (confirme com o `which` acima).
> Não é preciso alterar código — o puppeteer 24 lê a variável `PUPPETEER_EXECUTABLE_PATH`
> automaticamente.

Detalhes e alternativas: `docs/deploy/puppeteer-chromium-melo.md`.

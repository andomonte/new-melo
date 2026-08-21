
FROM node:20-alpine AS base

# 1. Install dependencies only when needed
FROM base AS deps
# Instalar dependências necessárias para libs nativas
RUN apk add --no-cache \
    libc6-compat \
    openssl \
    python3 \
    make \
    g++

WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
# Não baixar o Chromium do puppeteer (build glibc, não roda em Alpine/musl).
# Em produção usamos o Chromium do sistema (apk add) no estágio runner.
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci

# 2. Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# Versão exibida no login. O deploy pode passar o commit:
#   docker build --build-arg GIT_SHA=$(git rev-parse --short HEAD) ...
# Se não passar, o next.config cai na versão do package.json (o BUILD_TIME sempre atualiza).
ARG GIT_SHA=""
ENV GIT_SHA=$GIT_SHA

# Build the application
RUN npm run build

# 3. Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV TZ=America/Manaus

# Chromium do sistema (musl) + fontes — o puppeteer renderiza a DANFE em PDF
# a partir do HTML (layout MELO). Sem isso o HTML→PDF falha e cai no jsPDF antigo.
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-emoji
# Aponta o puppeteer para o Chromium do sistema (não baixa o próprio).
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

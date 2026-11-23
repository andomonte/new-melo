/*
 * Service worker da Venda Externa (escopo /externo).
 * Guarda no aparelho a TELA (HTML/JS/CSS/ícones) para o app abrir sem internet.
 * Dados (clientes, produtos, pedidos) ficam no IndexedDB, não aqui; chamadas /api/*
 * nunca são guardadas em cache.
 *  - página /externo/...  → rede primeiro (versão nova), sem rede → cópia guardada
 *  - /_next/static, /images, fontes → cache primeiro (arquivos com hash, não mudam)
 * Arquitetura: docs/VENDAS-EXTERNAS-OFFLINE.md
 */
const VERSAO = 'externo-v1';
const ESTATICOS = ['/images/externo-icon-192.png', '/images/externo-icon-512.png', '/images/externo-icon-180.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(VERSAO)
      .then((c) => c.addAll(ESTATICOS))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n.startsWith('externo-') && n !== VERSAO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

// A página manda a lista do que já carregou (antes do SW assumir) para guardar também.
self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.tipo !== 'GUARDAR' || !Array.isArray(d.urls)) return;
  e.waitUntil(
    caches.open(VERSAO).then((c) =>
      Promise.all(
        d.urls.map((u) =>
          fetch(u, { credentials: 'same-origin' })
            .then((r) => (r && r.ok ? c.put(u, r) : undefined))
            .catch(() => undefined),
        ),
      ),
    ),
  );
});

const ehEstatico = (url) =>
  url.pathname.startsWith('/_next/static/') ||
  url.pathname.startsWith('/images/') ||
  url.pathname.startsWith('/fonts/') ||
  /\.(woff2?|ttf|otf)$/.test(url.pathname);

async function redePrimeiro(req, chave) {
  const cache = await caches.open(VERSAO);
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(req, { signal: ctrl.signal });
    clearTimeout(t);
    if (r && r.ok) cache.put(chave || req, r.clone());
    return r;
  } catch (err) {
    const c = (await cache.match(chave || req, { ignoreSearch: true })) || (await cache.match(req, { ignoreSearch: true }));
    if (c) return c;
    throw err;
  }
}

async function cachePrimeiro(req) {
  const cache = await caches.open(VERSAO);
  const c = await cache.match(req);
  if (c) return c;
  const r = await fetch(req);
  if (r && r.ok) cache.put(req, r.clone());
  return r;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/externo/manifest')) return; // dados: sempre rede

  if (req.mode === 'navigate') {
    e.respondWith(
      redePrimeiro(req).catch(async () => {
        // sem rede e sem esta URL guardada: qualquer tela /externo guardada serve
        const cache = await caches.open(VERSAO);
        const chaves = await cache.keys();
        const pagina = chaves.find((k) => new URL(k.url).pathname.startsWith('/externo/'));
        return (pagina && cache.match(pagina)) || new Response('Sem internet e a tela ainda não foi guardada neste aparelho.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }),
    );
    return;
  }

  if (ehEstatico(url)) {
    e.respondWith(cachePrimeiro(req));
    return;
  }
  e.respondWith(redePrimeiro(req));
});

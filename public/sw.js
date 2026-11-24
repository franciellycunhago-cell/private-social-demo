// Bumpar versão sempre que precisar invalidar cache em PWAs já
// instalados. v8 (29/04 noite): exclui rotas públicas do intercept
// (resolve /convite dando "sem internet" pra users com PWA antigo).
const CACHE = "tc-v8";
const OFFLINE_URL = "/offline";

// Rotas públicas que NUNCA devem ser interceptadas pelo SW — passam
// direto pro browser (sem cache, sem fallback). Evita problema de
// PWA antigo cachear redirect ou servir /offline indevidamente em
// landing pages que precisam funcionar 100% pra qualquer visitante.
const ROTAS_PUBLICAS_SEM_INTERCEPT = new Set([
  "/",
  "/convite",
  "/termos",
  "/privacidade",
  "/login",
  "/cadastro",
  "/auth/callback",
  "/solicitar-convite",
]);

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
      .then(async () => {
        // Força reload em todos os clients abertos pra pegar o JS novo.
        // Sem isso, o user precisaria fechar+abrir o PWA manualmente.
        const allClients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        for (const client of allClients) {
          try {
            // navigate é mais seguro que postMessage — força refresh
            await client.navigate(client.url);
          } catch {
            // Em iOS/PWA standalone às vezes navigate falha. Sem fallback
            // — o próximo refresh manual pega o JS novo.
          }
        }
      })
  );
});

// ── Push notification recebida ─────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = { title: "PrivateSocial", body: "Você tem uma nova notificação.", url: "/" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/logo-icon.png",
      badge: "/logo-icon.png",
      data: { url: data.url },
      vibrate: [200, 100, 200],
    })
  );
});

// ── Clique na notificação ──────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? "/app/descobrir";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        const match = windowClients.find((c) => c.url.includes(self.location.origin));
        if (match) {
          match.focus();
          return match.navigate(targetUrl);
        }
        return clients.openWindow(targetUrl);
      })
  );
});

// ── Fetch ──────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (url.hostname !== self.location.hostname) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            // CLONE ANTES de retornar — body é stream que só pode ser
            // lido 1x. Se clonarmos depois (dentro do .then assíncrono),
            // o body original já foi consumido pelo respondWith e o
            // clone() falha com "Response body is already used".
            if (res.ok) {
              const cacheClone = res.clone();
              caches.open(CACHE).then((c) =>
                c.put(request, cacheClone).catch(() => {}),
              );
            }
            return res;
          })
      )
    );
    return;
  }

  if (request.mode === "navigate") {
    // Rotas públicas (/, /convite, /termos, etc) passam DIRETO sem
    // interceptação. Garante que landing pages funcionam mesmo se
    // o SW velho tem algum cache estranho ou o /offline cacheado
    // estiver bugado. Só fazemos cache+fallback pras rotas internas
    // do app (/app/*, /admin/*) onde o user precisa de resiliência
    // offline.
    if (ROTAS_PUBLICAS_SEM_INTERCEPT.has(url.pathname)) {
      return; // Sem event.respondWith → browser cuida sozinho
    }

    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            caches.open(CACHE).then((cache) => {
              fetch(OFFLINE_URL)
                .then((r) => { if (r.ok) cache.put(OFFLINE_URL, r); })
                .catch(() => {});
            });
          }
          return res;
        })
        .catch(() =>
          caches.match(OFFLINE_URL).then(
            (offline) =>
              offline ??
              new Response(
                "<!doctype html><html><body style='font-family:sans-serif;padding:32px'>" +
                  "<h2>Sem conexão</h2><p>Verifique sua internet e tente novamente.</p>" +
                  "<button onclick='location.reload()'>Tentar novamente</button></body></html>",
                { status: 503, headers: { "Content-Type": "text/html" } }
              )
          )
        )
    );
  }
});

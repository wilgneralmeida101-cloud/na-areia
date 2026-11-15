// Guarda as telas para abrir rápido. Dados (bancas, produtos, pedidos) sempre vêm da internet.
const VERSAO = "na-areia-cliente-v6";
const ARQUIVOS = ["./", "index.html", "cliente.css", "cliente.js", "comum/base.css", "comum/util.js", "comum/config.js", "demo.js", "icone.svg", "icone-192.png", "manifest.webmanifest"];
self.addEventListener("install", e => e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys()
  .then(ks => Promise.all(ks.filter(k => k.startsWith("na-areia-cliente") && k !== VERSAO).map(k => caches.delete(k))))
  .then(() => self.clients.claim())));
// Rede primeiro; se estiver sem internet, usa o guardado.
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(VERSAO).then(k => k.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});

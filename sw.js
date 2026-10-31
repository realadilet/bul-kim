// Offline cache. Code (html/js/css/json) is network-first and always revalidated, so a deploy shows up
// on the next open; pictures/animations/audio are cache-first and prefetched in the background.
const CACHE = "bul-kim-v4";
const CORE = [
  "./",
  "index.html",
  "css/style.css",
  "js/app.js",
  "js/audio.js",
  "js/fx.js",
  "js/viewer.js",
  "js/quiz.js",
  "js/parent.js",
  "js/mic.js",
  "assets/phrases.json",
  "assets/img/_bye.svg",
  "assets/anim/_bye.json",
  "vendor/lottie_light.min.js",
  "content.json",
  "manifest.webmanifest",
  "assets/fonts/nunito-cyrillic-ext.woff2",
  "assets/fonts/nunito-cyrillic.woff2",
  "assets/fonts/nunito-latin.woff2",
  "assets/img/_game.svg",
  "icons/icon-192.png",
];
const CODE = /\.(html|css|js|json|webmanifest)$|\/$/;

async function warmUp() {
  const c = await caches.open(CACHE);
  const get = async (u) => (await fetch(u, { cache: "no-cache" })).json();
  const [cfg, phrases] = await Promise.all([get("content.json"), get("assets/phrases.json")]);
  const urls = Object.keys(cfg.phrases || {}).map((k) => `assets/audio/_${k}.mp3`);
  for (const [id, kinds] of Object.entries(phrases)) {
    for (const kind of Object.keys(kinds)) urls.push(`assets/audio/${kind}_${id}.mp3`);
  }
  for (const s of cfg.sets) {
    for (const it of s.items) {
      urls.push(`assets/img/${it.id}.svg`, `assets/audio/${it.id}.mp3`);
      if (it.anim) urls.push(`assets/anim/${it.id}.json`);
      if (it.sound) urls.push(`assets/sounds/${it.id}.mp3`);
    }
  }
  const have = new Set((await c.keys()).map((r) => new URL(r.url).pathname));
  const todo = urls.filter((u) => !have.has(new URL(u, location.href).pathname));
  for (let i = 0; i < todo.length; i += 24) {
    await Promise.allSettled(todo.slice(i, i + 24).map((u) => c.add(u)));
  }
}

self.addEventListener("install", (e) => {
  // only the app shell before taking over — the new version must not wait for ~1000 files
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE.map((u) => new Request(u, { cache: "reload" })));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
    await warmUp().catch(() => {});
  })());
});

self.addEventListener("message", (e) => { if (e.data === "warm") e.waitUntil(warmUp().catch(() => {})); });

// Weak Wi-Fi: if the page itself doesn't arrive in 3 s, open the cached version. Every other code file of
// that page then also comes from the cache, so old and new files never mix. The fresh copies still download
// in the background and are used on the next open.
const NAV_TIMEOUT = 3000;
const fromCache = new Set(); // ids of pages that were opened from the cache

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  const isCode = CODE.test(url.pathname) && !url.pathname.includes("/assets/anim/");

  if (!isCode) {
    e.respondWith((async () => {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    })());
    return;
  }

  // revalidate with the server (ETag → tiny 304), never a stale HTTP-cache copy
  let saved = null;
  const fresh = fetch(req, { cache: "no-cache" }).then((res) => {
    if (res.ok) { const copy = res.clone(); saved = caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  });
  e.waitUntil(fresh.then(() => saved, () => {}).catch(() => {}));

  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const cached = (await caches.match(req, { ignoreSearch: true })) || (await caches.match("./"));
      if (!cached) return fresh.catch(() => Response.error());
      const res = await Promise.race([fresh.catch(() => null), new Promise((r) => setTimeout(() => r(null), NAV_TIMEOUT))]);
      if (res && res.ok) return res;
      if (e.resultingClientId) fromCache.add(e.resultingClientId);
      return cached;
    })());
    return;
  }

  e.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached && fromCache.has(e.clientId)) return cached;
    try {
      const res = await fresh;
      return res.ok || !cached ? res : cached;
    } catch {
      return cached || Response.error();
    }
  })());
});

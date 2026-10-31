// Offline-first: everything opens from the cache, instantly, with or without Wi-Fi.
// Updates: bump VERSION on every release. The browser notices the changed sw.js in the background,
// installs the new version, and the page reloads itself once the child is back on the menu.
const VERSION = "2026-10-31.8";
const CACHE = `bul-kim-${VERSION}`;
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

// all pictures, animations and sounds of this version, fetched in the background after install
async function warmUp() {
  const c = await caches.open(CACHE);
  const json = async (u) => ((await c.match(u)) || (await fetch(u, { cache: "no-cache" }))).json();
  const [cfg, phrases] = await Promise.all([json("content.json"), json("assets/phrases.json")]);
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
    await Promise.allSettled(todo.slice(i, i + 24).map((u) => c.add(new Request(u, { cache: "no-cache" }))));
  }
}

self.addEventListener("install", (e) => {
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

self.addEventListener("message", (e) => {
  if (e.data === "warm") e.waitUntil(warmUp().catch(() => {}));
  if (e.data === "version" && e.ports[0]) e.ports[0].postMessage(VERSION);
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const hit = (await caches.match(req, { ignoreSearch: true })) || (req.mode === "navigate" && (await caches.match("./")));
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
    return res;
  })());
});

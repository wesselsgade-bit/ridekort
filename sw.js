// Ridekort offline cache: app shell + every map tile you have seen.
const SHELL = "rk-shell-v2", TILES = "rk-tiles-v1", MAX_TILES = 4000;
const SHELL_FILES = ["./", "index.html", "manifest.json",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return; // Overpass uses POST; the page caches that itself
  if (url.hostname === "tile.openstreetmap.org") {
    e.respondWith(caches.open(TILES).then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      try {
        const r = await fetch(e.request);
        if (r.ok) { c.put(e.request, r.clone()); trim(c); }
        return r;
      } catch (err) { return new Response("", { status: 504 }); }
    }));
    return;
  }
  // app shell: network first, cache as fallback (so updates arrive)
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok && (url.origin === location.origin || url.hostname === "cdnjs.cloudflare.com")) {
      const copy = r.clone(); caches.open(SHELL).then(c => c.put(e.request, copy));
    }
    return r;
  }).catch(() => caches.match(e.request)));
});

let trimming = false;
async function trim(c) {
  if (trimming) return; trimming = true;
  const keys = await c.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await c.delete(keys[i]);
  trimming = false;
}

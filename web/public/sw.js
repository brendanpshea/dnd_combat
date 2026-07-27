/**
 * Minimal offline support.
 *
 * The rule that matters is which assets may be cached first-response-wins.
 * Vite's own output under `assets/` is content-hashed — a changed file gets a
 * changed name — so cache-first is safe there and nothing ever goes stale.
 *
 * NOTHING ELSE IS HASHED. Everything under `art/`, the fonts, the manifest and
 * the icon keep the same filename across every deploy, and they used to be
 * cached first-response-wins too, on the strength of a comment that said
 * "assets are content-hashed". They are not. An installed copy therefore kept
 * whatever it got the first time it asked, for good: a portrait that failed to
 * arrive once stayed missing through every later deploy, because the app never
 * asked again. That is what "the monster portraits are broken on my phone, and
 * it isn't the network" looks like from the inside.
 *
 * So unhashed assets are stale-while-revalidate: answer from cache at once (so
 * the game still works on a train), and refresh from the network in the
 * background so the next load is right. A copy can be one load behind; it can
 * no longer be permanently wrong.
 */
const CACHE = 'dnd-grid-combat-v2';

/** Content-hashed by the bundler, so safe to keep forever. */
function isImmutable(url) {
  return url.pathname.includes('/assets/');
}

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./'])));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // Bumping CACHE above drops the previous one here, which is what lets an
  // already-installed copy recover from a poisoned entry without reinstalling.
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;

  if (req.mode === 'navigate') {
    // Network-first so deploys show up; fall back to cache offline.
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./')),
    );
    return;
  }

  if (isImmutable(url)) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            if (res.ok && sameOrigin) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Unhashed: stale-while-revalidate. Only a successful response is stored, so
  // a 404 during a half-finished deploy is never what gets kept.
  e.respondWith(
    caches.match(req).then((hit) => {
      const fresh = fetch(req)
        .then((res) => {
          if (res.ok && sameOrigin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit ?? fresh;
    }),
  );
});

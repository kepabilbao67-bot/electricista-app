// Electricista 360: no guardar datos privados ni páginas antiguas en caché.
const CACHE_NAME = "electricista360-static-v2";
self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("autonomo360-") ||
      (key.startsWith("electricista360-") && key !== CACHE_NAME))
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
// Las páginas y las API siempre consultan al servidor para proteger datos y actualizar la app.

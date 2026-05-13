const CACHE_NAME = 'oba-brownie-imagens-v3';

function isCacheableImageRequest(event, url) {
    if (event.request.method !== 'GET') return false;

    const isImageRequest = event.request.destination === 'image';
    const isImgBBImage = url.hostname === 'i.ibb.co' && isImageRequest;
    const isSupabaseStorageImage = url.hostname.endsWith('.supabase.co')
        && url.pathname.includes('/storage/v1/object/')
        && isImageRequest;

    return isImgBBImage || isSupabaseStorageImage;
}

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Apaga caches velhos quando uma nova estrategia assumir.
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Cacheia apenas arquivos de imagem. Nunca cachear REST/Auth/Realtimes do Supabase,
    // porque isso pode esconder produtos, pedidos ou status atualizados.
    if (isCacheableImageRequest(event, url)) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                // Se a foto já está no celular, devolve de graça (0 tráfego!)
                if (cachedResponse) {
                    return cachedResponse;
                }

                // Se não está, busca na internet, salva no celular e depois devolve
                return fetch(event.request).then((networkResponse) => {
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'cors') {
                        return networkResponse;
                    }

                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });

                    return networkResponse;
                });
            })
        );
    }
});

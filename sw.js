const CACHE_NAME = 'oba-brownie-imagens-v2'; // Mudamos a versão para forçar a atualização

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Apaga o cache velho (v1) quando o novo (v2) assumir
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

    // AGORA ELE INTERCEPTA TANTO O IMGBB QUANTO O SUPABASE!
    if (url.origin.includes('i.ibb.co') || url.origin.includes('supabase.co')) {
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
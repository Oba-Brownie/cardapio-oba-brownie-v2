/* ARQUIVO: sw.js (Na raiz do projeto) */
const CACHE_NAME = 'oba-brownie-v1';

self.addEventListener('install', (event) => {
    // Força o Service Worker a ativar imediatamente
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Estratégia "Network First": Tenta sempre pegar os dados atualizados da internet (Supabase).
    // Fundamental para não exibir estoque velho para o cliente.
    event.respondWith(
        fetch(event.request).catch(() => {
            // Se falhar (cliente sem internet), não faz nada de especial, 
            // apenas impede que o app quebre.
        })
    );
});
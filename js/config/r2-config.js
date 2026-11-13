/* ================================================= */
/* ARQUIVO: js/config/r2-config.js                    */
/* Configurações do Cloudflare R2 Object Storage      */
/* ================================================= */

export const R2_CONFIG = {
    accountId: '27e3d44c56e6f533fdd2e53e3f900825',
    bucketName: 'oba-brownie-fotos',
    s3ApiUrl: 'https://27e3d44c56e6f533fdd2e53e3f900825.r2.cloudflarestorage.com/oba-brownie-fotos',
    
    // URL Pública para leitura direta pelas tags <img> dos clientes.
    // Pode ser o R2.dev Subdomain público (ex: https://pub-xxxxxx.r2.dev)
    // ou um Custom Domain conectado na Cloudflare (ex: https://fotos.obabrownie.com.br).
    publicBaseUrl: 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev',

    // URL opcional de um Cloudflare Worker responsável por receber uploads do painel admin
    // e gravar no bucket 'oba-brownie-fotos' com segurança (ex: https://oba-r2-upload.seu-subdominio.workers.dev).
    uploadWorkerUrl: ''
};

/**
 * Monta a URL completa de um arquivo no Cloudflare R2
 * @param {string} relativePath - Ex: 'produtos/brownies/brownie-tradicional.png'
 * @returns {string} URL pública pronta para o cardápio
 */
export function getR2ImageUrl(relativePath) {
    if (!relativePath) return '';
    const cleanPath = String(relativePath).replace(/^\/+/, '');
    const baseUrl = (R2_CONFIG.publicBaseUrl || '').replace(/\/+$/, '');
    return `${baseUrl}/${cleanPath}`;
}

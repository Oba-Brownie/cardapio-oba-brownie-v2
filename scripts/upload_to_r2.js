/**
 * Script de Upload em Lote para o Cloudflare R2
 * Bucket: oba-brownie-fotos (Account: 27e3d44c56e6f533fdd2e53e3f900825)
 *
 * Modo de uso:
 * 1. Pelo painel web da Cloudflare: Você pode arrastar as pastas da pasta `r2-upload-staging/produtos`
 *    diretamente no navegador em https://dash.cloudflare.com -> R2 -> oba-brownie-fotos -> Upload.
 *
 * 2. Via este script (automático via API S3):
 *    No painel Cloudflare R2, clique em "Manage R2 API Tokens" -> "Create API Token" (Permissão: Object Read & Write).
 *    Depois execute no terminal:
 *    $env:R2_ACCESS_KEY_ID="sua_access_key"
 *    $env:R2_SECRET_ACCESS_KEY="sua_secret_key"
 *    node scripts/upload_to_r2.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const ACCOUNT_ID = '27e3d44c56e6f533fdd2e53e3f900825';
const BUCKET_NAME = 'oba-brownie-fotos';

const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;

const stagingDir = path.join(__dirname, '..', 'r2-upload-staging', 'produtos');

if (!ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    console.log('==================================================================');
    console.log('AVISO: R2_ACCESS_KEY_ID ou R2_SECRET_ACCESS_KEY não definidas.');
    console.log('Você pode fazer o upload das imagens de duas formas:');
    console.log('1. Manual: Arraste a pasta "r2-upload-staging/produtos" diretamente');
    console.log('   no painel da Cloudflare (R2 -> oba-brownie-fotos -> Upload).');
    console.log('2. Automático: Defina as variáveis no terminal:');
    console.log('   $env:R2_ACCESS_KEY_ID="<sua_access_key>"');
    console.log('   $env:R2_SECRET_ACCESS_KEY="<sua_secret_key>"');
    console.log('   node scripts/upload_to_r2.js');
    console.log('==================================================================');
    process.exit(0);
}

// Assinador AWS Signature V4 para Cloudflare R2
function getSignatureKey(key, dateStamp, regionName, serviceName) {
    const kDate = crypto.createHmac('sha256', 'AWS4' + key).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    return kSigning;
}

function uploadFileToR2(localPath, r2Key, contentType) {
    return new Promise((resolve) => {
        const fileContent = fs.readFileSync(localPath);
        const contentHash = crypto.createHash('sha256').update(fileContent).digest('hex');

        const now = new Date();
        const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
        const dateStamp = amzDate.slice(0, 8);
        const region = 'auto';
        const service = 's3';

        const host = `${ACCOUNT_ID}.r2.cloudflarestorage.com`;
        const canonicalUri = `/${BUCKET_NAME}/${r2Key}`;

        const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${contentHash}\nx-amz-date:${amzDate}\n`;
        const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

        const canonicalRequest = `PUT\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${contentHash}`;

        const algorithm = 'AWS4-HMAC-SHA256';
        const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
        const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;

        const signingKey = getSignatureKey(SECRET_ACCESS_KEY, dateStamp, region, service);
        const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

        const authorizationHeader = `${algorithm} Credential=${ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

        const req = https.request({
            hostname: host,
            path: canonicalUri,
            method: 'PUT',
            headers: {
                'Host': host,
                'Content-Type': contentType,
                'Content-Length': fileContent.length,
                'x-amz-date': amzDate,
                'x-amz-content-sha256': contentHash,
                'Authorization': authorizationHeader
            }
        }, (res) => {
            if (res.statusCode === 200) {
                resolve({ success: true, statusCode: res.statusCode });
            } else {
                let body = '';
                res.on('data', c => body += c);
                res.on('end', () => resolve({ success: false, statusCode: res.statusCode, body }));
            }
        });

        req.on('error', (err) => resolve({ success: false, error: err.message }));
        req.write(fileContent);
        req.end();
    });
}

function getAllFiles(dir, baseDir = '') {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    for (const item of fs.readdirSync(dir)) {
        const full = path.join(dir, item);
        const rel = path.join(baseDir, item).replace(/\\/g, '/');
        if (fs.statSync(full).isDirectory()) {
            results = results.concat(getAllFiles(full, rel));
        } else {
            results.push({ full, rel });
        }
    }
    return results;
}

async function run() {
    console.log(`Iniciando upload para Cloudflare R2 (${BUCKET_NAME})...`);
    const files = getAllFiles(stagingDir);
    console.log(`Total de arquivos para enviar: ${files.length}`);

    let ok = 0;
    let fail = 0;

    for (const file of files) {
        const r2Key = `produtos/${file.rel}`;
        const ext = path.extname(file.full).toLowerCase();
        const contentType = ext === '.webp' ? 'image/webp' : ext === '.png' ? 'image/png' : 'image/jpeg';

        process.stdout.write(`Enviando ${r2Key}... `);
        const res = await uploadFileToR2(file.full, r2Key, contentType);
        if (res.success) {
            console.log('✓ OK');
            ok++;
        } else {
            console.log(`✗ ERRO (${res.statusCode}): ${res.body || res.error}`);
            fail++;
        }
    }

    console.log(`\nUpload concluído! Sucessos: ${ok}, Falhas: ${fail}`);
}

run();

-- ====================================================================
-- MIGRATION: Atualizar URLs de imagens dos produtos para Cloudflare R2
-- ====================================================================

UPDATE produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/salgados/brotinho-frango.webp'
WHERE id = 260;

UPDATE produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/brownies/brownie-leite-ninho.png'
WHERE id = 275;

UPDATE produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/brownies/brownie-tradicional.png'
WHERE id = 276;

UPDATE produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/brownies/brownie-ninho-com-nutella.webp'
WHERE id = 278;

UPDATE produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/brownies/brownie-de-brigadeiro.png'
WHERE id = 281;

UPDATE produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/brownies/brownie-doce-de-leite.png'
WHERE id = 282;

UPDATE produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/doces/bordinhas-de-brownie.webp'
WHERE id = 283;

UPDATE produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/brownies/brownie-nutella.png'
WHERE id = 301;

UPDATE produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/doces/pao-de-mel-doce-de-leite.png'
WHERE id = 304;

UPDATE produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/doces/pao-de-mel-de-brigadeiro.png'
WHERE id = 308;

UPDATE produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/salgados/kit-de-salgados-15-unidades.png'
WHERE id = 394;

UPDATE produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/bolos/mini-vulcao-cenoura-com-chocolate.png'
WHERE id = 401;

UPDATE produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/cookies/cookie-ninhotella.png'
WHERE id = 405;

UPDATE produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/bolos/bolo-nuvem.webp'
WHERE id = 480;

UPDATE produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/salgados/kit-de-salgadinhos-10-unidades.png'
WHERE id = 483;

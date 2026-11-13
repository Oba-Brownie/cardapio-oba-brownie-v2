-- ==============================================================================
-- Migration: Associar produtos às imagens no Cloudflare R2
-- Data: 2026-11-13
-- Bucket: oba-brownie-fotos (Account: 27e3d44c56e6f533fdd2e53e3f900825)
-- ==============================================================================
-- INSTRUÇÃO:
-- Substitua 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev' pelo seu domínio público configurado
-- no painel do Cloudflare R2 (R2.dev subdomain ou Custom domain).
-- ==============================================================================

-- 1. Brownie Tradicional (ID 276)
UPDATE public.produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/brownies/brownie-tradicional.png'
WHERE id = 276;

-- 2. Brownie Leite Ninho (ID 275)
UPDATE public.produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/brownies/brownie-leite-ninho.png'
WHERE id = 275;

-- 3. Brownie ninho com Nutella (ID 278)
UPDATE public.produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/brownies/brownie-ninho-com-nutella.webp'
WHERE id = 278;

-- 4. Brownie de Brigadeiro (ID 281)
UPDATE public.produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/brownies/brownie-de-brigadeiro.png'
WHERE id = 281;

-- 5. Brownie Doce de Leite (ID 282)
UPDATE public.produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/brownies/brownie-doce-de-leite.png'
WHERE id = 282;

-- 6. Brownie Nutella (ID 301)
UPDATE public.produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/brownies/brownie-nutella.png'
WHERE id = 301;

-- 7. Bordinhas de Brownie (ID 283)
UPDATE public.produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/doces/bordinhas-de-brownie.webp'
WHERE id = 283;

-- 8. Pão de mel doce de leite (ID 304)
UPDATE public.produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/doces/pao-de-mel-doce-de-leite.png'
WHERE id = 304;

-- 9. Pão de mel de brigadeiro (ID 308)
UPDATE public.produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/doces/pao-de-mel-de-brigadeiro.png'
WHERE id = 308;

-- 10. Cone trufado ninho com Nutella (ID 364)
UPDATE public.produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/doces/cone-trufado-ninho-com-nutella.png'
WHERE id = 364;

-- 11. Cone trufado ChocoBrownie (ID 365)
UPDATE public.produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/doces/cone-trufado-chocobrownie.png'
WHERE id = 365;

-- 12. Brotinho Frango (ID 260)
UPDATE public.produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/salgados/brotinho-frango.webp'
WHERE id = 260;

-- 13. Kit de salgados 15 unidades (ID 394)
UPDATE public.produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/salgados/kit-de-salgados-15-unidades.png'
WHERE id = 394;

-- 14. Kit de salgadinhos 10 unidades (ID 483)
UPDATE public.produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/salgados/kit-de-salgadinhos-10-unidades.png'
WHERE id = 483;

-- 15. Bolo gelado choconinho (ID 328)
UPDATE public.produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/bolos/bolo-gelado-choconinho.webp'
WHERE id = 328;

-- 16. Bolo Nuvem (ID 480)
UPDATE public.produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/bolos/bolo-nuvem.webp'
WHERE id = 480;

-- 17. Mini Vulcão Cenoura com chocolate (ID 401)
UPDATE public.produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/bolos/mini-vulcao-cenoura-com-chocolate.png'
WHERE id = 401;

-- 18. Cookie Ninhotella (ID 405)
UPDATE public.produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/cookies/cookie-ninhotella.png'
WHERE id = 405;

-- 19. Ketchup e Maionese (ID 263)
UPDATE public.produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/acompanhamentos/ketchup-e-maionese.webp'
WHERE id = 263;

-- 20. SUA FOTO VALE UM BRINDE! (ID 288)
UPDATE public.produtos
SET imagem = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev/produtos/promocoes/sua-foto-vale-um-brinde.webp'
WHERE id = 288;

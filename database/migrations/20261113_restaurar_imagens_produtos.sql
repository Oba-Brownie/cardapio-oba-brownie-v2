-- ==============================================================================
-- Migration: Restaurar imagens de produtos para links ativos recuperados (ImgBB)
-- Data: 2026-11-13
-- Motivo: Cloudinary hhoqdvcp desativado (401); restaura imagens originais do backup
-- ==============================================================================

-- 1. Bordinhas de Brownie (ID 283)
UPDATE public.produtos
SET imagem = 'https://i.ibb.co/mrNGnZZc/brownie.webp'
WHERE id = 283 AND imagem LIKE '%res.cloudinary.com/hhoqdvcp%';

-- 2. Pão de mel doce de leite (ID 304)
UPDATE public.produtos
SET imagem = 'https://i.ibb.co/XfNDN32t/brownie-1786619800267.png'
WHERE id = 304 AND imagem LIKE '%res.cloudinary.com/hhoqdvcp%';

-- 3. Pão de mel de brigadeiro (ID 308)
UPDATE public.produtos
SET imagem = 'https://i.ibb.co/p6y7fkSX/brownie-1783609978117.png'
WHERE id = 308 AND imagem LIKE '%res.cloudinary.com/hhoqdvcp%';

-- 4. Brotinho Frango (ID 260)
UPDATE public.produtos
SET imagem = 'https://i.ibb.co/k2YHC4Xp/brownie.webp'
WHERE id = 260 AND imagem LIKE '%res.cloudinary.com/hhoqdvcp%';

-- 5. Brownie Tradicional (ID 276)
UPDATE public.produtos
SET imagem = 'https://i.ibb.co/RXpqhLP/brownie-1776135053256.png'
WHERE id = 276 AND imagem LIKE '%res.cloudinary.com/hhoqdvcp%';

-- 6. Brownie Leite Ninho (ID 275)
UPDATE public.produtos
SET imagem = 'https://i.ibb.co/3ynPn5YK/brownie-1776435743579.png'
WHERE id = 275 AND imagem LIKE '%res.cloudinary.com/hhoqdvcp%';

-- 7. Mini Vulcão Cenoura com chocolate (ID 401)
UPDATE public.produtos
SET imagem = 'https://i.ibb.co/XwCFYBv/brownie-1780020522386.png'
WHERE id = 401 AND imagem LIKE '%res.cloudinary.com/hhoqdvcp%';

-- 8. Cookie Ninhotella (ID 405)
UPDATE public.produtos
SET imagem = 'https://i.ibb.co/Qqd1xdR/brownie-1784859171821.png'
WHERE id = 405 AND imagem LIKE '%res.cloudinary.com/hhoqdvcp%';

-- 9. Kit de salgados 15 unidades (ID 394)
UPDATE public.produtos
SET imagem = 'https://i.ibb.co/kgf7gj5z/brownie-1785765178987.png'
WHERE id = 394 AND imagem LIKE '%res.cloudinary.com/hhoqdvcp%';

-- 10. Risole de Carne (ID 265)
UPDATE public.produtos
SET imagem = 'https://i.ibb.co/XrVZtB33/brownie-1778896436155.png'
WHERE id = 265 AND imagem LIKE '%res.cloudinary.com/hhoqdvcp%';

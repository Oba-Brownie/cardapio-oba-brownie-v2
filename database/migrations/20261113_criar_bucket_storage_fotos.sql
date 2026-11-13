-- ====================================================================
-- MIGRATION: Criar bucket de fotos dos produtos no Supabase Storage
-- ====================================================================

SET lock_timeout = '2s';
SET statement_timeout = '10s';

-- 1. Cria ou atualiza o bucket 'fotos-brownie' com acesso público
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'fotos-brownie',
    'fotos-brownie',
    true,
    5242880,
    ARRAY['image/webp', 'image/png', 'image/jpeg', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/webp', 'image/png', 'image/jpeg', 'image/jpg'];

-- 2. Permite upload de imagens no bucket
DROP POLICY IF EXISTS "Permitir upload publico em fotos-brownie" ON storage.objects;
CREATE POLICY "Permitir upload publico em fotos-brownie"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'fotos-brownie');

-- 3. Permite leitura pública de todas as fotos
DROP POLICY IF EXISTS "Permitir leitura publica de fotos-brownie" ON storage.objects;
CREATE POLICY "Permitir leitura publica de fotos-brownie"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'fotos-brownie');

-- 4. Permite atualizar/substituir fotos
DROP POLICY IF EXISTS "Permitir update em fotos-brownie" ON storage.objects;
CREATE POLICY "Permitir update em fotos-brownie"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'fotos-brownie');

-- 5. Permite excluir fotos quando necessário
DROP POLICY IF EXISTS "Permitir delete em fotos-brownie" ON storage.objects;
CREATE POLICY "Permitir delete em fotos-brownie"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'fotos-brownie');

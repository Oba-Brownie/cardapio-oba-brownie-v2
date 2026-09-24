# Migração de escopo dos cupons

Esta alteração aditiva cria os campos usados para limitar cupons à loja, a uma seção ou à taxa de entrega. Cupons existentes recebem `target_tipo = 'loja'` e continuam funcionando como antes.

O SQL abaixo é uma proposta local. Não foi executado no Supabase. Revise as policies/RLS existentes e aplique manualmente quando decidir publicar a funcionalidade.

```sql
alter table public.cupons
  add column if not exists target_tipo text not null default 'loja',
  add column if not exists target_categoria text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cupons_target_tipo_check'
      and conrelid = 'public.cupons'::regclass
  ) then
    alter table public.cupons
      add constraint cupons_target_tipo_check
      check (target_tipo in ('loja', 'categoria', 'frete'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'cupons_target_categoria_check'
      and conrelid = 'public.cupons'::regclass
  ) then
    alter table public.cupons
      add constraint cupons_target_categoria_check
      check (
        (target_tipo = 'categoria' and nullif(btrim(target_categoria), '') is not null)
        or (target_tipo in ('loja', 'frete') and target_categoria is null)
      );
  end if;
end
$$;
```

Após aplicar, valide a criação de um cupom de loja, de seção e de taxa de entrega. Para cupom de seção, confirme que o campo `target_categoria` recebe uma categoria existente. Esta migração não altera RLS e pode ser reaplicada.

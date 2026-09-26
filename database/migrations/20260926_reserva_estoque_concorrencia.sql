-- Reserva de estoque na entrada do pedido para impedir venda concorrente do mesmo saldo.
-- Revisar contra o schema atual e testar em projeto isolado antes de aplicar em producao.

begin;

create schema if not exists app_private;

alter table public.produtos
  add column if not exists estoque_reservado integer not null default 0;

-- NULL não representa saldo conhecido; normalize como indisponível e torne explícito.
update public.produtos set estoque = 0 where estoque is null;
alter table public.produtos alter column estoque set default 0;
alter table public.produtos alter column estoque set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'produtos_estoque_nonnegative'
       and conrelid = 'public.produtos'::regclass
  ) then
    alter table public.produtos
      add constraint produtos_estoque_nonnegative check (estoque >= 0);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'produtos_estoque_reservado_valido'
       and conrelid = 'public.produtos'::regclass
  ) then
    alter table public.produtos
      add constraint produtos_estoque_reservado_valido
      check (estoque_reservado >= 0 and estoque_reservado <= estoque);
  end if;
end
$$;

alter table public.pedidos
  add column if not exists estoque_status text not null default 'legado',
  add column if not exists estoque_baixado_em timestamptz,
  add column if not exists checkout_request_id uuid;

-- Pedidos de uma eventual versão intermediária nunca tiveram reserva real.
update public.pedidos
   set estoque_status = 'legado'
 where estoque_status is null or estoque_status = 'pendente';
alter table public.pedidos alter column estoque_status set default 'reservado';
alter table public.pedidos drop constraint if exists pedidos_estoque_status_check;
alter table public.pedidos add constraint pedidos_estoque_status_check
  check (estoque_status in ('legado', 'reservado', 'baixado', 'liberado'));

create unique index if not exists pedidos_checkout_request_id_key
  on public.pedidos (checkout_request_id)
  where checkout_request_id is not null;

create table if not exists app_private.pedidos_reservas_estoque (
  pedido_id text not null,
  produto_id text not null,
  quantidade integer not null check (quantidade > 0),
  estado text not null check (estado in ('ativa', 'consumida', 'liberada')),
  criada_em timestamptz not null default now(),
  encerrada_em timestamptz,
  admin_user_id uuid references auth.users(id),
  primary key (pedido_id, produto_id)
);

create table if not exists app_private.checkout_requests (
  request_id uuid primary key,
  pedido_id text not null,
  criada_em timestamptz not null default now()
);

create table if not exists app_private.pedidos_baixas_estoque (
  pedido_id text not null,
  produto_id text not null,
  quantidade integer not null check (quantidade > 0),
  estoque_antes integer not null check (estoque_antes >= 0),
  estoque_depois integer not null check (estoque_depois >= 0),
  admin_user_id uuid references auth.users(id),
  criado_em timestamptz not null default now(),
  primary key (pedido_id, produto_id)
);

create index if not exists pedidos_reservas_ativas_produto_idx
  on app_private.pedidos_reservas_estoque (produto_id, pedido_id)
  where estado = 'ativa';

alter table app_private.pedidos_reservas_estoque enable row level security;
alter table app_private.checkout_requests enable row level security;
alter table app_private.pedidos_baixas_estoque enable row level security;
revoke all on table app_private.pedidos_reservas_estoque from public, anon, authenticated;
revoke all on table app_private.checkout_requests from public, anon, authenticated;
revoke all on table app_private.pedidos_baixas_estoque from public, anon, authenticated;
grant usage on schema app_private to authenticated, service_role;

create or replace function app_private._criar_pedido_com_reserva(
  p_pedido jsonb,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido_id text;
  v_payload_existente jsonb;
  v_payload_atual jsonb;
  v_item record;
  v_estoque integer;
  v_reservado integer;
  v_ativo boolean;
  v_existing_status text;
begin
  if p_request_id is null
     or jsonb_typeof(p_pedido) is distinct from 'object'
     or pg_catalog.octet_length(p_pedido::text) > 16000
     or char_length(btrim(coalesce(p_pedido ->> 'cliente_nome', ''))) not between 1 and 120
     or jsonb_typeof(p_pedido -> 'cliente_dados') is distinct from 'object' then
    raise exception using errcode = '22023', message = 'Dados do pedido inválidos.';
  end if;

  if jsonb_typeof(p_pedido -> 'itens') is distinct from 'array' then
    raise exception using errcode = '22023', message = 'A lista de itens do pedido é inválida.';
  end if;
  if jsonb_array_length(p_pedido -> 'itens') not between 1 and 50 then
    raise exception using errcode = '22023', message = 'A quantidade de itens do pedido é inválida.';
  end if;
  if coalesce(p_pedido ->> 'total', '') !~ '^[0-9]+([.][0-9]{1,2})?$' then
    raise exception using errcode = '22023', message = 'O total do pedido é inválido.';
  end if;
  if (p_pedido ->> 'total')::numeric < 0 then
    raise exception using errcode = '22023', message = 'O total do pedido é inválido.';
  end if;

  v_payload_atual := jsonb_build_object(
    'cliente_nome', btrim(p_pedido ->> 'cliente_nome'),
    'cliente_dados', p_pedido -> 'cliente_dados',
    'itens', p_pedido -> 'itens',
    'total', (p_pedido ->> 'total')::numeric
  );

  if exists (
    select 1
      from jsonb_array_elements(p_pedido -> 'itens') as e(item)
     where jsonb_typeof(e.item) is distinct from 'object'
        or nullif(btrim(e.item ->> 'id'), '') is null
        or coalesce(e.item ->> 'id', '') !~ '^[1-9][0-9]*$'
        or coalesce(e.item ->> 'quantity', '') !~ '^[1-9][0-9]*$'
  ) then
    raise exception using errcode = '22023', message = 'Itens ou quantidades inválidos.';
  end if;
  if exists (
    select 1
      from jsonb_array_elements(p_pedido -> 'itens') as e(item)
     where (e.item ->> 'quantity')::numeric > 2147483647
  ) then
    raise exception using errcode = '22023', message = 'Itens ou quantidades inválidos.';
  end if;

  -- Serializa tentativas com a mesma chave; chamadas repetidas retornam o pedido original.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select r.pedido_id into v_pedido_id
    from app_private.checkout_requests r
   where r.request_id = p_request_id;
  if found then
    select jsonb_build_object(
             'cliente_nome', p.cliente_nome,
             'cliente_dados', p.cliente_dados,
             'itens', p.itens,
             'total', p.total
           ), p.status
      into v_payload_existente, v_existing_status
      from public.pedidos p where p.id = v_pedido_id::bigint;
    if not found then
      raise exception using errcode = 'P0002', message = 'O pedido desta tentativa já foi removido. Fale com a loja antes de reenviar.';
    end if;
    if v_payload_existente is distinct from v_payload_atual then
      raise exception using errcode = '23505', message = 'Esta tentativa já foi registrada com outros dados. Consulte a loja antes de enviar novamente.';
    end if;
    if v_existing_status = 'Cancelado' then
      raise exception using errcode = 'P0002', message = 'O pedido desta tentativa já foi cancelado ou removido. Fale com a loja antes de reenviar.';
    end if;
    return jsonb_build_object('ok', true, 'pedido_id', v_pedido_id, 'repetido', true);
  end if;

  insert into public.pedidos (
    cliente_nome, cliente_dados, itens, total, status, data,
    estoque_status, checkout_request_id
  ) values (
    btrim(p_pedido ->> 'cliente_nome'),
    p_pedido -> 'cliente_dados',
    p_pedido -> 'itens',
    (p_pedido ->> 'total')::numeric,
    'Novo',
    now(),
    'reservado',
    p_request_id
  ) returning id::text into v_pedido_id;

  -- IDs sempre são bloqueados em ordem estável; itens repetidos são somados.
  for v_item in
    select ((e.item ->> 'id')::bigint)::text as produto_id,
           sum((e.item ->> 'quantity')::bigint) as quantidade
      from jsonb_array_elements(p_pedido -> 'itens') as e(item)
     group by ((e.item ->> 'id')::bigint)::text
     order by ((e.item ->> 'id')::bigint)::text
  loop
    if v_item.quantidade > 2147483647 then
      raise exception using errcode = '22023', message = 'Quantidade inválida no pedido.';
    end if;

    select p.estoque, p.estoque_reservado, p.ativo
      into v_estoque, v_reservado, v_ativo
      from public.produtos p
     where p.id = v_item.produto_id::bigint
     for update;

    if not found or v_ativo is distinct from true
       or v_estoque - v_reservado < v_item.quantidade then
      raise exception using errcode = 'P0001', message = 'Estoque insuficiente ou produto indisponível.';
    end if;

    update public.produtos
       set estoque_reservado = estoque_reservado + v_item.quantidade::integer
     where id = v_item.produto_id::bigint;

    insert into app_private.pedidos_reservas_estoque (
      pedido_id, produto_id, quantidade, estado
    ) values (
      v_pedido_id, v_item.produto_id, v_item.quantidade::integer, 'ativa'
    );
  end loop;

  insert into app_private.checkout_requests (request_id, pedido_id)
  values (p_request_id, v_pedido_id);

  return jsonb_build_object('ok', true, 'pedido_id', v_pedido_id, 'repetido', false);
end;
$$;

create or replace function app_private._confirmar_pedido_preparacao(
  p_pedido_id text,
  p_confirmar_legado boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido record;
  v_reserva record;
  v_estoque integer;
  v_depois integer;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception using errcode = '42501', message = 'Ação permitida somente para administradores.';
  end if;

  select p.id::text as id, p.status, p.estoque_status, p.itens
    into v_pedido
    from public.pedidos p
   where p.id = p_pedido_id::bigint
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Pedido não encontrado.';
  end if;

  if v_pedido.status = 'Em Preparação' and v_pedido.estoque_status in ('baixado', 'legado') then
    return jsonb_build_object('ok', true, 'ja_processado', true, 'estoque_status', v_pedido.estoque_status);
  end if;
  if v_pedido.status <> 'Novo' then
    raise exception using errcode = '22023', message = 'Somente pedidos novos podem ser confirmados para preparação.';
  end if;

  if v_pedido.estoque_status = 'legado' then
    if not coalesce(p_confirmar_legado, false) then
      raise exception using errcode = 'P0002', message = 'Pedido legado requer conferência manual de estoque.';
    end if;
    update public.pedidos set status = 'Em Preparação' where id = v_pedido.id::bigint;
    return jsonb_build_object('ok', true, 'estoque_status', 'legado', 'baixa_automatica', false);
  end if;

  if v_pedido.estoque_status <> 'reservado' then
    raise exception using errcode = '22023', message = 'Este pedido não possui reserva válida.';
  end if;

  -- Impede confirmar com ledger incompleto, duplicado ou parcialmente encerrado.
  if exists (
    select 1 from app_private.pedidos_reservas_estoque r
     where r.pedido_id = v_pedido.id and r.estado <> 'ativa'
  ) or not exists (
    select 1 from app_private.pedidos_reservas_estoque r
     where r.pedido_id = v_pedido.id and r.estado = 'ativa'
  ) or exists (
    with itens as (
      select e.item ->> 'id' as produto_id,
             sum((e.item ->> 'quantity')::bigint) as quantidade
        from jsonb_array_elements(v_pedido.itens) as e(item)
       group by e.item ->> 'id'
    ), reservas as (
      select r.produto_id, sum(r.quantidade)::bigint as quantidade
        from app_private.pedidos_reservas_estoque r
       where r.pedido_id = v_pedido.id and r.estado = 'ativa'
       group by r.produto_id
    )
    select 1 from itens i
    full join reservas r using (produto_id)
    where i.quantidade is distinct from r.quantidade
  ) then
    raise exception using errcode = '22023', message = 'A reserva do pedido não corresponde aos itens; estoque não alterado.';
  end if;

  for v_reserva in
    select r.produto_id, r.quantidade
      from app_private.pedidos_reservas_estoque r
     where r.pedido_id = v_pedido.id and r.estado = 'ativa'
     order by r.produto_id
     for update
  loop
    select p.estoque into v_estoque
      from public.produtos p
     where p.id = v_reserva.produto_id::bigint
     for update;
    if not found or v_estoque < v_reserva.quantidade then
      raise exception using errcode = 'P0001', message = 'Saldo físico inconsistente; pedido não movido para preparação.';
    end if;

    update public.produtos
       set estoque = estoque - v_reserva.quantidade,
           estoque_reservado = estoque_reservado - v_reserva.quantidade
     where id = v_reserva.produto_id::bigint
     returning estoque into v_depois;

    update app_private.pedidos_reservas_estoque
       set estado = 'consumida', encerrada_em = now(), admin_user_id = auth.uid()
     where pedido_id = v_pedido.id and produto_id = v_reserva.produto_id and estado = 'ativa';

    insert into app_private.pedidos_baixas_estoque (
      pedido_id, produto_id, quantidade, estoque_antes, estoque_depois, admin_user_id
    ) values (
      v_pedido.id, v_reserva.produto_id, v_reserva.quantidade,
      v_depois + v_reserva.quantidade, v_depois, auth.uid()
    );
  end loop;

  if not exists (
    select 1 from app_private.pedidos_reservas_estoque r
     where r.pedido_id = v_pedido.id and r.estado = 'consumida'
  ) then
    raise exception using errcode = '22023', message = 'Reserva de estoque ausente; pedido não movido para preparação.';
  end if;

  update public.pedidos
     set status = 'Em Preparação', estoque_status = 'baixado', estoque_baixado_em = now()
   where id = v_pedido.id::bigint;
  return jsonb_build_object('ok', true, 'estoque_status', 'baixado', 'baixa_automatica', true);
end;
$$;

create or replace function app_private._cancelar_pedido_e_liberar_estoque(p_pedido_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido record;
  v_reserva record;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception using errcode = '42501', message = 'Ação permitida somente para administradores.';
  end if;

  select p.id::text as id, p.status, p.estoque_status
    into v_pedido
    from public.pedidos p
   where p.id = p_pedido_id::bigint
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Pedido não encontrado.';
  end if;
  if v_pedido.status = 'Cancelado' then
    if not exists (
      select 1 from app_private.pedidos_reservas_estoque r
       where r.pedido_id = v_pedido.id and r.estado = 'ativa'
    ) then
      if v_pedido.estoque_status = 'reservado' and not exists (
        select 1 from app_private.pedidos_reservas_estoque r
         where r.pedido_id = v_pedido.id and r.estado = 'liberada'
      ) then
        raise exception using errcode = '22023', message = 'Pedido cancelado com reserva inconsistente; confira o estoque manualmente.';
      end if;
      return jsonb_build_object('ok', true, 'ja_cancelado', true);
    end if;
  end if;
  if v_pedido.status not in ('Novo', 'Cancelado') then
    if v_pedido.status not in ('Concluido', 'Arquivado')
       or v_pedido.estoque_status not in ('baixado', 'legado')
       or exists (
         select 1 from app_private.pedidos_reservas_estoque r
          where r.pedido_id = v_pedido.id and r.estado = 'ativa'
       ) then
      raise exception using errcode = '22023', message = 'Pedido em andamento ou com reserva ativa não pode ser removido.';
    end if;
    -- Histórico concluído pode ser removido por ação explícita do admin; o ledger permanece.
    delete from public.pedidos where id = v_pedido.id::bigint;
    return jsonb_build_object('ok', true, 'excluido', true, 'estoque_liberado', false);
  end if;

  for v_reserva in
    select r.produto_id, r.quantidade
      from app_private.pedidos_reservas_estoque r
     where r.pedido_id = v_pedido.id and r.estado = 'ativa'
     order by r.produto_id
     for update
  loop
    update public.produtos
       set estoque_reservado = estoque_reservado - v_reserva.quantidade
     where id = v_reserva.produto_id::bigint
       and estoque_reservado >= v_reserva.quantidade;
    if not found then
      raise exception using errcode = 'P0001', message = 'Reserva inconsistente; cancelamento não aplicado.';
    end if;

    update app_private.pedidos_reservas_estoque
       set estado = 'liberada', encerrada_em = now(), admin_user_id = auth.uid()
     where pedido_id = v_pedido.id and produto_id = v_reserva.produto_id and estado = 'ativa';
  end loop;

  if v_pedido.estoque_status = 'reservado' and not exists (
    select 1 from app_private.pedidos_reservas_estoque r
     where r.pedido_id = v_pedido.id and r.estado = 'liberada'
  ) then
    raise exception using errcode = '22023', message = 'Reserva ausente; não foi possível liberar saldo automaticamente.';
  end if;

  update public.pedidos
     set status = 'Cancelado',
         estoque_status = case when estoque_status = 'reservado' then 'liberado' else estoque_status end
   where id = v_pedido.id::bigint;
  return jsonb_build_object('ok', true, 'status', 'Cancelado', 'estoque_liberado', true);
end;
$$;

create or replace function app_private._mudar_status_pedido(p_pedido_id text, p_novo_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status_atual text;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception using errcode = '42501', message = 'Ação permitida somente para administradores.';
  end if;
  select p.status into v_status_atual
    from public.pedidos p where p.id = p_pedido_id::bigint for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Pedido não encontrado.';
  end if;
  if not ((v_status_atual = 'Em Preparação' and p_novo_status = 'Em Entrega')
       or (v_status_atual in ('Em Entrega', 'Visto') and p_novo_status = 'Concluido')) then
    raise exception using errcode = '22023', message = 'Transição de status inválida.';
  end if;
  update public.pedidos set status = p_novo_status where id = p_pedido_id::bigint;
  return jsonb_build_object('ok', true, 'status', p_novo_status);
end;
$$;

revoke all on function app_private._criar_pedido_com_reserva(jsonb, uuid) from public;
revoke all on function app_private._criar_pedido_com_reserva(jsonb, uuid) from anon, authenticated;
revoke all on function app_private._confirmar_pedido_preparacao(text, boolean) from public, anon;
revoke all on function app_private._cancelar_pedido_e_liberar_estoque(text) from public, anon;
revoke all on function app_private._mudar_status_pedido(text, text) from public, anon;
grant execute on function app_private._criar_pedido_com_reserva(jsonb, uuid) to service_role;
grant execute on function app_private._confirmar_pedido_preparacao(text, boolean) to authenticated;
grant execute on function app_private._cancelar_pedido_e_liberar_estoque(text) to authenticated;
grant execute on function app_private._mudar_status_pedido(text, text) to authenticated;

create or replace function public.criar_pedido_com_reserva(p_pedido jsonb, p_request_id uuid)
returns jsonb language sql volatile security invoker set search_path = ''
as $$ select app_private._criar_pedido_com_reserva($1, $2); $$;

create or replace function public.confirmar_pedido_preparacao(p_pedido_id text, p_confirmar_legado boolean default false)
returns jsonb language sql volatile security invoker set search_path = ''
as $$ select app_private._confirmar_pedido_preparacao($1, $2); $$;

create or replace function public.cancelar_pedido_e_liberar_estoque(p_pedido_id text)
returns jsonb language sql volatile security invoker set search_path = ''
as $$ select app_private._cancelar_pedido_e_liberar_estoque($1); $$;

create or replace function public.mudar_status_pedido(p_pedido_id text, p_novo_status text)
returns jsonb language sql volatile security invoker set search_path = ''
as $$ select app_private._mudar_status_pedido($1, $2); $$;

revoke all on function public.criar_pedido_com_reserva(jsonb, uuid) from public;
revoke all on function public.confirmar_pedido_preparacao(text, boolean) from public, anon;
revoke all on function public.cancelar_pedido_e_liberar_estoque(text) from public, anon;
revoke all on function public.mudar_status_pedido(text, text) from public, anon;
revoke all on function public.criar_pedido_com_reserva(jsonb, uuid) from anon, authenticated;
grant execute on function public.criar_pedido_com_reserva(jsonb, uuid) to service_role;
grant execute on function public.confirmar_pedido_preparacao(text, boolean) to authenticated;
grant execute on function public.cancelar_pedido_e_liberar_estoque(text) to authenticated;
grant execute on function public.mudar_status_pedido(text, text) to authenticated;

-- O pedido passa a ser gravado/mutado somente pelas RPCs; remove policies antigas
-- inclusive nomes criados em versões anteriores (INSERT público e admin FOR ALL).
alter table public.pedidos enable row level security;
do $$
declare
  v_policy record;
begin
  for v_policy in
    select polname from pg_policy where polrelid = 'public.pedidos'::regclass
  loop
    execute format('drop policy %I on public.pedidos', v_policy.polname);
  end loop;
end
$$;

create policy "Admin reads pedidos"
  on public.pedidos for select to authenticated
  using ((select public.is_admin()));

revoke select, insert, update, delete, truncate, references, trigger
  on table public.pedidos from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.pedidos from public, authenticated;
grant select on table public.pedidos to authenticated;

commit;

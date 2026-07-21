-- ============================================================
--  Cronosfera · Seguridad (RLS) y lógica de negocio en servidor
--  ------------------------------------------------------------
--  Ejecutar DESPUÉS de 01-schema.sql
--
--  Idea clave: el navegador NUNCA decide precios ni ganadores.
--  Las pujas pasan por una función del servidor que valida y
--  bloquea la fila de la subasta, así dos personas pujando en
--  el mismo segundo no se pisan.
-- ============================================================

alter table public.profiles           enable row level security;
alter table public.products           enable row level security;
alter table public.wholesale_requests enable row level security;
alter table public.auctions           enable row level security;
alter table public.bids               enable row level security;
alter table public.orders             enable row level security;
alter table public.config             enable row level security;

-- ---------- PERFILES ----------
drop policy if exists profiles_self_read     on public.profiles;
drop policy if exists profiles_admin_read    on public.profiles;
drop policy if exists profiles_self_update   on public.profiles;
drop policy if exists profiles_admin_update  on public.profiles;

-- Cada quien ve su perfil; el admin ve todos.
create policy profiles_self_read on public.profiles
  for select using (id = auth.uid() or public.is_admin());
-- Cada quien edita sus datos de contacto; solo el admin cambia rol/estado
-- (lo garantiza el trigger de abajo, no la política).
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid() or public.is_admin());

-- Un usuario no puede auto-ascenderse a admin ni auto-aprobarse como mayorista.
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    new.role   := old.role;
    new.status := old.status;
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_protect_privileges on public.profiles;
create trigger profiles_protect_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();

-- ---------- PRODUCTOS: catálogo público, escritura solo admin ----------
drop policy if exists products_public_read on public.products;
drop policy if exists products_admin_write on public.products;
create policy products_public_read on public.products for select using (true);
create policy products_admin_write on public.products for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------- SOLICITUDES MAYORISTAS ----------
drop policy if exists wr_owner_read   on public.wholesale_requests;
drop policy if exists wr_owner_insert on public.wholesale_requests;
drop policy if exists wr_admin_all    on public.wholesale_requests;
create policy wr_owner_read on public.wholesale_requests
  for select using (user_id = auth.uid() or public.is_admin());
create policy wr_owner_insert on public.wholesale_requests
  for insert with check (user_id = auth.uid());
-- Solo el admin aprueba o rechaza.
create policy wr_admin_all on public.wholesale_requests
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------- SUBASTAS: visibles para todos, las crea el admin ----------
drop policy if exists auctions_public_read on public.auctions;
drop policy if exists auctions_admin_write on public.auctions;
create policy auctions_public_read on public.auctions for select using (true);
create policy auctions_admin_write on public.auctions for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------- PUJAS: historial público; NADIE inserta directo ----------
-- Se insertan únicamente a través de la función place_bid(), que valida todo.
drop policy if exists bids_public_read on public.bids;
create policy bids_public_read on public.bids for select using (true);

-- ---------- PEDIDOS ----------
drop policy if exists orders_owner_read   on public.orders;
drop policy if exists orders_insert       on public.orders;
drop policy if exists orders_admin_update on public.orders;
create policy orders_owner_read on public.orders
  for select using (user_id = auth.uid() or public.is_admin());
-- Se permite comprar como invitado (user_id nulo).
create policy orders_insert on public.orders
  for insert with check (user_id = auth.uid() or user_id is null);
create policy orders_admin_update on public.orders
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------- CONFIGURACIÓN ----------
drop policy if exists config_public_read on public.config;
drop policy if exists config_admin_write on public.config;
create policy config_public_read on public.config for select using (true);
create policy config_admin_write on public.config for all
  using (public.is_admin()) with check (public.is_admin());


-- ============================================================
--  PUJAR: toda la validación ocurre aquí, en el servidor
-- ============================================================
create or replace function public.place_bid(p_auction_id uuid, p_amount bigint)
returns public.auctions
language plpgsql
security definer set search_path = public
as $$
declare
  a          public.auctions;
  prof       public.profiles;
  v_min      bigint;
  v_now      timestamptz := now();
begin
  -- Debe haber sesión iniciada.
  if auth.uid() is null then
    raise exception 'Necesitas una cuenta para pujar';
  end if;

  select * into prof from public.profiles where id = auth.uid();
  if prof is null then
    raise exception 'Necesitas una cuenta para pujar';
  end if;
  if prof.status <> 'active' then
    raise exception 'Tu cuenta no está activa para pujar';
  end if;

  -- Bloquea la fila: si dos personas pujan a la vez, se atienden en orden.
  select * into a from public.auctions where id = p_auction_id for update;
  if a is null then
    raise exception 'Subasta no encontrada';
  end if;
  if a.status = 'closed' or a.closed_at is not null or v_now >= a.ends_at then
    raise exception 'La subasta ya cerró';
  end if;
  if v_now < a.starts_at then
    raise exception 'La subasta aún no comienza';
  end if;

  -- Puja mínima = puja actual + incremento mínimo.
  v_min := a.current_bid + greatest(1, round(a.current_bid * a.min_increment_pct / 100.0));
  if p_amount is null or p_amount < v_min then
    raise exception 'Tu puja debe ser al menos %', v_min;
  end if;

  insert into public.bids (auction_id, user_id, amount)
  values (p_auction_id, auth.uid(), p_amount);

  -- Anti-snipe: si entra en el último tramo, se extiende el cierre.
  if a.anti_snipe_seconds > 0
     and (a.ends_at - v_now) < make_interval(secs => a.anti_snipe_seconds) then
    a.ends_at := v_now + make_interval(secs => a.extension_seconds);
  end if;

  update public.auctions
     set current_bid       = p_amount,
         current_bidder_id = auth.uid(),
         status            = 'live',
         ends_at           = a.ends_at
   where id = p_auction_id
   returning * into a;

  return a;
end;
$$;

revoke all on function public.place_bid(uuid, bigint) from public;
grant execute on function public.place_bid(uuid, bigint) to authenticated;


-- ============================================================
--  CIERRE: solo hay ganador si se alcanzó el precio de reserva
-- ============================================================
create or replace function public.close_expired_auctions()
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  n int := 0;
begin
  with cerradas as (
    update public.auctions
       set status      = 'closed',
           closed_at   = coalesce(closed_at, now()),
           reserve_met = (current_bidder_id is not null and current_bid >= reserve_price),
           winner_id   = case
                           when current_bidder_id is not null and current_bid >= reserve_price
                           then current_bidder_id else null
                         end
     where status <> 'closed'
       and closed_at is null
       and ends_at <= now()
     returning 1
  )
  select count(*) into n from cerradas;
  return n;
end;
$$;
grant execute on function public.close_expired_auctions() to anon, authenticated;

-- ============================================================
--  TIEMPO REAL: que las pujas se vean al instante en todos lados
-- ============================================================
alter publication supabase_realtime add table public.auctions;
alter publication supabase_realtime add table public.bids;
alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.orders;

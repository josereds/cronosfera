-- ============================================================
--  Cronosfera · Esquema de base de datos (Supabase / Postgres)
--  ------------------------------------------------------------
--  Ejecutar en: Supabase → SQL Editor → New query → Run
--  Es idempotente: se puede volver a ejecutar sin romper nada.
-- ============================================================

-- ---------- PERFILES ----------
-- Supabase guarda las credenciales en auth.users (no se toca).
-- Aquí van los datos de negocio de cada cuenta.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null default '',
  email       text not null,
  role        text not null default 'retail'   check (role   in ('retail','wholesale','admin')),
  status      text not null default 'active'   check (status in ('active','pending','rejected','suspended')),
  company     text,
  tax_id      text,
  phone       text,
  city        text,
  created_at  timestamptz not null default now()
);

-- Al registrarse un usuario en Supabase Auth se crea su perfil automáticamente.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role, status, company, tax_id, phone, city)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'retail'),
    -- Las cuentas mayoristas nacen pendientes de aprobación manual.
    case when coalesce(new.raw_user_meta_data->>'role','retail') = 'wholesale'
         then 'pending' else 'active' end,
    new.raw_user_meta_data->>'company',
    new.raw_user_meta_data->>'tax_id',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'city'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: ¿el usuario actual es admin? (evita recursión en las políticas)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------- PRODUCTOS ----------
create table if not exists public.products (
  id                uuid primary key default gen_random_uuid(),
  brand             text not null,
  brand_slug        text,
  model             text not null,
  ref               text not null,
  price             bigint not null check (price >= 0),
  was_price         bigint default 0,
  off               int default 0,
  wholesale_price   bigint,
  tone              text default 'ink',
  tag               jsonb,
  stock             text default 'Disponible',
  stock_status      text default 'in' check (stock_status in ('in','low','out')),
  variants          jsonb default '[]'::jsonb,
  gender            text,
  mechanism         text,
  crystal           text,
  strap             text,
  case_size         text,
  case_material     text,
  water_resistance  text,
  image             text,
  created_at        timestamptz not null default now()
);
create index if not exists products_brand_slug_idx on public.products (brand_slug);

-- ---------- SOLICITUDES MAYORISTAS ----------
create table if not exists public.wholesale_requests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  reference      text not null unique,
  business_data  jsonb not null default '{}'::jsonb,
  status         text not null default 'pending' check (status in ('pending','approved','rejected')),
  reject_reason  text,
  created_at     timestamptz not null default now(),
  reviewed_at    timestamptz
);

-- ---------- SUBASTAS ----------
create table if not exists public.auctions (
  id                 uuid primary key default gen_random_uuid(),
  product_id         uuid not null references public.products(id) on delete cascade,
  start_price        bigint not null check (start_price > 0),
  current_bid        bigint not null,
  current_bidder_id  uuid references public.profiles(id) on delete set null,
  reserve_price      bigint not null default 0,
  min_increment_pct  int not null default 5 check (min_increment_pct > 0),
  anti_snipe_seconds int not null default 60,
  extension_seconds  int not null default 120,
  starts_at          timestamptz not null default now(),
  ends_at            timestamptz not null,
  status             text not null default 'scheduled' check (status in ('scheduled','live','closed')),
  closed_at          timestamptz,
  winner_id          uuid references public.profiles(id) on delete set null,
  reserve_met        boolean default false,
  created_at         timestamptz not null default now()
);
create index if not exists auctions_ends_at_idx on public.auctions (ends_at);

-- ---------- PUJAS ----------
create table if not exists public.bids (
  id          uuid primary key default gen_random_uuid(),
  auction_id  uuid not null references public.auctions(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  amount      bigint not null check (amount > 0),
  created_at  timestamptz not null default now()
);
create index if not exists bids_auction_idx on public.bids (auction_id, created_at desc);

-- ---------- PEDIDOS ----------
create table if not exists public.orders (
  id                    uuid primary key default gen_random_uuid(),
  reference             text not null unique,
  user_id               uuid references public.profiles(id) on delete set null,
  customer              jsonb not null default '{}'::jsonb,
  items                 jsonb not null default '[]'::jsonb,
  total                 bigint not null default 0,
  status                text not null default 'pendiente'
                        check (status in ('pendiente','contactado','pagado','rechazado','cancelado')),
  payment_method        text,
  wompi_transaction_id  text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz
);

-- ---------- CONFIGURACIÓN (una sola fila) ----------
create table if not exists public.config (
  id    int primary key default 1 check (id = 1),
  data  jsonb not null default '{}'::jsonb
);
insert into public.config (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;

-- ============================================================
--  Cronosfera · Promociones del home
--  ------------------------------------------------------------
--  Ejecutar en Supabase → SQL Editor (una sola vez).
--
--  Solo CREA una tabla nueva; no modifica ninguna existente.
--  Las imagenes se guardan en el bucket "product-images" (carpeta
--  promos/), cuyas politicas de admin ya existen: no hace falta
--  tocar Storage.
-- ============================================================

create table if not exists public.promotions (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text,
  image_url   text,
  link_url    text,          -- destino ya resuelto (producto, marca, subasta, tienda, WhatsApp o URL)
  link_kind   text,          -- de donde salio el enlace, para reabrir el formulario como estaba
  link_ref    text,          -- id/slug elegido en ese selector
  cta_label   text,
  active      boolean not null default true,
  starts_at   timestamptz,   -- null = desde ya
  ends_at     timestamptz,   -- null = sin fecha de fin
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists promotions_order_idx
  on public.promotions (sort_order, created_at);

alter table public.promotions enable row level security;

-- El publico solo ve promociones activas y dentro de su rango de fechas. La
-- vigencia la decide el servidor con now(): los borradores y las vencidas no
-- salen por la API aunque alguien la consulte directo.
drop policy if exists promotions_public_read on public.promotions;
create policy promotions_public_read on public.promotions
  for select using (
    public.is_admin()
    or (
      active
      and (starts_at is null or starts_at <= now())
      and (ends_at   is null or ends_at   >  now())
    )
  );

-- Crear, editar, reordenar y borrar: solo el administrador.
drop policy if exists promotions_admin_write on public.promotions;
create policy promotions_admin_write on public.promotions
  for all using (public.is_admin()) with check (public.is_admin());

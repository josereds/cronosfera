-- ============================================================
--  Cronosfera · Subastar relojes externos (de segunda)
--  ------------------------------------------------------------
--  Ejecutar en Supabase → SQL Editor (una sola vez).
--
--  Permite crear subastas de relojes que NO están montados en el
--  catálogo (por ejemplo piezas de segunda que Cristian consigue
--  puntualmente). Sin esto, solo se pueden subastar productos del
--  catálogo. Las subastas de catálogo siguen funcionando igual.
-- ============================================================

-- 1) El producto deja de ser obligatorio: una subasta puede referirse a un
--    ítem externo en vez de a un producto del catálogo.
alter table public.auctions
  alter column product_id drop not null;

-- 2) Datos propios del ítem externo (se usan cuando product_id es null).
alter table public.auctions
  add column if not exists item_title       text,
  add column if not exists item_ref         text,
  add column if not exists item_image       text,
  add column if not exists item_description text;

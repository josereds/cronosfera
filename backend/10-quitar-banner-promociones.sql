-- ============================================================
--  Cronosfera · (OPCIONAL) quitar la tabla del banner de promociones
--  ------------------------------------------------------------
--  La primera version de "Promociones" guardaba los banners en su propia
--  tabla (09-promociones.sql). La version final guarda los banners en la
--  configuracion del sitio (tabla config, clave homeBanners), asi que la
--  tabla promotions quedo sin uso y vacia. Borrarla es solo limpieza: el sitio funciona igual si se
--  deja. Ejecutar en Supabase -> SQL Editor si se quiere eliminar.
-- ============================================================
drop table if exists public.promotions;

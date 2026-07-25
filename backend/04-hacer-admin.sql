-- ============================================================
--  Cronosfera · Convertir una cuenta en administrador
--  ------------------------------------------------------------
--  Se usa UNA vez para crear el primer admin (y cada vez que se
--  quiera ascender a alguien más a admin desde el editor SQL).
--
--  Por qué el disable/enable trigger:
--  La tabla profiles tiene una protección (protect_profile_privileges)
--  que impide que un usuario cambie su propio rol/estado — así nadie
--  se auto-nombra admin desde el navegador. Pero desde el editor SQL
--  no hay usuario autenticado, así que esa misma protección revertiría
--  el cambio. Por eso se desactiva un instante, se hace el cambio, y se
--  vuelve a activar. (Ya con un admin, ese admin puede ascender a otros
--  desde el panel sin tocar esto.)
--
--  Pasos previos: crear la cuenta en Authentication → Users → Add user
--  (con Auto Confirm). Eso crea sola la fila en profiles como 'retail'.
-- ============================================================

alter table public.profiles disable trigger profiles_protect_privileges;

update public.profiles
   set role = 'admin', status = 'active'
 where email = 'TU-CORREO-ADMIN';   -- <-- cambia esto

alter table public.profiles enable trigger profiles_protect_privileges;

-- Verificación: tu correo debe salir con role = admin
select email, role, status from public.profiles;

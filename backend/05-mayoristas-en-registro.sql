-- ============================================================
--  Cronosfera · La solicitud mayorista se crea al registrarse
--  ------------------------------------------------------------
--  Ejecutar una vez en Supabase → SQL Editor → Run.
--
--  Por qué: con "confirmar correo" activado, el mayorista se
--  registra pero no tiene sesión hasta confirmar su email. Antes
--  la solicitud se creaba desde el navegador DESPUÉS de tener
--  sesión, así que nunca se creaba y el admin no la veía. Ahora
--  el propio servidor (este trigger) crea el perfil y la solicitud
--  juntos al momento del registro, sin depender de la sesión.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_role text := coalesce(new.raw_user_meta_data->>'role', 'retail');
begin
  insert into public.profiles (id, email, name, role, status, company, tax_id, phone, city)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    v_role,
    case when v_role = 'wholesale' then 'pending' else 'active' end,
    new.raw_user_meta_data->>'company',
    new.raw_user_meta_data->>'tax_id',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'city'
  )
  on conflict (id) do nothing;

  -- Si la cuenta es mayorista, crear también su solicitud (para el panel admin).
  if v_role = 'wholesale' then
    insert into public.wholesale_requests (user_id, reference, business_data)
    values (
      new.id,
      'CR-MA-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(new.id::text, '-', ''), 1, 8)),
      jsonb_build_object(
        'company', new.raw_user_meta_data->>'company',
        'taxId',   new.raw_user_meta_data->>'tax_id',
        'phone',   new.raw_user_meta_data->>'phone',
        'city',    new.raw_user_meta_data->>'city',
        'channel', new.raw_user_meta_data->>'channel',
        'message', new.raw_user_meta_data->>'message'
      )
    )
    on conflict (reference) do nothing;
  end if;

  return new;
end;
$$;

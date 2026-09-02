-- ============================================================
--  Cronosfera · Editar precio de una subasta PROGRAMADA
--  ------------------------------------------------------------
--  Ejecutar en Supabase → SQL Editor (una sola vez).
--
--  Permite al admin cambiar el precio inicial y la reserva SOLO
--  mientras la subasta no ha arrancado y no tiene pujas. La
--  validación es de servidor: bloquea la fila y revisa estado +
--  conteo de pujas en el momento de guardar, así no hay carrera
--  si la subasta arranca mientras el admin tiene el form abierto.
-- ============================================================

create or replace function public.update_scheduled_auction_pricing(
  p_auction_id   uuid,
  p_start_price  bigint,
  p_reserve_price bigint
)
returns public.auctions
language plpgsql
security definer set search_path = public
as $$
declare
  a      public.auctions;
  v_bids int;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede editar subastas';
  end if;

  if p_start_price is null or p_start_price < 1000 then
    raise exception 'El precio inicial debe ser al menos 1.000';
  end if;
  if p_reserve_price is null or p_reserve_price < 0 then
    raise exception 'El precio de reserva no es válido';
  end if;

  -- Bloquea la fila: si la subasta arranca o entra una puja en este instante,
  -- se resuelve en orden y la validación de abajo ve el estado real.
  select * into a from public.auctions where id = p_auction_id for update;
  if a is null then
    raise exception 'Subasta no encontrada';
  end if;

  -- Debe seguir PROGRAMADA (aún no empieza) y no estar cerrada.
  if a.status = 'closed' or a.closed_at is not null or now() >= a.ends_at then
    raise exception 'No se puede editar: la subasta ya cerró';
  end if;
  if now() >= a.starts_at then
    raise exception 'No se puede editar el precio: la subasta ya está en curso';
  end if;

  -- Y no debe tener ninguna puja.
  select count(*) into v_bids from public.bids where auction_id = p_auction_id;
  if v_bids > 0 then
    raise exception 'No se puede editar el precio: la subasta ya tiene pujas';
  end if;

  update public.auctions
     set start_price   = p_start_price,
         current_bid   = p_start_price,   -- sin pujas, la puja actual sigue al inicial
         reserve_price = p_reserve_price
   where id = p_auction_id
   returning * into a;

  return a;
end;
$$;

revoke all on function public.update_scheduled_auction_pricing(uuid, bigint, bigint) from public;
grant execute on function public.update_scheduled_auction_pricing(uuid, bigint, bigint) to authenticated;

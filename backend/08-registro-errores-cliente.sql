-- ============================================================
--  Cronosfera · Registro de errores de cliente
--  ------------------------------------------------------------
--  Ejecutar en Supabase → SQL Editor (una sola vez).
--
--  Guarda los errores de JavaScript que ocurren en el navegador de
--  los visitantes (window.onerror y promesas rechazadas), junto con
--  el navegador, la URL y el mensaje. Sin esto no hay forma de saber
--  a QUIÉN le falla el sitio ni POR QUÉ: solo llegan reportes de
--  "se ve negro" sin dato técnico.
-- ============================================================

create table if not exists public.client_errors (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  kind        text,          -- 'error' | 'unhandledrejection' | 'resource' | 'manual'
  message     text,
  source      text,          -- archivo donde ocurrió
  lineno      integer,
  colno       integer,
  stack       text,
  url         text,          -- página que estaba viendo
  user_agent  text,
  screen_size text
);

create index if not exists client_errors_created_idx
  on public.client_errors (created_at desc);

alter table public.client_errors enable row level security;

-- Cualquier visitante puede REPORTAR un error (es telemetría del propio sitio;
-- no expone datos, solo los deja). No se permite leer, editar ni borrar.
drop policy if exists client_errors_insert on public.client_errors;
create policy client_errors_insert on public.client_errors
  for insert with check (true);

-- Solo el administrador puede leerlos.
drop policy if exists client_errors_admin_read on public.client_errors;
create policy client_errors_admin_read on public.client_errors
  for select using (public.is_admin());

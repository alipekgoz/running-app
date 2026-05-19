create extension if not exists pgcrypto;

create table if not exists public.territories (
  id uuid primary key default gen_random_uuid(),
  device_id text null,
  user_id uuid null,
  coordinates jsonb not null,
  area_m2 double precision not null,
  area_hectare double precision not null,
  source_route_point_count integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_status text not null default 'synced'
);

comment on table public.territories is 'Current ownership is device_id-based. Future migrations may add owner_user_id while preserving device_id fallback for anonymous players.';

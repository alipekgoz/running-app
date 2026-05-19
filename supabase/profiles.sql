create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  device_id text null,
  username text unique null,
  display_name text null,
  avatar_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_user_id_idx on public.profiles (user_id);
create index if not exists profiles_device_id_idx on public.profiles (device_id);

comment on table public.profiles is 'Player profiles supporting both anonymous device identities and authenticated Supabase users.';
comment on column public.profiles.device_id is 'Anonymous identity anchor. Keep for backward compatibility with device-based ownership.';
comment on column public.profiles.user_id is 'Authenticated user link. Nullable during anonymous play and before account linking.';

-- RLS foundation notes:
-- 1. Enable RLS before production rollout.
-- 2. Allow authenticated users to read/update only their own row via auth.uid() = user_id.
-- 3. If anonymous remote profile sync is kept, add a constrained service-role flow or a secure RPC instead of broad public writes.
-- 4. Future territory ownership migration can reference owner_user_id while preserving owner_device_id fallback.

alter table public.territories
add column if not exists user_id uuid null;

-- M18 spatial backend foundation
-- This file is documentation and migration preparation only.
-- Do not apply automatically from the app runtime.

-- Future step 1:
-- create extension if not exists postgis;

-- Future step 2:
-- alter table public.territories
--   add column if not exists geom geometry(Polygon, 4326);

-- Future step 3:
-- Backfill `geom` from existing JSON coordinates payload.
-- This requires a safe conversion path from the current coordinates array shape.

-- Future step 4:
-- create index if not exists territories_geom_gist_idx
--   on public.territories
--   using gist (geom);

-- Future step 5:
-- create or replace function public.fetch_territories_for_viewport(
--   min_lon double precision,
--   min_lat double precision,
--   max_lon double precision,
--   max_lat double precision
-- )
-- returns setof public.territories
-- language sql
-- as $$
--   select *
--   from public.territories
--   where geom && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326);
-- $$;

-- TODO:
-- - Decide whether `coordinates` stays as source-of-truth or becomes a compatibility payload.
-- - Add a trigger or write-path sync so `coordinates` and `geom` remain consistent during migration.
-- - Evaluate spatial conflict/capture queries once PostGIS is available.

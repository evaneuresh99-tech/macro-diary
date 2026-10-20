-- Macro Diary — Supabase schema
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- Every table is private to the signed-in user (row-level security).

-- Products: your personal library. All nutrition values are PER 100 g.
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  barcode     text,
  name        text not null,
  brand       text,
  kcal        numeric not null default 0,
  protein     numeric not null default 0,
  carbs       numeric not null default 0,
  fat         numeric not null default 0,
  fiber       numeric not null default 0,
  piece_g     numeric,               -- optional weight of one piece (egg, slice, tbsp)
  source      text not null default 'manual',  -- generic | openfoodfacts | label | manual
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, barcode)
);

-- Settings: daily targets + optional maintenance calories.
create table if not exists public.settings (
  user_id          uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  target_kcal      numeric not null default 2163,
  target_protein   numeric not null default 181,
  target_carbs     numeric not null default 190,
  target_fat       numeric not null default 81,
  target_fiber     numeric not null default 26,
  maintenance_kcal numeric
);

-- Meal plan: the default day.
create table if not exists public.plan_meals (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  slot     text not null check (slot in ('breakfast','lunch','dinner','snack')),
  name     text not null,
  sort     int not null default 0
);

create table if not exists public.plan_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  meal_id     uuid not null references public.plan_meals(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete restrict,
  grams       numeric not null,
  variable    boolean not null default false,  -- "moving variable": tick on/off each day
  default_on  boolean not null default true,
  sort        int not null default 0
);

-- Diary: what you actually ate. Macros are stored at logging time,
-- so later product edits don't rewrite your history.
create table if not exists public.log_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day         date not null,
  slot        text not null check (slot in ('breakfast','lunch','dinner','snack')),
  product_id  uuid references public.products(id) on delete set null,
  name        text not null,
  grams       numeric,
  kcal        numeric not null default 0,
  protein     numeric not null default 0,
  carbs       numeric not null default 0,
  fat         numeric not null default 0,
  fiber       numeric not null default 0,
  source      text not null default 'manual',  -- plan | manual | quick
  created_at  timestamptz not null default now()
);

-- Calories burned (workouts, cardio).
create table if not exists public.burn_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day         date not null,
  activity    text not null,
  kcal        numeric not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists log_entries_user_day on public.log_entries (user_id, day);
create index if not exists burn_entries_user_day on public.burn_entries (user_id, day);
create index if not exists plan_items_meal on public.plan_items (meal_id);

-- Row-level security: you only ever see your own rows.
do $$
declare t text;
begin
  foreach t in array array['products','settings','plan_meals','plan_items','log_entries','burn_entries'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

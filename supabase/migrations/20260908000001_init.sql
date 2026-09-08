-- ============================================================================
-- 0001: Core schema — categories, products, full-text search
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Status enum
-- ---------------------------------------------------------------------------
create type public.product_status as enum ('active', 'inactive');

-- ---------------------------------------------------------------------------
-- Categories — a closed, referenceable list.
-- This is a security control as much as a data-modeling one: the AI product
-- generation schema and the AI search filter DSL both restrict `category` to
-- values from this table, so neither the model nor an attacker can smuggle
-- an arbitrary string into a column that downstream code treats as an enum.
-- `synonyms` powers the heuristic (non-AI) search fallback's keyword map.
-- ---------------------------------------------------------------------------
create table public.categories (
  slug text primary key check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (char_length(name) between 2 and 60),
  synonyms text[] not null default '{}'
);

comment on table public.categories is
  'Closed category list. Referenced by products.category (FK) and by the AI '
  'generation/search schemas as an enum, so the model can never invent one.';

insert into public.categories (slug, name, synonyms) values
  ('dining',        'Dining',            array['buffet','dinner','lunch','breakfast','restaurant','meal','food']),
  ('excursion',     'Excursion',         array['tour','trip','day-trip','sightseeing','walking tour']),
  ('safari',        'Wildlife Safari',   array['safari','wildlife','national park','leopard','elephant']),
  ('accommodation', 'Accommodation',     array['hotel','stay','room','suite','resort','villa']),
  ('transport',     'Transport',         array['transfer','airport','pickup','drop-off','taxi','shuttle','chauffeur']),
  ('family',        'Family Package',    array['family','kids','children','package']),
  ('wellness',      'Wellness & Spa',    array['spa','wellness','ayurveda','massage','yoga']),
  ('cultural',      'Cultural',          array['cultural','heritage','temple','historical','festival']),
  ('adventure',     'Adventure',         array['adventure','hiking','trekking','rafting','diving','surfing']),
  ('shopping',      'Shopping',          array['shopping','market','souvenir']);

-- ---------------------------------------------------------------------------
-- Products — the base table. Holds everything, including expired rows: a
-- user must still be able to open, count, and correct an expired product.
-- Visibility (hiding expired rows from listing/search) is enforced by the
-- `products_listable` view added in 0003_views.sql, NOT here — see that
-- migration for the rationale.
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),

  name text not null check (char_length(name) between 2 and 200),
  destination text not null check (char_length(destination) between 2 and 120),
  category text not null references public.categories (slug),
  description text not null check (char_length(description) between 10 and 4000),

  price numeric(12, 2) not null check (price >= 0 and price < 100000000),
  currency char(3) not null default 'LKR' check (currency = 'LKR'),
  inventory_count integer not null check (inventory_count >= 0),

  valid_from date not null,
  valid_until date not null,
  status public.product_status not null default 'active',

  highlights text[] not null default '{}',
  inclusions text[] not null default '{}',
  tags text[] not null default '{}',

  image_url text,

  created_by uuid not null references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint valid_window check (valid_until >= valid_from),
  constraint valid_from_reasonable check (valid_from >= date '2000-01-01'),
  constraint valid_until_reasonable check (valid_until <= valid_from + interval '5 years'),
  constraint highlights_bounded check (array_length(highlights, 1) is null or array_length(highlights, 1) <= 20),
  constraint inclusions_bounded check (array_length(inclusions, 1) is null or array_length(inclusions, 1) <= 20),
  constraint tags_bounded check (array_length(tags, 1) is null or array_length(tags, 1) <= 20),
  constraint image_url_https check (image_url is null or image_url ~ '^https://')
);

comment on table public.products is
  'Base table. Includes expired rows on purpose — see products_listable (0003) '
  'for the validity-filtered read path used by listing, AI search, and export.';
comment on column public.products.created_by is
  'Ownership for RLS + API-layer authorization checks. Never settable by the '
  'client — always derived server-side from the authenticated JWT subject.';

-- ---------------------------------------------------------------------------
-- Full-text search column.
-- This is the AI-search design decision: the LLM normalizes a natural-
-- language query into structured fields (category, destination, price
-- range) *plus* leftover free-text keywords; those keywords are matched here
-- via websearch_to_tsquery, which never throws on malformed input and is
-- injection-safe by construction (unlike interpolating into ilike/or()).
-- See packages/validation/src/ai.schema.ts and apps/api/src/ai/search for
-- the rest of the design. Deliberately no pgvector — see the README for the
-- considered-and-rejected rationale.
--
-- `to_tsvector('english', text)` is STABLE, not IMMUTABLE (the config name
-- is resolved via a catalog lookup), so a generated column can't call it
-- directly. `array_to_string(text[], text)` is *also* STABLE in this
-- Postgres version, for the same reason. The standard fix for both: wrap
-- each call chain in a trivial SQL function declared IMMUTABLE — Postgres
-- trusts the declared volatility of a function and does not recurse into
-- its body, so wrapping is sufficient. Safe here because this app never
-- changes its search configuration at runtime.
-- ---------------------------------------------------------------------------
create or replace function public.immutable_to_tsvector(txt text)
returns tsvector
language sql
immutable
parallel safe
set search_path = ''
as $$
  select to_tsvector('pg_catalog.english', coalesce(txt, ''));
$$;

create or replace function public.immutable_tags_to_tsvector(tags text[])
returns tsvector
language sql
immutable
parallel safe
set search_path = ''
as $$
  select to_tsvector('pg_catalog.english', coalesce(array_to_string(tags, ' '), ''));
$$;

alter table public.products
  add column search_tsv tsvector generated always as (
    setweight(public.immutable_to_tsvector(name), 'A') ||
    setweight(public.immutable_to_tsvector(destination), 'A') ||
    setweight(public.immutable_tags_to_tsvector(tags), 'B') ||
    setweight(public.immutable_to_tsvector(description), 'C')
  ) stored;

create index products_search_tsv_idx on public.products using gin (search_tsv);
create index products_valid_until_idx on public.products (valid_until);
create index products_status_idx on public.products (status);
create index products_destination_idx on public.products (destination);
create index products_category_idx on public.products (category);
create index products_created_by_idx on public.products (created_by);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger products_set_updated_at
  before update on public.products
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- AI usage ledger — cost-control backstop (see apps/api/src/ai/).
-- Throttler rate limits handle bursts; this catches a slow-drip cost attack
-- (many calls spread out enough to stay under any per-minute bucket).
-- ---------------------------------------------------------------------------
create table public.ai_usage (
  user_id uuid not null references auth.users (id),
  day date not null default (now() at time zone 'Asia/Colombo')::date,
  calls integer not null default 0,
  estimated_tokens bigint not null default 0,
  primary key (user_id, day)
);

comment on table public.ai_usage is
  'Per-user daily AI call counter. Enforces AI_DAILY_QUOTA independently of '
  'the per-minute throttler buckets, which alone do not stop a slow-drip '
  'cost attack spread across many minutes.';

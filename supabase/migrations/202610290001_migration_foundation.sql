-- Pre-cutover foundation. No browser access until identity and policies are tested.
begin;
create schema if not exists migration_private;
revoke all on schema migration_private from public, anon, authenticated;
create table migration_private.runs (
 id text primary key, source_project text not null, source_database text not null,
 exported_at timestamptz not null, imported_at timestamptz not null default now(),
 document_count bigint not null check(document_count >= 0), sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$')
);
create table migration_private.documents (
 run_id text not null references migration_private.runs(id),
 path text not null, data jsonb not null check(jsonb_typeof(data) = 'object'),
 primary key(run_id, path)
);
-- Auth users are linked later by a trusted migration, never by client-supplied email.
create table public.profiles (
 id uuid primary key, firebase_uid text unique, full_name text not null,
 auth_user_id uuid unique references auth.users(id), created_at timestamptz not null default now()
);
create table public.stores (
 id text primary key, name text not null, status text not null check(status in ('open','closed','busy')),
 logo_url text, banner_url text, address text, latitude numeric, longitude numeric,
 check(latitude between -90 and 90), check(longitude between -180 and 180),
 check((latitude is null) = (longitude is null))
);
create table public.store_memberships (
 store_id text not null references public.stores(id), profile_id uuid not null references public.profiles(id),
 duty text not null check(duty in ('manager','kitchen')), primary key(store_id, profile_id)
);
create table public.categories (
 id text primary key, parent_id text references public.categories(id), name_ar text not null,
 active boolean not null default true, check(parent_id is distinct from id)
);
create index categories_parent_idx on public.categories(parent_id);
create table public.catalog_products (
 id text primary key, category_id text not null references public.categories(id),
 name_ar text not null, description_ar text not null default '', brand_name text,
 active boolean not null default true
);
create index catalog_products_category_idx on public.catalog_products(category_id, id);
create table public.catalog_variants (
 id text primary key, product_id text not null references public.catalog_products(id),
 sku text not null unique, barcode text unique check(barcode is null or length(trim(barcode)) > 0),
 name_ar text not null, measure_value numeric check(measure_value > 0),
 measure_unit text check(measure_unit in ('g','kg','ml','l','piece')),
 pack_count integer not null default 1 check(pack_count > 0),
 attributes jsonb not null default '{}' check(jsonb_typeof(attributes) = 'object'),
 active boolean not null default true, check((measure_value is null) = (measure_unit is null))
);
create index catalog_variants_product_idx on public.catalog_variants(product_id, id);
create table public.merchant_offers (
 id text primary key, store_id text not null references public.stores(id),
 variant_id text not null references public.catalog_variants(id), merchant_sku text,
 currency text not null default 'EGP' check(currency = 'EGP'),
 price_minor bigint not null check(price_minor >= 0),
 original_price_minor bigint check(original_price_minor >= price_minor),
 available boolean not null default false, archived boolean not null default false,
 image_override_url text, unique(store_id, variant_id), unique(store_id, merchant_sku)
);
create index merchant_offers_store_idx on public.merchant_offers(store_id, archived, available, id);
create index merchant_offers_variant_idx on public.merchant_offers(variant_id);
create table public.catalog_images (
 id text primary key, product_id text not null references public.catalog_products(id),
 variant_id text, url text not null, content_sha256 text, sort_order integer not null default 0,
 unique(product_id, url)
);
-- A composite FK also prevents attaching an image to another product's variant.
alter table public.catalog_variants add constraint variants_product_identity unique(product_id, id);
alter table public.catalog_images add constraint images_variant_product_fk
 foreign key(product_id, variant_id) references public.catalog_variants(product_id, id);
create table public.modifier_groups (
 id text primary key, product_id text not null references public.catalog_products(id),
 name_ar text not null, min_selections integer not null default 0 check(min_selections >= 0),
 max_selections integer not null check(max_selections >= min_selections)
);
create index modifier_groups_product_idx on public.modifier_groups(product_id);
create table public.modifier_choices (
 id text primary key, group_id text not null references public.modifier_groups(id),
 name_ar text not null, extra_price_minor bigint not null check(extra_price_minor >= 0),
 active boolean not null default true
);
create index modifier_choices_group_idx on public.modifier_choices(group_id);
-- Orders, financial records and operational projections remain in private staging
-- until their dedicated schema and reconciliation are implemented. Do not cut over yet.
do $$
declare relation text;
begin
 foreach relation in array array['profiles','stores','store_memberships','categories','catalog_products',
 'catalog_variants','merchant_offers','catalog_images','modifier_groups','modifier_choices'] loop
 execute format('alter table public.%I enable row level security', relation);
 execute format('revoke all on public.%I from public, anon, authenticated', relation);
 end loop;
end $$;
revoke all on all tables in schema migration_private from public, anon, authenticated;
commit;

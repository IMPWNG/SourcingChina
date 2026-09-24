-- SourcingChina schema for Supabase Postgres.
-- Notes stay on companies but authenticated roles cannot select that column.
-- Admins read and write notes through public.company_notes / public.set_company_notes.

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'subscriber' check (role in ('subscriber', 'admin')),
  airwallex_customer_id text,
  subscription_status text not null default 'none' check (subscription_status in ('none', 'active', 'past_due', 'canceled')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null default 'airwallex',
  provider_payment_intent_id text,
  provider_customer_id text,
  status text not null check (status in ('active', 'past_due', 'canceled')),
  amount numeric(12, 2) not null,
  currency text not null,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index subscriptions_intent_uidx
  on public.subscriptions (provider_payment_intent_id)
  where provider_payment_intent_id is not null;

create table public.billing_events (
  id text primary key,
  name text not null,
  granted boolean not null default false,
  reason text,
  received_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name_zh text,
  name_en text,
  brand text,
  company_type text not null default 'unknown' check (company_type in ('factory', 'trading', 'mixed', 'unknown')),
  address text,
  city text,
  province text,
  country text not null default 'CN',
  website text,
  wechat text,
  phone text,
  email text,
  export_markets jsonb not null default '[]'::jsonb,
  notes text,
  is_published boolean not null default false,
  merged_into_id uuid references public.companies (id),
  last_scrape_status text not null default 'never' check (last_scrape_status in ('never', 'succeeded', 'failed', 'skipped')),
  last_scraped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null,
  name_zh text
);

create table public.company_categories (
  company_id uuid not null references public.companies (id) on delete cascade,
  category_id uuid not null references public.product_categories (id) on delete cascade,
  primary key (company_id, category_id)
);

create table public.product_families (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  category_id uuid references public.product_categories (id),
  name text not null,
  description text
);

create table public.factories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  address text,
  city text
);

create table public.certifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  code text not null
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  title text,
  phone text,
  email text,
  is_public boolean not null default false
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete cascade,
  source_type text not null check (source_type in ('card', 'website', 'pdf')),
  url_or_ref text,
  raw_text text,
  payload jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now()
);

create table public.scrape_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  status text not null check (status in ('proposed', 'applied', 'failed', 'skipped')),
  proposed_patch jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index companies_published_idx on public.companies (is_published);
create index companies_city_idx on public.companies (city);
create index sources_company_idx on public.sources (company_id);

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
for each row execute function private.touch_updated_at();
create trigger companies_touch before update on public.companies
for each row execute function private.touch_updated_at();
create trigger subscriptions_touch before update on public.subscriptions
for each row execute function private.touch_updated_at();
create trigger scrape_jobs_touch before update on public.scrape_jobs
for each row execute function private.touch_updated_at();

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function private.has_directory_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and (
        role = 'admin'
        or (
          subscription_status = 'active'
          and current_period_end is not null
          and current_period_end > now()
        )
      )
  );
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, role, subscription_status)
  values (new.id, coalesce(new.email, ''), 'subscriber', 'none');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.company_notes(target uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin'
    )
    then (select c.notes from public.companies c where c.id = target)
    else null
  end;
$$;

create or replace function public.company_notes(company uuid)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select private.company_notes(company);
$$;

create or replace function private.set_company_notes(target uuid, body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  ) then
    raise exception 'not allowed';
  end if;
  update public.companies set notes = body, updated_at = now() where id = target;
end;
$$;

create or replace function public.set_company_notes(company uuid, body text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.set_company_notes(company, body);
end;
$$;

revoke all on function private.is_admin() from public;
revoke all on function private.has_directory_access() from public;
revoke all on function private.company_notes(uuid) from public;
revoke all on function private.set_company_notes(uuid, text) from public;
grant execute on function private.is_admin() to authenticated, service_role;
grant execute on function private.has_directory_access() to authenticated, service_role;
grant execute on function private.company_notes(uuid) to authenticated, service_role;
grant execute on function private.set_company_notes(uuid, text) to authenticated, service_role;
grant execute on function public.company_notes(uuid) to authenticated;
grant execute on function public.set_company_notes(uuid, text) to authenticated;

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.billing_events enable row level security;
alter table public.companies enable row level security;
alter table public.product_categories enable row level security;
alter table public.company_categories enable row level security;
alter table public.product_families enable row level security;
alter table public.factories enable row level security;
alter table public.certifications enable row level security;
alter table public.contacts enable row level security;
alter table public.sources enable row level security;
alter table public.scrape_jobs enable row level security;

create policy profiles_select on public.profiles
for select to authenticated
using (id = (select auth.uid()) or (select private.is_admin()));

create policy subscriptions_select on public.subscriptions
for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy categories_read on public.product_categories
for select to anon, authenticated
using (true);

create policy categories_admin on public.product_categories
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy companies_select on public.companies
for select to authenticated
using (
  (select private.is_admin())
  or (
    is_published
    and merged_into_id is null
    and (select private.has_directory_access())
  )
);

create policy companies_admin_write on public.companies
for insert to authenticated
with check ((select private.is_admin()));

create policy companies_admin_update on public.companies
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy companies_admin_delete on public.companies
for delete to authenticated
using ((select private.is_admin()));

create policy company_categories_select on public.company_categories
for select to authenticated
using (
  (select private.is_admin())
  or (
    (select private.has_directory_access())
    and exists (
      select 1 from public.companies c
      where c.id = company_id and c.is_published and c.merged_into_id is null
    )
  )
);

create policy company_categories_admin on public.company_categories
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy families_select on public.product_families
for select to authenticated
using (
  (select private.is_admin())
  or (
    (select private.has_directory_access())
    and exists (
      select 1 from public.companies c
      where c.id = company_id and c.is_published and c.merged_into_id is null
    )
  )
);

create policy families_admin on public.product_families
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy factories_select on public.factories
for select to authenticated
using (
  (select private.is_admin())
  or (
    (select private.has_directory_access())
    and exists (
      select 1 from public.companies c
      where c.id = company_id and c.is_published and c.merged_into_id is null
    )
  )
);

create policy factories_admin on public.factories
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy certs_select on public.certifications
for select to authenticated
using (
  (select private.is_admin())
  or (
    (select private.has_directory_access())
    and exists (
      select 1 from public.companies c
      where c.id = company_id and c.is_published and c.merged_into_id is null
    )
  )
);

create policy certs_admin on public.certifications
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy contacts_select on public.contacts
for select to authenticated
using (
  (select private.is_admin())
  or (
    is_public
    and (select private.has_directory_access())
    and exists (
      select 1 from public.companies c
      where c.id = company_id and c.is_published and c.merged_into_id is null
    )
  )
);

create policy contacts_admin on public.contacts
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy sources_admin on public.sources
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy jobs_admin on public.scrape_jobs
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.product_categories to anon;
revoke all on public.billing_events from anon, authenticated;
revoke select (notes) on public.companies from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'card-images',
  'card-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

create policy card_images_admin_select on storage.objects
for select to authenticated
using (bucket_id = 'card-images' and (select private.is_admin()));

create policy card_images_admin_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'card-images' and (select private.is_admin()));

create policy card_images_admin_update on storage.objects
for update to authenticated
using (bucket_id = 'card-images' and (select private.is_admin()))
with check (bucket_id = 'card-images' and (select private.is_admin()));

create policy card_images_admin_delete on storage.objects
for delete to authenticated
using (bucket_id = 'card-images' and (select private.is_admin()));

insert into public.product_categories (id, slug, name_en, name_zh) values
  ('a0000001-0000-4000-8000-000000000001', 'helmets', 'Helmets', '头盔'),
  ('a0000001-0000-4000-8000-000000000002', 'engine-parts', 'Engine parts', '发动机配件'),
  ('a0000001-0000-4000-8000-000000000003', 'batteries', 'Batteries', '电池'),
  ('a0000001-0000-4000-8000-000000000004', 'lighting', 'Lighting', '灯具'),
  ('a0000001-0000-4000-8000-000000000005', 'electrical', 'Electrical', '电气'),
  ('a0000001-0000-4000-8000-000000000006', 'accessories', 'Accessories', '配件'),
  ('a0000001-0000-4000-8000-000000000007', 'apparel', 'Apparel', '骑行服饰'),
  ('a0000001-0000-4000-8000-000000000008', 'tires-wheels', 'Tires and wheels', '轮胎轮毂'),
  ('a0000001-0000-4000-8000-000000000009', 'exhaust', 'Exhaust', '排气'),
  ('a0000001-0000-4000-8000-000000000010', 'full-vehicles', 'Full vehicles', '整车'),
  ('a0000001-0000-4000-8000-000000000011', 'other', 'Other', '其他');

insert into public.companies (
  id, name_zh, name_en, brand, company_type, address, city, province, country,
  website, wechat, phone, email, export_markets, notes, is_published
) values
  (
    'c0000001-0000-4000-8000-000000000001',
    '庆岭顶点头盔有限公司',
    'Qingling Apex Helmets Co., Ltd.',
    'ApexRide',
    'factory',
    'No. 18 Fengqi Road, Shapingba, Chongqing, China',
    'Chongqing',
    'Chongqing',
    'CN',
    'https://apexride.example',
    'ApexRideHelmets',
    '+86 23 6500 2210',
    'sales@apexride.example',
    '["EU","US"]'::jsonb,
    'Sample record. Fictional supplier for an empty directory.',
    true
  ),
  (
    'c0000001-0000-4000-8000-000000000006',
    '两江骑行服饰',
    'Liangjiang Riding Apparel',
    'Liangjiang',
    'factory',
    null,
    'Chongqing',
    'Chongqing',
    'CN',
    'fixture://sample-supplier',
    null,
    null,
    null,
    '[]'::jsonb,
    'Sample enrichment target. Website is a local fixture.',
    true
  ),
  (
    'c0000001-0000-4000-8000-000000000009',
    '沙坪坝未审卡片',
    'Shapingba Unreviewed Card',
    null,
    'unknown',
    'Shapingba, Chongqing',
    'Chongqing',
    'Chongqing',
    'CN',
    null,
    null,
    '+86 23 6000 0009',
    null,
    '[]'::jsonb,
    'Unpublished draft. Hidden from subscribers.',
    false
  );

insert into public.company_categories (company_id, category_id) values
  ('c0000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000001'),
  ('c0000001-0000-4000-8000-000000000006', 'a0000001-0000-4000-8000-000000000007'),
  ('c0000001-0000-4000-8000-000000000009', 'a0000001-0000-4000-8000-000000000011');

insert into public.product_families (company_id, category_id, name, description) values
  (
    'c0000001-0000-4000-8000-000000000001',
    'a0000001-0000-4000-8000-000000000001',
    'Full-face helmets',
    'Street and sport full-face shells.'
  );

insert into public.certifications (company_id, code) values
  ('c0000001-0000-4000-8000-000000000001', 'CCC');

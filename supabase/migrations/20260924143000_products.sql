-- Product rows collected from a supplier website. Visible to subscribers only
-- after the company is published, matching the other company-owned tables.

create table public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  category_id uuid references public.product_categories (id),
  name text not null,
  description text,
  image_url text,
  source_url text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index products_company_idx on public.products (company_id);

alter table public.products enable row level security;

create policy products_select on public.products
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

create policy products_admin on public.products
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

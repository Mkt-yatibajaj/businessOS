-- Advaitum Business OS: initial relational schema.
-- Run through Supabase SQL Editor or `supabase db push` after reviewing.
create extension if not exists pgcrypto;

create type public.app_role as enum ('owner','admin','operator','viewer');
create type public.stock_movement_type as enum ('purchase','sale','sale_return','purchase_return','adjustment_in','adjustment_out','damage');
create type public.sale_status as enum ('completed','cancelled','partially_returned','returned');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.app_role not null default 'owner',
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  category_id uuid references public.categories(id) on delete set null,
  description text,
  unit text not null default 'piece',
  selling_price numeric(12,2) not null default 0 check (selling_price >= 0),
  reorder_level numeric(12,3) not null default 5 check (reorder_level >= 0),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  purchase_number text not null unique,
  supplier_id uuid references public.suppliers(id) on delete set null,
  purchase_date date not null,
  supplier_invoice text,
  status text not null default 'received' check (status in ('draft','received','cancelled')),
  notes text,
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  additional_cost numeric(14,2) not null default 0 check (additional_cost >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.purchase_lots (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchase_orders(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity_received numeric(12,3) not null check (quantity_received > 0),
  quantity_remaining numeric(12,3) not null check (quantity_remaining >= 0),
  unit_purchase_cost numeric(12,4) not null check (unit_purchase_cost >= 0),
  allocated_landed_cost numeric(14,2) not null default 0 check (allocated_landed_cost >= 0),
  unit_landed_cost numeric(12,4) generated always as (unit_purchase_cost + case when quantity_received > 0 then allocated_landed_cost / quantity_received else 0 end) stored,
  created_at timestamptz not null default now(),
  check (quantity_remaining <= quantity_received)
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  sale_number text not null unique,
  sold_at timestamptz not null default now(),
  channel text not null check (length(trim(channel)) > 0),
  location text,
  external_order_reference text,
  payment_method text,
  status public.sale_status not null default 'completed',
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  shipping_charged numeric(14,2) not null default 0 check (shipping_charged >= 0),
  selling_fees numeric(14,2) not null default 0 check (selling_fees >= 0),
  shipping_cost numeric(14,2) not null default 0 check (shipping_cost >= 0),
  other_cost numeric(14,2) not null default 0 check (other_cost >= 0),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity numeric(12,3) not null check (quantity > 0),
  unit_selling_price numeric(12,2) not null check (unit_selling_price >= 0),
  unit_cost_at_sale numeric(12,4) not null check (unit_cost_at_sale >= 0),
  line_discount numeric(12,2) not null default 0 check (line_discount >= 0),
  created_at timestamptz not null default now()
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  movement_type public.stock_movement_type not null,
  quantity_delta numeric(12,3) not null check (quantity_delta <> 0),
  unit_cost numeric(12,4) not null default 0 check (unit_cost >= 0),
  purchase_lot_id uuid references public.purchase_lots(id) on delete restrict,
  sale_item_id uuid references public.sale_items(id) on delete restrict,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index products_name_idx on public.products using gin (to_tsvector('simple', name));
create index purchase_lots_product_idx on public.purchase_lots(product_id, created_at);
create index sales_sold_at_idx on public.sales(sold_at desc);
create index sales_channel_idx on public.sales(channel);
create index sale_items_product_idx on public.sale_items(product_id);
create index stock_movements_product_date_idx on public.stock_movements(product_id, created_at desc);

-- Safe default: all business tables are private until explicit policies are added.
-- Do not expose tables to anon/authenticated without reviewed RLS policies.
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_lots enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.audit_log enable row level security;

-- Intentionally no client-facing policies yet. Add owner/admin/team policies
-- after the initial owner account and authorization strategy are defined.

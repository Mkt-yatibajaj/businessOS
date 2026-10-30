-- Advaitum Business OS core schema. Apply to a NEW Supabase project.
create extension if not exists pgcrypto;
do $$ begin create type public.app_role as enum ('owner','admin','operator','viewer'); exception when duplicate_object then null; end $$;
create table if not exists public.profiles(id uuid primary key references auth.users(id) on delete cascade, full_name text not null default '', role public.app_role not null default 'viewer', created_at timestamptz not null default now());
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.profiles(id,full_name,role) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),'viewer') on conflict(id) do nothing; return new; end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
create table if not exists public.categories(id uuid primary key default gen_random_uuid(),name text not null unique,active boolean not null default true,created_at timestamptz not null default now());
create table if not exists public.suppliers(id uuid primary key default gen_random_uuid(),name text not null,phone text,email text,notes text,active boolean not null default true,created_at timestamptz not null default now());
create table if not exists public.products(id uuid primary key default gen_random_uuid(),sku text not null unique,name text not null,category_id uuid references public.categories(id),unit text not null default 'piece',selling_price numeric(14,2) not null default 0 check(selling_price>=0),reorder_level numeric(14,3) not null default 0 check(reorder_level>=0),active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.purchase_orders(id uuid primary key default gen_random_uuid(),purchase_number text not null unique,supplier_id uuid references public.suppliers(id),purchase_date date not null default current_date,supplier_invoice text,status text not null default 'received' check(status in('received','cancelled')),subtotal numeric(14,2) not null,additional_cost numeric(14,2) not null default 0,notes text,created_by uuid references auth.users(id),created_at timestamptz not null default now());
create table if not exists public.purchase_lots(id uuid primary key default gen_random_uuid(),purchase_id uuid not null references public.purchase_orders(id),product_id uuid not null references public.products(id),quantity_received numeric(14,3) not null check(quantity_received>0),quantity_remaining numeric(14,3) not null check(quantity_remaining>=0 and quantity_remaining<=quantity_received),unit_purchase_cost numeric(14,4) not null check(unit_purchase_cost>=0),allocated_landed_cost numeric(14,2) not null default 0,created_at timestamptz not null default now());
create table if not exists public.sales(id uuid primary key default gen_random_uuid(),sale_number text not null unique,sold_at timestamptz not null default now(),channel text not null,location text,external_order_reference text,payment_method text,discount_amount numeric(14,2) not null default 0,selling_fees numeric(14,2) not null default 0,shipping_cost numeric(14,2) not null default 0,notes text,created_by uuid references auth.users(id),created_at timestamptz not null default now());
create table if not exists public.sale_items(id uuid primary key default gen_random_uuid(),sale_id uuid not null references public.sales(id),product_id uuid not null references public.products(id),quantity numeric(14,3) not null check(quantity>0),unit_selling_price numeric(14,2) not null,unit_cost_at_sale numeric(14,4) not null,line_revenue numeric(14,2) not null,line_cogs numeric(14,2) not null,created_at timestamptz not null default now());
create table if not exists public.stock_movements(id uuid primary key default gen_random_uuid(),product_id uuid not null references public.products(id),movement_type text not null check(movement_type in('purchase','sale','adjustment_in','adjustment_out','damage','return')),quantity_delta numeric(14,3) not null check(quantity_delta<>0),unit_cost numeric(14,4) not null default 0,purchase_lot_id uuid references public.purchase_lots(id),sale_item_id uuid references public.sale_items(id),reason text,created_by uuid references auth.users(id),created_at timestamptz not null default now());
create table if not exists public.audit_log(id bigint generated always as identity primary key,actor_id uuid references auth.users(id),action text not null,table_name text not null,record_id text,details jsonb not null default '{}',created_at timestamptz not null default now());
create index if not exists purchase_lots_fifo_idx on public.purchase_lots(product_id,created_at,id) where quantity_remaining>0;
create index if not exists sales_date_idx on public.sales(sold_at desc);
create index if not exists stock_movements_product_idx on public.stock_movements(product_id,created_at desc);
create or replace function public.current_role() returns public.app_role language sql stable security definer set search_path=public as $$ select role from public.profiles where id=auth.uid() $$;
create or replace function public.can_operate() returns boolean language sql stable security definer set search_path=public as $$ select coalesce(public.current_role() in ('owner','admin','operator'),false) $$;
-- RLS: private workspace. Viewers can read; operator/admin/owner can mutate operational tables.
do $$ declare t text; begin foreach t in array array['profiles','categories','suppliers','products','purchase_orders','purchase_lots','sales','sale_items','stock_movements','audit_log'] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;
drop policy if exists profiles_read_self on public.profiles; create policy profiles_read_self on public.profiles for select to authenticated using(id=auth.uid() or public.current_role() in ('owner','admin'));
drop policy if exists profiles_owner_update on public.profiles; create policy profiles_owner_update on public.profiles for update to authenticated using(public.current_role()='owner') with check(public.current_role()='owner');
do $$ declare t text; begin foreach t in array array['categories','suppliers','products','purchase_orders','purchase_lots','sales','sale_items','stock_movements'] loop execute format('drop policy if exists %I_read on public.%I',t,t); execute format('create policy %I_read on public.%I for select to authenticated using(public.current_role() is not null)',t,t); end loop; foreach t in array array['categories','suppliers','products'] loop execute format('drop policy if exists %I_write on public.%I',t,t); execute format('create policy %I_write on public.%I for all to authenticated using(public.can_operate()) with check(public.can_operate())',t,t); end loop; end $$;
-- Purchases, sales, lots and stock ledger are intentionally read-only to clients. Only atomic SECURITY DEFINER RPCs may post movements.
drop policy if exists audit_owner_read on public.audit_log; create policy audit_owner_read on public.audit_log for select to authenticated using(public.current_role() in ('owner','admin'));
-- No direct client inserts/updates to audit_log; transactional RPCs write it.
revoke all on function public.current_role() from public, anon; grant execute on function public.current_role() to authenticated;
revoke all on function public.can_operate() from public, anon; grant execute on function public.can_operate() to authenticated;

create or replace function public.post_purchase(p_number text,p_product uuid,p_qty numeric,p_unit_cost numeric,p_extra_cost numeric default 0,p_date date default current_date,p_supplier uuid default null,p_invoice text default null,p_notes text default null) returns uuid language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_id uuid; v_lot uuid; v_sub numeric;
begin
 if v_uid is null or not public.can_operate() then raise exception 'Not authorized'; end if;
 if p_qty<=0 or p_unit_cost<0 or p_extra_cost<0 then raise exception 'Invalid purchase values'; end if;
 if not exists(select 1 from public.products where id=p_product and active) then raise exception 'Active product not found'; end if;
 v_sub:=p_qty*p_unit_cost;
 insert into public.purchase_orders(purchase_number,supplier_id,purchase_date,supplier_invoice,subtotal,additional_cost,notes,created_by) values(p_number,p_supplier,p_date,p_invoice,v_sub,p_extra_cost,p_notes,v_uid) returning id into v_id;
 insert into public.purchase_lots(purchase_id,product_id,quantity_received,quantity_remaining,unit_purchase_cost,allocated_landed_cost) values(v_id,p_product,p_qty,p_qty,p_unit_cost,p_extra_cost) returning id into v_lot;
 insert into public.stock_movements(product_id,movement_type,quantity_delta,unit_cost,purchase_lot_id,created_by) values(p_product,'purchase',p_qty,p_unit_cost+(p_extra_cost/p_qty),v_lot,v_uid);
 insert into public.audit_log(actor_id,action,table_name,record_id,details) values(v_uid,'purchase_posted','purchase_orders',v_id::text,jsonb_build_object('number',p_number,'quantity',p_qty,'landed_unit_cost',p_unit_cost+p_extra_cost/p_qty));
 return v_id;
end $$;
create or replace function public.post_sale(p_number text,p_product uuid,p_qty numeric,p_price numeric,p_channel text,p_date timestamptz default now(),p_location text default null,p_discount numeric default 0,p_fees numeric default 0,p_shipping numeric default 0,p_order_ref text default null,p_notes text default null) returns uuid language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_sale uuid; v_item uuid; v_need numeric:=p_qty; v_take numeric; v_cost numeric:=0; v_lot record; v_line_rev numeric;
begin
 if v_uid is null or not public.can_operate() then raise exception 'Not authorized'; end if;
 if p_qty<=0 or p_price<0 or p_discount<0 or p_fees<0 or p_shipping<0 or length(trim(coalesce(p_channel,'')))=0 then raise exception 'Invalid sale values'; end if;
 perform 1 from public.products where id=p_product and active for update; if not found then raise exception 'Active product not found'; end if;
 for v_lot in select id,quantity_remaining,unit_purchase_cost,allocated_landed_cost,quantity_received from public.purchase_lots where product_id=p_product and quantity_remaining>0 order by created_at,id for update loop
  exit when v_need<=0; v_take:=least(v_need,v_lot.quantity_remaining); v_cost:=v_cost+v_take*(v_lot.unit_purchase_cost+v_lot.allocated_landed_cost/v_lot.quantity_received); update public.purchase_lots set quantity_remaining=quantity_remaining-v_take where id=v_lot.id; v_need:=v_need-v_take;
 end loop;
 if v_need>0 then raise exception 'Insufficient stock. Short by % units',v_need; end if;
 v_line_rev:=p_qty*p_price-p_discount;
 insert into public.sales(sale_number,sold_at,channel,location,external_order_reference,discount_amount,selling_fees,shipping_cost,notes,created_by) values(p_number,p_date,p_channel,p_location,p_order_ref,p_discount,p_fees,p_shipping,p_notes,v_uid) returning id into v_sale;
 insert into public.sale_items(sale_id,product_id,quantity,unit_selling_price,unit_cost_at_sale,line_revenue,line_cogs) values(v_sale,p_product,p_qty,p_price,v_cost/p_qty,v_line_rev,v_cost) returning id into v_item;
 insert into public.stock_movements(product_id,movement_type,quantity_delta,unit_cost,sale_item_id,created_by) values(p_product,'sale',-p_qty,v_cost/p_qty,v_item,v_uid);
 insert into public.audit_log(actor_id,action,table_name,record_id,details) values(v_uid,'sale_posted','sales',v_sale::text,jsonb_build_object('number',p_number,'quantity',p_qty,'revenue',v_line_rev,'cogs',v_cost));
 return v_sale;
end $$;
revoke all on function public.post_purchase(text,uuid,numeric,numeric,numeric,date,uuid,text,text) from public,anon; grant execute on function public.post_purchase(text,uuid,numeric,numeric,numeric,date,uuid,text,text) to authenticated;
revoke all on function public.post_sale(text,uuid,numeric,numeric,text,timestamptz,text,numeric,numeric,numeric,text,text) from public,anon; grant execute on function public.post_sale(text,uuid,numeric,numeric,text,timestamptz,text,numeric,numeric,numeric,text,text) to authenticated;
create or replace view public.inventory_summary with (security_invoker=true) as select p.id,p.sku,p.name,p.unit,p.selling_price,p.reorder_level,coalesce(sum(l.quantity_remaining),0)::numeric(14,3) as stock,coalesce(sum(l.quantity_remaining*(l.unit_purchase_cost+l.allocated_landed_cost/l.quantity_received)),0)::numeric(14,2) as stock_value from public.products p left join public.purchase_lots l on l.product_id=p.id group by p.id;
grant select on public.inventory_summary to authenticated;

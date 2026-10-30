-- Security and atomic inventory transactions for Advaitum Business OS.
-- Review this migration and back up your project before applying to an existing database.

-- Profiles are never automatically owners. Existing profile roles are preserved.
alter table public.profiles alter column role set default 'viewer';
-- Fail closed: demote all existing profiles; the intended owner is promoted explicitly using bootstrap-admin.sql.
update public.profiles set role = 'viewer' where role <> 'viewer';
alter table public.products add column if not exists category text not null default 'Other';
alter table public.products add column if not exists updated_at timestamptz not null default now();

create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer
set search_path = ''
as $$ select p.role from public.profiles p where p.id = (select auth.uid()) limit 1 $$;
revoke all on function public.current_app_role() from public;
grant execute on function public.current_app_role() to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name',''), 'viewer')
  on conflict (id) do nothing;
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users
for each row execute function public.handle_new_user();

-- RLS: only the designated owner can read/write business data. Authenticated users can read their own profile.
drop policy if exists "profile owner or self read" on public.profiles;
create policy "profile owner or self read" on public.profiles for select to authenticated
using (id = (select auth.uid()) or public.current_app_role() = 'owner');
drop policy if exists "owner updates own profile fields" on public.profiles;
create policy "owner updates own profile fields" on public.profiles for update to authenticated
using (public.current_app_role() = 'owner') with check (public.current_app_role() = 'owner');

do $$ declare t text; begin
  foreach t in array array['categories','suppliers','products','purchase_orders','purchase_lots','sales','sale_items','stock_movements','audit_log'] loop
    execute format('drop policy if exists %I on public.%I', 'owner full access', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.current_app_role() = ''owner'') with check (public.current_app_role() = ''owner'')', 'owner full access', t);
  end loop;
end $$;

-- Record every purchase as a purchase order, a costed lot and a positive stock movement in one transaction.
create or replace function public.post_purchase(
  p_purchase_number text,
  p_product_id uuid,
  p_quantity numeric,
  p_unit_purchase_cost numeric,
  p_additional_cost numeric default 0,
  p_purchase_date date default current_date,
  p_supplier_id uuid default null,
  p_supplier_invoice text default null,
  p_notes text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_purchase_id uuid; v_lot_id uuid; v_unit_landed numeric; v_actor uuid;
begin
  v_actor := auth.uid();
  if v_actor is null or public.current_app_role() <> 'owner' then raise exception 'Owner access required'; end if;
  if p_quantity <= 0 or p_unit_purchase_cost < 0 or coalesce(p_additional_cost,0) < 0 then raise exception 'Quantity must be positive and costs cannot be negative'; end if;
  if nullif(trim(p_purchase_number),'') is null then raise exception 'Purchase number is required'; end if;
  perform 1 from public.products where id = p_product_id and active = true for update;
  if not found then raise exception 'Active product not found'; end if;
  insert into public.purchase_orders(purchase_number,supplier_id,purchase_date,supplier_invoice,status,notes,subtotal,additional_cost,created_by)
  values (trim(p_purchase_number),p_supplier_id,coalesce(p_purchase_date,current_date),p_supplier_invoice,'received',p_notes,p_quantity*p_unit_purchase_cost,coalesce(p_additional_cost,0),v_actor)
  returning id into v_purchase_id;
  insert into public.purchase_lots(purchase_id,product_id,quantity_received,quantity_remaining,unit_purchase_cost,allocated_landed_cost)
  values(v_purchase_id,p_product_id,p_quantity,p_quantity,p_unit_purchase_cost,coalesce(p_additional_cost,0)) returning id, unit_landed_cost into v_lot_id,v_unit_landed;
  insert into public.stock_movements(product_id,movement_type,quantity_delta,unit_cost,purchase_lot_id,reason,created_by)
  values(p_product_id,'purchase',p_quantity,v_unit_landed,v_lot_id,'Purchase '||trim(p_purchase_number),v_actor);
  insert into public.audit_log(actor_id,action,table_name,record_id,after_data)
  values(v_actor,'purchase.post','purchase_orders',v_purchase_id::text,jsonb_build_object('purchase_number',p_purchase_number,'product_id',p_product_id,'quantity',p_quantity,'unit_landed_cost',v_unit_landed));
  return jsonb_build_object('purchase_id',v_purchase_id,'lot_id',v_lot_id,'quantity',p_quantity,'unit_landed_cost',v_unit_landed);
end $$;
revoke all on function public.post_purchase(text,uuid,numeric,numeric,numeric,date,uuid,text,text) from public, anon;
grant execute on function public.post_purchase(text,uuid,numeric,numeric,numeric,date,uuid,text,text) to authenticated;

-- FIFO sale posting. Row locks and a single database transaction prevent partial sales/overselling.
create or replace function public.post_sale(
  p_sale_number text,
  p_product_id uuid,
  p_quantity numeric,
  p_unit_selling_price numeric,
  p_channel text,
  p_sold_at timestamptz default now(),
  p_location text default null,
  p_external_order_reference text default null,
  p_discount_amount numeric default 0,
  p_selling_fees numeric default 0,
  p_shipping_cost numeric default 0,
  p_other_cost numeric default 0,
  p_notes text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_sale_id uuid; v_item_id uuid; v_actor uuid; v_remaining numeric; v_take numeric; v_cost numeric := 0; v_unit_cost numeric; v_lot record; v_revenue numeric;
begin
  v_actor := auth.uid();
  if v_actor is null or public.current_app_role() <> 'owner' then raise exception 'Owner access required'; end if;
  if p_quantity <= 0 or p_unit_selling_price < 0 or coalesce(p_discount_amount,0) < 0 or coalesce(p_selling_fees,0) < 0 or coalesce(p_shipping_cost,0) < 0 or coalesce(p_other_cost,0) < 0 then raise exception 'Quantity must be positive and amounts cannot be negative'; end if;
  if nullif(trim(p_sale_number),'') is null or nullif(trim(p_channel),'') is null then raise exception 'Sale number and channel are required'; end if;
  perform 1 from public.products where id = p_product_id and active = true for update;
  if not found then raise exception 'Active product not found'; end if;
  select coalesce(sum(quantity_remaining),0) into v_remaining from public.purchase_lots where product_id=p_product_id;
  if v_remaining < p_quantity then raise exception 'Insufficient stock. Available: %', v_remaining; end if;
  insert into public.sales(sale_number,sold_at,channel,location,external_order_reference,status,discount_amount,selling_fees,shipping_cost,other_cost,notes,created_by)
  values(trim(p_sale_number),coalesce(p_sold_at,now()),trim(p_channel),p_location,p_external_order_reference,'completed',coalesce(p_discount_amount,0),coalesce(p_selling_fees,0),coalesce(p_shipping_cost,0),coalesce(p_other_cost,0),p_notes,v_actor)
  returning id into v_sale_id;
  v_remaining := p_quantity;
  for v_lot in select id,quantity_remaining,unit_landed_cost from public.purchase_lots where product_id=p_product_id and quantity_remaining>0 order by created_at,id for update loop
    exit when v_remaining <= 0;
    v_take := least(v_remaining,v_lot.quantity_remaining);
    update public.purchase_lots set quantity_remaining=quantity_remaining-v_take where id=v_lot.id;
    v_cost := v_cost + v_take*v_lot.unit_landed_cost;
    insert into public.stock_movements(product_id,movement_type,quantity_delta,unit_cost,purchase_lot_id,reason,created_by)
    values(p_product_id,'sale',-v_take,v_lot.unit_landed_cost,v_lot.id,'Sale '||trim(p_sale_number),v_actor);
    v_remaining := v_remaining-v_take;
  end loop;
  if v_remaining > 0 then raise exception 'Stock changed during sale; transaction cancelled'; end if;
  v_unit_cost := v_cost/p_quantity;
  insert into public.sale_items(sale_id,product_id,quantity,unit_selling_price,unit_cost_at_sale,line_discount)
  values(v_sale_id,p_product_id,p_quantity,p_unit_selling_price,v_unit_cost,coalesce(p_discount_amount,0)) returning id into v_item_id;
  update public.stock_movements set sale_item_id=v_item_id where reason='Sale '||trim(p_sale_number) and created_by=v_actor and sale_item_id is null and product_id=p_product_id and movement_type='sale' and created_at >= (select created_at from public.sales where id=v_sale_id);
  v_revenue := p_quantity*p_unit_selling_price-coalesce(p_discount_amount,0);
  insert into public.audit_log(actor_id,action,table_name,record_id,after_data)
  values(v_actor,'sale.post','sales',v_sale_id::text,jsonb_build_object('sale_number',p_sale_number,'product_id',p_product_id,'quantity',p_quantity,'revenue',v_revenue,'cogs',v_cost));
  return jsonb_build_object('sale_id',v_sale_id,'quantity',p_quantity,'revenue',v_revenue,'cogs',v_cost,'gross_profit',v_revenue-v_cost,'remaining_stock',(select coalesce(sum(quantity_remaining),0) from public.purchase_lots where product_id=p_product_id));
end $$;
revoke all on function public.post_sale(text,uuid,numeric,numeric,text,timestamptz,text,text,numeric,numeric,numeric,numeric,text) from public, anon;
grant execute on function public.post_sale(text,uuid,numeric,numeric,text,timestamptz,text,text,numeric,numeric,numeric,numeric,text) to authenticated;

-- Keep client-side direct writes closed: product/category/supplier mutations are owner-only through RLS.

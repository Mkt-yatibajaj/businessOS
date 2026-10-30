-- Advaitum Business OS - 0002 operations upgrade.
-- Run AFTER 0001_advaitum_core.sql. Safe on an empty project; if 0001 already holds real data,
-- take a backup first (legacy sales posted by 0001 have no lot allocations and cannot be cancelled).

create sequence if not exists public.sale_number_seq start 1001;
create sequence if not exists public.purchase_number_seq start 1001;

alter table public.purchase_lots alter column purchase_id drop not null;
alter table public.purchase_lots add column if not exists source text not null default 'purchase';
alter table public.purchase_orders add column if not exists cancelled_at timestamptz;
alter table public.purchase_orders add column if not exists cancel_reason text;
alter table public.sales add column if not exists status text not null default 'posted';
alter table public.sales add column if not exists cancelled_at timestamptz;
alter table public.sales add column if not exists cancel_reason text;
do $$ begin
  alter table public.sales add constraint sales_status_chk check (status in ('posted','cancelled'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.purchase_lots add constraint lots_source_chk check (source in ('purchase','adjustment'));
exception when duplicate_object then null; end $$;

create table if not exists public.sale_item_allocations(
  id uuid primary key default gen_random_uuid(),
  sale_item_id uuid not null references public.sale_items(id),
  lot_id uuid not null references public.purchase_lots(id),
  quantity numeric(14,3) not null check(quantity>0),
  unit_cost numeric(14,4) not null);
create index if not exists sale_alloc_item_idx on public.sale_item_allocations(sale_item_id);

create table if not exists public.expenses(
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  category text not null,
  amount numeric(14,2) not null check(amount>0),
  notes text,
  voided boolean not null default false,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now());
create index if not exists expenses_date_idx on public.expenses(expense_date desc);

alter table public.sale_item_allocations enable row level security;
alter table public.expenses enable row level security;
drop policy if exists alloc_read on public.sale_item_allocations;
create policy alloc_read on public.sale_item_allocations for select to authenticated using(public.current_role() is not null);
drop policy if exists expenses_read on public.expenses;
create policy expenses_read on public.expenses for select to authenticated using(public.current_role() is not null);
drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses for insert to authenticated with check(public.can_operate() and created_by=auth.uid());
drop policy if exists expenses_void on public.expenses;
create policy expenses_void on public.expenses for update to authenticated using(public.current_role() in ('owner','admin')) with check(public.current_role() in ('owner','admin'));

-- ---------- internal FIFO consumer (not callable by clients) ----------
drop function if exists public.post_purchase(text,uuid,numeric,numeric,numeric,date,uuid,text,text);
drop function if exists public.post_sale(text,uuid,numeric,numeric,text,timestamptz,text,numeric,numeric,numeric,text,text);

create or replace function public.consume_fifo(p_product uuid,p_qty numeric,p_sale_item uuid) returns numeric
language plpgsql security definer set search_path=public as $$
declare v_need numeric:=p_qty; v_take numeric; v_cost numeric:=0; v_lot record; v_unit numeric; v_sku text;
begin
  for v_lot in select id,quantity_remaining,unit_purchase_cost,allocated_landed_cost,quantity_received
               from public.purchase_lots where product_id=p_product and quantity_remaining>0
               order by created_at,id for update loop
    exit when v_need<=0;
    v_take:=least(v_need,v_lot.quantity_remaining);
    v_unit:=v_lot.unit_purchase_cost+v_lot.allocated_landed_cost/v_lot.quantity_received;
    v_cost:=v_cost+v_take*v_unit;
    update public.purchase_lots set quantity_remaining=quantity_remaining-v_take where id=v_lot.id;
    if p_sale_item is not null then
      insert into public.sale_item_allocations(sale_item_id,lot_id,quantity,unit_cost) values(p_sale_item,v_lot.id,v_take,v_unit);
    end if;
    v_need:=v_need-v_take;
  end loop;
  if v_need>0 then
    select sku into v_sku from public.products where id=p_product;
    raise exception 'Insufficient stock for %. Short by % units',v_sku,v_need;
  end if;
  return v_cost;
end $$;
revoke all on function public.consume_fifo(uuid,numeric,uuid) from public,anon,authenticated;

-- ---------- purchases (multi-line) ----------
create or replace function public.post_purchase(p_items jsonb,p_date date default current_date,p_supplier uuid default null,p_invoice text default null,p_extra_cost numeric default 0,p_notes text default null,p_number text default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_id uuid; v_num text; v_sub numeric:=0; v_qty numeric:=0; v_it record; v_lot uuid;
        v_alloc numeric; v_given numeric:=0; v_count int; v_lines int;
begin
  if v_uid is null or not public.can_operate() then raise exception 'Not authorized'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Add at least one product line'; end if;
  if coalesce(p_extra_cost,0)<0 then raise exception 'Additional cost cannot be negative'; end if;
  v_count:=jsonb_array_length(p_items);
  for v_it in select (e->>'product')::uuid product,(e->>'qty')::numeric qty,(e->>'unit_cost')::numeric unit_cost from jsonb_array_elements(p_items) e loop
    if v_it.product is null or v_it.qty is null or v_it.qty<=0 or v_it.unit_cost is null or v_it.unit_cost<0 then raise exception 'Invalid purchase line'; end if;
    if not exists(select 1 from public.products where id=v_it.product and active) then raise exception 'Active product not found'; end if;
    v_sub:=v_sub+v_it.qty*v_it.unit_cost; v_qty:=v_qty+v_it.qty;
  end loop;
  v_num:=coalesce(nullif(trim(p_number),''),'PUR-'||nextval('public.purchase_number_seq'));
  insert into public.purchase_orders(purchase_number,supplier_id,purchase_date,supplier_invoice,subtotal,additional_cost,notes,created_by)
    values(v_num,p_supplier,p_date,nullif(trim(p_invoice),''),round(v_sub,2),coalesce(p_extra_cost,0),p_notes,v_uid) returning id into v_id;
  v_lines:=0;
  for v_it in select (e->>'product')::uuid product,(e->>'qty')::numeric qty,(e->>'unit_cost')::numeric unit_cost from jsonb_array_elements(p_items) e loop
    v_lines:=v_lines+1;
    if v_lines=v_count then v_alloc:=coalesce(p_extra_cost,0)-v_given;
    elsif v_sub>0 then v_alloc:=round(coalesce(p_extra_cost,0)*(v_it.qty*v_it.unit_cost)/v_sub,2);
    else v_alloc:=round(coalesce(p_extra_cost,0)*v_it.qty/v_qty,2); end if;
    v_given:=v_given+v_alloc;
    insert into public.purchase_lots(purchase_id,product_id,quantity_received,quantity_remaining,unit_purchase_cost,allocated_landed_cost)
      values(v_id,v_it.product,v_it.qty,v_it.qty,v_it.unit_cost,v_alloc) returning id into v_lot;
    insert into public.stock_movements(product_id,movement_type,quantity_delta,unit_cost,purchase_lot_id,created_by)
      values(v_it.product,'purchase',v_it.qty,v_it.unit_cost+v_alloc/v_it.qty,v_lot,v_uid);
  end loop;
  insert into public.audit_log(actor_id,action,table_name,record_id,details)
    values(v_uid,'purchase_posted','purchase_orders',v_id::text,jsonb_build_object('number',v_num,'lines',v_count,'subtotal',v_sub,'extra',p_extra_cost));
  return v_id;
end $$;

-- ---------- sales (multi-line) ----------
create or replace function public.post_sale(p_items jsonb,p_channel text,p_date timestamptz default now(),p_location text default null,p_discount numeric default 0,p_fees numeric default 0,p_shipping numeric default 0,p_order_ref text default null,p_payment text default null,p_notes text default null,p_number text default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_sale uuid; v_item uuid; v_num text; v_it record; v_cost numeric; v_gross numeric:=0; v_count int;
begin
  if v_uid is null or not public.can_operate() then raise exception 'Not authorized'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Add at least one product line'; end if;
  if length(trim(coalesce(p_channel,'')))=0 then raise exception 'Sales channel is required'; end if;
  if coalesce(p_discount,0)<0 or coalesce(p_fees,0)<0 or coalesce(p_shipping,0)<0 then raise exception 'Invalid sale values'; end if;
  v_num:=coalesce(nullif(trim(p_number),''),'SAL-'||nextval('public.sale_number_seq'));
  insert into public.sales(sale_number,sold_at,channel,location,external_order_reference,payment_method,discount_amount,selling_fees,shipping_cost,notes,created_by)
    values(v_num,p_date,trim(p_channel),p_location,nullif(trim(p_order_ref),''),p_payment,coalesce(p_discount,0),coalesce(p_fees,0),coalesce(p_shipping,0),p_notes,v_uid) returning id into v_sale;
  v_count:=0;
  -- ordered by product to avoid lock-order deadlocks between concurrent sales
  for v_it in select (e->>'product')::uuid product,(e->>'qty')::numeric qty,(e->>'price')::numeric price from jsonb_array_elements(p_items) e order by 1 loop
    if v_it.product is null or v_it.qty is null or v_it.qty<=0 or v_it.price is null or v_it.price<0 then raise exception 'Invalid sale line'; end if;
    perform 1 from public.products where id=v_it.product and active for update;
    if not found then raise exception 'Active product not found'; end if;
    insert into public.sale_items(sale_id,product_id,quantity,unit_selling_price,unit_cost_at_sale,line_revenue,line_cogs)
      values(v_sale,v_it.product,v_it.qty,v_it.price,0,round(v_it.qty*v_it.price,2),0) returning id into v_item;
    v_cost:=public.consume_fifo(v_it.product,v_it.qty,v_item);
    update public.sale_items set unit_cost_at_sale=v_cost/v_it.qty,line_cogs=round(v_cost,2) where id=v_item;
    insert into public.stock_movements(product_id,movement_type,quantity_delta,unit_cost,sale_item_id,created_by)
      values(v_it.product,'sale',-v_it.qty,v_cost/v_it.qty,v_item,v_uid);
    v_gross:=v_gross+round(v_it.qty*v_it.price,2); v_count:=v_count+1;
  end loop;
  if coalesce(p_discount,0)>v_gross then raise exception 'Discount cannot exceed the sale total'; end if;
  insert into public.audit_log(actor_id,action,table_name,record_id,details)
    values(v_uid,'sale_posted','sales',v_sale::text,jsonb_build_object('number',v_num,'lines',v_count,'gross',v_gross,'discount',p_discount));
  return v_sale;
end $$;

-- ---------- cancellations (owner/admin only) ----------
create or replace function public.cancel_sale(p_sale uuid,p_reason text) returns void
language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_s record; v_i record; v_a record; v_alloc numeric;
begin
  if v_uid is null or public.current_role() not in ('owner','admin') then raise exception 'Only an owner or admin can cancel a sale'; end if;
  if length(trim(coalesce(p_reason,'')))=0 then raise exception 'A cancellation reason is required'; end if;
  select * into v_s from public.sales where id=p_sale for update;
  if not found then raise exception 'Sale not found'; end if;
  if v_s.status<>'posted' then raise exception 'Sale is already cancelled'; end if;
  for v_i in select * from public.sale_items where sale_id=p_sale loop
    select coalesce(sum(quantity),0) into v_alloc from public.sale_item_allocations where sale_item_id=v_i.id;
    if v_alloc<>v_i.quantity then raise exception 'This sale has no lot allocation record and cannot be cancelled automatically. Use a stock adjustment.'; end if;
    for v_a in select * from public.sale_item_allocations where sale_item_id=v_i.id loop
      update public.purchase_lots set quantity_remaining=quantity_remaining+v_a.quantity where id=v_a.lot_id;
    end loop;
    insert into public.stock_movements(product_id,movement_type,quantity_delta,unit_cost,sale_item_id,reason,created_by)
      values(v_i.product_id,'return',v_i.quantity,v_i.unit_cost_at_sale,v_i.id,'Sale '||v_s.sale_number||' cancelled: '||p_reason,v_uid);
  end loop;
  update public.sales set status='cancelled',cancelled_at=now(),cancel_reason=p_reason where id=p_sale;
  insert into public.audit_log(actor_id,action,table_name,record_id,details) values(v_uid,'sale_cancelled','sales',p_sale::text,jsonb_build_object('number',v_s.sale_number,'reason',p_reason));
end $$;

create or replace function public.cancel_purchase(p_purchase uuid,p_reason text) returns void
language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_p record; v_l record;
begin
  if v_uid is null or public.current_role() not in ('owner','admin') then raise exception 'Only an owner or admin can cancel a purchase'; end if;
  if length(trim(coalesce(p_reason,'')))=0 then raise exception 'A cancellation reason is required'; end if;
  select * into v_p from public.purchase_orders where id=p_purchase for update;
  if not found then raise exception 'Purchase not found'; end if;
  if v_p.status<>'received' then raise exception 'Purchase is already cancelled'; end if;
  if exists(select 1 from public.purchase_lots where purchase_id=p_purchase and quantity_remaining<quantity_received) then
    raise exception 'Part of this purchase has already been sold or adjusted. Cancel the related sales first, or use a stock adjustment.';
  end if;
  for v_l in select * from public.purchase_lots where purchase_id=p_purchase for update loop
    update public.purchase_lots set quantity_remaining=0 where id=v_l.id;
    insert into public.stock_movements(product_id,movement_type,quantity_delta,unit_cost,purchase_lot_id,reason,created_by)
      values(v_l.product_id,'adjustment_out',-v_l.quantity_received,v_l.unit_purchase_cost+v_l.allocated_landed_cost/v_l.quantity_received,v_l.id,'Purchase '||v_p.purchase_number||' cancelled: '||p_reason,v_uid);
  end loop;
  update public.purchase_orders set status='cancelled',cancelled_at=now(),cancel_reason=p_reason where id=p_purchase;
  insert into public.audit_log(actor_id,action,table_name,record_id,details) values(v_uid,'purchase_cancelled','purchase_orders',p_purchase::text,jsonb_build_object('number',v_p.purchase_number,'reason',p_reason));
end $$;

-- ---------- stock adjustments ----------
create or replace function public.adjust_stock(p_product uuid,p_type text,p_qty numeric,p_reason text,p_unit_cost numeric default null) returns void
language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_lot uuid; v_cost numeric;
begin
  if v_uid is null or not public.can_operate() then raise exception 'Not authorized'; end if;
  if p_type not in ('adjustment_in','adjustment_out','damage') then raise exception 'Invalid adjustment type'; end if;
  if p_qty is null or p_qty<=0 then raise exception 'Quantity must be greater than zero'; end if;
  if length(trim(coalesce(p_reason,'')))=0 then raise exception 'A reason is required'; end if;
  perform 1 from public.products where id=p_product and active for update;
  if not found then raise exception 'Active product not found'; end if;
  if p_type='adjustment_in' then
    if p_unit_cost is null or p_unit_cost<0 then raise exception 'Unit cost is required when adding stock'; end if;
    insert into public.purchase_lots(purchase_id,product_id,quantity_received,quantity_remaining,unit_purchase_cost,allocated_landed_cost,source)
      values(null,p_product,p_qty,p_qty,p_unit_cost,0,'adjustment') returning id into v_lot;
    insert into public.stock_movements(product_id,movement_type,quantity_delta,unit_cost,purchase_lot_id,reason,created_by) values(p_product,'adjustment_in',p_qty,p_unit_cost,v_lot,p_reason,v_uid);
  else
    v_cost:=public.consume_fifo(p_product,p_qty,null);
    insert into public.stock_movements(product_id,movement_type,quantity_delta,unit_cost,reason,created_by) values(p_product,p_type,-p_qty,v_cost/p_qty,p_reason,v_uid);
  end if;
  insert into public.audit_log(actor_id,action,table_name,record_id,details) values(v_uid,'stock_adjusted','products',p_product::text,jsonb_build_object('type',p_type,'qty',p_qty,'reason',p_reason));
end $$;

-- ---------- reporting (RLS applies: security invoker) ----------
create or replace function public.report_summary(p_from date,p_to date,p_tz text default 'Asia/Kolkata')
returns table(orders bigint,units numeric,gross_sales numeric,discounts numeric,net_revenue numeric,cogs numeric,selling_fees numeric,shipping numeric,gross_profit numeric,expenses_total numeric,net_profit numeric,purchases_total numeric)
language sql stable security invoker set search_path=public as $$
  with s as (select id,discount_amount,selling_fees,shipping_cost from public.sales where status='posted' and (sold_at at time zone p_tz)::date between p_from and p_to),
  i as (select coalesce(sum(quantity),0) units,coalesce(sum(line_revenue),0) gross,coalesce(sum(line_cogs),0) cogs from public.sale_items where sale_id in (select id from s)),
  sd as (select count(*) n,coalesce(sum(discount_amount),0) disc,coalesce(sum(selling_fees),0) fees,coalesce(sum(shipping_cost),0) ship from s),
  x as (select coalesce(sum(amount),0) e from public.expenses where not voided and expense_date between p_from and p_to),
  p as (select coalesce(sum(subtotal+additional_cost),0) t from public.purchase_orders where status='received' and purchase_date between p_from and p_to)
  select sd.n,i.units,i.gross,sd.disc,i.gross-sd.disc,i.cogs,sd.fees,sd.ship,i.gross-sd.disc-i.cogs,x.e,i.gross-sd.disc-i.cogs-sd.fees-sd.ship-x.e,p.t from i,sd,x,p $$;

create or replace function public.report_by_channel(p_from date,p_to date,p_tz text default 'Asia/Kolkata')
returns table(channel text,orders bigint,revenue numeric,cogs numeric,profit numeric)
language sql stable security invoker set search_path=public as $$
  select s.channel,count(*),sum(t.gross-s.discount_amount),sum(t.cogs),sum(t.gross-s.discount_amount-t.cogs)
  from public.sales s cross join lateral (select coalesce(sum(line_revenue),0) gross,coalesce(sum(line_cogs),0) cogs from public.sale_items where sale_id=s.id) t
  where s.status='posted' and (s.sold_at at time zone p_tz)::date between p_from and p_to group by s.channel order by 3 desc $$;

create or replace function public.report_by_product(p_from date,p_to date,p_tz text default 'Asia/Kolkata')
returns table(sku text,name text,units numeric,revenue numeric,cogs numeric,profit numeric)
language sql stable security invoker set search_path=public as $$
  select p.sku,p.name,sum(i.quantity),sum(i.line_revenue),sum(i.line_cogs),sum(i.line_revenue-i.line_cogs)
  from public.sale_items i join public.sales s on s.id=i.sale_id join public.products p on p.id=i.product_id
  where s.status='posted' and (s.sold_at at time zone p_tz)::date between p_from and p_to group by p.sku,p.name order by 4 desc $$;

create or replace function public.report_daily(p_from date,p_to date,p_tz text default 'Asia/Kolkata')
returns table(day date,revenue numeric,profit numeric)
language sql stable security invoker set search_path=public as $$
  select (s.sold_at at time zone p_tz)::date,sum(t.gross-s.discount_amount),sum(t.gross-s.discount_amount-t.cogs)
  from public.sales s cross join lateral (select coalesce(sum(line_revenue),0) gross,coalesce(sum(line_cogs),0) cogs from public.sale_items where sale_id=s.id) t
  where s.status='posted' and (s.sold_at at time zone p_tz)::date between p_from and p_to group by 1 order by 1 $$;

-- ---------- team management ----------
create or replace function public.list_team() returns table(id uuid,email text,full_name text,role public.app_role,created_at timestamptz)
language sql stable security definer set search_path=public,auth as $$
  select p.id,u.email::text,p.full_name,p.role,p.created_at from public.profiles p join auth.users u on u.id=p.id
  where public.current_role() in ('owner','admin') order by p.created_at $$;

create or replace function public.set_user_role(p_user uuid,p_role public.app_role) returns void
language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid();
begin
  if v_uid is null or public.current_role()<>'owner' then raise exception 'Only the owner can change roles'; end if;
  if p_user=v_uid then raise exception 'You cannot change your own role'; end if;
  update public.profiles set role=p_role where id=p_user;
  if not found then raise exception 'User not found'; end if;
  insert into public.audit_log(actor_id,action,table_name,record_id,details) values(v_uid,'role_changed','profiles',p_user::text,jsonb_build_object('role',p_role));
end $$;

do $$ declare f text; begin
  foreach f in array array[
    'public.post_purchase(jsonb,date,uuid,text,numeric,text,text)',
    'public.post_sale(jsonb,text,timestamptz,text,numeric,numeric,numeric,text,text,text,text)',
    'public.cancel_sale(uuid,text)','public.cancel_purchase(uuid,text)',
    'public.adjust_stock(uuid,text,numeric,text,numeric)',
    'public.report_summary(date,date,text)','public.report_by_channel(date,date,text)',
    'public.report_by_product(date,date,text)','public.report_daily(date,date,text)',
    'public.list_team()','public.set_user_role(uuid,public.app_role)'] loop
    execute format('revoke all on function %s from public,anon',f);
    execute format('grant execute on function %s to authenticated',f);
  end loop;
end $$;

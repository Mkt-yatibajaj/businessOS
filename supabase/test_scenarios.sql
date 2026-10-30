\set ON_ERROR_STOP off
insert into auth.users(id,email) values('00000000-0000-0000-0000-000000000001','owner@x.com'),('00000000-0000-0000-0000-000000000002','viewer@x.com');
update public.profiles set role='owner' where id='00000000-0000-0000-0000-000000000001';
insert into public.products(id,sku,name,selling_price,reorder_level) values('11111111-1111-1111-1111-111111111111','TEST-1','Test one',100,2),('22222222-2222-2222-2222-222222222222','TEST-2','Test two',50,0);
set role authenticated;
select set_config('request.jwt.sub','00000000-0000-0000-0000-000000000001',false);
\echo == purchase 5@40 +10 extra, 3@50 (expect stock 8, value 360+10=... 210+150=360)
select public.post_purchase('[{"product":"11111111-1111-1111-1111-111111111111","qty":5,"unit_cost":40}]'::jsonb,current_date,null,null,10) is not null as p1;
select public.post_purchase('[{"product":"11111111-1111-1111-1111-111111111111","qty":3,"unit_cost":50}]'::jsonb) is not null as p2;
select sku,stock,stock_value from public.inventory_summary order by sku;
\echo == sell 6 @100 (expect COGS 260, stock 2, value 100)
select public.post_sale('[{"product":"11111111-1111-1111-1111-111111111111","qty":6,"price":100}]'::jsonb,'Offline') is not null as s1;
select sku,stock,stock_value from public.inventory_summary order by sku;
select line_revenue,line_cogs from public.sale_items;
\echo == oversell 3 (expect error, nothing persisted)
select public.post_sale('[{"product":"11111111-1111-1111-1111-111111111111","qty":3,"price":100}]'::jsonb,'Offline');
select count(*) as sales_count_should_be_1 from public.sales;
\echo == multi-line sale with discount, fees
select public.post_sale('[{"product":"11111111-1111-1111-1111-111111111111","qty":1,"price":100},{"product":"22222222-2222-2222-2222-222222222222","qty":1,"price":50}]'::jsonb,'Website',now(),null,10,5,20);
\echo == (TEST-2 has no stock so expect failure + rollback of line 1)
select sku,stock from public.inventory_summary order by sku;
select count(*) as sales_count_should_still_be_1 from public.sales;
\echo == multi-line purchase w/ extra cost split
select public.post_purchase('[{"product":"11111111-1111-1111-1111-111111111111","qty":1,"unit_cost":100},{"product":"22222222-2222-2222-2222-222222222222","qty":10,"unit_cost":10}]'::jsonb,current_date,null,null,100) is not null;
select p.sku,l.quantity_received,l.unit_purchase_cost,l.allocated_landed_cost from public.purchase_lots l join public.products p on p.id=l.product_id where l.created_at=(select max(created_at) from public.purchase_lots);
\echo == cancel the first sale -> stock back
select public.cancel_sale((select id from public.sales where sale_number like 'SAL-%' order by created_at limit 1),'test');
select sku,stock,stock_value from public.inventory_summary order by sku;
\echo == double cancel (expect error)
select public.cancel_sale((select id from public.sales limit 1),'again');
\echo == adjust: damage 2 of TEST-1, add 5 of TEST-2 @8
select public.adjust_stock('11111111-1111-1111-1111-111111111111','damage',2,'broken');
select public.adjust_stock('22222222-2222-2222-2222-222222222222','adjustment_in',5,'found',8);
select sku,stock,stock_value from public.inventory_summary order by sku;
\echo == expenses
insert into public.expenses(category,amount) values('Packaging',50);
\echo == reports (today)
select * from public.report_summary(current_date,current_date);
select * from public.report_by_channel(current_date,current_date);
select * from public.report_daily(current_date,current_date);
\echo == cancel purchase that was partly consumed (expect error)
select public.cancel_purchase((select id from public.purchase_orders order by created_at limit 1),'x');
\echo == viewer permissions
select set_config('request.jwt.sub','00000000-0000-0000-0000-000000000002',false);
select public.post_sale('[{"product":"11111111-1111-1111-1111-111111111111","qty":1,"price":100}]'::jsonb,'Offline');
insert into public.products(sku,name) values('HACK','hack');
select count(*) as viewer_can_read_products from public.products;
insert into public.sales(sale_number,channel) values('x','y');
select public.set_user_role('00000000-0000-0000-0000-000000000002','owner');
\echo == anon
reset role; set role anon;
select count(*) from public.products;

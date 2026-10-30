-- Run only after creating your own account in Supabase Authentication → Users.
-- Replace the email below with the exact email used for that account.
update public.profiles p set role='owner'
from auth.users u
where p.id=u.id and lower(u.email)=lower('YOUR-ADMIN-EMAIL@example.com');
-- Verify exactly one owner exists:
select p.id,u.email,p.role from public.profiles p join auth.users u on u.id=p.id where p.role='owner';

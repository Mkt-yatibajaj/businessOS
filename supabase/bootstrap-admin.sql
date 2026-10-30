-- Run only AFTER creating your own user in Supabase Dashboard > Authentication > Users.
-- Replace the email below with the exact email you own. Do not run this for an untrusted user.
-- This promotes exactly one matching profile to owner; it does not create an auth user.
update public.profiles p
set role = 'owner', full_name = coalesce(nullif(p.full_name, ''), 'Advaitum Owner')
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('REPLACE-WITH-YOUR-LOGIN-EMAIL@example.com');

-- Verify: this should return exactly your account with role owner.
select u.id, u.email, p.role
from auth.users u
join public.profiles p on p.id = u.id
where lower(u.email) = lower('REPLACE-WITH-YOUR-LOGIN-EMAIL@example.com');

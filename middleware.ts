import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isLogin = request.nextUrl.pathname.startsWith('/login');
  const isUnauthorized = request.nextUrl.pathname.startsWith('/unauthorized');
  if (!url || !key) {
    if (isLogin) return response;
    const target = request.nextUrl.clone(); target.pathname = '/login'; target.searchParams.set('setup', 'missing-env');
    return NextResponse.redirect(target);
  }
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && !isLogin && !isUnauthorized) {
    const target = request.nextUrl.clone(); target.pathname = '/login'; target.search = '';
    return NextResponse.redirect(target);
  }
  if (user && isLogin) {
    const target = request.nextUrl.clone(); target.pathname = '/'; target.search = '';
    return NextResponse.redirect(target);
  }
  if (user && !isLogin && !isUnauthorized) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (!profile || profile.role !== 'owner') {
      const target = request.nextUrl.clone(); target.pathname = '/unauthorized'; target.search = '';
      return NextResponse.redirect(target);
    }
  }
  if (!user && isUnauthorized) {
    const target = request.nextUrl.clone(); target.pathname = '/login';
    return NextResponse.redirect(target);
  }
  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'] };

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
export async function middleware(request:NextRequest){
 let response=NextResponse.next({request});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key) return request.nextUrl.pathname==='/setup' ? NextResponse.next({request}) : NextResponse.redirect(new URL('/setup',request.url));
 const supabase=createServerClient(url,key,{cookies:{getAll:()=>request.cookies.getAll(),setAll(cookies){cookies.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});cookies.forEach(({name,value,options})=>response.cookies.set(name,value,options));}}});
 const {data:{user}}=await supabase.auth.getUser();
 const path=request.nextUrl.pathname;
 if(!user && path!='/login' && path!='/setup' && !path.startsWith('/auth/')) return NextResponse.redirect(new URL('/login',request.url));
 if(user && path==='/login') return NextResponse.redirect(new URL('/',request.url));
 return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']};

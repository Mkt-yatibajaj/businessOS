'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function Login() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setBusy(false); return; }
    router.replace('/'); router.refresh();
  }
  return <main className="login-wrap"><form className="login-card" onSubmit={submit}>
    <div className="brand"><div className="brand-mark">A</div><div><b>advaitum</b><small>BUSINESS OS</small></div></div>
    <h1>Welcome back</h1><p className="subhead">Sign in to your private business workspace.</p>
    {error && <div className="notice error" role="alert">{error}</div>}
    <label>Email<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
    <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
    <button className="btn primary block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    <p className="foot-note">Private workspace. Accounts are created by the owner in Supabase; public registration is disabled.</p>
  </form></main>;
}

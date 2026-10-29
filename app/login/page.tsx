'use client';
import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Leaf, LogIn } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      window.location.assign('/');
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Unable to sign in.'); }
    finally { setBusy(false); }
  }
  return <main className="login-wrap"><form className="login-card" onSubmit={submit}>
    <div className="brand"><div className="brand-mark"><Leaf size={22}/></div><span>ADVAITUM</span></div>
    <h1>Sign in securely</h1><p className="subhead">Sign in to access your private inventory and business records.</p>
    {message && <div className="notice error">{message}</div>}
    <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@yourdomain.com"/></div>
    <div className="field"><label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password"/></div>
    <button className="btn btn-primary" style={{width:'100%',marginTop:8}} disabled={busy}><LogIn size={16}/>{busy?'Signing in…':'Sign in'}</button>
    <p className="footer-note">Private workspace. New accounts must be created by the owner in Supabase Authentication and explicitly authorized in the database. Public sign-up is not provided.</p>
  </form></main>;
}

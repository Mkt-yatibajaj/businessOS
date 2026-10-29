 "use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Leaf, LogIn } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMessage(""); setError(false);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.href = "/";
    } catch (e) {
      setError(true); setMessage(e instanceof Error ? e.message : "Login failed.");
    } finally { setBusy(false); }
  }

  return <main className="login-wrap"><form className="login-card" onSubmit={submit}>
    <div className="brand"><div className="brand-mark"><Leaf size={22}/></div><span>ADV AITUM</span></div>
    <h1>Welcome back</h1><p className="subhead">Sign in to manage your products, purchases and sales.</p>
    {message && <div className={`notice ${error ? "error" : ""}`}>{message}</div>}
    <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></div>
    <div className="field"><label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password"/></div>
    <button className="btn primary" style={{width:"100%",marginTop:8}} disabled={busy}><LogIn size={16}/>{busy ? "Signing in..." : "Sign in"}</button>
    <p className="footer-note">Create your first user in Supabase Authentication. Access is restricted by database policies; do not enable public sign-ups for a private inventory system.</p>
  </form></main>;
}

'use client';
import { useEffect, useState } from 'react';
import { BarChart3, Boxes, LayoutGrid, LogOut, Package, Receipt, RefreshCw, ShoppingCart, Users, Wallet } from 'lucide-react';
import { AppProvider, useApp } from '@/components/AppProvider';
import { Overview } from '@/components/Overview';
import { Products } from '@/components/Products';
import { Purchases } from '@/components/Purchases';
import { Sales } from '@/components/Sales';
import { Stock } from '@/components/Stock';
import { Expenses } from '@/components/Expenses';
import { Reports } from '@/components/Reports';
import { Team } from '@/components/Team';
import { PRESETS, type Preset } from '@/lib/format';

const NAV = [
  { id: 'Overview', icon: LayoutGrid }, { id: 'Products', icon: Package }, { id: 'Purchases', icon: ShoppingCart }, { id: 'Sales', icon: Receipt },
  { id: 'Stock', icon: Boxes }, { id: 'Expenses', icon: Wallet }, { id: 'Reports', icon: BarChart3 }, { id: 'Team', icon: Users, admin: true },
];
const DATED = ['Overview', 'Purchases', 'Sales', 'Expenses', 'Reports'];

function Shell() {
  const { db, role, email, ready, canAdmin, busy, msg, err, clearNotices, reload, preset, setPreset, customFrom, customTo, setCustom, range } = useApp();
  const [tab, setTab] = useState('Overview');
  useEffect(() => { const h = decodeURIComponent(location.hash.slice(1)); if (NAV.some(n => n.id === h)) setTab(h); }, []);
  const go = (t: string) => { setTab(t); history.replaceState(null, '', '#' + t); clearNotices(); window.scrollTo({ top: 0 }); };
  const logout = async () => { await db.auth.signOut(); location.href = '/login'; };
  const noProfile = ready && !role;

  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">A</div><div><b>advaitum</b><small>BUSINESS OS</small></div></div>
      <nav>{NAV.filter(n => !n.admin || canAdmin).map(n => <button key={n.id} className={`nav ${tab === n.id ? 'on' : ''}`} onClick={() => go(n.id)}><n.icon size={18} />{n.id}</button>)}</nav>
      <div className="side-foot"><small className="who">{email}</small><span className="role">{role || '…'}</span><button className="nav" onClick={logout}><LogOut size={17} />Sign out</button></div>
    </aside>
    <main className="main">
      <header className="top">
        <div><span className="eyebrow">ADVAITUM / BUSINESS OS</span><h1>{tab}</h1></div>
        <div className="top-actions">
          {DATED.includes(tab) && <>
            <select value={preset} onChange={e => setPreset(e.target.value as Preset)} aria-label="Period">{PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
            {preset === 'custom' && <><input type="date" value={customFrom} onChange={e => setCustom(e.target.value, customTo)} /><input type="date" value={customTo} onChange={e => setCustom(customFrom, e.target.value)} /></>}
          </>}
          <button className="btn" onClick={() => reload()} disabled={busy}><RefreshCw size={15} />Refresh</button>
        </div>
      </header>
      <div className="content">
        {DATED.includes(tab) && <p className="period">Showing {range.from} → {range.to}</p>}
        {err && <div className="notice error" role="alert">{err}<button onClick={clearNotices} aria-label="Dismiss">×</button></div>}
        {msg && <div className="notice ok" role="status">{msg}</div>}
        {noProfile && <div className="notice error">Your account has no profile or permission yet. Make sure both SQL migrations ran, then run the owner bootstrap SQL.</div>}
        {ready && role === 'viewer' && <div className="notice">Your account is view-only. Ask the owner to give you the operator role.</div>}
        {ready && tab === 'Overview' && <Overview go={go} />}
        {ready && tab === 'Products' && <Products />}
        {ready && tab === 'Purchases' && <Purchases />}
        {ready && tab === 'Sales' && <Sales />}
        {ready && tab === 'Stock' && <Stock />}
        {ready && tab === 'Expenses' && <Expenses />}
        {ready && tab === 'Reports' && <Reports />}
        {ready && tab === 'Team' && canAdmin && <Team />}
        {!ready && <p className="empty">Loading your workspace…</p>}
      </div>
    </main>
  </div>;
}
export default function Home() { return <AppProvider><Shell /></AppProvider>; }

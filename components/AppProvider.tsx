'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { rangeFor, type Preset } from '@/lib/format';
import type { Category, Product, Role, Supplier } from '@/lib/types';

type Db = ReturnType<typeof createClient>;
type Result = PromiseLike<{ error: { message: string } | null }>;
type Ctx = {
  db: Db; role: Role | ''; email: string; ready: boolean;
  canWrite: boolean; canAdmin: boolean; isOwner: boolean;
  products: Product[]; suppliers: Supplier[]; categories: Category[];
  version: number; reload: () => Promise<void>;
  preset: Preset; setPreset: (p: Preset) => void; customFrom: string; customTo: string; setCustom: (f: string, t: string) => void;
  range: { from: string; to: string };
  busy: boolean; msg: string; err: string; setErr: (s: string) => void; clearNotices: () => void;
  run: (fn: () => Result, success?: string) => Promise<boolean>;
};
const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => { const c = useContext(AppCtx); if (!c) throw new Error('AppProvider missing'); return c; };

export function AppProvider({ children }: { children: React.ReactNode }) {
  const db = useMemo(() => createClient(), []);
  const [role, setRole] = useState<Role | ''>(''); const [email, setEmail] = useState(''); const [ready, setReady] = useState(false);
  const [products, setProducts] = useState<Product[]>([]); const [suppliers, setSuppliers] = useState<Supplier[]>([]); const [categories, setCategories] = useState<Category[]>([]);
  const [version, setVersion] = useState(0); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const [preset, setPreset] = useState<Preset>('month'); const [customFrom, setFrom] = useState(''); const [customTo, setTo] = useState('');
  const range = useMemo(() => rangeFor(preset, customFrom, customTo), [preset, customFrom, customTo]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    const [u, inv, prod, sup, cat] = await Promise.all([
      db.auth.getUser(),
      db.from('inventory_summary').select('id,stock,stock_value'),
      db.from('products').select('*').order('name'),
      db.from('suppliers').select('*').order('name'),
      db.from('categories').select('*').order('name'),
    ]);
    const firstErr = inv.error || prod.error || sup.error || cat.error;
    if (firstErr) setErr(firstErr.message);
    setEmail(u.data.user?.email || '');
    if (u.data.user) {
      const { data: prof } = await db.from('profiles').select('role').eq('id', u.data.user.id).maybeSingle();
      setRole((prof?.role as Role) || '');
    }
    const stockMap = new Map((inv.data || []).map((r: { id: string; stock: number; stock_value: number }) => [r.id, r]));
    setProducts((prod.data || []).map((p: Product) => ({ ...p, selling_price: Number(p.selling_price), reorder_level: Number(p.reorder_level), stock: Number(stockMap.get(p.id)?.stock ?? 0), stock_value: Number(stockMap.get(p.id)?.stock_value ?? 0) })));
    setSuppliers(sup.data || []); setCategories(cat.data || []);
    setVersion(v => v + 1); setReady(true);
  }, [db]);
  useEffect(() => { reload(); }, [reload]);

  const notify = (m: string) => { setMsg(m); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setMsg(''), 4000); };
  const run = useCallback(async (fn: () => Result, success = 'Saved.') => {
    setBusy(true); setErr(''); setMsg('');
    try { const r = await fn(); if (r.error) throw new Error(r.error.message); notify(success); await reload(); return true; }
    catch (e) { setErr(e instanceof Error ? e.message : 'Operation failed'); return false; }
    finally { setBusy(false); }
  }, [reload]);

  const value: Ctx = {
    db, role, email, ready, canWrite: ['owner', 'admin', 'operator'].includes(role), canAdmin: ['owner', 'admin'].includes(role), isOwner: role === 'owner',
    products, suppliers, categories, version, reload, preset, setPreset, customFrom, customTo, setCustom: (f, t) => { setFrom(f); setTo(t); }, range,
    busy, msg, err, setErr, clearNotices: () => { setErr(''); setMsg(''); }, run,
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

/** Fetch rows whenever data is reloaded or the date range changes. */
export function useRows<T>(fetcher: (db: Db, range: { from: string; to: string }) => PromiseLike<{ data: unknown; error: { message: string } | null }>) {
  const { db, version, range, setErr } = useApp();
  const [rows, setRows] = useState<T[]>([]); const [loading, setLoading] = useState(true);
  const ref = useRef(fetcher);
  useEffect(() => { ref.current = fetcher; });
  useEffect(() => {
    let live = true; setLoading(true);
    Promise.resolve(ref.current(db, range)).then(({ data, error }) => {
      if (!live) return; if (error) setErr(error.message); setRows((data as T[]) || []); setLoading(false);
    });
    return () => { live = false; };
  }, [db, version, range, setErr]);
  return { rows, loading };
}

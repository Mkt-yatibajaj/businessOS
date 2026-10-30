'use client';
import type { Product } from '@/lib/types';
import { Plus, Trash2 } from 'lucide-react';

export function Panel({ title, sub, action, children }: { title?: string; sub?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="panel">{(title || action) && <div className="panel-head"><div>{title && <h2>{title}</h2>}{sub && <p>{sub}</p>}</div>{action}</div>}{children}</section>;
}
export function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'bad' }) {
  return <article className="stat"><span>{label}</span><strong className={tone}>{value}</strong>{hint && <small>{hint}</small>}</article>;
}
export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: string }) {
  const has = Array.isArray(children) ? children.flat().filter(Boolean).length > 0 : !!children;
  return <div className="table-scroll"><table><thead><tr>{head.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table>{!has && <p className="empty">{empty || 'Nothing here yet.'}</p>}</div>;
}
export const Badge = ({ tone, children }: { tone?: 'good' | 'warn' | 'bad'; children: React.ReactNode }) => <span className={`badge ${tone || ''}`}>{children}</span>;

export type Line = { product: string; qty: string; price: string };
export const emptyLine = (): Line => ({ product: '', qty: '1', price: '' });

/** Editable list of product lines used by the purchase and sale forms. */
export function Lines({ lines, setLines, products, priceLabel, showStock, onPick }: {
  lines: Line[]; setLines: (l: Line[]) => void; products: Product[]; priceLabel: string; showStock?: boolean; onPick?: (p: Product) => string;
}) {
  const set = (i: number, patch: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return <div className="lines">
    <div className="line head"><span>Product</span><span>Quantity</span><span>{priceLabel}</span><span /></div>
    {lines.map((l, i) => <div className="line" key={i}>
      <select required value={l.product} onChange={e => { const p = products.find(x => x.id === e.target.value); set(i, { product: e.target.value, price: p && onPick ? onPick(p) : l.price }); }}>
        <option value="">Select product</option>
        {products.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.sku} — {p.name}{showStock ? ` (stock ${p.stock})` : ''}</option>)}
      </select>
      <input type="number" required min="0.001" step="0.001" value={l.qty} onChange={e => set(i, { qty: e.target.value })} aria-label="Quantity" />
      <input type="number" required min="0" step="0.01" value={l.price} onChange={e => set(i, { price: e.target.value })} aria-label={priceLabel} />
      <button type="button" className="icon-btn" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="Remove line"><Trash2 size={15} /></button>
    </div>)}
    <button type="button" className="btn ghost" onClick={() => setLines([...lines, emptyLine()])}><Plus size={15} /> Add another product</button>
  </div>;
}

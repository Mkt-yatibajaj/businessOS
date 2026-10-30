'use client';
import { useState } from 'react';
import { useApp, useRows } from './AppProvider';
import { Badge, Panel, Table } from './ui';
import { dateTime, downloadCsv, inr, qty } from '@/lib/format';

type Move = { id: string; created_at: string; movement_type: string; quantity_delta: number; unit_cost: number; reason: string | null; products: { sku: string; name: string } | null };
const LABEL: Record<string, string> = { purchase: 'Purchase', sale: 'Sale', adjustment_in: 'Stock added', adjustment_out: 'Stock removed', damage: 'Damage / loss', return: 'Returned (cancelled sale)' };

export function Stock() {
  const { db, products, canWrite, run, busy } = useApp();
  const [f, setF] = useState({ product: '', type: 'adjustment_out', qty: '1', cost: '', reason: '' });
  const { rows } = useRows<Move>(d => d.from('stock_movements').select('id,created_at,movement_type,quantity_delta,unit_cost,reason,products(sku,name)').order('created_at', { ascending: false }).limit(200));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await run(() => db.rpc('adjust_stock', { p_product: f.product, p_type: f.type, p_qty: Number(f.qty), p_reason: f.reason, p_unit_cost: f.type === 'adjustment_in' ? Number(f.cost) : null }), 'Stock adjusted.');
    if (ok) setF({ ...f, qty: '1', cost: '', reason: '' });
  }
  return <>
    <Panel title="Stock levels" action={<button className="btn sm" onClick={() => downloadCsv('advaitum-inventory.csv', [['SKU', 'Product', 'Stock', 'Unit', 'Reorder level', 'Stock value'], ...products.map(p => [p.sku, p.name, p.stock, p.unit, p.reorder_level, p.stock_value])])}>CSV</button>}>
      <Table head={['SKU', 'Product', 'On hand', 'Reorder level', 'Avg cost / unit', 'Stock value', 'Status']} empty="No products yet.">
        {products.filter(p => p.active).map(p => <tr key={p.id}><td className="mono">{p.sku}</td><td>{p.name}</td><td>{qty(p.stock)} {p.unit}</td><td>{qty(p.reorder_level)}</td><td>{p.stock > 0 ? inr(p.stock_value / p.stock) : '—'}</td><td>{inr(p.stock_value)}</td><td>{p.stock <= 0 ? <Badge tone="bad">Out of stock</Badge> : p.stock <= p.reorder_level ? <Badge tone="warn">Low stock</Badge> : <Badge tone="good">OK</Badge>}</td></tr>)}
      </Table>
    </Panel>
    {canWrite && <Panel title="Stock adjustment" sub="For damage, loss, stock-take corrections or opening stock. Every adjustment is logged with your reason.">
      <form className="form-grid" onSubmit={submit}>
        <label>Product<select required value={f.product} onChange={e => setF({ ...f, product: e.target.value })}><option value="">Select product</option>{products.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.sku} — {p.name} (stock {p.stock})</option>)}</select></label>
        <label>Type<select value={f.type} onChange={e => setF({ ...f, type: e.target.value })}><option value="adjustment_out">Remove stock (correction)</option><option value="damage">Damage / loss</option><option value="adjustment_in">Add stock (opening / found)</option></select></label>
        <label>Quantity<input type="number" required min="0.001" step="0.001" value={f.qty} onChange={e => setF({ ...f, qty: e.target.value })} /></label>
        {f.type === 'adjustment_in' && <label>Unit cost (₹)<input type="number" required min="0" step="0.01" value={f.cost} onChange={e => setF({ ...f, cost: e.target.value })} /></label>}
        <label>Reason<input required value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} placeholder="e.g. broken in transit" /></label>
        <div className="form-actions"><button className="btn primary" disabled={busy}>Apply adjustment</button></div>
      </form>
    </Panel>}
    <Panel title="Stock movement log" sub="Latest 200 movements across all products">
      <Table head={['Date', 'Product', 'Type', 'Change', 'Unit cost', 'Reason']} empty="No movements yet.">
        {rows.map(m => <tr key={m.id}><td>{dateTime(m.created_at)}</td><td>{m.products?.name} <small className="mono">{m.products?.sku}</small></td><td>{LABEL[m.movement_type] || m.movement_type}</td><td className={Number(m.quantity_delta) < 0 ? 'neg' : 'pos'}>{Number(m.quantity_delta) > 0 ? '+' : ''}{qty(m.quantity_delta)}</td><td>{inr(m.unit_cost)}</td><td>{m.reason || '—'}</td></tr>)}
      </Table>
    </Panel>
  </>;
}

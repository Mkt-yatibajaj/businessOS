'use client';
import { useState } from 'react';
import { useApp, useRows } from './AppProvider';
import { Badge, emptyLine, Lines, Panel, Table, type Line } from './ui';
import { dateOnly, downloadCsv, inr, qty, today } from '@/lib/format';

type PO = { id: string; purchase_number: string; purchase_date: string; supplier_invoice: string | null; subtotal: number; additional_cost: number; status: string; cancel_reason: string | null; suppliers: { name: string } | null; purchase_lots: { quantity_received: number; unit_purchase_cost: number; products: { name: string; sku: string } | null }[] };

export function Purchases() {
  const { db, products, suppliers, canWrite, canAdmin, run, busy } = useApp();
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [f, setF] = useState({ supplier: '', invoice: '', date: today(), extra: '0', notes: '', number: '' });
  const { rows } = useRows<PO>((d, r) => d.from('purchase_orders').select('*,suppliers(name),purchase_lots(quantity_received,unit_purchase_cost,products(name,sku))').gte('purchase_date', r.from).lte('purchase_date', r.to).order('purchase_date', { ascending: false }).order('created_at', { ascending: false }).limit(500));
  const sub = lines.reduce((a, l) => a + Number(l.qty || 0) * Number(l.price || 0), 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const items = lines.filter(l => l.product).map(l => ({ product: l.product, qty: Number(l.qty), unit_cost: Number(l.price) }));
    const ok = await run(() => db.rpc('post_purchase', { p_items: items, p_date: f.date, p_supplier: f.supplier || null, p_invoice: f.invoice || null, p_extra_cost: Number(f.extra || 0), p_notes: f.notes || null, p_number: f.number || null }), 'Purchase posted and stock updated.');
    if (ok) { setLines([emptyLine()]); setF({ ...f, invoice: '', extra: '0', notes: '', number: '' }); }
  }
  const addSupplier = async () => { const name = prompt('Supplier name'); if (name?.trim()) await run(() => db.from('suppliers').insert({ name: name.trim() }), 'Supplier added.'); };
  const cancel = async (id: string, n: string) => { const reason = prompt(`Cancel purchase ${n}? Enter a reason:`); if (reason?.trim()) await run(() => db.rpc('cancel_purchase', { p_purchase: id, p_reason: reason.trim() }), 'Purchase cancelled and stock reversed.'); };

  return <>
    {canWrite && <Panel title="Receive stock (purchase)" sub="Additional cost (freight, duty, packing) is spread across the lines by value and added to each unit's landed cost.">
      <form onSubmit={submit}>
        <div className="form-grid">
          <label>Supplier<span className="row"><select value={f.supplier} onChange={e => setF({ ...f, supplier: e.target.value })}><option value="">— none —</option>{suppliers.filter(s => s.active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><button type="button" className="btn sm" onClick={addSupplier}>+ New</button></span></label>
          <label>Supplier invoice no.<input value={f.invoice} onChange={e => setF({ ...f, invoice: e.target.value })} /></label>
          <label>Purchase date<input type="date" required value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></label>
          <label>Additional cost (₹)<input type="number" min="0" step="0.01" value={f.extra} onChange={e => setF({ ...f, extra: e.target.value })} /></label>
          <label>Purchase no. <small>(blank = auto)</small><input value={f.number} onChange={e => setF({ ...f, number: e.target.value })} placeholder="PUR-1001" /></label>
          <label>Notes<input value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></label>
        </div>
        <Lines lines={lines} setLines={setLines} products={products} priceLabel="Unit cost (₹)" />
        <div className="form-foot"><span>Goods ₹{sub.toFixed(2)} + additional ₹{Number(f.extra || 0).toFixed(2)} = <b>{inr(sub + Number(f.extra || 0))}</b></span><button className="btn primary" disabled={busy}>Post purchase</button></div>
      </form>
    </Panel>}
    <Panel title="Purchase history" action={<button className="btn sm" onClick={() => downloadCsv('advaitum-purchases.csv', [['Purchase', 'Date', 'Supplier', 'Invoice', 'SKU', 'Product', 'Qty', 'Unit cost', 'Additional cost (order)', 'Status'], ...rows.flatMap(p => p.purchase_lots.map(l => [p.purchase_number, p.purchase_date, p.suppliers?.name, p.supplier_invoice, l.products?.sku, l.products?.name, l.quantity_received, l.unit_purchase_cost, p.additional_cost, p.status]))])}>CSV</button>}>
      <Table head={['Number', 'Date', 'Supplier', 'Items', 'Total cost', 'Status', '']} empty="No purchases in this period.">
        {rows.map(p => <tr key={p.id} className={p.status === 'cancelled' ? 'muted' : ''}><td className="mono">{p.purchase_number}</td><td>{dateOnly(p.purchase_date + 'T12:00:00+05:30')}</td><td>{p.suppliers?.name || '—'}</td><td>{p.purchase_lots.map(l => `${l.products?.name} ×${qty(l.quantity_received)} @ ${inr(l.unit_purchase_cost)}`).join(', ')}</td><td>{inr(Number(p.subtotal) + Number(p.additional_cost))}</td><td>{p.status === 'cancelled' ? <Badge tone="bad">Cancelled</Badge> : <Badge tone="good">Received</Badge>}</td><td className="actions">{canAdmin && p.status === 'received' && <button className="link danger" onClick={() => cancel(p.id, p.purchase_number)}>Cancel</button>}</td></tr>)}
      </Table>
    </Panel>
  </>;
}

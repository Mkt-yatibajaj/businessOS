'use client';
import { useState } from 'react';
import { useApp, useRows } from './AppProvider';
import { Badge, emptyLine, Lines, Panel, Table, type Line } from './ui';
import { bounds, dateTime, downloadCsv, inr, nowLocalInput, qty } from '@/lib/format';
import { CHANNELS } from '@/lib/types';

type SaleRow = { id: string; sale_number: string; sold_at: string; channel: string; location: string | null; payment_method: string | null; external_order_reference: string | null; discount_amount: number; selling_fees: number; shipping_cost: number; status: string; sale_items: { quantity: number; unit_selling_price: number; line_revenue: number; line_cogs: number; products: { name: string; sku: string } | null }[] };

const net = (s: SaleRow) => s.sale_items.reduce((a, i) => a + Number(i.line_revenue), 0) - Number(s.discount_amount);
const cogs = (s: SaleRow) => s.sale_items.reduce((a, i) => a + Number(i.line_cogs), 0);

export function Sales() {
  const { db, products, canWrite, canAdmin, run, busy } = useApp();
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const blank = { channel: 'Website', location: '', date: nowLocalInput(), discount: '0', fees: '0', shipping: '0', ref: '', payment: '', notes: '', number: '' };
  const [f, setF] = useState(blank); const [q, setQ] = useState('');
  const { rows } = useRows<SaleRow>((d, r) => { const b = bounds(r.from, r.to); return d.from('sales').select('*,sale_items(quantity,unit_selling_price,line_revenue,line_cogs,products(name,sku))').gte('sold_at', b.start).lte('sold_at', b.end).order('sold_at', { ascending: false }).limit(500); });
  const gross = lines.reduce((a, l) => a + Number(l.qty || 0) * Number(l.price || 0), 0);
  const shown = rows.filter(s => `${s.sale_number} ${s.channel} ${s.external_order_reference ?? ''} ${s.sale_items.map(i => i.products?.name).join(' ')}`.toLowerCase().includes(q.toLowerCase()));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const items = lines.filter(l => l.product).map(l => ({ product: l.product, qty: Number(l.qty), price: Number(l.price) }));
    const ok = await run(() => db.rpc('post_sale', { p_items: items, p_channel: f.channel, p_date: new Date(f.date).toISOString(), p_location: f.location || null, p_discount: Number(f.discount || 0), p_fees: Number(f.fees || 0), p_shipping: Number(f.shipping || 0), p_order_ref: f.ref || null, p_payment: f.payment || null, p_notes: f.notes || null, p_number: f.number || null }), 'Sale recorded and stock deducted (FIFO).');
    if (ok) { setLines([emptyLine()]); setF({ ...blank, channel: f.channel, date: nowLocalInput() }); }
  }
  const cancel = async (s: SaleRow) => { const reason = prompt(`Cancel sale ${s.sale_number}? Stock will be restored. Enter a reason:`); if (reason?.trim()) await run(() => db.rpc('cancel_sale', { p_sale: s.id, p_reason: reason.trim() }), 'Sale cancelled and stock restored.'); };

  return <>
    {canWrite && <Panel title="Record sale" sub="Stock is deducted oldest-lot-first. If any line is short of stock, the whole sale is rejected.">
      <form onSubmit={submit}>
        <div className="form-grid">
          <label>Channel<select value={f.channel} onChange={e => setF({ ...f, channel: e.target.value })}>{CHANNELS.map(c => <option key={c}>{c}</option>)}</select></label>
          <label>Date & time<input type="datetime-local" required value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></label>
          <label>Location / city<input value={f.location} onChange={e => setF({ ...f, location: e.target.value })} /></label>
          <label>Marketplace order ID<input value={f.ref} onChange={e => setF({ ...f, ref: e.target.value })} /></label>
          <label>Payment method<input value={f.payment} onChange={e => setF({ ...f, payment: e.target.value })} placeholder="UPI, COD, card…" /></label>
          <label>Sale no. <small>(blank = auto)</small><input value={f.number} onChange={e => setF({ ...f, number: e.target.value })} placeholder="SAL-1001" /></label>
        </div>
        <Lines lines={lines} setLines={setLines} products={products} priceLabel="Selling price (₹)" showStock onPick={p => String(p.selling_price)} />
        <div className="form-grid compact">
          <label>Discount (₹)<input type="number" min="0" step="0.01" value={f.discount} onChange={e => setF({ ...f, discount: e.target.value })} /></label>
          <label>Platform / payment fees (₹)<input type="number" min="0" step="0.01" value={f.fees} onChange={e => setF({ ...f, fees: e.target.value })} /></label>
          <label>Shipping cost you paid (₹)<input type="number" min="0" step="0.01" value={f.shipping} onChange={e => setF({ ...f, shipping: e.target.value })} /></label>
          <label>Notes<input value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></label>
        </div>
        <div className="form-foot"><span>Net sale value: <b>{inr(gross - Number(f.discount || 0))}</b></span><button className="btn primary" disabled={busy}>Post sale</button></div>
      </form>
    </Panel>}
    <Panel title="Sales ledger" action={<div className="row"><input className="search" placeholder="Search order, channel, product" value={q} onChange={e => setQ(e.target.value)} />
      <button className="btn sm" onClick={() => downloadCsv('advaitum-sales.csv', [['Sale', 'Date', 'Channel', 'Order ref', 'SKU', 'Product', 'Qty', 'Unit price', 'Line revenue', 'Line COGS', 'Sale discount', 'Fees', 'Shipping', 'Status'], ...rows.flatMap(s => s.sale_items.map(i => [s.sale_number, s.sold_at, s.channel, s.external_order_reference, i.products?.sku, i.products?.name, i.quantity, i.unit_selling_price, i.line_revenue, i.line_cogs, s.discount_amount, s.selling_fees, s.shipping_cost, s.status]))])}>CSV</button></div>}>
      <Table head={['Sale', 'Date', 'Channel', 'Items', 'Net revenue', 'COGS', 'Profit*', 'Status', '']} empty="No sales in this period.">
        {shown.map(s => { const cancelled = s.status === 'cancelled'; const p = net(s) - cogs(s) - Number(s.selling_fees) - Number(s.shipping_cost);
          return <tr key={s.id} className={cancelled ? 'muted' : ''}><td className="mono">{s.sale_number}</td><td>{dateTime(s.sold_at)}</td><td>{s.channel}</td><td>{s.sale_items.map(i => `${i.products?.name} ×${qty(i.quantity)}`).join(', ')}</td><td>{inr(net(s))}</td><td>{inr(cogs(s))}</td><td>{inr(p)}</td><td>{cancelled ? <Badge tone="bad">Cancelled</Badge> : <Badge tone="good">Posted</Badge>}</td><td className="actions">{canAdmin && !cancelled && <button className="link danger" onClick={() => cancel(s)}>Cancel</button>}</td></tr>; })}
      </Table>
      <p className="foot-note">*Profit = net revenue − FIFO cost − platform fees − shipping. Business expenses are deducted in Reports.</p>
    </Panel>
  </>;
}

'use client';
import { useApp, useRows } from './AppProvider';
import { Badge, Panel, Stat, Table } from './ui';
import { dateOnly, inr, qty } from '@/lib/format';
import type { Summary } from '@/lib/types';

type RecentSale = { id: string; sale_number: string; sold_at: string; channel: string; status: string; discount_amount: number; sale_items: { quantity: number; line_revenue: number; line_cogs: number; products: { name: string } | null }[] };

export function Overview({ go }: { go: (t: string) => void }) {
  const { products, range, canWrite } = useApp();
  const sum = useRows<Summary>(db => db.rpc('report_summary', { p_from: range.from, p_to: range.to }));
  const daily = useRows<{ day: string; revenue: number; profit: number }>((db, r) => db.rpc('report_daily', { p_from: r.from, p_to: r.to }));
  const recent = useRows<RecentSale>(db => db.from('sales').select('id,sale_number,sold_at,channel,status,discount_amount,sale_items(quantity,line_revenue,line_cogs,products(name))').order('sold_at', { ascending: false }).limit(6));
  const s = sum.rows[0];
  const units = products.reduce((a, p) => a + p.stock, 0), value = products.reduce((a, p) => a + p.stock_value, 0);
  const watch = products.filter(p => p.active && p.stock <= p.reorder_level).sort((a, b) => a.stock - b.stock);
  const days = daily.rows.slice(-30), max = Math.max(1, ...days.map(d => Number(d.revenue)));
  return <>
    <div className="stats">
      <Stat label="Net sales" value={inr(s?.net_revenue)} hint={`${s?.orders ?? 0} orders · ${qty(s?.units)} units`} />
      <Stat label="Gross profit" value={inr(s?.gross_profit)} hint="Sales less discounts and FIFO cost" />
      <Stat label="Net profit" value={inr(s?.net_profit)} tone={Number(s?.net_profit) < 0 ? 'bad' : 'good'} hint="After fees, shipping and expenses" />
      <Stat label="Inventory value" value={inr(value)} hint={`${qty(units)} units in stock`} />
    </div>
    <div className="grid-2">
      <Panel title="Sales trend" sub="Net sales per day in the selected period">
        {days.length === 0 ? <p className="empty">No sales in this period.</p> :
          <div className="chart" role="img" aria-label="Daily net sales">{days.map(d => <div key={d.day} className="bar-wrap" title={`${d.day}: ${inr(d.revenue)}`}><div className="bar" style={{ height: `${Math.max(3, (Number(d.revenue) / max) * 100)}%` }} /><small>{d.day.slice(8)}</small></div>)}</div>}
      </Panel>
      <Panel title="Stock to watch" sub="At or below reorder level" action={<button className="link" onClick={() => go('Stock')}>Manage →</button>}>
        {watch.length === 0 ? <p className="empty">All products are above their reorder level.</p> :
          <ul className="list">{watch.slice(0, 7).map(p => <li key={p.id}><div><b>{p.name}</b><small>{p.sku}</small></div><div className="right">{p.stock <= 0 ? <Badge tone="bad">Out of stock</Badge> : <Badge tone="warn">{qty(p.stock)} left</Badge>}</div></li>)}</ul>}
      </Panel>
    </div>
    <Panel title="Recent sales" action={<div className="row">{canWrite && <button className="btn primary sm" onClick={() => go('Sales')}>Record sale</button>}<button className="link" onClick={() => go('Sales')}>View all →</button></div>}>
      <Table head={['Order', 'Date', 'Channel', 'Items', 'Net revenue', 'Status']} empty="No sales recorded yet.">
        {recent.rows.map(r => { const gross = r.sale_items.reduce((a, i) => a + Number(i.line_revenue), 0) - Number(r.discount_amount);
          return <tr key={r.id}><td className="mono">{r.sale_number}</td><td>{dateOnly(r.sold_at)}</td><td>{r.channel}</td><td>{r.sale_items.map(i => `${i.products?.name ?? '—'} ×${qty(i.quantity)}`).join(', ')}</td><td>{inr(gross)}</td><td>{r.status === 'cancelled' ? <Badge tone="bad">Cancelled</Badge> : <Badge tone="good">Posted</Badge>}</td></tr>; })}
      </Table>
    </Panel>
  </>;
}

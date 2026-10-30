'use client';
import { useApp, useRows } from './AppProvider';
import { Panel, Stat, Table } from './ui';
import { downloadCsv, inr, qty } from '@/lib/format';
import type { Summary } from '@/lib/types';

export function Reports() {
  const { range } = useApp();
  const sum = useRows<Summary>(db => db.rpc('report_summary', { p_from: range.from, p_to: range.to }));
  const ch = useRows<{ channel: string; orders: number; revenue: number; cogs: number; profit: number }>(db => db.rpc('report_by_channel', { p_from: range.from, p_to: range.to }));
  const pr = useRows<{ sku: string; name: string; units: number; revenue: number; cogs: number; profit: number }>(db => db.rpc('report_by_product', { p_from: range.from, p_to: range.to }));
  const s = sum.rows[0]; const margin = s && Number(s.net_revenue) > 0 ? (Number(s.gross_profit) / Number(s.net_revenue)) * 100 : 0;
  const pl: [string, number, boolean?][] = s ? [['Gross sales', s.gross_sales], ['Less: discounts', -s.discounts], ['Net sales', s.net_revenue, true], ['Less: cost of goods sold (FIFO)', -s.cogs], ['Gross profit', s.gross_profit, true], ['Less: platform fees', -s.selling_fees], ['Less: shipping paid', -s.shipping], ['Less: business expenses', -s.expenses_total], ['Net profit', s.net_profit, true]] : [];
  return <>
    <div className="stats">
      <Stat label="Net sales" value={inr(s?.net_revenue)} hint={`${s?.orders ?? 0} orders`} />
      <Stat label="Gross margin" value={`${margin.toFixed(1)}%`} hint="Gross profit ÷ net sales" />
      <Stat label="Net profit" value={inr(s?.net_profit)} tone={Number(s?.net_profit) < 0 ? 'bad' : 'good'} />
      <Stat label="Stock purchased" value={inr(s?.purchases_total)} hint="Cash spent on purchases in period" />
    </div>
    <Panel title="Profit & loss" sub={`${range.from} to ${range.to} · cancelled sales excluded`} action={<button className="btn sm" onClick={() => downloadCsv('advaitum-profit-loss.csv', [['Line', 'Amount'], ...pl.map(([l, v]) => [l, v])])}>CSV</button>}>
      <Table head={['', 'Amount']} empty="No data in this period.">{pl.map(([l, v, bold]) => <tr key={l} className={bold ? 'total' : ''}><td>{l}</td><td>{inr(v)}</td></tr>)}</Table>
      <p className="foot-note">Management report only — not a GST return or statutory accounts. Purchases are shown for cash tracking; profit uses cost of goods actually sold.</p>
    </Panel>
    <div className="grid-2">
      <Panel title="By sales channel" action={<button className="btn sm" onClick={() => downloadCsv('advaitum-by-channel.csv', [['Channel', 'Orders', 'Net revenue', 'COGS', 'Gross profit'], ...ch.rows.map(r => [r.channel, r.orders, r.revenue, r.cogs, r.profit])])}>CSV</button>}>
        <Table head={['Channel', 'Orders', 'Net revenue', 'Gross profit']} empty="No sales in this period.">{ch.rows.map(r => <tr key={r.channel}><td>{r.channel}</td><td>{r.orders}</td><td>{inr(r.revenue)}</td><td>{inr(r.profit)}</td></tr>)}</Table>
      </Panel>
      <Panel title="By product" sub="Line revenue before any order-level discount" action={<button className="btn sm" onClick={() => downloadCsv('advaitum-by-product.csv', [['SKU', 'Product', 'Units', 'Revenue', 'COGS', 'Profit'], ...pr.rows.map(r => [r.sku, r.name, r.units, r.revenue, r.cogs, r.profit])])}>CSV</button>}>
        <Table head={['Product', 'Units', 'Revenue', 'Profit']} empty="No sales in this period.">{pr.rows.map(r => <tr key={r.sku}><td>{r.name} <small className="mono">{r.sku}</small></td><td>{qty(r.units)}</td><td>{inr(r.revenue)}</td><td>{inr(r.profit)}</td></tr>)}</Table>
      </Panel>
    </div>
  </>;
}

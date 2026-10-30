'use client';
import { useState } from 'react';
import { useApp, useRows } from './AppProvider';
import { Badge, Panel, Table } from './ui';
import { downloadCsv, inr, today } from '@/lib/format';
import { EXPENSE_CATEGORIES } from '@/lib/types';

type Exp = { id: string; expense_date: string; category: string; amount: number; notes: string | null; voided: boolean };

export function Expenses() {
  const { db, canWrite, canAdmin, run, busy } = useApp();
  const [f, setF] = useState({ date: today(), category: EXPENSE_CATEGORIES[0], amount: '', notes: '' });
  const { rows } = useRows<Exp>((d, r) => d.from('expenses').select('*').gte('expense_date', r.from).lte('expense_date', r.to).order('expense_date', { ascending: false }).limit(500));
  const total = rows.filter(r => !r.voided).reduce((a, r) => a + Number(r.amount), 0);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await run(() => db.from('expenses').insert({ expense_date: f.date, category: f.category, amount: Number(f.amount), notes: f.notes || null }), 'Expense recorded.');
    if (ok) setF({ ...f, amount: '', notes: '' });
  }
  const voidIt = async (x: Exp) => { if (confirm(`Void this ${inr(x.amount)} ${x.category} expense?`)) await run(() => db.from('expenses').update({ voided: true }).eq('id', x.id), 'Expense voided.'); };
  return <>
    {canWrite && <Panel title="Record business expense" sub="Operating costs that are not stock purchases (ads, rent, packaging, salaries…). They reduce net profit in Reports.">
      <form className="form-grid" onSubmit={submit}>
        <label>Date<input type="date" required value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></label>
        <label>Category<select value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>{EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
        <label>Amount (₹)<input type="number" required min="0.01" step="0.01" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /></label>
        <label>Notes<input value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></label>
        <div className="form-actions"><button className="btn primary" disabled={busy}>Add expense</button></div>
      </form>
    </Panel>}
    <Panel title="Expenses" sub={`Total in period: ${inr(total)}`} action={<button className="btn sm" onClick={() => downloadCsv('advaitum-expenses.csv', [['Date', 'Category', 'Amount', 'Notes', 'Voided'], ...rows.map(r => [r.expense_date, r.category, r.amount, r.notes, r.voided ? 'yes' : 'no'])])}>CSV</button>}>
      <Table head={['Date', 'Category', 'Amount', 'Notes', 'Status', '']} empty="No expenses in this period.">
        {rows.map(r => <tr key={r.id} className={r.voided ? 'muted' : ''}><td>{r.expense_date}</td><td>{r.category}</td><td>{inr(r.amount)}</td><td>{r.notes || '—'}</td><td>{r.voided ? <Badge tone="bad">Voided</Badge> : <Badge tone="good">Counted</Badge>}</td><td className="actions">{canAdmin && !r.voided && <button className="link danger" onClick={() => voidIt(r)}>Void</button>}</td></tr>)}
      </Table>
    </Panel>
  </>;
}

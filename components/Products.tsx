'use client';
import { useState } from 'react';
import { Download, Plus } from 'lucide-react';
import { useApp } from './AppProvider';
import { Badge, Panel, Table } from './ui';
import { downloadCsv, inr, qty } from '@/lib/format';

const blank = { sku: '', name: '', unit: 'piece', price: '0', reorder: '0', category: '' };

export function Products() {
  const { db, products, categories, canWrite, run, busy } = useApp();
  const [f, setF] = useState(blank); const [editing, setEditing] = useState<string | null>(null);
  const [q, setQ] = useState(''); const [showInactive, setShowInactive] = useState(false);
  const shown = products.filter(p => (showInactive || p.active) && (`${p.sku} ${p.name}`.toLowerCase().includes(q.toLowerCase())));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const row = { name: f.name.trim(), unit: f.unit.trim() || 'piece', selling_price: Number(f.price), reorder_level: Number(f.reorder), category_id: f.category || null };
    const ok = await run(() => editing ? db.from('products').update({ ...row, sku: f.sku.trim(), updated_at: new Date().toISOString() }).eq('id', editing) : db.from('products').insert({ ...row, sku: f.sku.trim() }), editing ? 'Product updated.' : 'Product added.');
    if (ok) { setF(blank); setEditing(null); }
  }
  const edit = (id: string) => { const p = products.find(x => x.id === id)!; setEditing(id); setF({ sku: p.sku, name: p.name, unit: p.unit, price: String(p.selling_price), reorder: String(p.reorder_level), category: p.category_id || '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const addCat = async () => { const name = prompt('New category name'); if (name?.trim()) await run(() => db.from('categories').insert({ name: name.trim() }), 'Category added.'); };

  return <>
    {canWrite && <Panel title={editing ? 'Edit product' : 'Add product / SKU'} sub="Selling price is a default suggestion; the real price is entered at each sale.">
      <form className="form-grid" onSubmit={save}>
        <label>SKU<input required value={f.sku} onChange={e => setF({ ...f, sku: e.target.value })} /></label>
        <label>Product name<input required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></label>
        <label>Category<span className="row"><select value={f.category} onChange={e => setF({ ...f, category: e.target.value })}><option value="">— none —</option>{categories.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button type="button" className="btn sm" onClick={addCat}>+ New</button></span></label>
        <label>Unit<input value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })} /></label>
        <label>Default selling price (₹)<input type="number" min="0" step="0.01" value={f.price} onChange={e => setF({ ...f, price: e.target.value })} /></label>
        <label>Reorder level<input type="number" min="0" step="0.001" value={f.reorder} onChange={e => setF({ ...f, reorder: e.target.value })} /></label>
        <div className="form-actions"><button className="btn primary" disabled={busy}><Plus size={16} />{editing ? 'Save changes' : 'Add product'}</button>{editing && <button type="button" className="btn" onClick={() => { setEditing(null); setF(blank); }}>Cancel</button>}</div>
      </form>
    </Panel>}
    <Panel title="Product catalogue" action={<div className="row"><input className="search" placeholder="Search SKU or name" value={q} onChange={e => setQ(e.target.value)} /><label className="check"><input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />Show inactive</label>
      <button className="btn sm" onClick={() => downloadCsv('advaitum-products.csv', [['SKU', 'Product', 'Category', 'Stock', 'Unit', 'Selling price', 'Reorder level', 'Stock value'], ...products.map(p => [p.sku, p.name, categories.find(c => c.id === p.category_id)?.name, p.stock, p.unit, p.selling_price, p.reorder_level, p.stock_value])])}><Download size={14} /> CSV</button></div>}>
      <Table head={['SKU', 'Product', 'Category', 'Stock', 'Price', 'Stock value', 'Status', '']} empty="No products yet. Add your first SKU above.">
        {shown.map(p => <tr key={p.id} className={p.active ? '' : 'muted'}><td className="mono">{p.sku}</td><td>{p.name}</td><td>{categories.find(c => c.id === p.category_id)?.name || '—'}</td><td>{qty(p.stock)} {p.unit}</td><td>{inr(p.selling_price)}</td><td>{inr(p.stock_value)}</td>
          <td>{!p.active ? <Badge>Inactive</Badge> : p.stock <= 0 ? <Badge tone="bad">Out of stock</Badge> : p.stock <= p.reorder_level ? <Badge tone="warn">Low stock</Badge> : <Badge tone="good">In stock</Badge>}</td>
          <td className="actions">{canWrite && <><button className="link" onClick={() => edit(p.id)}>Edit</button><button className="link" onClick={() => run(() => db.from('products').update({ active: !p.active }).eq('id', p.id), p.active ? 'Product deactivated.' : 'Product reactivated.')}>{p.active ? 'Deactivate' : 'Reactivate'}</button></>}</td></tr>)}
      </Table>
    </Panel>
  </>;
}

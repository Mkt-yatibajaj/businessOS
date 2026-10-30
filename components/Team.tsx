'use client';
import { useApp, useRows } from './AppProvider';
import { Panel, Table } from './ui';
import { dateTime } from '@/lib/format';
import type { Role } from '@/lib/types';

type Member = { id: string; email: string; full_name: string; role: Role; created_at: string };
type Audit = { id: number; created_at: string; action: string; details: Record<string, unknown>; actor_id: string | null };

export function Team() {
  const { db, isOwner, run, email } = useApp();
  const team = useRows<Member>(d => d.rpc('list_team'));
  const audit = useRows<Audit>(d => d.from('audit_log').select('*').order('created_at', { ascending: false }).limit(100));
  const who = (id: string | null) => team.rows.find(m => m.id === id)?.email || '—';
  return <>
    <Panel title="Team & access" sub="Owner = everything incl. roles · Admin = cancellations & voids · Operator = record purchases, sales, stock · Viewer = read-only">
      <Table head={['Email', 'Role', 'Joined']} empty="No users.">
        {team.rows.map(m => <tr key={m.id}><td>{m.email}{m.email === email && <small> (you)</small>}</td><td>{isOwner && m.email !== email ?
          <select value={m.role} onChange={e => run(() => db.rpc('set_user_role', { p_user: m.id, p_role: e.target.value }), 'Role updated.')}>{['viewer', 'operator', 'admin', 'owner'].map(r => <option key={r}>{r}</option>)}</select> : m.role}</td><td>{dateTime(m.created_at)}</td></tr>)}
      </Table>
      <p className="foot-note">To add a person: Supabase dashboard → Authentication → Users → Add user. They appear here as <b>viewer</b>; the owner then upgrades their role. Public sign-up must stay disabled.</p>
    </Panel>
    <Panel title="Activity log" sub="Last 100 recorded actions">
      <Table head={['When', 'Who', 'Action', 'Details']} empty="No activity yet.">
        {audit.rows.map(a => <tr key={a.id}><td>{dateTime(a.created_at)}</td><td>{who(a.actor_id)}</td><td>{a.action.replaceAll('_', ' ')}</td><td className="mono small">{Object.entries(a.details).map(([k, v]) => `${k}: ${v}`).join(' · ')}</td></tr>)}
      </Table>
    </Panel>
  </>;
}

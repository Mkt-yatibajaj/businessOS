export const TZ = 'Asia/Kolkata';

export const inr = (n: number | string | null | undefined) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(n || 0));

export const qty = (n: number | string | null | undefined) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(Number(n || 0));

export const dateOnly = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));

export const dateTime = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

/** YYYY-MM-DD for "now" in India time. */
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());

/** Value for <input type="datetime-local"> using the browser's local clock. */
export const nowLocalInput = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export type Preset = 'today' | 'week' | 'month' | 'last30' | 'fy' | 'all' | 'custom';
export const PRESETS: { id: Preset; label: string }[] = [
  { id: 'today', label: 'Today' }, { id: 'week', label: 'Last 7 days' }, { id: 'month', label: 'This month' },
  { id: 'last30', label: 'Last 30 days' }, { id: 'fy', label: 'This financial year' }, { id: 'all', label: 'All time' }, { id: 'custom', label: 'Custom range' },
];

const addDays = (ymd: string, d: number) => {
  const dt = new Date(ymd + 'T00:00:00Z'); dt.setUTCDate(dt.getUTCDate() + d); return dt.toISOString().slice(0, 10);
};

export function rangeFor(p: Preset, customFrom: string, customTo: string) {
  const t = today(); const [y, m] = t.split('-').map(Number);
  switch (p) {
    case 'today': return { from: t, to: t };
    case 'week': return { from: addDays(t, -6), to: t };
    case 'month': return { from: `${y}-${String(m).padStart(2, '0')}-01`, to: t };
    case 'last30': return { from: addDays(t, -29), to: t };
    case 'fy': return { from: `${m >= 4 ? y : y - 1}-04-01`, to: t };
    case 'all': return { from: '2000-01-01', to: '2099-12-31' };
    default: return { from: customFrom || t, to: customTo || t };
  }
}
/** Convert a YYYY-MM-DD range into timestamptz bounds in India time. */
export const bounds = (from: string, to: string) => ({ start: `${from}T00:00:00+05:30`, end: `${to}T23:59:59.999+05:30` });

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const esc = (x: string | number | null | undefined) => {
    let s = String(x ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralise spreadsheet formula injection
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const blob = new Blob(['\ufeff' + rows.map(r => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
}

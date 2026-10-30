'use client';
export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return <main className="login-wrap"><section className="login-card"><h1>Something went wrong</h1><p className="subhead">{error.message}</p><button className="btn primary" onClick={reset}>Try again</button></section></main>;
}

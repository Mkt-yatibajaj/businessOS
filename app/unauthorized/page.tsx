import Link from 'next/link';
export default function UnauthorizedPage() {
  return <main className="login-wrap"><section className="login-card"><h1>Access not enabled</h1><p className="subhead">Your account is authenticated, but it does not have the Advaitum owner role. Ask the system owner to authorize it.</p><Link className="btn btn-secondary" href="/login">Return to sign in</Link></section></main>;
}

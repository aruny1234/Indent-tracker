import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { ErrorText } from '../components/ui.jsx';

const MESSAGES = {
  'auth/invalid-credential': 'Email or password is wrong.',
  'auth/wrong-password': 'Email or password is wrong.',
  'auth/user-not-found': 'No account exists for this email.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes or reset your password.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/network-request-failed': 'No internet connection.',
};

export default function Login() {
  const { login, resetPassword, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await login(email, password);
    } catch (e2) {
      setErr(MESSAGES[e2.code] || e2.message);
    }
    setBusy(false);
  }
  async function reset() {
    setErr('');
    if (!email) return setErr('Enter your email first, then choose "Forgot password".');
    try {
      await resetPassword(email);
      setMsg(`A password reset link was sent to ${email}.`);
    } catch (e2) {
      setErr(MESSAGES[e2.code] || e2.message);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-xl border border-line bg-white">
        <div className="bg-ink px-6 py-6 text-white">
          <h1 className="text-xl font-semibold">Indent Tracker</h1>
          <p className="mt-1 text-sm text-slate-300">Track purchase indents from NetSuite until the material is received.</p>
        </div>
        <form onSubmit={submit} className="space-y-4 px-6 py-6">
          <div>
            <label className="label" htmlFor="email">Work email</label>
            <input id="email" type="email" autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="pw">Password</label>
            <input id="pw" type="password" autoComplete="current-password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <ErrorText>{err || error}</ErrorText>
          {msg && <p className="rounded-md bg-teal-light px-3 py-2 text-sm text-teal-dark">{msg}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <button type="button" onClick={reset} className="w-full text-center text-sm text-steel hover:text-ink hover:underline">Forgot password</button>
        </form>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Palmtree, Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { authApi } from '../api/auth.js';

// Landing page for the emailed reset link (/reset-password?token=…).
// Public by design — the token in the URL is the credential.
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { toast.error('Passwords do not match'); return; }
    setSubmitting(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
      toast.success('Password updated');
      setTimeout(() => navigate('/login', { replace: true }), 1800);
    } catch (err) {
      toast.error(err.message || 'Could not reset the password');
    } finally {
      setSubmitting(false);
    }
  };

  const field = (label, value, setter) => (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</label>
      <div className="relative">
        <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => setter(e.target.value)}
          minLength={6}
          required
          placeholder="••••••••"
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-11 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white"><Palmtree size={17} /></span>
          <div>
            <p className="text-sm font-bold text-slate-900">Andaman TravelCare</p>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Trip CRM</p>
          </div>
        </div>

        {!token ? (
          <div className="text-sm text-slate-600">
            <p className="font-semibold text-slate-900">This reset link is incomplete.</p>
            <p className="mt-1">Open the link from your email again, or request a new one from the login page.</p>
            <Link to="/login" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">Back to sign in</Link>
          </div>
        ) : done ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <CheckCircle2 size={36} className="text-green-500" />
            <p className="font-semibold text-slate-900">Password updated</p>
            <p className="text-sm text-slate-500">Taking you to sign in…</p>
          </div>
        ) : (
          <>
            <h1 className="text-lg font-bold text-slate-900">Choose a new password</h1>
            <p className="mb-5 mt-1 text-xs text-slate-500">Minimum 6 characters. The reset link works once and expires after 1 hour.</p>
            <form onSubmit={submit} className="space-y-4">
              {field('New Password', password, setPassword)}
              {field('Confirm Password', confirm, setConfirm)}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
              >
                {submitting ? 'Updating…' : 'Update Password'}
              </button>
            </form>
            <Link to="/login" className="mt-4 inline-block text-xs font-medium text-slate-400 hover:text-slate-600">Back to sign in</Link>
          </>
        )}
      </div>
    </div>
  );
}

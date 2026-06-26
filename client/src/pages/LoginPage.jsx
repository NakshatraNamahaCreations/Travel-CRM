import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Palmtree, Waves } from 'lucide-react';
import { useAuth } from '../store/AuthContext.jsx';

export default function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth();
  const [email, setEmail] = useState('admin@travelcrm.test');
  const [password, setPassword] = useState('admin123');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  if (!loading && isAuthenticated) return <Navigate to={from} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login({ email, password });
      toast.success('Welcome back!');
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ocean px-4">
      {/* Decorative ocean glow */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-brand-400/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-brand-300/30 blur-3xl" />
      <Waves className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-white/5" size={420} />

      <div className="relative w-full max-w-md">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/95 text-brand-600 shadow-glow">
            <Palmtree size={28} />
          </div>
          <h1 className="mt-4 text-h1 tracking-tighter text-white lg:text-[2.25rem]">Andaman TravelCare</h1>
          <p className="text-sm text-brand-100/80">Sign in to your Trip CRM</p>
        </div>

        <form onSubmit={handleSubmit} className="animate-scale-in space-y-4 rounded-2xl border border-white/15 border-t-2 border-t-brand-300 bg-white/95 p-7 shadow-xl backdrop-blur">
          <p className="pill-info w-full justify-center">Demo: admin@travelcrm.test / admin123</p>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn-primary w-full py-3 text-base" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-5 text-center text-xs text-brand-100/60">Andaman Islands · Tours, Ferries & Stays</p>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Palmtree, Mail, Lock, ArrowRight, Star } from 'lucide-react';
import { useAuth } from '../store/AuthContext.jsx';

const SLIDES = [
  {
    url: 'https://images.unsplash.com/photo-1586500036706-41963de24d8b?w=1400&q=90',
    title: 'Radhanagar Beach',
    subtitle: 'Havelock Island, Andaman',
  },
  {
    url: 'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?w=1400&q=90',
    title: 'Crystal Clear Waters',
    subtitle: 'Neil Island, Andaman',
  },
  {
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1400&q=90',
    title: 'Tropical Paradise',
    subtitle: 'Port Blair, Andaman',
  },
];

/* Floating bubble positions (randomised but stable) */
const BUBBLES = [
  { w: 180, h: 180, left: '8%',  top: '15%', delay: '0s',   dur: '7s'  },
  { w: 100, h: 100, left: '72%', top: '8%',  delay: '1.5s', dur: '9s'  },
  { w: 60,  h: 60,  left: '55%', top: '55%', delay: '3s',   dur: '6s'  },
  { w: 140, h: 140, left: '20%', top: '68%', delay: '0.8s', dur: '8s'  },
  { w: 80,  h: 80,  left: '85%', top: '40%', delay: '2.2s', dur: '10s' },
  { w: 50,  h: 50,  left: '40%', top: '25%', delay: '4s',   dur: '7s'  },
];

export default function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth();
  const [email, setEmail]       = useState('admin@travelcrm.test');
  const [password, setPassword] = useState('admin123');
  const [submitting, setSubmitting] = useState(false);
  const [slide, setSlide]       = useState(0);
  const [prevSlide, setPrevSlide] = useState(null);
  const navigate  = useNavigate();
  const location  = useLocation();
  const from      = location.state?.from?.pathname || '/';

  /* Auto-advance slides every 5 s */
  useEffect(() => {
    const t = setInterval(() => {
      setSlide((s) => {
        setPrevSlide(s);
        return (s + 1) % SLIDES.length;
      });
    }, 5000);
    return () => clearInterval(t);
  }, []);

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

  const goSlide = (i) => { setPrevSlide(slide); setSlide(i); };

  return (
    <>
      {/* ── Global keyframe animations ── */}
      <style>{`
        @keyframes kenburns {
          0%   { transform: scale(1)    translateX(0)    translateY(0); }
          50%  { transform: scale(1.08) translateX(-1%)  translateY(-1%); }
          100% { transform: scale(1)    translateX(0)    translateY(0); }
        }
        @keyframes floatBubble {
          0%, 100% { transform: translateY(0px) scale(1); opacity: 0.07; }
          50%       { transform: translateY(-22px) scale(1.05); opacity: 0.13; }
        }
        @keyframes waveMove {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes slideFormIn {
          from { opacity: 0; transform: translateX(30px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .img-kenburns {
          animation: kenburns 14s ease-in-out infinite;
        }
        .bubble {
          animation: floatBubble var(--dur, 7s) ease-in-out var(--delay, 0s) infinite;
        }
        .wave-track {
          animation: waveMove 12s linear infinite;
        }
        .caption-anim {
          animation: fadeSlideUp 0.7s ease both;
        }
        .form-anim {
          animation: slideFormIn 0.6s cubic-bezier(0.22,1,0.36,1) both;
        }
        .img-fade {
          animation: fadeIn 1s ease both;
        }
      `}</style>

      <div className="flex min-h-screen">

        {/* ══════════════ LEFT PANEL ══════════════ */}
        <div className="relative hidden w-[58%] overflow-hidden lg:flex flex-col">

          {/* Slide images with cross-fade */}
          {SLIDES.map((s, i) => (
            <img
              key={i}
              src={s.url}
              alt={s.title}
              className={`img-kenburns absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${i === slide ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
            />
          ))}

          {/* Gradient overlays */}
          <div className="absolute inset-0 z-20 bg-gradient-to-br from-[#0a2a6e]/85 via-[#1144b0]/45 to-transparent" />
          <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

          {/* Floating glass bubbles */}
          {BUBBLES.map((b, i) => (
            <div
              key={i}
              className="bubble absolute rounded-full border border-white/20 bg-white/5 backdrop-blur-sm z-30"
              style={{ width: b.w, height: b.h, left: b.left, top: b.top, '--delay': b.delay, '--dur': b.dur }}
            />
          ))}

          {/* Animated SVG wave at bottom */}
          <div className="absolute bottom-0 left-0 right-0 z-30 overflow-hidden leading-none" style={{ height: 90 }}>
            <div className="wave-track flex" style={{ width: '200%' }}>
              <svg viewBox="0 0 1440 90" className="w-1/2 shrink-0 fill-white/10" preserveAspectRatio="none">
                <path d="M0,40 C180,80 360,0 540,40 C720,80 900,0 1080,40 C1260,80 1440,20 1440,40 L1440,90 L0,90 Z" />
              </svg>
              <svg viewBox="0 0 1440 90" className="w-1/2 shrink-0 fill-white/10" preserveAspectRatio="none">
                <path d="M0,40 C180,80 360,0 540,40 C720,80 900,0 1080,40 C1260,80 1440,20 1440,40 L1440,90 L0,90 Z" />
              </svg>
            </div>
          </div>

          {/* Second wave layer (offset) */}
          <div className="absolute bottom-0 left-0 right-0 z-30 overflow-hidden leading-none" style={{ height: 60 }}>
            <div className="flex" style={{ width: '200%', animation: 'waveMove 8s linear infinite reverse' }}>
              <svg viewBox="0 0 1440 60" className="w-1/2 shrink-0 fill-white/8" preserveAspectRatio="none">
                <path d="M0,20 C240,50 480,0 720,25 C960,50 1200,5 1440,20 L1440,60 L0,60 Z" />
              </svg>
              <svg viewBox="0 0 1440 60" className="w-1/2 shrink-0 fill-white/8" preserveAspectRatio="none">
                <path d="M0,20 C240,50 480,0 720,25 C960,50 1200,5 1440,20 L1440,60 L0,60 Z" />
              </svg>
            </div>
          </div>

          {/* Top-left brand */}
          <div className="absolute left-8 top-8 z-40 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md border border-white/20">
              <Palmtree size={20} className="text-white" />
            </div>
            <div>
              <p className="text-[15px] font-bold leading-tight text-white drop-shadow">Andaman TravelCare</p>
              <p className="text-[10px] uppercase tracking-widest text-white/60">Trip CRM</p>
            </div>
          </div>

          {/* Floating quote card */}
          <div className="absolute right-7 top-1/2 -translate-y-1/2 z-40 max-w-[195px] rounded-2xl border border-white/25 bg-white/10 p-5 shadow-2xl backdrop-blur-md"
               style={{ animation: 'floatBubble 6s ease-in-out infinite', opacity: 1 }}>
            <div className="mb-2 text-2xl leading-none text-white/80">"</div>
            <p className="text-[12.5px] italic leading-relaxed text-white/90">
              The sea, once it casts its spell, holds one in its net of wonder forever.
            </p>
            <p className="mt-3 text-[11px] font-semibold text-white/55">— Jacques Cousteau</p>
          </div>

          {/* Bottom caption + dots */}
          <div className="absolute bottom-10 left-0 right-0 z-40 px-10">
            <div key={slide} className="caption-anim mb-5">
              <div className="mb-2 flex items-center gap-1.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={11} className="fill-amber-400 text-amber-400" />
                ))}
                <span className="ml-1 text-[11px] text-white/60">Premium Experience</span>
              </div>
              <h2 className="text-[28px] font-extrabold leading-tight text-white drop-shadow-md">
                {SLIDES[slide].title}
              </h2>
              <p className="mt-0.5 text-sm text-white/65">{SLIDES[slide].subtitle}</p>
            </div>
            <div className="flex gap-2">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goSlide(i)}
                  className={`h-1.5 rounded-full transition-all duration-500 ${i === slide ? 'w-8 bg-white' : 'w-2 bg-white/35 hover:bg-white/60'}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ══════════════ RIGHT PANEL ══════════════ */}
        <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-slate-50 px-8 py-12">

          {/* Subtle animated background circles */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand-100/50 blur-3xl"
               style={{ animation: 'floatBubble 9s ease-in-out infinite' }} />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-brand-200/30 blur-3xl"
               style={{ animation: 'floatBubble 11s ease-in-out 2s infinite' }} />

          {/* Mobile logo */}
          <div className="mb-8 flex flex-col items-center lg:hidden">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg">
              <Palmtree size={28} />
            </div>
            <h1 className="mt-3 text-xl font-bold text-slate-900">Andaman TravelCare</h1>
          </div>

          <div className="form-anim relative w-full max-w-[400px]">

            {/* Heading */}
            <div className="mb-8">
              <h2 className="text-[30px] font-extrabold leading-tight text-slate-900">Welcome back 👋</h2>
              <p className="mt-1.5 text-sm text-slate-500">
                Sign in to manage bookings, quotes & your team.
              </p>
            </div>

            {/* Demo badge */}
            <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
              </span>
              <span className="text-xs text-brand-700">
                Demo: <span className="font-semibold">admin@travelcrm.test</span> / <span className="font-semibold">admin123</span>
              </span>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div className="group">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition group-focus-within:text-brand-500" />
                  <input
                    type="email"
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition duration-200 focus:border-brand-400 focus:ring-3 focus:ring-brand-100 hover:border-slate-300"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="group">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Password
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition group-focus-within:text-brand-500" />
                  <input
                    type="password"
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition duration-200 focus:border-brand-400 focus:ring-3 focus:ring-brand-100 hover:border-slate-300"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="group relative mt-2 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-300/40 transition-all duration-200 hover:bg-brand-700 hover:shadow-brand-400/50 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {/* Shimmer effect on hover */}
                <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Signing in…
                  </span>
                ) : (
                  <><span>Sign in</span><ArrowRight size={16} className="transition-transform group-hover:translate-x-1" /></>
                )}
              </button>
            </form>

            {/* Footer */}
            <div className="mt-10 border-t border-slate-200 pt-6 text-center">
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                <span>Andaman Islands</span>
                <span className="text-slate-300">·</span>
                <span>Tours, Ferries & Stays</span>
                <span className="text-slate-300">·</span>
                <span>© 2026 Andaman TravelCare</span>
              </div>
              <p className="mt-1.5 text-[10.5px] text-slate-400">
                Developed by <span className="font-semibold text-brand-600">NNC Digital</span>
              </p>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}

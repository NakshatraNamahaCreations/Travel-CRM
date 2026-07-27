import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { X, AlertTriangle } from 'lucide-react';
import TopNav from '../components/TopNav.jsx';
import { useAuth } from '../store/AuthContext.jsx';

// Amber warning strip shown when the org's subscription expires within 7 days.
function SubscriptionBanner() {
  const { organization } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const exp = organization?.subscription?.expiresAt;
  if (dismissed || !exp) return null;
  const msLeft = new Date(exp).getTime() - Date.now();
  if (msLeft < 0 || msLeft > 7 * 24 * 60 * 60 * 1000) return null;
  const dateStr = new Date(exp).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div className="flex items-center gap-2 bg-amber-100 px-4 py-2 text-sm text-amber-800">
      <AlertTriangle size={15} className="shrink-0" />
      <span>
        Your subscription expires on <b>{dateStr}</b> — contact support to renew and avoid interruption.
      </span>
      <button className="ml-auto text-amber-600 hover:text-amber-900" onClick={() => setDismissed(true)}>
        <X size={15} />
      </button>
    </div>
  );
}

export default function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-surface print:block print:min-h-0 print:bg-white">
      {/* App chrome is never printed — only the page content (invoices, quotations…) */}
      <div className="contents print:hidden">
        <TopNav />
        <SubscriptionBanner />
      </div>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}

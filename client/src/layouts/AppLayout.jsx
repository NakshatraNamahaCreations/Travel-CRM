import { Outlet } from 'react-router-dom';
import TopNav from '../components/TopNav.jsx';

export default function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-surface print:block print:min-h-0 print:bg-white">
      {/* App chrome is never printed — only the page content (invoices, quotations…) */}
      <div className="contents print:hidden">
        <TopNav />
      </div>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}

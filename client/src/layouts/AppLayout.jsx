import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import TopBar from '../components/TopBar.jsx';

export default function AppLayout() {
  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

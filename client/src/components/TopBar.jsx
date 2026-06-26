import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Bell, Home } from 'lucide-react';

export default function TopBar() {
  const [term, setTerm] = useState('');
  const navigate = useNavigate();
  const submit = (e) => {
    e.preventDefault();
    if (!term.trim()) return;
    navigate(`/trips?status=all&q=${encodeURIComponent(term.trim())}`);
  };
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-slate-200 bg-white px-5">
      <form onSubmit={submit} className="flex w-full max-w-xl items-center">
        <div className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 transition focus-within:border-brand-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-200">
          <Search size={15} className="text-slate-400" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search trips by id, guest, phone…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
        </div>
      </form>
      <div className="ml-auto flex items-center gap-2 text-slate-400">
        <button className="rounded-lg p-2 hover:bg-slate-100 hover:text-slate-700" title="Notifications"><Bell size={18} /></button>
        <Link to="/" className="rounded-lg p-2 hover:bg-slate-100 hover:text-slate-700" title="Home"><Home size={18} /></Link>
      </div>
    </header>
  );
}

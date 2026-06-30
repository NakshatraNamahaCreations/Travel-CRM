import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowRight, ChevronRight, Check, Waves } from 'lucide-react';
import { useAuth } from '../store/AuthContext.jsx';
import { reportsApi } from '../api/reports.js';
import { money } from '../lib/pricing.js';
import { cn } from '../lib/cn.js';

// Section wrapper: title with a "→" link to the full report page.
function SectionCard({ title, to, right, children }) {
  return (
    <div className="card card-flush overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <Link to={to} className="group flex items-center gap-1.5 font-semibold text-slate-900">
          {title}
          <ArrowRight size={15} className="text-brand-600 transition group-hover:translate-x-0.5" />
        </Link>
        {right}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

// One clickable bucket column: a "Label ›" link with a value (or a ✓ when empty).
function Bucket({ label, to, value, empty }) {
  return (
    <div className="min-w-[96px] flex-1">
      <Link to={to} className="flex items-center gap-0.5 text-sm text-slate-500 hover:text-brand-700">
        {label} <ChevronRight size={13} />
      </Link>
      <div className="mt-1">
        {empty ? <Check size={18} className="text-emerald-500" /> : <span className="text-xl font-bold text-slate-900">{value}</span>}
      </div>
    </div>
  );
}

function GroupHeading({ children }) {
  return <h2 className="col-span-full mb-0 mt-3 text-sm font-semibold text-slate-500">{children}</h2>;
}

const PERIODS = [['today', 'Today'], ['week', 'Week'], ['month', 'Month']];

export default function DashboardPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState('month');

  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: () => reportsApi.dashboard() });

  const d = data || {};
  const sales = d.salesStats?.[period] || {};
  const fu = d.followups || {};
  const due = d.payments?.dueIncoming || {};
  const ts = d.tripsStarting || {};
  const te = d.tripsEnding || {};
  const live = d.liveDuePayments || {};

  const dueVal = (b) => (b?.count ? `${money(b.amount)}` : null);

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      {/* Slim hero */}
      <div className="relative mb-6 overflow-hidden rounded-2xl bg-ocean p-6 text-white shadow-soft">
        <Waves className="pointer-events-none absolute -bottom-8 right-6 text-white/10" size={140} />
        <div className="relative">
          <h1 className="text-h2 font-bold tracking-tight text-white">Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="mt-1 text-sm text-brand-100/90">{format(new Date(), 'EEEE, d MMMM yyyy')} · Andaman TravelCare</p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-slate-400">Loading dashboard…</div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
          {/* Trip Sales Stats */}
          <SectionCard
            title="Trip Sales Stats"
            to="/sales-reports"
            right={
              <div className="flex rounded-lg border border-slate-200 p-0.5">
                {PERIODS.map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setPeriod(k)}
                    className={cn('rounded-md px-2.5 py-1 text-xs font-medium', period === k ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:text-slate-700')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            }
          >
            <div className="flex flex-wrap gap-y-3">
              <Bucket label="Revenue" to="/sales-reports" value={money(sales.revenue || 0)} />
              <Bucket label="Leads" to="/sales-reports" value={sales.leads ?? 0} />
              <Bucket label="Quotes" to="/sales-reports" value={sales.quotes ?? 0} />
              <Bucket label="Conversion" to="/sales-reports" value={`${sales.conversionPct ?? 0}%`} />
            </div>
          </SectionCard>

          {/* Pending Follow-ups */}
          <SectionCard title="Pending Follow-ups" to="/reports/followups">
            <div className="flex flex-wrap gap-y-3">
              <Bucket label="Today" to="/reports/followups?bucket=today" value={fu.today} empty={!fu.today} />
              <Bucket label="Yesterday" to="/reports/followups?bucket=yesterday" value={fu.yesterday} empty={!fu.yesterday} />
              <Bucket label="Next 7 Days" to="/reports/followups?bucket=next7" value={fu.next7} empty={!fu.next7} />
            </div>
          </SectionCard>

          {/* Payments */}
          <GroupHeading>Payments</GroupHeading>
          <SectionCard title="Due Incoming" to="/reports/due-incoming">
            <div className="flex flex-wrap gap-y-3">
              <Bucket label="Today" to="/reports/due-incoming?bucket=today" value={dueVal(due.today)} empty={!due.today?.count} />
              <Bucket label="Yesterday" to="/reports/due-incoming?bucket=yesterday" value={dueVal(due.yesterday)} empty={!due.yesterday?.count} />
            </div>
          </SectionCard>

          {/* Trip Starting and Endings */}
          <GroupHeading>Trip Starting and Endings</GroupHeading>
          <SectionCard title="Trips Starting" to="/reports/starting">
            <div className="flex flex-wrap gap-y-3">
              <Bucket label="Today" to="/reports/starting?bucket=today" value={ts.today ?? 0} />
              <Bucket label="Yesterday" to="/reports/starting?bucket=yesterday" value={ts.yesterday ?? 0} />
              <Bucket label="Next 7 Days" to="/reports/starting?bucket=next7" value={ts.next7 ?? 0} />
            </div>
          </SectionCard>
          <SectionCard title="Trips Ending" to="/reports/ending">
            <div className="flex flex-wrap gap-y-3">
              <Bucket label="Today" to="/reports/ending?bucket=today" value={te.today ?? 0} />
              <Bucket label="Tomorrow" to="/reports/ending?bucket=tomorrow" value={te.tomorrow ?? 0} />
              <Bucket label="Prev 7 Days" to="/reports/ending?bucket=prev7" value={te.prev7 ?? 0} />
            </div>
          </SectionCard>

          {/* Live Trips with Due Payments */}
          <GroupHeading>Live Trips with Due Payments</GroupHeading>
          <SectionCard title="Trips with Due Payments" to="/reports/live-due">
            <div className="flex flex-wrap gap-y-3">
              <Bucket label="Live" to="/reports/live-due?bucket=live" value={dueVal(live.live)} empty={!live.live?.count} />
              <Bucket label="Ended Yesterday" to="/reports/live-due?bucket=endedYesterday" value={dueVal(live.endedYesterday)} empty={!live.endedYesterday?.count} />
              <Bucket label="Starts in 7 Days" to="/reports/live-due?bucket=starts7" value={dueVal(live.starts7)} empty={!live.starts7?.count} />
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}

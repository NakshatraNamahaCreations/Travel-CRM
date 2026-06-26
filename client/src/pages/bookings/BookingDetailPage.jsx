import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Printer, MapPin, Calendar, Users, Phone, Mail, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { bookingsApi } from '../../api/bookings.js';
import { money } from '../../lib/pricing.js';
import { cn } from '../../lib/cn.js';
import { tripNo } from '../../lib/format.js';

const STATUSES = [
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'on_trip', label: 'On Trip' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];
const BADGE = {
  confirmed: 'bg-blue-50 text-blue-700', on_trip: 'bg-purple-50 text-purple-700',
  completed: 'bg-green-50 text-green-700', cancelled: 'bg-red-50 text-red-700',
};

function Field({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={15} className="mt-0.5 text-gray-400" />
      <div><p className="text-xs uppercase tracking-wide text-gray-400">{label}</p><p className="text-sm font-medium text-gray-900">{children || '—'}</p></div>
    </div>
  );
}

export default function BookingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: b, isLoading } = useQuery({ queryKey: ['booking', id], queryFn: () => bookingsApi.get(id) });

  const statusMut = useMutation({
    mutationFn: (status) => bookingsApi.setStatus(id, status),
    onSuccess: () => { toast.success('Status updated'); qc.invalidateQueries({ queryKey: ['booking', id] }); qc.invalidateQueries({ queryKey: ['bookings'] }); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <div className="py-20 text-center text-gray-400">Loading…</div>;
  if (!b) return <div className="py-20 text-center text-gray-500">Booking not found.</div>;

  const cur = b.currency;
  const guestName = [b.guest?.salutation, b.guest?.name].filter(Boolean).join(' ') || 'Guest';

  return (
    <div>
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-3 text-sm print:hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900"><ArrowLeft size={18} /></button>
          <span className="font-semibold text-gray-900">Booking #{b.bookingNumber}</span>
          <span className={cn('rounded px-2 py-0.5 text-xs font-medium', BADGE[b.status])}>{b.status}</span>
        </div>
        <div className="flex items-center gap-2">
          <select className="input w-36" value={b.status} onChange={(e) => statusMut.mutate(e.target.value)} disabled={statusMut.isPending}>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button onClick={() => window.print()} className="btn-secondary text-sm"><Printer size={14} /> Voucher</button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-6">
        <div className="flex items-start justify-between border-b border-gray-200 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{b.title || 'Trip Booking'}</h1>
            <p className="text-sm text-gray-500">Booking #{b.bookingNumber} · {format(new Date(b.createdAt), 'd MMM yyyy')}
              {b.query && <> · <Link to={`/trips/${b.query._id}`} className="text-brand-600 hover:underline">Query #{tripNo(b.query.queryNumber)}</Link></>}
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold text-gray-900">Andaman Travel Care</p>
            <p className="text-gray-500">+91 89009 12121</p>
          </div>
        </div>

        <div className="grid gap-4 border-b border-gray-200 py-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field icon={Users} label="Guest">{guestName}</Field>
          <Field icon={Phone} label="Phone">{b.guest?.phones?.map((p) => `+${p.countryCode} ${p.number}`).join(', ')}</Field>
          <Field icon={Mail} label="Email">{b.guest?.email}</Field>
          <Field icon={MapPin} label="Destinations">{(b.destinations || []).map((d) => d.name).join(', ')}</Field>
          <Field icon={Calendar} label="Travel">
            {b.startDate ? format(new Date(b.startDate), 'd MMM') : '—'}{b.endDate ? ` – ${format(new Date(b.endDate), 'd MMM yyyy')}` : ''} · {b.nights}N/{b.days_count}D
          </Field>
          <Field icon={Users} label="Pax">{b.pax?.adults} adults{b.pax?.children?.length ? `, ${b.pax.children.length} child` : ''}</Field>
        </div>

        {/* Financials */}
        <div className="grid gap-4 border-b border-gray-200 py-5 sm:grid-cols-3">
          <div className="rounded-lg bg-gray-50 p-4"><p className="text-xs uppercase text-gray-400">Total</p><p className="text-xl font-bold text-gray-900">{money(b.totalAmount, cur)}</p></div>
          <div className="rounded-lg bg-green-50 p-4"><p className="text-xs uppercase text-green-600">Paid</p><p className="text-xl font-bold text-green-700">{money(b.paidAmount, cur)}</p></div>
          <div className="rounded-lg bg-red-50 p-4"><p className="text-xs uppercase text-red-600">Balance Due</p><p className="text-xl font-bold text-red-700">{money(b.balanceDue, cur)}</p></div>
        </div>
        <div className="flex justify-end py-3 print:hidden">
          <Link to={`/accounting/payments?booking=${b._id}`} className="btn-secondary text-sm"><Wallet size={14} /> Record / View Payments</Link>
        </div>

        {/* Itinerary */}
        {b.days?.length > 0 && (
          <div className="border-b border-gray-200 py-5">
            <h2 className="mb-3 font-semibold text-gray-900">Itinerary</h2>
            <div className="space-y-3">
              {b.days.map((d) => (
                <div key={d._id || d.dayNumber} className="flex gap-3">
                  <span className="mt-0.5 h-6 shrink-0 rounded-full bg-brand-600 px-2 text-xs font-semibold leading-6 text-white">Day {d.dayNumber}</span>
                  <div><p className="font-medium text-gray-900">{d.title || `Day ${d.dayNumber}`}</p>{d.description && <p className="text-sm text-gray-600">{d.description}</p>}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Services snapshot */}
        {b.costItems?.length > 0 && (
          <div className="py-5">
            <h2 className="mb-3 font-semibold text-gray-900">Included Services</h2>
            <ul className="space-y-1 text-sm text-gray-700">
              {b.costItems.map((it) => (
                <li key={it._id} className="flex justify-between border-b border-gray-50 py-1">
                  <span>{it.label} {it.meta && <span className="text-xs text-gray-400">({it.meta})</span>}</span>
                  <span className="text-gray-500">{it.qty} × {money(it.rate, cur)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

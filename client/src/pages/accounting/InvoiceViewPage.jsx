import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { bookingsApi } from '../../api/bookings.js';
import { money } from '../../lib/pricing.js';

export default function InvoiceViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: b, isLoading } = useQuery({ queryKey: ['booking', id], queryFn: () => bookingsApi.get(id) });

  if (isLoading) return <div className="py-20 text-center text-gray-400">Loading…</div>;
  if (!b) return <div className="py-20 text-center text-gray-500">Invoice not found.</div>;

  const cur = b.currency;
  const guest = b.guest;

  return (
    <div>
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-3 text-sm print:hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900"><ArrowLeft size={18} /></button>
          <span className="font-semibold text-gray-900">Invoice INV-{b.bookingNumber}</span>
          <Link to="/accounting/invoices" className="text-gray-500 hover:text-gray-800">/ Invoices</Link>
        </div>
        <button onClick={() => window.print()} className="btn-primary text-sm"><Printer size={14} /> Print</button>
      </div>

      <div className="mx-auto max-w-3xl px-8 py-10">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">PROFORMA INVOICE</h1>
            <p className="text-sm text-gray-500">INV-{b.bookingNumber} · {format(new Date(b.createdAt), 'd MMM yyyy')}</p>
          </div>
          <div className="text-right text-sm">
            <p className="text-lg font-bold text-brand-700">Andaman Travel Care</p>
            <p className="text-gray-500">info@andamantravelcare.com</p>
            <p className="text-gray-500">+91 89009 12121</p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-6 border-y border-gray-200 py-5">
          <div>
            <p className="text-xs uppercase text-gray-400">Billed To</p>
            <p className="font-semibold text-gray-900">{[guest?.salutation, guest?.name].filter(Boolean).join(' ')}</p>
            {guest?.phones?.[0] && <p className="text-sm text-gray-500">+{guest.phones[0].countryCode} {guest.phones[0].number}</p>}
            {guest?.email && <p className="text-sm text-gray-500">{guest.email}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase text-gray-400">Trip</p>
            <p className="font-semibold text-gray-900">{(b.destinations || []).map((d) => d.name).join(', ')}</p>
            <p className="text-sm text-gray-500">{b.startDate ? format(new Date(b.startDate), 'd MMM') : ''}{b.endDate ? ` – ${format(new Date(b.endDate), 'd MMM yyyy')}` : ''} · {b.nights}N/{b.days_count}D</p>
          </div>
        </div>

        <table className="mt-6 w-full text-sm">
          <thead className="border-b border-gray-300 text-left text-xs uppercase text-gray-400">
            <tr><th className="py-2">Description</th><th className="text-center">Qty</th><th className="text-right">Rate</th><th className="text-right">Amount</th></tr>
          </thead>
          <tbody>
            {(b.costItems || []).map((it) => (
              <tr key={it._id} className="border-b border-gray-100">
                <td className="py-2"><span className="font-medium text-gray-900">{it.label}</span>{it.meta && <span className="ml-1 text-xs text-gray-400">({it.meta})</span>}</td>
                <td className="text-center text-gray-600">{it.qty}</td>
                <td className="text-right text-gray-600">{money(it.rate, cur)}</td>
                <td className="text-right font-medium">{money(it.amount, cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto mt-6 w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between text-base font-bold text-gray-900"><span>Grand Total</span><span>{money(b.totalAmount, cur)}</span></div>
          <div className="flex justify-between text-green-700"><span>Paid</span><span>{money(b.paidAmount, cur)}</span></div>
          <div className="flex justify-between border-t border-gray-200 pt-1 font-semibold text-red-600"><span>Balance Due</span><span>{money(b.balanceDue, cur)}</span></div>
        </div>

        <p className="mt-10 text-xs text-gray-400">This is a proforma invoice and not a tax invoice. Andaman Travel Care · Thank you for your business.</p>
      </div>
    </div>
  );
}

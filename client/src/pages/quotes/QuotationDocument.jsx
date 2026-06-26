import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import { ArrowLeft, Printer, Download, Send, Palmtree, Phone, Mail, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { quotesApi } from '../../api/quotes.js';
import { company } from '../../config/company.js';
import { tripNo } from '../../lib/format.js';
import Modal from '../../components/ui/Modal.jsx';

const inr = (n, dec = 0) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });

function Band({ children }) {
  return <div className="bg-brand-600 px-5 py-2.5 text-base font-bold text-white">{children}</div>;
}

export default function QuotationDocument() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data: q, isLoading } = useQuery({ queryKey: ['quote', id], queryFn: () => quotesApi.get(id) });
  const [emailOpen, setEmailOpen] = useState(false);
  const [toEmail, setToEmail] = useState('');

  useEffect(() => {
    if (q && params.get('print') === '1') setTimeout(() => window.print(), 600);
    if (q) setToEmail(q.query?.guest?.email || '');
  }, [q, params]);

  const pdfMut = useMutation({
    mutationFn: () => quotesApi.pdf(id),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    },
    onError: (e) => toast.error(e.message || 'Could not generate PDF'),
  });

  const emailMut = useMutation({
    mutationFn: () => quotesApi.email(id, toEmail),
    onSuccess: (d) => { toast.success(`Quotation emailed to ${d.to}`); setEmailOpen(false); },
    onError: (e) => toast.error(e.message || 'Email failed — is SMTP configured in server/.env?'),
  });

  if (isLoading) return <div className="py-20 text-center text-gray-400">Loading…</div>;
  if (!q) return <div className="py-20 text-center text-gray-500">Quote not found.</div>;

  const pkg = q.packages?.[q.selectedPackageIndex || 0] || {};
  const guest = q.query?.guest || {};
  const paxAdults = q.pax?.adults || 0;
  const paxChildren = q.pax?.children?.length || 0;
  const pax = paxAdults + paxChildren;
  const start = q.startDate ? new Date(q.startDate) : null;
  const end = start ? addDays(start, q.nights || 0) : null;
  const destNames = (q.query?.destinations || []).map((d) => d.name).join(', ') || 'Andaman and Nicobar Islands';

  // Cost categories from the flattened cost items, mapped to the 5 PDF columns.
  const cats = { hotel: 0, tour: 0, permits: 0, ferry: 0, misc: 0 };
  (q.costItems || []).forEach((it) => {
    const label = String(it.label || '').toLowerCase();
    const amt = it.amount || 0;
    if (it.category === 'hotel') cats.hotel += amt;
    else if (/ferry|cruise|makruzz|nautika|green ocean|itt|sea ?link|catamaran/.test(label)) cats.ferry += amt;
    else if (/permit|boat|entry|jetty/.test(label)) cats.permits += amt;
    else if (it.category === 'transport') cats.tour += amt;
    else cats.misc += amt;
  });
  const p = q.pricing || {};
  const servicePct = p.subtotal ? Math.round((p.markup / p.subtotal) * 100) : 0;
  const gstPct = pkg.taxPercent || (p.subtotal + p.markup ? Math.round((p.tax / (p.subtotal + p.markup)) * 100) : 0);
  const taxable = (p.subtotal || 0) + (p.markup || 0);
  const perPerson = pax ? Math.round((p.total || 0) / pax) : 0;
  const advance = Math.round(((p.total || 0) * company.advancePercent) / 100);

  const inclusions = q.inclusions?.length ? q.inclusions : company.defaultInclusions;
  const exclusions = q.exclusions?.length ? q.exclusions : company.defaultExclusions;

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      {/* Toolbar */}
      <div className="mx-auto mb-4 flex max-w-4xl items-center justify-between px-4 print:hidden">
        <button onClick={() => navigate(-1)} className="btn-secondary text-sm"><ArrowLeft size={15} /> Back</button>
        <div className="flex gap-2">
          <button onClick={() => navigate(`/quotes/${id}/edit`)} className="btn-secondary text-sm">Edit Quote</button>
          <button onClick={() => window.print()} className="btn-secondary text-sm"><Printer size={15} /> Print</button>
          <button onClick={() => setEmailOpen(true)} className="btn-secondary text-sm"><Send size={15} /> Email Guest</button>
          <button onClick={() => pdfMut.mutate()} disabled={pdfMut.isPending} className="btn-primary text-sm">
            <Download size={15} /> {pdfMut.isPending ? 'Generating…' : 'Download PDF'}
          </button>
        </div>
      </div>

      <Modal open={emailOpen} onClose={() => setEmailOpen(false)} title="Email Quotation to Guest">
        <div className="space-y-3">
          <div>
            <label className="label">Recipient email</label>
            <input type="email" className="input" value={toEmail} onChange={(e) => setToEmail(e.target.value)} placeholder="guest@email.com" />
            <p className="mt-1 text-xs text-slate-400">The quotation PDF is attached automatically. Sending marks the quote as “sent”.</p>
          </div>
          <div className="flex justify-end">
            <button onClick={() => emailMut.mutate()} disabled={!toEmail || emailMut.isPending} className="btn-primary">
              {emailMut.isPending ? 'Sending…' : 'Send Email'}
            </button>
          </div>
        </div>
      </Modal>

      {/* A4 document */}
      <div className="mx-auto max-w-4xl bg-white text-slate-800 shadow-soft print:max-w-none print:shadow-none">
        {/* ===== PAGE 1 ===== */}
        <div className="px-8 pt-8" style={{ breakAfter: 'page' }}>
          {/* Letterhead */}
          <div className="grid grid-cols-3 gap-4 border-b border-slate-200 pb-5">
            <div className="flex items-center gap-2">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white"><Palmtree size={22} /></span>
              <div><p className="text-lg font-extrabold leading-tight text-brand-700">{company.name}</p><p className="text-[10px] uppercase tracking-widest text-slate-400">Trip CRM</p></div>
            </div>
            <div className="text-center text-xs text-slate-600">
              <p className="font-bold text-slate-800">Address:</p>
              {company.address.map((l) => <p key={l}>{l}</p>)}
            </div>
            <div className="text-right text-xs text-slate-600">
              <p className="font-bold text-slate-800">Contact:</p>
              {company.emails.map((e) => <p key={e}>{e}</p>)}
              {company.phones.map((ph) => <p key={ph}>{ph}</p>)}
            </div>
          </div>

          {/* Quotation-for + dates */}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="overflow-hidden rounded-xl border border-brand-200">
              <div className="bg-brand-600 px-4 py-2 text-sm font-bold text-white">Quotation for:</div>
              <div className="bg-brand-50/60 px-4 py-3 text-sm">
                <p className="font-bold text-slate-900">{[guest.salutation, guest.name].filter(Boolean).join(' ') || 'Guest'} &nbsp;|&nbsp; M{tripNo(q.query?.queryNumber)}</p>
                {guest.phones?.[0] && <p className="text-slate-600">+{guest.phones[0].countryCode} {guest.phones[0].number}</p>}
                <p className="mt-1 flex items-center gap-2 text-slate-700">
                  Adults: {paxAdults}, Children: {paxChildren}
                  <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white">{pkg.name || 'Package'}</span>
                </p>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-brand-200">
              <div className="bg-brand-600 px-4 py-2 text-sm font-bold text-white">{q.nights}N{q.nights + 1}D {pkg.name || 'Package'} to Andaman:</div>
              <div className="bg-brand-50/60 px-4 py-3 text-right text-sm">
                <p className="font-semibold text-slate-500">Travel Dates:</p>
                <p className="font-bold text-slate-900">{start ? format(start, 'MMMM d, yyyy') : '—'}</p>
                <p className="font-bold text-slate-900">{end ? format(end, 'MMMM d, yyyy') : ''}</p>
              </div>
            </div>
          </div>

          {/* Hotels */}
          <h2 className="mt-7 text-xl font-extrabold text-slate-900">Cruise and Hotel Information:</h2>
          {pkg.transports?.length > 0 && (
            <table className="mt-3 w-full overflow-hidden rounded-lg text-xs">
              <thead className="bg-brand-600 text-white"><tr><Th>Sector / Transfer</Th><Th>Service</Th><Th>Start Time</Th></tr></thead>
              <tbody>
                {pkg.transports.map((t, i) => (
                  <tr key={i} className="border-b border-slate-100 text-center text-brand-700">
                    <Td className="font-semibold">{t.serviceLocation || `Day ${t.day}`}</Td><Td>{t.serviceType || '—'}</Td><Td>{t.startTime || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <table className="mt-3 w-full overflow-hidden rounded-lg text-xs">
            <thead className="bg-brand-600 text-white">
              <tr><Th>Hotel Name</Th><Th>Type of Room</Th><Th>Place</Th><Th>#Rooms</Th><Th>#Nights</Th><Th>Extra Mattress</Th><Th>W/O Mattress</Th><Th>Meal Plan</Th></tr>
            </thead>
            <tbody>
              {(pkg.hotels || []).map((h, i) => (
                <tr key={i} className="border-b border-slate-100 text-center text-brand-700">
                  <Td className="font-semibold">{h.hotelName}</Td><Td>{h.roomType}</Td><Td>{h.city}</Td>
                  <Td>{h.rooms}</Td><Td>{(h.nights || []).length || 1}</Td><Td>{h.aweb || 0}</Td><Td>{h.cnb || 0}</Td>
                  <Td><span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">{h.mealPlan}</span></Td>
                </tr>
              ))}
              {!pkg.hotels?.length && <tr><td colSpan={8} className="py-3 text-center text-slate-400">No hotels added.</td></tr>}
            </tbody>
          </table>

          {/* Cost breakage */}
          <h2 className="mt-7 text-xl font-extrabold text-slate-900">Transparent Breakage of all Costs:</h2>
          <table className="mt-3 w-full text-xs">
            <thead className="bg-brand-600 text-white"><tr><Th>Hotel Cost</Th><Th>Tour Cost</Th><Th>Permits & Boat</Th><Th>Ferry Cost</Th><Th>Misc Cost</Th></tr></thead>
            <tbody><tr className="text-center font-semibold text-slate-800">
              <Td>{inr(cats.hotel)}</Td><Td>{inr(cats.tour)}</Td><Td>{inr(cats.permits)}</Td><Td>{inr(cats.ferry)}</Td><Td>{inr(cats.misc)}</Td>
            </tr></tbody>
          </table>

          {/* Cost summary */}
          <table className="mt-4 w-full text-xs">
            <thead className="bg-brand-600 text-white"><tr><Th>Package Cost</Th><Th>Discount</Th><Th>Total</Th><Th>Service Charge</Th><Th>Taxable</Th><Th>GST</Th><Th>Total Tax</Th><Th>Final Payable</Th></tr></thead>
            <tbody><tr className="bg-brand-50/40 text-center font-semibold text-slate-800">
              <Td>{inr(p.subtotal)}</Td><Td>—</Td><Td>{inr(p.subtotal)}</Td><Td>{servicePct}%</Td><Td>{inr(taxable)}</Td><Td>{gstPct}%</Td><Td>{inr(p.tax, 2)}</Td>
              <Td className="text-sm font-extrabold text-brand-700">{inr(p.total, 2)}</Td>
            </tr></tbody>
          </table>

          {/* Per person + advance */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="overflow-hidden rounded-xl">
              <div className="grid grid-cols-2">
                <div className="flex items-center justify-center bg-brand-600 px-4 py-4 text-lg font-extrabold text-white">COST BREAKAGE</div>
                <div className="divide-y divide-slate-200 bg-amber-50 text-sm">
                  <div className="flex justify-between px-4 py-2"><span className="font-semibold text-slate-600">Pax:</span><span className="font-bold">{pax}</span></div>
                  <div className="flex justify-between px-4 py-2"><span className="font-semibold text-slate-600">Per Person:</span><span className="font-bold">{inr(perPerson)}</span></div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between overflow-hidden rounded-xl bg-brand-600 text-white">
              <span className="px-4 py-4 text-sm font-bold">Payable to Confirm Booking ({company.advancePercent}%):</span>
              <span className="bg-emerald-500 px-6 py-4 text-xl font-extrabold">{inr(advance)}</span>
            </div>
          </div>

          <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-center text-[11px] text-slate-500">
            Costing here is for your reference; the GST invoice will be provided after tour completion. {company.bookingTerms}
          </p>
        </div>

        {/* ===== PAGE 2 — Itinerary ===== */}
        <div className="px-8 py-8" style={{ breakAfter: 'page' }}>
          <Band>{q.nights}N{q.nights + 1}D Day Wise Itinerary:</Band>
          <div className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {(q.days || []).map((d) => (
              <div key={d._id || d.dayNumber} className="rounded-lg border border-brand-100 bg-brand-50/30 p-3">
                <p className="font-bold text-brand-700">▸ DAY {d.dayNumber}{d.date ? `: ${format(new Date(d.date), 'd MMM yyyy')}` : ''}</p>
                <p className="mt-1 font-semibold text-slate-800">{d.title}</p>
                {d.description && (
                  <ul className="mt-1 space-y-0.5 text-sm text-slate-600">
                    {String(d.description).split(/\n|·/).filter((x) => x.trim()).map((line, i) => <li key={i}>- {line.trim()}</li>)}
                  </ul>
                )}
              </div>
            ))}
            {!q.days?.length && <p className="text-sm text-slate-400">No day-wise itinerary added.</p>}
          </div>
        </div>

        {/* ===== PAGE 3 — Info / Inclusions / Payment ===== */}
        <div className="px-8 py-8">
          <Band>Additional Information:</Band>
          <Box title="NOTE:" tone="slate" items={company.notes} className="mt-4" />
          <Box title="INCLUSIONS:" tone="green" items={inclusions} className="mt-4" />
          <Box title="EXCLUSIONS:" tone="rose" items={exclusions} className="mt-4" />

          <div className="mt-5 rounded-xl border border-brand-200 bg-brand-50/40 p-5">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900"><ShieldCheck size={18} className="text-brand-600" /> Payment Information</h3>
            <div className="grid gap-1 text-sm sm:grid-cols-2">
              <Kv k="Holder Name" v={company.bank.holder} />
              <Kv k="Bank" v={company.bank.bank} />
              <Kv k="Address" v={company.bank.address} />
              <Kv k="Acc. No." v={company.bank.accNo} />
              <Kv k="IFSC Code" v={company.bank.ifsc} />
              <Kv k="Payment Link" v={company.bank.paymentLink} />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-500">
            <div className="flex items-center gap-2"><Mail size={13} /> {company.emails[0]} <Phone size={13} className="ml-2" /> {company.phones[0]}</div>
            <span className="font-semibold text-brand-700">{company.tagline}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Th({ children }) { return <th className="px-2 py-2 text-center font-semibold">{children}</th>; }
function Td({ children, className = '' }) { return <td className={`px-2 py-2 ${className}`}>{children}</td>; }
function Kv({ k, v }) { return <p><span className="font-semibold text-slate-700">{k}:</span> <span className="text-slate-600">{v}</span></p>; }

function Box({ title, items, tone, className = '' }) {
  const tones = { slate: 'border-slate-200 bg-slate-50', green: 'border-green-200 bg-green-50', rose: 'border-rose-200 bg-rose-50' };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]} ${className}`}>
      <h3 className="mb-2 text-sm font-bold text-slate-800">{title}</h3>
      <ul className="space-y-1 text-sm text-slate-600">{items.map((it, i) => <li key={i}>- {it}</li>)}</ul>
    </div>
  );
}

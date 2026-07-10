import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import { ArrowLeft, Printer, Download, Send, Palmtree, Phone, Mail, ShieldCheck, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { quotesApi } from '../../api/quotes.js';
import { inclusionExclusionApi } from '../../api/masterData.js';
import { company } from '../../config/company.js';
import { tripNo } from '../../lib/format.js';
import Modal from '../../components/ui/Modal.jsx';

const inr = (n, dec = 0) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });

/* ─── shared sub-components ─────────────────────────────────────── */

function Band({ children }) {
  return (
    <div className="rounded bg-brand-600 px-4 py-2 text-[13px] font-bold text-white tracking-wide">
      {children}
    </div>
  );
}

function PageLetterhead() {
  return (
    <div className="flex items-start justify-between border-b border-slate-200 pb-3 mb-4 gap-2">
      {/* Logo block — nowrap so it never wraps to 2-3 lines */}
      <div className="flex shrink-0 items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
          <Palmtree size={17} />
        </span>
        <div>
          <p className="text-[13px] font-extrabold leading-tight text-brand-700 whitespace-nowrap">{company.name}</p>
          <p className="text-[8.5px] uppercase tracking-widest text-slate-400 whitespace-nowrap">Quality Tours. Exceptional Service.</p>
        </div>
      </div>
      {/* Address */}
      <div className="text-center text-[10.5px] leading-relaxed text-slate-600">
        <p className="font-semibold text-slate-800">Address:</p>
        {company.address.map((l) => <p key={l}>{l}</p>)}
      </div>
      {/* Contact */}
      <div className="text-right text-[10.5px] leading-relaxed text-slate-600">
        <p className="font-semibold text-slate-800">Contact:</p>
        {company.emails.map((e) => <p key={e}>{e}</p>)}
        {company.phones.map((ph) => <p key={ph}>{ph}</p>)}
      </div>
    </div>
  );
}

function PageFooter() {
  return (
    <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-3 text-[10px] text-slate-500">
      <div className="flex items-center gap-1.5">
        <Mail size={11} /> {company.emails[0]}
        <span className="mx-2 text-slate-300">|</span>
        <Phone size={11} /> {company.phones[0]}
      </div>
      <span className="font-semibold text-brand-600">{company.tagline}</span>
    </div>
  );
}

function Th({ children }) {
  return <th className="px-2 py-1.5 text-center text-[10.5px] font-semibold">{children}</th>;
}
function Td({ children, className = '' }) {
  return <td className={`px-2 py-1.5 text-[10.5px] ${className}`}>{children}</td>;
}
function Kv({ k, v }) {
  return (
    <div className="flex gap-1 text-[11px]">
      <span className="font-semibold text-slate-700 shrink-0">{k}:</span>
      <span className="text-slate-600">{v}</span>
    </div>
  );
}

function Box({ title, items, tone, className = '' }) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50',
    green: 'border-green-200 bg-green-50',
    rose: 'border-rose-200 bg-rose-50',
  };
  return (
    <div className={`rounded-lg border p-3 ${tones[tone]} ${className}`}>
      <p className="mb-1.5 text-[11px] font-bold text-slate-800">{title}</p>
      <ul className="space-y-0.5 text-[10.5px] text-slate-600">
        {items.map((it, i) => <li key={i} className="flex gap-1"><span className="shrink-0 text-slate-400">–</span><span>{it}</span></li>)}
      </ul>
    </div>
  );
}

/* ─── main component ─────────────────────────────────────────────── */

export default function QuotationDocument() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data: q, isLoading } = useQuery({ queryKey: ['quote', id], queryFn: () => quotesApi.get(id) });
  // Dynamic default inclusion/exclusion lines from the master (Settings page).
  const { data: incExcData } = useQuery({
    queryKey: ['inclusion-exclusions', 'defaults'],
    queryFn: () => inclusionExclusionApi.list({ limit: 200 }),
    staleTime: 60_000,
  });
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

  const incExcItems = (incExcData?.data || []).filter((i) => i.isActive !== false);
  const dynInclusions = incExcItems.filter((i) => i.type === 'inclusion').map((i) => i.text);
  const dynExclusions = incExcItems.filter((i) => i.type === 'exclusion').map((i) => i.text);
  const inclusions = q.inclusions?.length ? q.inclusions : (dynInclusions.length ? dynInclusions : company.defaultInclusions);
  const exclusions = q.exclusions?.length ? q.exclusions : (dynExclusions.length ? dynExclusions : company.defaultExclusions);
  const tcSections = Array.isArray(company.termsAndConditions) ? company.termsAndConditions : [];
  const whyUs = company.whyUs || {};
  const gallery = company.galleryImages || [];

  return (
    <>
      {/* Print-only global styles */}
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm 12mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .page-break { page-break-after: always; break-after: page; }
        }
      `}</style>

      <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
        {/* Toolbar */}
        <div className="no-print mx-auto mb-4 flex max-w-4xl items-center justify-between px-4">
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
              <p className="mt-1 text-xs text-slate-400">The quotation PDF is attached automatically.</p>
            </div>
            <div className="flex justify-end">
              <button onClick={() => emailMut.mutate()} disabled={!toEmail || emailMut.isPending} className="btn-primary">
                {emailMut.isPending ? 'Sending…' : 'Send Email'}
              </button>
            </div>
          </div>
        </Modal>

        {/* A4 wrapper */}
        <div className="mx-auto max-w-4xl bg-white text-slate-800 shadow-soft print:max-w-none print:shadow-none">

          {/* ═══ PAGE 1 ═══ */}
          <div className="page-break px-8 pt-7 pb-6">
            <PageLetterhead />

            {/* Quote for + dates */}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="overflow-hidden rounded-lg border border-brand-200">
                <div className="bg-brand-600 px-3 py-1.5 text-[11px] font-bold text-white">Quotation for:</div>
                <div className="bg-brand-50/60 px-3 py-2 text-[11px]">
                  <p className="font-bold text-slate-900">{[guest.salutation, guest.name].filter(Boolean).join(' ') || 'Guest'} &nbsp;|&nbsp; M{tripNo(q.query?.queryNumber)}</p>
                  {guest.phones?.[0] && <p className="text-slate-600">+{guest.phones[0].countryCode} {guest.phones[0].number}</p>}
                  <p className="mt-1 flex items-center gap-2 text-slate-700">
                    Adults: {paxAdults}, Children: {paxChildren}
                    <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">{pkg.name || 'Package'}</span>
                  </p>
                </div>
              </div>
              <div className="overflow-hidden rounded-lg border border-brand-200">
                <div className="bg-brand-600 px-3 py-1.5 text-[11px] font-bold text-white">{q.nights}N{q.nights + 1}D {pkg.name || 'Package'} to Andaman:</div>
                <div className="bg-brand-50/60 px-3 py-2 text-right text-[11px]">
                  <p className="font-medium text-slate-500">Travel Dates:</p>
                  <p className="font-bold text-slate-900">{start ? format(start, 'MMMM d, yyyy') : '—'}</p>
                  <p className="font-bold text-slate-900">{end ? format(end, 'MMMM d, yyyy') : ''}</p>
                </div>
              </div>
            </div>

            {/* Hotels & Cruise */}
            <h2 className="mt-5 text-[15px] font-extrabold text-slate-900">Cruise and Hotel Information:</h2>
            {pkg.transports?.length > 0 && (
              <table className="mt-2 w-full overflow-hidden rounded-lg text-xs">
                <thead className="bg-brand-600 text-white">
                  <tr><Th>Sector / Transfer</Th><Th>Service</Th><Th>Start Time</Th></tr>
                </thead>
                <tbody>
                  {pkg.transports.map((t, i) => {
                    const days = Array.isArray(t.days) ? t.days : (t.day ? [t.day] : []);
                    return (
                      <tr key={i} className="border-b border-slate-100 text-center text-brand-700">
                        <Td className="font-semibold">{t.serviceLocation || (days.length ? `Day ${days.join(', ')}` : '—')}</Td>
                        <Td>{t.serviceType || '—'}</Td>
                        <Td>{t.startTime || '—'}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <table className="mt-2 w-full overflow-hidden rounded-lg">
              <thead className="bg-brand-600 text-white">
                <tr><Th>Hotel Name</Th><Th>Type of Room</Th><Th>Place</Th><Th>#Rooms</Th><Th>#Nights</Th><Th>Extra Mattress</Th><Th>W/O Mattress</Th><Th>Meal Plan</Th></tr>
              </thead>
              <tbody>
                {(pkg.hotels || []).map((h, i) => (
                  <tr key={i} className="border-b border-slate-100 text-center text-brand-700">
                    <Td className="font-semibold">{h.hotelName}</Td><Td>{h.roomType}</Td><Td>{h.city}</Td>
                    <Td>{h.rooms}</Td><Td>{(h.nights || []).length || 1}</Td><Td>{h.aweb || 0}</Td><Td>{h.cnb || 0}</Td>
                    <Td><span className="rounded-full bg-brand-600 px-2 py-0.5 text-[9.5px] font-semibold text-white">{h.mealPlan}</span></Td>
                  </tr>
                ))}
                {!pkg.hotels?.length && <tr><td colSpan={8} className="py-2 text-center text-[10.5px] text-slate-400">No hotels added.</td></tr>}
              </tbody>
            </table>

            {/* Cost breakage */}
            <h2 className="mt-5 text-[15px] font-extrabold text-slate-900">Transparent Breakage of all Costs:</h2>
            <table className="mt-2 w-full overflow-hidden rounded-lg">
              <thead className="bg-brand-600 text-white"><tr><Th>Hotel Cost</Th><Th>Tour Cost</Th><Th>Permits &amp; Boat</Th><Th>Ferry Cost</Th><Th>Misc Cost</Th></tr></thead>
              <tbody><tr className="text-center font-semibold text-slate-800 bg-brand-50/40">
                <Td>{inr(cats.hotel)}</Td><Td>{inr(cats.tour)}</Td><Td>{inr(cats.permits)}</Td><Td>{inr(cats.ferry)}</Td><Td>{inr(cats.misc)}</Td>
              </tr></tbody>
            </table>
            <table className="mt-2 w-full overflow-hidden rounded-lg">
              <thead className="bg-brand-600 text-white"><tr><Th>Package Cost</Th><Th>Discount</Th><Th>Total</Th><Th>Service Charge</Th><Th>Taxable</Th><Th>GST</Th><Th>Total Tax</Th><Th>Final Payable</Th></tr></thead>
              <tbody><tr className="bg-brand-50/40 text-center font-semibold text-slate-800">
                <Td>{inr(p.subtotal)}</Td><Td>—</Td><Td>{inr(p.subtotal)}</Td><Td>{servicePct}%</Td><Td>{inr(taxable)}</Td><Td>{gstPct}%</Td><Td>{inr(p.tax, 2)}</Td>
                <Td className="text-[12px] font-extrabold text-brand-700">{inr(p.total, 2)}</Td>
              </tr></tbody>
            </table>

            {/* Pax + advance */}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="grid grid-cols-2">
                  <div className="flex items-center justify-center bg-brand-600 px-3 py-3 text-[13px] font-extrabold leading-tight text-white text-center">COST<br/>BREAKAGE</div>
                  <div className="divide-y divide-slate-100 bg-amber-50 text-[11px]">
                    <div className="flex justify-between px-3 py-2"><span className="font-medium text-slate-600">Pax:</span><span className="font-bold">{pax}</span></div>
                    <div className="flex justify-between px-3 py-2"><span className="font-medium text-slate-600">Per Person:</span><span className="font-bold">{inr(perPerson)}</span></div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between overflow-hidden rounded-lg bg-brand-600 text-white">
                <span className="px-3 py-3 text-[11px] font-bold leading-snug">Payable to Confirm Booking ({company.advancePercent}%):</span>
                <span className="bg-brand-800 px-5 py-3 text-[18px] font-extrabold whitespace-nowrap">{inr(advance)}</span>
              </div>
            </div>

            <p className="mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-1.5 text-center text-[9.5px] text-slate-500">
              Costing here is for your reference; the GST invoice will be provided after tour completion. {company.bookingTerms}
            </p>
          </div>

          {/* ═══ PAGE 2 — Day Wise Itinerary ═══ */}
          <div className="page-break px-8 py-6">
            <PageLetterhead />
            <Band>{q.nights}N{q.nights + 1}D Day Wise Itinerary:</Band>

            {q.days?.length > 0 ? (
              <div className="mt-3 space-y-2">
                {(q.days || []).map((d) => (
                  <div key={d._id || d.dayNumber} className="overflow-hidden rounded-lg border border-brand-100">
                    <div className="flex items-center gap-2.5 bg-brand-600 px-3 py-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-extrabold text-brand-700">{d.dayNumber}</span>
                      <div>
                        <span className="text-[12px] font-bold text-white">{d.title || `Day ${d.dayNumber}`}</span>
                        {d.date && <span className="ml-2 text-[10px] font-normal text-brand-200">{format(new Date(d.date), 'EEEE, d MMM yyyy')}</span>}
                      </div>
                    </div>
                    {d.description && (
                      <div className="bg-brand-50/30 px-4 py-2">
                        <ul className="space-y-1 text-[11px] text-slate-700">
                          {String(d.description).split(/\n|·|•/).filter((x) => x.trim()).map((line, li) => (
                            <li key={li} className="flex gap-1.5">
                              <span className="mt-0.5 shrink-0 text-brand-500 text-[9px]">▸</span>
                              <span>{line.trim()}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-6 text-center text-[11px] text-slate-400">
                No day-wise itinerary added to this quote yet.
              </div>
            )}
            <PageFooter />
          </div>

          {/* ═══ PAGE 3 — Additional Info ═══ */}
          <div className="page-break px-8 py-6">
            <PageLetterhead />
            <Band>Additional Information:</Band>
            <div className="mt-3 space-y-2">
              <Box title="NOTE:" tone="slate" items={company.notes} />
              <Box title="INCLUSIONS:" tone="green" items={inclusions} />
              <Box title="EXCLUSIONS:" tone="rose" items={exclusions} />
            </div>

            <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50/40 p-4">
              <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-bold text-slate-900">
                <ShieldCheck size={14} className="text-brand-600" /> Payment Information
              </h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
                <Kv k="Holder Name" v={company.bank.holder} />
                <Kv k="Bank" v={company.bank.bank} />
                <Kv k="Address" v={company.bank.address} />
                <Kv k="Acc. No." v={company.bank.accNo} />
                <Kv k="IFSC Code" v={company.bank.ifsc} />
                <Kv k="Payment Link" v={company.bank.paymentLink} />
              </div>
            </div>
            <PageFooter />
          </div>

          {/* ═══ PAGE 4 — Terms & Conditions ═══ */}
          <div className="page-break px-8 py-6">
            <PageLetterhead />
            <Band>Terms &amp; Conditions:</Band>

            {tcSections.map(({ heading, items }) => items?.length ? (
              <div key={heading} className="mt-4" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                <p className="mb-1.5 border-b border-slate-200 pb-1 text-[10.5px] font-bold uppercase tracking-wider text-slate-700">{heading}</p>
                <ul className="space-y-1.5">
                  {items.map((item, i) => {
                    const idx = item.indexOf(': ');
                    const hasLabel = idx > 0 && idx <= 45;
                    return (
                      <li key={i} className="flex gap-2 text-[11px] text-slate-700">
                        <span className="mt-0.5 shrink-0 text-brand-500 text-[9px]">▸</span>
                        <span>
                          {hasLabel ? (<><b>{item.slice(0, idx + 1)}</b> {item.slice(idx + 2)}</>) : item}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null)}

            {/* Company info box */}
            <div className="mt-6 rounded-xl bg-brand-600 p-5 text-white">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 text-xl"><Palmtree size={22} /></span>
                <div>
                  <p className="text-[17px] font-extrabold">{company.name}</p>
                  <p className="text-[10px] text-brand-200">GSTIN: {company.gstin}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-4 text-[11px]">
                <div>
                  <p className="font-semibold text-brand-200 mb-1">Address</p>
                  {company.address.map((l) => <p key={l}>{l}</p>)}
                </div>
                <div>
                  <p className="font-semibold text-brand-200 mb-1">Contact</p>
                  {company.emails.map((e) => <p key={e}>{e}</p>)}
                  {company.phones.map((ph) => <p key={ph}>{ph}</p>)}
                  <p className="mt-1">{company.website}</p>
                </div>
              </div>
            </div>
            <PageFooter />
          </div>

          {/* ═══ PAGE 5 — Why Choose Us ═══ */}
          <div className="page-break px-8 py-6">
            <PageLetterhead />
            <Band>Why Choose {company.name}?</Band>

            {whyUs.headline && (
              <p className="mt-3 text-[12px] font-semibold text-slate-700">{whyUs.headline}</p>
            )}

            <div className="mt-3 space-y-3">
              {(whyUs.testimonials || []).map((t, i) => (
                <div key={i} className="rounded-lg border border-brand-100 bg-brand-50/40 p-4">
                  <div className="flex gap-3">
                    {/* Use a text character instead of SVG icon — renders correctly in print */}
                    <span className="text-[28px] leading-none font-serif text-brand-400 mt-[-4px] shrink-0">"</span>
                    <div className="flex-1">
                      <p className="text-[11px] italic leading-relaxed text-slate-700">{t.review}"</p>
                      <div className="mt-2 flex items-center justify-between">
                        <div>
                          <p className="text-[11.5px] font-bold text-slate-900">{t.name}</p>
                          <p className="text-[10px] text-slate-500">via {t.platform}</p>
                        </div>
                        <div className="flex">
                          {Array.from({ length: t.rating || 5 }).map((_, si) => (
                            <Star key={si} size={12} className="fill-amber-400 text-amber-400" />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {(whyUs.reviewLinks || []).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {whyUs.reviewLinks.map((rl, i) => (
                  <div key={i} className="rounded-lg border border-brand-200 bg-brand-50/40 px-4 py-2 text-[11px]">
                    <p className="font-semibold text-slate-700">Read reviews on {rl.label}</p>
                    <p className="text-brand-600">{rl.url}</p>
                  </div>
                ))}
              </div>
            )}
            <PageFooter />
          </div>

          {/* ═══ PAGE 6 — Gallery ═══ */}
          <div className="px-8 py-6">
            <PageLetterhead />
            <Band>An Experience You Will Never Forget</Band>

            {gallery.length > 0 ? (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {gallery.map((src, i) => (
                  <div key={i} className="overflow-hidden rounded-lg" style={{ height: '140px' }}>
                    <img src={src} alt={`Gallery ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-dashed border-slate-300 p-6 text-center text-[11px] text-slate-400">
                No gallery images configured.
              </div>
            )}

            <div className="mt-5 rounded-xl bg-brand-600 px-8 py-5 text-center text-white">
              <p className="text-[20px] font-extrabold">{company.name}</p>
              <p className="mt-1 text-[12px] text-brand-200">{company.tagline}</p>
              <div className="mt-2 flex items-center justify-center gap-5 text-[11px] text-brand-100">
                <span><Mail size={11} className="mr-1 inline" />{company.emails[0]}</span>
                <span><Phone size={11} className="mr-1 inline" />{company.phones[0]}</span>
              </div>
              <p className="mt-1.5 text-[10px] text-brand-300">{company.website}</p>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

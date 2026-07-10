import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown, ChevronRight, Hotel, Bus, CalendarDays, StickyNote, ScrollText } from 'lucide-react';
import { format, addDays } from 'date-fns';
import toast from 'react-hot-toast';
import { quotesApi } from '../../api/quotes.js';
import { company } from '../../config/company.js';
import { tripNo } from '../../lib/format.js';
import InclusionExclusionEditor from './InclusionExclusionEditor.jsx';

const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

function Collapse({ icon: Icon, title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-100 py-4 last:border-0">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-left">
        {open ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
        {Icon && <Icon size={15} className="text-brand-600" />}
        <span className="text-[15px] font-bold text-slate-900">{title}</span>
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}

// Sembark-style "Create Itinerary" step shown right after a quote is saved:
// day-wise schedule, inclusions/exclusions, notes and T&C on one page.
export default function CreateItineraryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: q, isLoading } = useQuery({ queryKey: ['quote', id], queryFn: () => quotesApi.get(id) });

  const [days, setDays] = useState([]);
  const [inclusions, setInclusions] = useState([]);
  const [exclusions, setExclusions] = useState([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!q) return;
    const total = Math.max((q.nights || 0) + 1, q.days?.length || 0, 1);
    const byNo = new Map((q.days || []).map((d) => [d.dayNumber, d]));
    setDays(Array.from({ length: total }, (_, i) => {
      const d = byNo.get(i + 1) || {};
      const title = d.title && !/^day\s*\d+$/i.test(String(d.title).trim()) ? d.title : '';
      return { dayNumber: i + 1, title, description: d.description || '', sightseeing: d.sightseeing || '' };
    }));
    setInclusions(q.inclusions || []);
    setExclusions(q.exclusions || []);
    setNotes(q.terms || '');
  }, [q]);

  if (isLoading) return <div className="py-20 text-center text-gray-400">Loading…</div>;
  if (!q) return <div className="py-20 text-center text-gray-500">Quote not found.</div>;

  const pkg = (q.packages || [])[q.selectedPackageIndex || 0] || {};
  const start = q.startDate ? new Date(q.startDate) : null;
  const setDay = (i, patch) => setDays((ds) => ds.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));

  const save = async () => {
    setSaving(true);
    try {
      await quotesApi.update(id, {
        days,
        inclusions: inclusions.map((t) => t.trim()).filter(Boolean),
        exclusions: exclusions.map((t) => t.trim()).filter(Boolean),
        terms: notes,
        daysCustomized: true,
      });
      qc.invalidateQueries({ queryKey: ['quote', id] });
      qc.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Itinerary details saved');
      // Back to the trip's quotes tab — like Sembark's flow.
      navigate(q.query?._id ? `/trips/${q.query._id}` : `/quotes/${id}`);
    } catch (e) { toast.error(e.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const tcSections = Array.isArray(company.termsAndConditions) ? company.termsAndConditions : [];

  return (
    <div className="min-h-full bg-slate-50/70">
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-6 py-3 text-sm backdrop-blur">
        <button onClick={() => navigate(-1)} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"><ArrowLeft size={17} /></button>
        <span className="font-bold text-slate-900">Create Itinerary</span>
        <span className="text-slate-300">/</span>
        <span className="text-slate-500">Quote #{q.quoteNumber}</span>
        {q.query && <><span className="text-slate-300">/</span><Link to={`/trips/${q.query._id}`} className="text-slate-500 hover:text-slate-800">#{tripNo(q.query.queryNumber)}</Link></>}
      </div>

      <div className="px-6 py-6">
        <div className="card px-6 py-2">
          {/* Hotels — read-only summary */}
          <Collapse icon={Hotel} title="Hotels">
            {(pkg.hotels || []).length ? (
              <div className="space-y-1.5 text-sm text-slate-700">
                {pkg.hotels.map((h, i) => (
                  <p key={i}>• <b>{h.hotelName || 'Hotel'}</b> — {h.roomType || '—'}{h.mealPlan ? ` (${h.mealPlan})` : ''} · Night(s) {(h.nights || []).join(', ')}</p>
                ))}
                <Link to={`/quotes/${id}/edit`} className="inline-block text-xs font-medium text-brand-600 hover:underline">Edit hotels in the quote builder →</Link>
              </div>
            ) : <p className="text-sm text-slate-400">No hotels in this package.</p>}
          </Collapse>

          {/* Cabs / services — read-only summary */}
          <Collapse icon={Bus} title="Cabs & Services">
            {(pkg.transports || []).length || (pkg.activities || []).length ? (
              <div className="space-y-1.5 text-sm text-slate-700">
                {(pkg.transports || []).map((t, i) => (
                  <p key={`t${i}`}>• Day {(t.days || []).join(', ')} — <b>{t.serviceType || t.serviceLocation || 'Transport'}</b></p>
                ))}
                {(pkg.activities || []).map((a, i) => (
                  <p key={`a${i}`}>• Day {(a.days || []).join(', ')} — <b>{[a.name, a.ticketType].filter(Boolean).join(' — ') || 'Activity'}</b></p>
                ))}
                <Link to={`/quotes/${id}/edit`} className="inline-block text-xs font-medium text-brand-600 hover:underline">Edit services in the quote builder →</Link>
              </div>
            ) : <p className="text-sm text-slate-400">No transports or activities in this package.</p>}
          </Collapse>

          {/* Inclusion / Exclusion */}
          <Collapse title="Inclusion/Exclusion" defaultOpen>
            <div className="-m-5 sm:-m-6">
              <InclusionExclusionEditor
                inclusions={inclusions}
                exclusions={exclusions}
                onChange={({ inclusions: inc, exclusions: exc }) => { setInclusions(inc); setExclusions(exc); }}
              />
            </div>
          </Collapse>

          {/* Day-wise Schedule */}
          <Collapse icon={CalendarDays} title="Day-wise Schedule" defaultOpen>
            <div className="space-y-4">
              {days.map((d, i) => {
                const dt = start ? addDays(start, i) : null;
                return (
                  <div key={d.dayNumber} className="flex gap-4">
                    <div className="w-24 shrink-0 rounded-lg border border-brand-200 bg-brand-50/50 px-2 py-2 text-center">
                      <p className="text-xs font-bold text-brand-700">{ordinal(d.dayNumber)} Day</p>
                      {dt && <>
                        <p className="mt-1 text-[11px] text-slate-500">{format(dt, 'EEEE')}</p>
                        <p className="text-[12px] font-bold text-slate-800">{format(dt, 'do MMM')}</p>
                        <p className="text-[10px] text-slate-400">{format(dt, 'yyyy')}</p>
                      </>}
                    </div>
                    <div className="grid flex-1 gap-3 lg:grid-cols-[1fr_1.6fr]">
                      <div className="space-y-3">
                        <div>
                          <label className="label">Title</label>
                          <input className="input" placeholder="Title of the Day visit" value={d.title} onChange={(e) => setDay(i, { title: e.target.value })} />
                        </div>
                        <div>
                          <label className="label">Sightseeing</label>
                          <input className="input" placeholder="e.g. Cellular Jail, Corbyn's Cove Beach, Light & Sound Show" value={d.sightseeing || ''} onChange={(e) => setDay(i, { sightseeing: e.target.value })} />
                        </div>
                      </div>
                      <div>
                        <label className="label">Description</label>
                        <textarea className="input min-h-[128px]" placeholder="Please provide detailed description of the day visit…" value={d.description} onChange={(e) => setDay(i, { description: e.target.value })} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Collapse>

          {/* Important Notes */}
          <Collapse icon={StickyNote} title="Important Notes">
            <label className="label">Important Notes</label>
            <textarea className="input min-h-[120px]" placeholder="Any other information like contact details or guidelines…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Collapse>

          {/* Terms and Conditions */}
          <Collapse icon={ScrollText} title="Terms and Conditions">
            <p className="mb-2 text-xs text-slate-400">Applied terms and conditions for this package (managed in the company settings).</p>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/60 p-4">
              {tcSections.map((s) => (
                <div key={s.heading} className="mb-3">
                  <p className="text-xs font-bold uppercase text-slate-700">{s.heading}</p>
                  {(s.items || []).map((it, k) => <p key={k} className="mt-1 text-xs leading-relaxed text-slate-600">• {it}</p>)}
                </div>
              ))}
            </div>
          </Collapse>
        </div>
      </div>

      <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving} className="btn-primary px-6">{saving ? 'Saving…' : 'Save Details'}</button>
          <button onClick={() => navigate(q.query?._id ? `/trips/${q.query._id}` : `/quotes/${id}`)} disabled={saving} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}

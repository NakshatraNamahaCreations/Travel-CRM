import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Hotel, Bus, Pencil, Trash2, Sparkles, User, Share2, Mail, MessageCircle, Copy, Send, Plus, Flag, FileText } from 'lucide-react';
import { format, formatDistanceToNow, addDays } from 'date-fns';
import toast from 'react-hot-toast';
import { serviceBookingsApi } from '../../api/serviceBookings.js';
import { orgProfileApi } from '../../api/orgProfile.js';
import { company } from '../../config/company.js';
import { tripNo } from '../../lib/format.js';
import { stayCheckInOut, stayNightDates, markRepeatStays } from '../../lib/stayFormat.js';
import { buildHotelBookingSubject, buildHotelBookingEmailHtml, buildHotelBookingWhatsAppText, whatsappToHtml } from '../../lib/shareContent.js';
import StarRating from '../ui/StarRating.jsx';
import Modal from '../ui/Modal.jsx';
import GenerateVoucherModal from './GenerateVoucherModal.jsx';
import UpdateBookingStatusModal from './UpdateBookingStatusModal.jsx';
import { BOOKING_TAGS } from './TagCommentModal.jsx';
import { useConfirm } from '../ui/ConfirmProvider.jsx';
import { cn } from '../../lib/cn.js';

const htmlToPlain = (html) => html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim();

async function copyRichHtml(html) {
  try {
    if (window.ClipboardItem && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new window.ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([htmlToPlain(html)], { type: 'text/plain' }),
        }),
      ]);
    } else {
      await navigator.clipboard.writeText(htmlToPlain(html));
    }
    toast.success('Copied');
  } catch {
    toast.error('Copy failed — your browser blocked clipboard access');
  }
}

const SUBS = [
  { k: 'hotel', l: 'Hotels', icon: Hotel },
  { k: 'operational', l: 'Operational', icon: Bus },
];
const TITLES = { hotel: 'Hotel Bookings', operational: 'Operational Services' };
const ord = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const STATUS = {
  initialized: { label: 'Initialized', cls: 'bg-slate-100 text-slate-600' },
  in_progress: { label: 'In Progress', cls: 'bg-blue-50 text-blue-700' },
  booked: { label: 'Booked', cls: 'bg-green-50 text-green-700' },
  changed: { label: 'Changed', cls: 'bg-orange-50 text-orange-700' },
  cancelled: { label: 'Dropped', cls: 'bg-red-50 text-red-600' },
};
const money = (n, c = 'INR') => `${c} ${new Intl.NumberFormat('en-IN').format(Math.round(n || 0))}`;
const fmtD = (d) => (d ? format(new Date(d), 'd MMM') : '—');
const ago = (d) => (d ? `${formatDistanceToNow(new Date(d))} ago` : '');


function EditModal({ row, onClose, onSave, saving }) {
  const [f, setF] = useState({ price: row.price ?? 0, tag: row.tag || '', comment: row.comment || '', detail: row.detail || '' });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  return (
    <Modal open onClose={onClose} title={`Edit — ${row.name || 'Booking'}`}>
      <div className="space-y-3">
        <div><label className="label">Stay / Services</label><input className="input" value={f.detail} onChange={set('detail')} placeholder="CP • 3 Deluxe Room • 1 AWEB" /></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label className="label">Booking Price (₹)</label><input type="number" className="input" value={f.price} onChange={set('price')} /></div>
          <div>
            <label className="label">Tag</label>
            <select className="input" value={f.tag} onChange={set('tag')}>
              <option value="">No tag</option>
              {BOOKING_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
              {f.tag && !BOOKING_TAGS.includes(f.tag) && <option value={f.tag}>{f.tag}</option>}
            </select>
          </div>
        </div>
        <div><label className="label">Comment</label><textarea rows={3} className="input" value={f.comment} onChange={set('comment')} placeholder="Notes / follow-up…" /></div>
        <div className="flex justify-end pt-1">
          <button onClick={() => onSave({ price: Number(f.price) || 0, tag: f.tag, comment: f.comment, detail: f.detail })} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </Modal>
  );
}

function buildDefaultNightRates(row) {
  if (row.nightRates?.length) return row.nightRates.map((n) => ({ date: n.date, given: n.given ?? 0, booked: n.booked ?? 0 }));
  const count = Math.max(1, row.nights?.length || 1);
  const perNight = Math.round((row.price || 0) / count);
  const base = row.checkIn ? new Date(row.checkIn) : null;
  return Array.from({ length: count }, (_, i) => ({ date: base ? addDays(base, i) : null, given: perNight, booked: perNight }));
}

// Full-page-style hotel booking editor — mirrors the reference tool's "Edit
// Booking Details" layout: occupancy fields on the left, a per-night Prices
// table on the right, guest snapshot + single-guest "assigned tourist" card
// below (this app tracks one guest per trip, not a multi-traveler roster).
function EditHotelBookingModal({ row, guest, pax, onClose, onSave, saving }) {
  const [f, setF] = useState({
    mealPlan: row.mealPlan || '',
    roomType: row.roomType || '',
    paxPerRoom: row.paxPerRoom ?? 2,
    rooms: row.rooms ?? 1,
    aweb: row.aweb ?? 0,
    cweb: row.cweb ?? 0,
    cnb: row.cnb ?? 0,
    tag: row.tag || '',
    comment: row.comment || '',
    amountPaid: row.amountPaid ?? 0,
    flagged: !!row.flagged,
  });
  const [nightRates, setNightRates] = useState(() => buildDefaultNightRates(row));

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const setNum = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const updateNight = (i, patch) => setNightRates((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addNextNight = () => setNightRates((rs) => {
    const last = rs[rs.length - 1];
    return [...rs, { date: last?.date ? addDays(new Date(last.date), 1) : null, given: last?.given || 0, booked: last?.booked || 0 }];
  });
  const duplicateLast = () => setNightRates((rs) => (rs.length ? [...rs, { ...rs[rs.length - 1] }] : rs));
  const removeLast = () => setNightRates((rs) => (rs.length > 1 ? rs.slice(0, -1) : rs));
  const removeNight = (i) => setNightRates((rs) => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs));

  const phone0 = guest?.phones?.[0];
  const guestPhoneDigits = phone0 ? `${phone0.countryCode || '91'}${phone0.number}`.replace(/\D/g, '') : '';
  const guestName = [guest?.salutation, guest?.name].filter(Boolean).join(' ') || 'Guest';
  const paxLabel = pax
    ? `${pax.adults || 0} Adult${(pax.adults || 0) === 1 ? '' : 's'}${pax.children?.length ? `, ${pax.children.length} Child${pax.children.length === 1 ? '' : 'ren'}` : ''}`
    : '—';
  const totalBooked = nightRates.reduce((s, n) => s + (Number(n.booked) || 0), 0);

  const save = () => {
    const detail = [f.mealPlan, `${Number(f.rooms) || 1} ${f.roomType || 'Room'}`, Number(f.aweb) ? `${f.aweb} AWEB` : null, Number(f.cweb) ? `${f.cweb} CWEB` : null, Number(f.cnb) ? `${f.cnb} CNB` : null]
      .filter(Boolean).join(' • ');
    onSave({
      mealPlan: f.mealPlan, roomType: f.roomType, paxPerRoom: Number(f.paxPerRoom) || 2, rooms: Number(f.rooms) || 1,
      aweb: Number(f.aweb) || 0, cweb: Number(f.cweb) || 0, cnb: Number(f.cnb) || 0,
      tag: f.tag, comment: f.comment, amountPaid: Number(f.amountPaid) || 0, flagged: f.flagged, detail,
      nightRates: nightRates.map((n) => ({ date: n.date, given: Number(n.given) || 0, booked: Number(n.booked) || 0 })),
    });
  };

  return (
    <Modal open onClose={onClose} title={`Edit Booking Details for ${row.name || 'Hotel'}`} width="max-w-4xl">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <div>
            <label className="label">Stay Nights</label>
            <div className="flex flex-wrap gap-2">
              {nightRates.map((n, i) => (
                <label key={i} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700">
                  <input type="checkbox" checked onChange={() => removeNight(i)} disabled={nightRates.length <= 1} className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600" />
                  {ord(i + 1)} N{n.date ? ` (${format(new Date(n.date), 'EEE d MMM')})` : ''}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className="label">Meal Plan</label><input className="input" value={f.mealPlan} onChange={set('mealPlan')} placeholder="CP" /></div>
            <div><label className="label">Room Type</label><input className="input" value={f.roomType} onChange={set('roomType')} placeholder="Deluxe Room" /></div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:grid-cols-6">
            <div><label className="label">Pax/room (WoEB)</label><input type="number" min="1" className="input" value={f.paxPerRoom} onChange={setNum('paxPerRoom')} /></div>
            <div><label className="label">No. of rooms</label><input type="number" min="1" className="input" value={f.rooms} onChange={setNum('rooms')} /></div>
            <div><label className="label">AWEB</label><input type="number" min="0" className="input" value={f.aweb} onChange={setNum('aweb')} /></div>
            <div><label className="label">CWEB</label><input type="number" min="0" className="input" value={f.cweb} onChange={setNum('cweb')} /></div>
            <div><label className="label">CNB</label><input type="number" min="0" className="input" value={f.cnb} onChange={setNum('cnb')} /></div>
            <div><label className="label">Comp Child</label><div className="input flex items-center bg-slate-50 text-xs text-gray-500">Upto 5y ({Number(f.cnb) || 0}C)</div></div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
            <label className="label">Tag</label>
            <select className="input" value={f.tag} onChange={set('tag')}>
              <option value="">No tag</option>
              {BOOKING_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
              {f.tag && !BOOKING_TAGS.includes(f.tag) && <option value={f.tag}>{f.tag}</option>}
            </select>
          </div>
            <div><label className="label">Amount Paid (to hotel)</label><input type="number" min="0" className="input" value={f.amountPaid} onChange={setNum('amountPaid')} /></div>
          </div>
          <div><label className="label">Comment</label><textarea rows={2} className="input" value={f.comment} onChange={set('comment')} placeholder="Notes / follow-up…" /></div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="mb-1 text-sm font-semibold text-slate-800">Guest Details</h4>
            <p className="text-sm text-slate-700">{paxLabel}</p>
            <p className="mt-0.5 text-xs text-slate-400">Edit guest details from the trip's Overview tab.</p>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-800">Assigned Tourist</h4>
              <span className="text-xs text-gray-400">{pax?.adults || 0} Adult{(pax?.adults || 0) === 1 ? '' : 's'}</span>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <User size={14} className="shrink-0 text-slate-400" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{guestName}</p>
                  {phone0 && <p className="text-xs text-slate-400">+{phone0.countryCode || '91'}-{phone0.number}</p>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => guestPhoneDigits && window.open(`https://wa.me/${guestPhoneDigits}`, '_blank')}
                  disabled={!guestPhoneDigits}
                  className="rounded border border-slate-200 p-1.5 text-slate-400 hover:text-emerald-600 disabled:opacity-40"
                  title="Message on WhatsApp"
                >
                  <MessageCircle size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setF((s) => ({ ...s, flagged: !s.flagged }))}
                  className={cn('rounded border p-1.5', f.flagged ? 'border-amber-300 bg-amber-50 text-amber-600' : 'border-slate-200 text-slate-400 hover:text-amber-600')}
                  title="Flag for follow-up"
                >
                  <Flag size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-800">Prices</h4>
          <div className="rt-wrap overflow-hidden rounded-xl border border-slate-200">
            <table className="rt w-full text-xs">
              <thead className="bg-slate-50 text-left text-[11px] font-semibold text-slate-500">
                <tr>
                  <th className="px-2.5 py-2">Date</th>
                  <th className="px-2.5 py-2">Given</th>
                  <th className="px-2.5 py-2">Booked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {nightRates.map((n, i) => (
                  <tr key={i}>
                    <td data-card="title" className="px-2.5 py-2 align-top">
                      <div className="font-medium text-slate-700">{n.date ? format(new Date(n.date), 'd MMM') : '—'}</div>
                      <div className="text-[10px] text-slate-400">{n.date ? format(new Date(n.date), 'EEEE') : ''}</div>
                    </td>
                    <td data-th="Given" className="px-2.5 py-2 align-top text-slate-600">{money(n.given, row.currency)}</td>
                    <td data-th="Booked" className="px-2.5 py-2 align-top">
                      <input type="number" className="input py-1 text-xs" value={n.booked} onChange={(e) => updateNight(i, { booked: e.target.value })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-medium">
            <button type="button" onClick={addNextNight} className="flex items-center gap-1 text-brand-600 hover:text-brand-700"><Plus size={13} /> Next Night</button>
            <button type="button" onClick={duplicateLast} className="flex items-center gap-1 text-slate-500 hover:text-slate-700"><Copy size={13} /> Duplicate</button>
            <button type="button" onClick={removeLast} disabled={nightRates.length <= 1} className="flex items-center gap-1 text-red-500 hover:text-red-600 disabled:opacity-40"><Trash2 size={13} /> Remove</button>
          </div>
          <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-right text-sm">
            <span className="text-xs text-gray-400">Total Booked: </span>
            <span className="font-semibold text-gray-900">{money(totalBooked, row.currency)}</span>
          </div>
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </Modal>
  );
}

// Sends a hotel booking REQUEST to the supplier (the hotel) — not the guest.
// Composes a ready-to-send confirmation request with rate/billing details the
// hotel needs, since these bookings are billed to us, not paid by the guest
// on-site.
export function ShareHotelBookingModal({ row, guest, pax, queryNumber, onClose, onEdit }) {
  const { data: org } = useQuery({ queryKey: ['org-profile'], queryFn: orgProfileApi.get });
  const [tab, setTab] = useState('email');
  const [opts, setOpts] = useState({ price: true, billing: true, contact: false });
  const [subject, setSubject] = useState('');
  const [toEmail, setToEmail] = useState('');

  const builtSubject = useMemo(() => buildHotelBookingSubject(row, queryNumber), [row, queryNumber]);
  const emailHtml = useMemo(
    () => buildHotelBookingEmailHtml(row, { org, guest, pax, queryNumber, ...opts }),
    [row, org, guest, pax, queryNumber, opts]
  );
  const waText = useMemo(
    () => buildHotelBookingWhatsAppText(row, { org, guest, pax, queryNumber, ...opts }),
    [row, org, guest, pax, queryNumber, opts]
  );

  const subjectValue = subject || builtSubject;
  const copySubject = () => navigator.clipboard.writeText(subjectValue).then(() => toast.success('Subject copied'), () => toast.error('Copy failed'));
  const sendWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(waText)}`, '_blank');

  return (
    <Modal open onClose={onClose} title="Share Hotel Booking" width="max-w-2xl">
      <div className="-mx-6 -mt-2 mb-4 flex border-b border-slate-200 px-6">
        {[{ k: 'email', label: 'Email', icon: Mail }, { k: 'whatsapp', label: 'WhatsApp', icon: MessageCircle }].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={cn('flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium -mb-px',
              tab === t.k ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700')}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'email' && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700">Subject</label>
            <button onClick={copySubject} className="btn-secondary text-xs"><Copy size={12} /> Copy Subject</button>
          </div>
          <input className="input mb-4 text-sm" value={subjectValue} onChange={(e) => setSubject(e.target.value)} />
        </>
      )}

      <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-t-lg bg-slate-50 px-1 py-2">
        <span className="text-xs font-semibold text-slate-700">Body</span>
        {[['price', 'Price'], ['billing', 'Billing'], ['contact', 'Contact Detail']].map(([k, l]) => (
          <label key={k} className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600">
            <input type="checkbox" checked={opts[k]} onChange={(e) => setOpts((s) => ({ ...s, [k]: e.target.checked }))} className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600" />
            {l}
          </label>
        ))}
        {onEdit && (
          <button onClick={() => { onClose(); onEdit(row); }} className="btn-secondary ml-auto text-xs"><Pencil size={12} /> Edit Booking</button>
        )}
      </div>

      {tab === 'email' ? (
        <div className="max-h-[50vh] overflow-y-auto rounded-b-lg border border-slate-200 bg-white p-4" dangerouslySetInnerHTML={{ __html: emailHtml }} />
      ) : (
        <div className="max-h-[50vh] overflow-y-auto rounded-b-lg bg-slate-100 p-4">
          <div
            className="whitespace-pre-wrap rounded-lg bg-[#dcf8c6] p-4 text-[13px] leading-relaxed text-slate-800 shadow-sm"
            dangerouslySetInnerHTML={{ __html: whatsappToHtml(waText) }}
          />
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        {tab === 'email' ? (
          <>
            <input type="email" className="input min-w-0 flex-1 py-2 text-sm" placeholder="hotel@example.com" value={toEmail} onChange={(e) => setToEmail(e.target.value)} />
            <button
              onClick={() => window.open(`mailto:${toEmail.trim()}?subject=${encodeURIComponent(subjectValue)}&body=${encodeURIComponent(htmlToPlain(emailHtml))}`, '_blank')}
              disabled={!toEmail.trim()}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              <Send size={14} /> Open in Email App
            </button>
            <button onClick={() => copyRichHtml(emailHtml)} className="btn-primary text-sm"><Copy size={14} /> Copy Email</button>
          </>
        ) : (
          <>
            <button onClick={sendWhatsApp} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"><Send size={15} /> Send via WhatsApp</button>
            <button onClick={() => navigator.clipboard.writeText(waText).then(() => toast.success('Copied'), () => toast.error('Copy failed'))} className="btn-secondary text-sm"><Copy size={14} /> Copy</button>
          </>
        )}
      </div>
    </Modal>
  );
}

// Status only moves forward (Initialized -> Booked -> Confirmed, Dropped from
// anywhere) — clicking the badge opens the Update Booking Status modal
// instead of an inline dropdown that could revert to an earlier stage.
function StatusSelect({ row, onChange, saving }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn('cursor-pointer rounded-md border-0 px-2 py-1 text-xs font-semibold', STATUS[row.status]?.cls)}
      >
        {STATUS[row.status]?.label || row.status}
      </button>
      {open && (
        <UpdateBookingStatusModal
          row={row}
          saving={saving}
          onClose={() => setOpen(false)}
          onSave={(patch) => { onChange(patch); setOpen(false); }}
        />
      )}
    </>
  );
}

// Day-grouped operational services (Sembark-style: day chip left, service rows right).
function OperationalGroups({ rows, startDate, onStatus, onEdit, onDelete }) {
  // Older rows have no `day` — derive it from checkIn vs trip start.
  const dayOf = (r) => {
    if (r.day) return r.day;
    if (r.checkIn && startDate) {
      const diff = Math.round((new Date(r.checkIn) - new Date(startDate)) / 86400000);
      if (diff >= 0) return diff + 1;
    }
    return 0;
  };
  const byDay = new Map();
  rows.forEach((r) => {
    const d = dayOf(r);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(r);
  });
  const groups = [...byDay.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <div className="space-y-4">
      {groups.map(([day, groupRows]) => {
        const date = day && startDate ? addDays(new Date(startDate), day - 1) : (groupRows[0]?.checkIn ? new Date(groupRows[0].checkIn) : null);
        return (
          <div key={day} className="flex items-start gap-4">
            <div className="w-24 shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center">
              <p className="text-sm font-semibold text-slate-800">{day ? `${ord(day)} Day` : '—'}</p>
              {date && <p className="text-[11px] text-slate-400">{format(date, 'EEE, d MMM')}</p>}
            </div>
            <div className="card card-flush min-w-0 flex-1 divide-y divide-gray-100">
              {groupRows.map((r) => {
                const [serviceType, cabDetail] = (r.detail || '').split(' — ');
                return (
                  <div key={r._id} className="flex items-start gap-4 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-brand-700">{[r.name, serviceType].filter(Boolean).join(' - ')}</p>
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-gray-400">
                        <User size={10} /> {r.bookedBy?.name || '—'}{r.updatedAt ? ` • ${ago(r.updatedAt)}` : ''}
                      </div>
                    </div>
                    <div className="w-36 shrink-0 text-sm text-gray-600">{cabDetail || serviceType || '—'}</div>
                    <div className="w-32 shrink-0">
                      <StatusSelect row={r} onChange={(patch) => onStatus(r, patch)} />
                      {r.tag && <span className="mt-1 inline-block rounded bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-700">{r.tag}</span>}
                    </div>
                    <div className="w-32 shrink-0 text-right">
                      <span className="text-[11px] uppercase text-gray-400">Booking: </span>
                      <span className="font-semibold text-gray-900">{money(r.price, r.currency)}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 pt-0.5 text-gray-300">
                      <button onClick={() => onEdit(r)} className="hover:text-brand-600" title="Edit"><Pencil size={14} /></button>
                      <button onClick={() => onDelete(r)} className="hover:text-red-600" title="Remove"><Trash2 size={14} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ServiceBookingsTab({ queryId, quote, startDate, guest, queryNumber, pax }) {
  const [sub, setSub] = useState('hotel');
  const [editRow, setEditRow] = useState(null);
  const [shareRow, setShareRow] = useState(null);
  const [voucherRow, setVoucherRow] = useState(null);
  const qc = useQueryClient();
  const confirm = useConfirm();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['service-bookings', queryId, sub],
    queryFn: () => serviceBookingsApi.list(queryId, sub),
    enabled: !!queryId,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['service-bookings', queryId] });

  const genMut = useMutation({
    // Generate all kinds at once (no kind param) so one click fills Hotels + Operational + Flights.
    mutationFn: () => serviceBookingsApi.generate(queryId, quote._id, null),
    onSuccess: (rows) => { toast.success(rows?.length ? `Generated ${rows.length} booking line(s)` : 'Already generated'); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const updMut = useMutation({
    mutationFn: ({ id, patch }) => serviceBookingsApi.update(id, patch),
    onSuccess: () => { setEditRow(null); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id) => serviceBookingsApi.remove(id),
    onSuccess: () => { toast.success('Removed'); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const askDelete = async (row) => {
    if (await confirm({ title: 'Remove booking line?', message: `“${row.name}” will be removed from bookings.`, confirmLabel: 'Remove', danger: true })) delMut.mutate(row._id);
  };

  const title = TITLES[sub] || SUBS.find((s) => s.k === sub)?.l;
  const canGenerate = !!quote?._id;

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
      <aside className="-mx-1 flex w-full gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:w-36 lg:shrink-0 lg:flex-col lg:gap-0 lg:space-y-1 lg:overflow-visible lg:px-0 lg:pb-0">
        {SUBS.map((s) => (
          <button key={s.k} onClick={() => setSub(s.k)} className={cn('flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm lg:w-full', sub === s.k ? 'bg-brand-50 font-semibold text-brand-700' : 'text-gray-600 hover:bg-gray-50')}>
            <s.icon size={14} /> {s.l}
          </button>
        ))}
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        </div>

        {isLoading ? (
          <div className="card p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : !rows.length ? (
          <div className="card flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-sm text-gray-400">No {title.toLowerCase()} yet.</p>
            {canGenerate ? (
              <button onClick={() => genMut.mutate()} disabled={genMut.isPending} className="btn-primary text-sm"><Sparkles size={14} /> {genMut.isPending ? 'Generating…' : 'Generate from quote'}</button>
            ) : (
              <p className="text-xs text-gray-400">Accept a quote first to generate bookings.</p>
            )}
          </div>
        ) : sub === 'operational' ? (
          <OperationalGroups
            rows={rows}
            startDate={startDate}
            onStatus={(r, patch) => updMut.mutate({ id: r._id, patch })}
            onEdit={setEditRow}
            onDelete={askDelete}
          />
        ) : (
          <div className="rt-wrap card card-flush overflow-x-auto">
            <table className="rt w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">{sub === 'hotel' ? 'Hotel' : 'Service'}</th>
                  <th className="px-4 py-3">{sub === 'hotel' ? 'Stay and Services' : 'Details'}</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Tag / Comments</th>
                  <th className="px-4 py-3 text-right">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {markRepeatStays(rows).map(({ row: r, isRepeat }) => (
                  <tr key={r._id} className="align-top">
                    <td data-card="title" className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-brand-700">{r.name}</div>
                          {r.city && <div className="text-xs text-gray-400">{r.city}</div>}
                          {sub === 'hotel' && r.stars ? <StarRating value={r.stars} size={11} /> : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-2 text-gray-300">
                          <button onClick={() => setEditRow(r)} className="hover:text-brand-600" title="Edit"><Pencil size={14} /></button>
                          {sub === 'hotel' && (
                            <button onClick={() => setShareRow(r)} className="hover:text-emerald-600" title="Share booking request with the hotel"><Share2 size={14} /></button>
                          )}
                        </div>
                      </div>
                    </td>
                    <td data-th={sub === 'hotel' ? 'Stay and Services' : 'Details'} className="px-4 py-3 text-gray-600">
                      {sub === 'hotel' ? (
                        <>
                          <div className={cn('font-medium', isRepeat ? 'text-amber-700' : 'text-gray-800')}>{stayCheckInOut(r, isRepeat)}</div>
                          {r.detail && (
                            (r.nights?.length || 1) > 1
                              ? stayNightDates(r).map((d, i) => (
                                  <div key={i} className="text-xs text-gray-500">
                                    <span className="font-medium text-gray-400">{d ? `${fmtD(d)} · ` : ''}{i + 1}N - </span>{r.detail}
                                  </div>
                                ))
                              : <div className="text-xs text-gray-500">{r.detail}</div>
                          )}
                        </>
                      ) : (
                        r.detail && <div className="text-xs text-gray-500">{r.detail}</div>
                      )}
                    </td>
                    <td data-th="Status" className="px-4 py-3">
                      <StatusSelect row={r} onChange={(patch) => updMut.mutate({ id: r._id, patch })} />
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-gray-400">
                        <User size={10} /> {r.bookedBy?.name || '—'}{r.updatedAt ? ` • ${ago(r.updatedAt)}` : ''}
                      </div>
                      {sub === 'hotel' && r.status === 'booked' && (
                        <button onClick={() => setVoucherRow(r)} className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-600 hover:text-amber-700">
                          <FileText size={11} /> {r.voucherGeneratedAt ? 'Regenerate Voucher' : 'Generate Voucher'}
                        </button>
                      )}
                    </td>
                    <td data-th="Tag / Comments" className="px-4 py-3">
                      {r.tag && <span className="mb-1 inline-block rounded bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-700">{r.tag}</span>}
                      {r.comment ? <div className="text-xs text-gray-500">{r.comment}</div> : (!r.tag && <span className="text-xs text-gray-300">—</span>)}
                    </td>
                    <td data-th="Price" className="px-4 py-3 text-right">
                      <div className="text-[11px] uppercase text-gray-400">Booking</div>
                      <div className="font-semibold text-gray-900">{money(r.price, r.currency)}</div>
                      {sub === 'hotel' && (
                        <>
                          <div className="mt-1 text-[11px] uppercase text-gray-400">Amount Paid</div>
                          <div className="text-xs text-gray-600">{money(r.amountPaid, r.currency)}</div>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editRow && (editRow.kind === 'hotel' ? (
        <EditHotelBookingModal
          row={editRow}
          guest={guest}
          pax={pax}
          saving={updMut.isPending}
          onClose={() => setEditRow(null)}
          onSave={(patch) => updMut.mutate({ id: editRow._id, patch })}
        />
      ) : (
        <EditModal
          row={editRow}
          saving={updMut.isPending}
          onClose={() => setEditRow(null)}
          onSave={(patch) => updMut.mutate({ id: editRow._id, patch })}
        />
      ))}

      {shareRow && (
        <ShareHotelBookingModal
          row={shareRow}
          guest={guest}
          pax={pax}
          queryNumber={queryNumber}
          onClose={() => setShareRow(null)}
          onEdit={setEditRow}
        />
      )}

      {voucherRow && <GenerateVoucherModal row={voucherRow} onClose={() => { setVoucherRow(null); refresh(); }} />}
    </div>
  );
}

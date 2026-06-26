import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Copy, X, RefreshCw } from 'lucide-react';
import { hotelsApi } from '../../api/services.js';
import { lookupApi } from '../../api/quotes.js';
import { money } from '../../lib/pricing.js';
import AsyncSelect from '../../components/form/AsyncSelect.jsx';

let ROW_SEQ = 0;
const emptyRow = () => ({ id: ++ROW_SEQ, checkinDate: '', nights: 1, hotel: null, mealPlan: '', roomType: '', pax: 2, rooms: 0, aweb: 0, cweb: 0, cnb: 0 });

function NumField({ label, hint, value, onChange, className = '' }) {
  return (
    <div className={className}>
      <label className="label">{label} {hint && <span className="label-optional">({hint})</span>}</label>
      <input type="number" className="input" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Row({ k, v }) {
  return <div className="flex justify-between text-slate-600"><span>{k}</span><span>{v}</span></div>;
}

function CalcRow({ row, setRow, onDuplicate, onRemove, onTotal, showBooking, canRemove }) {
  const hotel = row.hotel;
  const ready = !!(hotel?._id && row.roomType && row.mealPlan && row.checkinDate);

  const { data: rate, isFetching, refetch } = useQuery({
    queryKey: ['calc-rate', hotel?._id, row.roomType, row.mealPlan, row.checkinDate],
    queryFn: () => lookupApi.hotelRate({ hotel: hotel._id, roomType: row.roomType, mealPlan: row.mealPlan, date: row.checkinDate }),
    enabled: ready,
  });

  const nights = Math.max(1, Number(row.nights) || 1);
  const rooms = Number(row.rooms) || 0;
  const perNight = rate
    ? rate.basePrice * rooms + rate.aweb * (Number(row.aweb) || 0) + rate.cweb * (Number(row.cweb) || 0) + rate.cwoeb * (Number(row.cnb) || 0)
    : null;
  const total = perNight != null ? perNight * nights : null;

  // Report this row's total upward (and clear it on unmount).
  useEffect(() => {
    onTotal(row.id, total);
    return () => onTotal(row.id, null);
  }, [row.id, total, onTotal]);

  const mealOptions = hotel?.mealPlans || [];
  const roomOptions = (hotel?.roomTypes || []).map((r) => r.name);

  return (
    <div className="card p-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-5">
            <div><label className="label">Checkin Date</label><input type="date" className="input" value={row.checkinDate} onChange={(e) => setRow({ checkinDate: e.target.value })} /></div>
            <div><label className="label">No of Nights</label><input type="number" min="1" className="input" value={row.nights} onChange={(e) => setRow({ nights: e.target.value })} /></div>
            <div className="sm:col-span-3">
              <label className="label">Hotel</label>
              <AsyncSelect
                loadOptions={(s) => hotelsApi.list({ search: s }).then((r) => r.data.map((h) => ({ _id: h._id, name: h.name, mealPlans: h.mealPlans, roomTypes: h.roomTypes })))}
                value={hotel}
                onChange={(h) => setRow({ hotel: h, mealPlan: '', roomType: '' })}
                placeholder="Type to search..."
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-5">
            <div>
              <label className="label">Meal Plan</label>
              <select className="input" value={row.mealPlan} onChange={(e) => setRow({ mealPlan: e.target.value })} disabled={!hotel}>
                <option value="">Select…</option>
                {mealOptions.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Room Type</label>
              <select className="input" value={row.roomType} onChange={(e) => setRow({ roomType: e.target.value })} disabled={!hotel}>
                <option value="">Select…</option>
                {roomOptions.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-3">
            <NumField label="Pax/room" hint="WoEB" value={row.pax} onChange={(v) => setRow({ pax: v })} />
            <NumField label="No. of rooms" value={row.rooms} onChange={(v) => setRow({ rooms: v })} />
            <NumField label="AWEB" value={row.aweb} onChange={(v) => setRow({ aweb: v })} />
            <NumField label="CWEB" value={row.cweb} onChange={(v) => setRow({ cweb: v })} />
            <NumField label="CNB" value={row.cnb} onChange={(v) => setRow({ cnb: v })} />
          </div>
        </div>

        {/* Prices panel */}
        <div className="border-t border-slate-100 pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold text-slate-900">{showBooking ? 'Booking Price' : 'Cost Price'}</span>
            {ready && <button onClick={() => refetch()} className="text-slate-400 hover:text-slate-700"><RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} /></button>}
          </div>
          {!ready ? (
            <p className="text-sm text-rose-500">Please fill all required details</p>
          ) : isFetching ? (
            <p className="text-sm text-slate-400">Calculating…</p>
          ) : !rate ? (
            <p className="text-sm text-amber-600">No rate found for this date / room / meal combination.</p>
          ) : (
            <div className="space-y-1 text-sm">
              <Row k={`Room × ${rooms}`} v={money(rate.basePrice * rooms, rate.currency)} />
              {Number(row.aweb) > 0 && <Row k={`AWEB × ${row.aweb}`} v={money(rate.aweb * row.aweb, rate.currency)} />}
              {Number(row.cweb) > 0 && <Row k={`CWEB × ${row.cweb}`} v={money(rate.cweb * row.cweb, rate.currency)} />}
              {Number(row.cnb) > 0 && <Row k={`CNB × ${row.cnb}`} v={money(rate.cwoeb * row.cnb, rate.currency)} />}
              <div className="flex justify-between border-t border-slate-100 pt-1"><span className="text-slate-500">Per night</span><span className="font-medium">{money(perNight, rate.currency)}</span></div>
              <div className="flex justify-between text-base font-bold text-slate-900"><span>× {nights} night{nights === 1 ? '' : 's'}</span><span>{money(total, rate.currency)}</span></div>
            </div>
          )}
          <div className="mt-3 flex items-center gap-3 text-sm">
            <button onClick={onDuplicate} className="flex items-center gap-1 text-brand-700 hover:underline"><Copy size={13} /> Duplicate</button>
            {canRemove && <button onClick={onRemove} className="flex items-center gap-1 text-slate-500 hover:text-red-500"><X size={13} /> Remove</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CalculatePricePage() {
  const navigate = useNavigate();
  const [showBooking, setShowBooking] = useState(false);
  const [rows, setRows] = useState([emptyRow()]);
  const totalsRef = useRef({});
  const [grandTotal, setGrandTotal] = useState(null);

  const recompute = useCallback(() => {
    const vals = Object.values(totalsRef.current).filter((v) => v != null);
    setGrandTotal(vals.length ? vals.reduce((a, b) => a + b, 0) : null);
  }, []);

  const onTotal = useCallback((id, value) => {
    if (value == null) delete totalsRef.current[id];
    else totalsRef.current[id] = value;
    recompute();
  }, [recompute]);

  const setRow = (i, patch) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const dup = (i) => setRows((rs) => [...rs, { ...rs[i], id: ++ROW_SEQ }]);
  const rm = (i) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-6 py-3 text-sm">
        <button onClick={() => navigate('/services/hotel-prices')} className="text-slate-600 hover:text-slate-900"><ArrowLeft size={18} /></button>
        <span className="font-semibold text-slate-900">Calculate Price</span>
        <span className="text-slate-400">/</span>
        <Link to="/services/hotel-prices" className="text-slate-500 hover:text-slate-800">Hotel Prices</Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-500">Calculator</span>
      </div>

      <div className="px-6 py-6">
        <p className="text-sm text-slate-600">Please enter the desired hotel configuration to get the updated rates.</p>
        <label className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={showBooking} onChange={(e) => setShowBooking(e.target.checked)} /> Show Booking Prices
        </label>

        <div className="mt-4 space-y-4">
          {rows.map((row, i) => (
            <CalcRow
              key={row.id}
              row={row}
              setRow={(patch) => setRow(i, patch)}
              onDuplicate={() => dup(i)}
              onRemove={() => rm(i)}
              onTotal={onTotal}
              showBooking={showBooking}
              canRemove={rows.length > 1}
            />
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <span className="rounded-lg bg-amber-50 px-4 py-2 text-base font-bold text-amber-700">
            Total Price: {grandTotal != null ? money(grandTotal) : 'N/A'}
          </span>
        </div>
      </div>
    </div>
  );
}

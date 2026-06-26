import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, X, Plus, Bus } from 'lucide-react';
import { transportApi, transportPricesApi } from '../../api/services.js';
import { money } from '../../lib/pricing.js';
import AsyncSelect from '../../components/form/AsyncSelect.jsx';

let BLK = 0;
const emptyBlock = () => ({ id: ++BLK, service: null, serviceType: '', startTime: '', duration: '', lines: {} });

function CalcBlock({ block, setBlock, onRemove, onTotal, date, canRemove }) {
  const service = block.service;

  const { data: rows = [] } = useQuery({
    queryKey: ['tp-rows', service?._id],
    queryFn: () => transportPricesApi.list({ service: service._id, limit: 100 }).then((r) => r.data),
    enabled: !!service?._id,
  });

  const d = date ? new Date(date) : null;
  const configs = rows.filter((r) => !d || (new Date(r.startDate) <= d && new Date(r.endDate) >= d));

  const lineFor = (r) => block.lines[r._id] || { qty: 0, given: r.price };
  const setLine = (id, patch) => setBlock({ lines: { ...block.lines, [id]: { ...(block.lines[id] || {}), ...patch } } });

  const total = configs.reduce((s, r) => {
    const l = lineFor(r);
    return s + (Number(l.qty) || 0) * (l.given === '' || l.given == null ? r.price : Number(l.given));
  }, 0);

  useEffect(() => {
    onTotal(block.id, total > 0 ? total : null);
    return () => onTotal(block.id, null);
  }, [block.id, total, onTotal]);

  const items = service?.items || [];

  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-brand-700"><Bus size={14} /> Transport Service</div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          <div>
            <label className="label">Service Locations</label>
            <AsyncSelect
              loadOptions={(s) => transportApi.list({ search: s }).then((r) => r.data.map((t) => ({ _id: t._id, name: t.to ? `${t.from || t.name} → ${t.to}` : (t.from || t.name), items: t.items })))}
              value={service}
              onChange={(v) => setBlock({ service: v, serviceType: '', lines: {} })}
              placeholder="Type to search..."
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Service Type</label>
              <select className="input" value={block.serviceType} onChange={(e) => setBlock({ serviceType: e.target.value })} disabled={!items.length}>
                <option value="">Select…</option>
                {items.map((it) => <option key={it._id || it.name}>{it.name}</option>)}
              </select>
            </div>
            <div><label className="label">Start Time</label><input className="input" value={block.startTime} onChange={(e) => setBlock({ startTime: e.target.value })} placeholder="14:00" /></div>
            <div><label className="label">Duration (Mins)</label><input type="number" className="input" value={block.duration} onChange={(e) => setBlock({ duration: e.target.value })} placeholder="60" /></div>
          </div>
        </div>

        {/* Transportation and Prices */}
        <div className="border-t border-slate-100 pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
          <p className="mb-2 font-semibold text-slate-900">Transportation and Prices</p>
          {!service ? (
            <p className="text-sm text-rose-500">Select a transport service</p>
          ) : !configs.length ? (
            <p className="text-sm text-amber-600">No rates found for this service{date ? ' on the chosen date' : ''}.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-400"><tr><th className="py-1">Type</th><th>Qty</th><th>Rate</th><th>Given</th></tr></thead>
              <tbody>
                {configs.map((r) => {
                  const l = lineFor(r);
                  return (
                    <tr key={r._id} className="border-t border-slate-100">
                      <td className="py-1.5 pr-2">{r.config || r.itemName || 'Vehicle'}</td>
                      <td className="pr-2"><input type="number" min="0" className="input w-16 px-2 py-1" value={l.qty} onChange={(e) => setLine(r._id, { qty: e.target.value })} /></td>
                      <td className="pr-2 tabular-nums text-slate-500">{money(r.price, r.currency)}</td>
                      <td><input type="number" className="input w-24 px-2 py-1" value={l.given} onChange={(e) => setLine(r._id, { given: e.target.value })} /></td>
                    </tr>
                  );
                })}
                <tr className="border-t border-slate-200 font-semibold"><td className="py-1.5" colSpan={3}>Subtotal</td><td className="tabular-nums">{money(total)}</td></tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="mt-3 flex justify-end border-t border-slate-100 pt-2">
        {canRemove && <button onClick={onRemove} className="flex items-center gap-1 text-sm text-slate-500 hover:text-red-500"><X size={13} /> Remove</button>}
      </div>
    </div>
  );
}

export default function TransportCalculatePricePage() {
  const navigate = useNavigate();
  const [date, setDate] = useState('');
  const [days, setDays] = useState(1);
  const [sameCab, setSameCab] = useState(false);
  const [blocks, setBlocks] = useState([emptyBlock()]);
  const totalsRef = useRef({});
  const [grand, setGrand] = useState(null);

  const recompute = useCallback(() => {
    const vals = Object.values(totalsRef.current).filter((v) => v != null);
    setGrand(vals.length ? vals.reduce((a, b) => a + b, 0) : null);
  }, []);
  const onTotal = useCallback((id, v) => {
    if (v == null) delete totalsRef.current[id];
    else totalsRef.current[id] = v;
    recompute();
  }, [recompute]);

  const setBlock = (i, patch) => setBlocks((bs) => bs.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const addBlock = () => setBlocks((bs) => [...bs, emptyBlock()]);
  const rm = (i) => setBlocks((bs) => bs.filter((_, idx) => idx !== i));

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-6 py-3 text-sm">
        <button onClick={() => navigate('/services/transport-prices')} className="text-slate-600 hover:text-slate-900"><ArrowLeft size={18} /></button>
        <span className="font-semibold text-slate-900">Calculate Price</span>
        <span className="text-slate-400">/</span>
        <Link to="/services/transport-prices" className="text-slate-500 hover:text-slate-800">Transport Service Prices</Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-500">Calculator</span>
      </div>

      <div className="px-6 py-6">
        <p className="text-sm text-slate-600">Please enter your transportation services and cabs to get the updated prices.</p>

        <label className="mt-3 flex items-center gap-2 rounded-lg bg-brand-50/60 px-4 py-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={sameCab} onChange={(e) => setSameCab(e.target.checked)} /> Same Cab Type for All
        </label>

        <div className="mt-4 flex flex-wrap gap-4">
          <div><label className="label">Date</label><input type="date" className="input w-44" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><label className="label">No of Days</label><input type="number" min="1" className="input w-28" value={days} onChange={(e) => setDays(e.target.value)} /></div>
        </div>

        <div className="mt-4 space-y-4">
          {blocks.map((block, i) => (
            <CalcBlock key={block.id} block={block} setBlock={(patch) => setBlock(i, patch)} onRemove={() => rm(i)} onTotal={onTotal} date={date} canRemove={blocks.length > 1} />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button onClick={addBlock} className="btn-secondary text-sm"><Plus size={14} /> Add More Services</button>
          <span className="rounded-lg bg-amber-50 px-4 py-2 text-base font-bold text-amber-700">Total Price: {grand != null ? money(grand) : 'N/A'}</span>
        </div>
      </div>
    </div>
  );
}

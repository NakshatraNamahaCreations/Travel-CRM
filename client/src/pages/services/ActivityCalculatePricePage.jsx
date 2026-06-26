import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, X, Plus, Ticket } from 'lucide-react';
import { activitiesApi, activityPricesApi } from '../../api/services.js';
import { money } from '../../lib/pricing.js';
import AsyncSelect from '../../components/form/AsyncSelect.jsx';

let BLK = 0;
const emptyBlock = () => ({ id: ++BLK, activity: null, lines: {} });

function CalcBlock({ block, setBlock, onRemove, onTotal, date, canRemove }) {
  const activity = block.activity;

  const { data: rows = [] } = useQuery({
    queryKey: ['ap-rows', activity?._id],
    queryFn: () => activityPricesApi.list({ activity: activity._id, limit: 200 }).then((r) => r.data),
    enabled: !!activity?._id,
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

  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-brand-700"><Ticket size={14} /> Travel Activity</div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          <div>
            <label className="label">Activity</label>
            <AsyncSelect
              loadOptions={(s) => activitiesApi.list({ search: s }).then((r) => r.data)}
              value={activity}
              onChange={(v) => setBlock({ activity: v, lines: {} })}
              placeholder="Type to search..."
            />
          </div>
        </div>

        {/* Tickets and Prices */}
        <div className="border-t border-slate-100 pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
          <p className="mb-2 font-semibold text-slate-900">Tickets and Prices</p>
          {!activity ? (
            <p className="text-sm text-rose-500">Select an activity</p>
          ) : !configs.length ? (
            <p className="text-sm text-amber-600">No rates found for this activity{date ? ' on the chosen date' : ''}.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-400"><tr><th className="py-1">Ticket</th><th>Config</th><th>Qty</th><th>Rate</th><th>Given</th></tr></thead>
              <tbody>
                {configs.map((r) => {
                  const l = lineFor(r);
                  return (
                    <tr key={r._id} className="border-t border-slate-100">
                      <td className="py-1.5 pr-2">{r.service || '—'}</td>
                      <td className="pr-2 text-slate-500">{r.config || '—'}</td>
                      <td className="pr-2"><input type="number" min="0" className="input w-16 px-2 py-1" value={l.qty} onChange={(e) => setLine(r._id, { qty: e.target.value })} /></td>
                      <td className="pr-2 tabular-nums text-slate-500">{money(r.price, r.currency)}</td>
                      <td><input type="number" className="input w-24 px-2 py-1" value={l.given} onChange={(e) => setLine(r._id, { given: e.target.value })} /></td>
                    </tr>
                  );
                })}
                <tr className="border-t border-slate-200 font-semibold"><td className="py-1.5" colSpan={4}>Subtotal</td><td className="tabular-nums">{money(total)}</td></tr>
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

export default function ActivityCalculatePricePage() {
  const navigate = useNavigate();
  const [date, setDate] = useState('');
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
        <button onClick={() => navigate('/services/activity-prices')} className="text-slate-600 hover:text-slate-900"><ArrowLeft size={18} /></button>
        <span className="font-semibold text-slate-900">Calculate Price</span>
        <span className="text-slate-400">/</span>
        <Link to="/services/activity-prices" className="text-slate-500 hover:text-slate-800">Travel Activity Prices</Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-500">Calculator</span>
      </div>

      <div className="px-6 py-6">
        <p className="text-sm text-slate-600">Please enter your travel activities and tickets to get the updated prices.</p>

        <div className="mt-4 flex flex-wrap gap-4">
          <div><label className="label">Date</label><input type="date" className="input w-44" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>

        <div className="mt-4 space-y-4">
          {blocks.map((block, i) => (
            <CalcBlock key={block.id} block={block} setBlock={(patch) => setBlock(i, patch)} onRemove={() => rm(i)} onTotal={onTotal} date={date} canRemove={blocks.length > 1} />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button onClick={addBlock} className="btn-secondary text-sm"><Plus size={14} /> Add More Activities</button>
          <span className="rounded-lg bg-amber-50 px-4 py-2 text-base font-bold text-amber-700">Total Price: {grand != null ? money(grand) : 'N/A'}</span>
        </div>
      </div>
    </div>
  );
}

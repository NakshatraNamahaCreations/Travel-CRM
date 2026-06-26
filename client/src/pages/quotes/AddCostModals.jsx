import { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal.jsx';
import AsyncSelect from '../../components/form/AsyncSelect.jsx';
import { hotelsApi, activitiesApi } from '../../api/services.js';
import { lookupApi } from '../../api/quotes.js';

// Add a hotel cost line — auto-pulls the applicable rate for the date.
export function AddHotelModal({ open, onClose, onAdd, date }) {
  const [hotel, setHotel] = useState(null);
  const [roomType, setRoomType] = useState('');
  const [mealPlan, setMealPlan] = useState('');
  const [nights, setNights] = useState(1);
  const [rate, setRate] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchRate = async () => {
    if (!hotel) return toast.error('Pick a hotel first');
    setLoading(true);
    try {
      const r = await lookupApi.hotelRate({ hotel: hotel._id, roomType, mealPlan, date });
      if (r) {
        setRate(r.basePrice);
        toast.success(`Rate found: ₹${r.basePrice}`);
      } else {
        toast('No matching rate — enter manually', { icon: '✏️' });
      }
    } finally {
      setLoading(false);
    }
  };

  const add = () => {
    if (!hotel) return toast.error('Pick a hotel');
    onAdd({
      category: 'hotel',
      refId: hotel._id,
      label: `${hotel.name}${roomType ? ` — ${roomType}` : ''}${mealPlan ? ` (${mealPlan})` : ''}`,
      meta: `${nights} night${nights == 1 ? '' : 's'}`,
      qty: Number(nights),
      rate: Number(rate) || 0,
    });
    setHotel(null); setRoomType(''); setMealPlan(''); setNights(1); setRate('');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Hotel">
      <div className="space-y-3">
        <div>
          <label className="label">Hotel</label>
          <AsyncSelect loadOptions={(s) => hotelsApi.list({ search: s }).then((r) => r.data)} value={hotel} onChange={(h) => { setHotel(h); setRoomType(''); setMealPlan(''); }} />
        </div>
        {hotel && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Room Type</label>
              <select className="input" value={roomType} onChange={(e) => setRoomType(e.target.value)}>
                <option value="">Any</option>
                {(hotel.roomTypes || []).map((r) => <option key={r.name}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Meal Plan</label>
              <select className="input" value={mealPlan} onChange={(e) => setMealPlan(e.target.value)}>
                <option value="">Any</option>
                {(hotel.mealPlans || []).map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label">Nights (qty)</label><input type="number" className="input" value={nights} onChange={(e) => setNights(e.target.value)} /></div>
          <div><label className="label">Rate / night</label><input type="number" className="input" value={rate} onChange={(e) => setRate(e.target.value)} /></div>
          <div className="flex items-end"><button type="button" onClick={fetchRate} className="btn-secondary w-full" disabled={loading}>{loading ? '…' : 'Auto rate'}</button></div>
        </div>
        <div className="flex justify-end pt-2"><button onClick={add} className="btn-primary">Add to quote</button></div>
      </div>
    </Modal>
  );
}

// Add an activity cost line — auto-pulls rate by ticket type + config.
export function AddActivityModal({ open, onClose, onAdd, date }) {
  const [activity, setActivity] = useState(null);
  const [service, setService] = useState('');
  const [config, setConfig] = useState('Adult');
  const [qty, setQty] = useState(1);
  const [rate, setRate] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchRate = async () => {
    if (!activity) return toast.error('Pick an activity first');
    setLoading(true);
    try {
      const r = await lookupApi.activityRate({ activity: activity._id, service, config, date });
      if (r) { setRate(r.price); toast.success(`Rate found: ₹${r.price}`); }
      else toast('No matching rate — enter manually', { icon: '✏️' });
    } finally {
      setLoading(false);
    }
  };

  const add = () => {
    if (!activity) return toast.error('Pick an activity');
    onAdd({
      category: 'activity',
      refId: activity._id,
      label: `${activity.name}${service ? ` — ${service}` : ''}`,
      meta: config,
      qty: Number(qty),
      rate: Number(rate) || 0,
    });
    setActivity(null); setService(''); setConfig('Adult'); setQty(1); setRate('');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Activity / Transfer">
      <div className="space-y-3">
        <div>
          <label className="label">Activity</label>
          <AsyncSelect loadOptions={(s) => activitiesApi.list({ search: s }).then((r) => r.data)} value={activity} onChange={(a) => { setActivity(a); setService(''); }} />
        </div>
        {activity && (
          <div>
            <label className="label">Ticket / Package</label>
            <select className="input" value={service} onChange={(e) => setService(e.target.value)}>
              <option value="">Any</option>
              {(activity.ticketTypes || []).map((t) => <option key={t.name}>{t.name}</option>)}
            </select>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label">Config</label><input className="input" value={config} onChange={(e) => setConfig(e.target.value)} /></div>
          <div><label className="label">Qty</label><input type="number" className="input" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
          <div><label className="label">Rate</label><input type="number" className="input" value={rate} onChange={(e) => setRate(e.target.value)} /></div>
        </div>
        <div className="flex items-center justify-between pt-2">
          <button type="button" onClick={fetchRate} className="btn-secondary" disabled={loading}>{loading ? '…' : 'Auto rate'}</button>
          <button onClick={add} className="btn-primary">Add to quote</button>
        </div>
      </div>
    </Modal>
  );
}

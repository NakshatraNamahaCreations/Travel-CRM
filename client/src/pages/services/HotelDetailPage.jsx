import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Ban, MapPin, ImageOff } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { hotelsApi } from '../../api/services.js';
import StarRating from '../../components/ui/StarRating.jsx';
import { cn } from '../../lib/cn.js';

const TABS = ['Details', 'Hotel Notes', 'Activities'];

function Info({ label, children }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <div className="mt-0.5 text-sm font-medium text-gray-900">{children || '—'}</div>
    </div>
  );
}

export default function HotelDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState('Details');

  const { data: h, isLoading } = useQuery({
    queryKey: ['hotel', id],
    queryFn: () => hotelsApi.get(id),
  });

  const toggle = useMutation({
    mutationFn: () => hotelsApi.update(id, { isActive: !h.isActive }),
    onSuccess: () => {
      toast.success(h.isActive ? 'Hotel disabled' : 'Hotel enabled');
      qc.invalidateQueries({ queryKey: ['hotel', id] });
      qc.invalidateQueries({ queryKey: ['hotels'] });
    },
  });

  if (isLoading) return <div className="py-20 text-center text-gray-400">Loading…</div>;
  if (!h) return <div className="py-20 text-center text-gray-500">Hotel not found.</div>;

  return (
    <div>
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-3">
        <div className="flex items-center gap-3 text-sm">
          <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900">
            <ArrowLeft size={18} />
          </button>
          <span className="font-semibold text-gray-900">Hotel Details</span>
          <span className="text-gray-400">/</span>
          <Link to="/services/hotels" className="text-gray-500 hover:text-gray-800">Hotels</Link>
          <span className="text-gray-400">/</span>
          <span className="text-gray-500">{h.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/services/hotels/${id}/edit`} className="btn-secondary text-sm">
            <Pencil size={14} /> Edit
          </Link>
          <button onClick={() => toggle.mutate()} className="btn-secondary text-sm" disabled={toggle.isPending}>
            <Ban size={14} /> {h.isActive ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="grid gap-6 md:grid-cols-[1fr_280px]">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{h.name}</h1>
              {!h.isActive && <span className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-600">Disabled</span>}
            </div>
            <div className="mt-3 grid max-w-xl gap-3">
              <Info label="Location">{h.locationLabel}</Info>
              <Info label="Category"><StarRating value={h.stars} /></Info>
              <Info label="Address">{h.address}</Info>
            </div>
          </div>

          <div>
            <div className="flex h-44 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
              {h.imageUrl ? (
                <img src={h.imageUrl} alt={h.name} className="h-full w-full object-cover" />
              ) : (
                <ImageOff className="text-gray-300" size={40} />
              )}
            </div>
            <button className="btn-secondary mt-2 w-full text-sm">Update Image</button>
          </div>
        </div>

        <div className="mt-8 border-b border-gray-200">
          <div className="flex gap-6">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'border-b-2 pb-2 text-sm font-medium',
                  tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-800'
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {tab === 'Details' && (
          <div className="mt-6 grid gap-x-10 gap-y-6 md:grid-cols-2 lg:grid-cols-4">
            <Info label="Available Meal Plans">{(h.mealPlans || []).join(' • ') || '—'}</Info>
            <Info label="Check-In / Check-Out">{h.checkIn} hrs / {h.checkOut} hrs</Info>
            <Info label="Extra bed child ages">From {h.childEbAge?.from} to {h.childEbAge?.to} years</Info>
            <Info label="Payment Preference">{h.paymentPreference || 'Not Set'}</Info>

            <div className="md:col-span-2">
              <p className="text-xs uppercase tracking-wide text-gray-400">Available Room Types</p>
              <div className="mt-1 space-y-1">
                {(h.roomTypes || []).map((r) => (
                  <div key={r.name} className="text-sm font-medium text-gray-900">
                    {r.name}{' '}
                    <span className="text-xs font-normal text-gray-400">
                      ({r.eb} EBs • {r.aweb} AWEBs • {r.cweb} CWEBs)
                    </span>
                  </div>
                ))}
                {!h.roomTypes?.length && <span className="text-sm text-gray-400">—</span>}
              </div>
            </div>

            <Info label="Trip Destinations">
              <span className="inline-flex items-center gap-1">
                <MapPin size={13} className="text-gray-400" />
                {(h.destinations || []).map((d) => d.name).join(', ') || '—'}
              </span>
            </Info>

            <div className="md:col-span-4">
              <Link to={`/services/hotel-prices?hotel=${h._id}`} className="btn-primary text-sm">
                View / Add Prices
              </Link>
            </div>
          </div>
        )}

        {tab === 'Hotel Notes' && (
          <div className="mt-6 text-sm text-gray-700">{h.notes || 'No notes added.'}</div>
        )}
        {tab === 'Activities' && (
          <div className="mt-6 text-sm text-gray-400">Linked activities coming with the itinerary module.</div>
        )}

        <p className="mt-8 text-xs text-gray-400">
          Created on {format(new Date(h.createdAt), 'd MMM, yyyy')}
        </p>
      </div>
    </div>
  );
}

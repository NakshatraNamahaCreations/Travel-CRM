import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MapPin, ImageOff } from 'lucide-react';
import { transportApi } from '../../api/services.js';

export default function TransportDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: t, isLoading } = useQuery({ queryKey: ['transport', id], queryFn: () => transportApi.get(id) });

  if (isLoading) return <div className="py-20 text-center text-gray-400">Loading…</div>;
  if (!t) return <div className="py-20 text-center text-gray-500">Service not found.</div>;

  return (
    <div>
      <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-6 py-3 text-sm">
        <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900"><ArrowLeft size={18} /></button>
        <span className="font-semibold text-gray-900">Service Details</span>
        <span className="text-gray-400">/</span>
        <Link to="/services/transport" className="text-gray-500 hover:text-gray-800">Transport Services</Link>
        <span className="text-gray-400">/</span>
        <span className="text-gray-500">{t.name}</span>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.name}</h1>
            {t.to && <p className="text-sm text-gray-500">{t.from} → {t.to}</p>}
            <p className="mt-2 text-xs uppercase tracking-wide text-gray-400">Trip Destinations</p>
            <p className="inline-flex items-center gap-1 text-sm font-medium text-gray-900">
              <MapPin size={13} className="text-gray-400" />{(t.destinations || []).map((d) => d.name).join(', ') || '—'}
            </p>
          </div>
          <Link to={`/services/transport-prices?service=${t._id}`} className="btn-secondary text-sm">View Prices</Link>
        </div>

        <h2 className="mt-8 text-lg font-semibold text-gray-900">Services</h2>
        <div className="mt-3 space-y-3">
          {(t.items || []).map((it) => (
            <div key={it._id || it.name} className="card flex items-start justify-between gap-4 p-4">
              <div>
                <h3 className="font-semibold text-gray-900">{t.name} - {it.name}</h3>
                {it.description && <p className="mt-1 text-sm text-gray-600">{it.description}</p>}
                {!it.isActive && <span className="mt-1 inline-block rounded bg-red-50 px-2 py-0.5 text-xs text-red-600">Disabled</span>}
              </div>
              <div className="flex h-20 w-28 items-center justify-center rounded-lg border border-gray-100 bg-gray-50">
                {it.imageUrl ? <img src={it.imageUrl} alt="" className="h-full w-full rounded-lg object-cover" /> : <ImageOff size={22} className="text-gray-300" />}
              </div>
            </div>
          ))}
          {!t.items?.length && <p className="text-sm text-gray-400">No services added yet.</p>}
        </div>
      </div>
    </div>
  );
}

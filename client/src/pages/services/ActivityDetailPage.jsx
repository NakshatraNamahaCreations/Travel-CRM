import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MapPin, Ticket } from 'lucide-react';
import { activitiesApi } from '../../api/services.js';

export default function ActivityDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: a, isLoading } = useQuery({ queryKey: ['activity', id], queryFn: () => activitiesApi.get(id) });

  if (isLoading) return <div className="py-20 text-center text-gray-400">Loading…</div>;
  if (!a) return <div className="py-20 text-center text-gray-500">Activity not found.</div>;

  return (
    <div>
      <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-6 py-3 text-sm">
        <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900"><ArrowLeft size={18} /></button>
        <span className="font-semibold text-gray-900">Activity Details</span>
        <span className="text-gray-400">/</span>
        <Link to="/services/activities" className="text-gray-500 hover:text-gray-800">Travel Activities</Link>
        <span className="text-gray-400">/</span>
        <span className="text-gray-500">{a.name}</span>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{a.name}</h1>
            <p className="mt-2 inline-flex items-center gap-1 text-sm text-gray-600">
              <MapPin size={13} className="text-gray-400" />{(a.destinations || []).map((d) => d.name).join(', ') || '—'}
            </p>
            <p className="text-sm text-gray-500">Age config: {a.ageConfig}</p>
          </div>
          <Link to={`/services/activity-prices?activity=${a._id}`} className="btn-secondary text-sm">View Prices</Link>
        </div>

        <h2 className="mt-8 text-lg font-semibold text-gray-900">Ticket / Packages</h2>
        <div className="mt-3 space-y-3">
          {(a.ticketTypes || []).map((t) => (
            <div key={t._id || t.name} className="card p-4">
              <h3 className="flex items-center gap-2 font-semibold text-gray-900"><Ticket size={15} className="text-brand-500" /> {t.name}</h3>
              {t.details && <p className="mt-1 text-sm text-gray-600">{t.details}</p>}
            </div>
          ))}
          {!a.ticketTypes?.length && <p className="text-sm text-gray-400">No ticket types added yet.</p>}
        </div>
      </div>
    </div>
  );
}

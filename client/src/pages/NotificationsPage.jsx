import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Trash2, BookOpen, CreditCard, MessageSquare, Calendar, Package, RefreshCw, X } from 'lucide-react';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import toast from 'react-hot-toast';
import { notificationsApi } from '../api/notifications.js';
import { cn } from '../lib/cn.js';

const TYPE_META = {
  booking_created:  { icon: BookOpen,      color: 'text-blue-500',   bg: 'bg-blue-50'   },
  payment_received: { icon: CreditCard,    color: 'text-green-500',  bg: 'bg-green-50'  },
  comment_added:    { icon: MessageSquare, color: 'text-amber-500',  bg: 'bg-amber-50'  },
  query_assigned:   { icon: Calendar,      color: 'text-purple-500', bg: 'bg-purple-50' },
  instalment_due:   { icon: Calendar,      color: 'text-red-500',    bg: 'bg-red-50'    },
  booking_status:   { icon: BookOpen,      color: 'text-indigo-500', bg: 'bg-indigo-50' },
  quote_accepted:   { icon: Package,       color: 'text-teal-500',   bg: 'bg-teal-50'   },
};

function groupByDate(items) {
  const groups = [];
  const map = new Map();
  for (const item of items) {
    const d = new Date(item.createdAt);
    const key = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'd MMM yyyy');
    if (!map.has(key)) { map.set(key, []); groups.push({ key, items: map.get(key) }); }
    map.get(key).push(item);
  }
  return groups;
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState('all'); // all | unread
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notifications', filter],
    queryFn: () => notificationsApi.list({ limit: 50, unread: filter === 'unread' ? 'true' : undefined }),
  });

  const items  = data?.data || [];
  const unread = data?.meta?.unread ?? 0;
  const groups = groupByDate(items);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['notifications'] });
    qc.invalidateQueries({ queryKey: ['notifications-count'] });
  };

  const markRead = useMutation({
    mutationFn: (id) => notificationsApi.markRead(id),
    onSuccess: invalidate,
  });

  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => { toast.success('All marked as read'); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id) => notificationsApi.remove(id),
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  });

  const clearAll = useMutation({
    mutationFn: () => notificationsApi.clearAll(),
    onSuccess: () => { toast.success('Read notifications cleared'); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Bell size={20} className="text-brand-600" /> Notifications
            {unread > 0 && (
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{unread}</span>
            )}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">{data?.meta?.total ?? 0} total</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
            <RefreshCw size={13} /> Refresh
          </button>
          {unread > 0 && (
            <button onClick={() => markAll.mutate()} disabled={markAll.isPending} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              <CheckCheck size={13} /> Mark all read
            </button>
          )}
          <button onClick={() => clearAll.mutate()} disabled={clearAll.isPending} className="flex items-center gap-1.5 rounded-lg border border-red-100 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50">
            <Trash2 size={13} /> Clear read
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mb-5 flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 w-fit">
        {['all', 'unread'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn('rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition', filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
          >
            {f}{f === 'unread' && unread > 0 ? ` (${unread})` : ''}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="py-20 text-center text-slate-400">Loading…</div>
      ) : !items.length ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-20 text-center">
          <Bell size={40} className="mb-3 text-slate-200" />
          <p className="font-medium text-slate-500">{filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}</p>
          <p className="mt-1 text-sm text-slate-400">Notifications appear here when bookings, payments and comments are created.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ key, items: groupItems }) => (
            <div key={key}>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">{key}</p>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                {groupItems.map((n) => {
                  const meta = TYPE_META[n.type] || TYPE_META.booking_created;
                  const Icon = meta.icon;
                  const content = (
                    <div
                      className={cn('flex items-start gap-3 px-4 py-3.5 transition hover:bg-slate-50', !n.read && 'bg-blue-50/40')}
                      onClick={() => { if (!n.read) markRead.mutate(n._id); }}
                    >
                      <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', meta.bg)}>
                        <Icon size={17} className={meta.color} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn('text-[13.5px] leading-snug', n.read ? 'text-slate-600' : 'font-semibold text-slate-900')}>
                            {n.title}
                          </p>
                          <div className="flex shrink-0 items-center gap-2">
                            {!n.read && <span className="h-2 w-2 rounded-full bg-blue-500" />}
                            <button
                              onClick={(e) => { e.stopPropagation(); e.preventDefault(); remove.mutate(n._id); }}
                              className="text-slate-300 hover:text-red-400"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                        {n.body && <p className="mt-0.5 text-xs text-slate-500">{n.body}</p>}
                        <p className="mt-1 text-[11px] text-slate-400">
                          {n.createdBy?.name && <span>{n.createdBy.name} · </span>}
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  );
                  return (
                    <div key={n._id} className="cursor-pointer">
                      {n.link ? <Link to={n.link}>{content}</Link> : content}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

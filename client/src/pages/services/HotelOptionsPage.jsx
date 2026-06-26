import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, Search, RefreshCw, MoreVertical, X, Ban, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { optionsApi } from '../../api/options.js';
import { destinationsApi } from '../../api/masterData.js';
import { useDebounced } from '../../hooks/useDebounced.js';
import { cn } from '../../lib/cn.js';
import Modal from '../../components/ui/Modal.jsx';
import AsyncSelect from '../../components/form/AsyncSelect.jsx';
import { useConfirm } from '../../components/ui/ConfirmProvider.jsx';

// Reusable manager for a hotel option category (Hotel Groups / Meal Plans / Room Types / Payment Preferences).
export default function HotelOptionsPage({ config }) {
  const {
    category, title, addLabel = 'Add New', valueHeader = 'Name',
    showDescription = false, showCreatedBy = false, bulkDelete = false,
    countLabel = 'Hotels', valuePlaceholder = 'Name',
    backTo = '/services/hotels', hideCount = false,
  } = config;

  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [disabledOnly, setDisabledOnly] = useState(false);
  const debounced = useDebounced(search);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['option-usage', category, debounced, disabledOnly],
    queryFn: () => optionsApi.usage(category, debounced, disabledOnly),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['option-usage', category] });

  const delMut = useMutation({
    mutationFn: (id) => optionsApi.remove(id),
    onSuccess: () => { toast.success('Deleted'); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const toggleMut = useMutation({
    mutationFn: (o) => optionsApi.update(o._id, { isActive: o.isActive === false }),
    onSuccess: (_d, o) => { toast.success(o.isActive === false ? 'Enabled' : 'Disabled'); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const bulkMut = useMutation({
    mutationFn: () => optionsApi.bulkDeleteUnused(category),
    onSuccess: (r) => { toast.success(`Deleted ${r.deleted} unused`); refresh(); setMenuOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const askDelete = async (o) => { if (await confirm({ title: 'Delete this item?', message: `“${o.value}” will be permanently removed.` })) delMut.mutate(o._id); };

  return (
    <div className="px-6 py-5">
      <div className="mb-1 flex items-center gap-2 text-sm text-slate-400">
        <button onClick={() => navigate(backTo)} className="hover:text-slate-700"><ArrowLeft size={16} /></button>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        <div className="flex items-center gap-2">
          {config.cabBuilder && (
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              <input type="checkbox" checked={disabledOnly} onChange={(e) => setDisabledOnly(e.target.checked)} /> Disabled Only
            </label>
          )}
          <button onClick={() => setShowAdd(true)} className="btn-primary text-sm"><Plus size={15} /> {addLabel}</button>
          {bulkDelete && (
            <div className="relative">
              <button onClick={() => setMenuOpen((o) => !o)} className="btn-secondary px-2"><MoreVertical size={16} /></button>
              {menuOpen && (
                <div className="absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
                  <button
                    onClick={async () => { if (await confirm({ title: 'Delete unused room types?', message: 'Every room type not used by any hotel will be permanently deleted.' })) bulkMut.mutate(); }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                  ><Trash2 size={14} /> Bulk Delete Unused Rooms</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5">
        <Search size={15} className="text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="w-full text-sm outline-none" />
      </div>

      <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
        Showing {items.length} {items.length === 1 ? 'Item' : 'Items'}
        <button onClick={refresh} className="text-slate-400 hover:text-slate-700"><RefreshCw size={14} /></button>
      </div>

      <div className="card card-flush overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs font-semibold text-slate-600">
            <tr>
              <th className="px-4 py-3">{valueHeader}</th>
              {showDescription && <th className="px-4 py-3">Description</th>}
              {!hideCount && <th className="px-4 py-3">{countLabel}</th>}
              {showCreatedBy && <th className="px-4 py-3">Created By</th>}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={5} className="py-12 text-center text-slate-400">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="py-12 text-center text-slate-400">No items yet.</td></tr>
            ) : items.map((o) => (
              <tr key={o._id} className={cn('hover:bg-slate-50', o.isActive === false && 'opacity-60')}>
                <td className="px-4 py-3 font-medium text-brand-700">
                  {config.cabBuilder
                    ? <button onClick={() => setEditItem(o)} className="text-left hover:underline">{o.value}</button>
                    : o.value}
                  {o.isActive === false && <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-500">Disabled</span>}
                </td>
                {showDescription && <td className="px-4 py-3 text-slate-600">{o.description || '—'}</td>}
                {!hideCount && <td className="px-4 py-3 text-slate-700">{o.hotels ?? 0}</td>}
                {showCreatedBy && <td className="px-4 py-3 text-slate-500">{o.createdBy?.name || '—'}{o.createdAt ? ` · ${format(new Date(o.createdAt), 'd MMM yyyy')}` : ''}</td>}
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    {config.cabBuilder && (
                      <button
                        onClick={() => toggleMut.mutate(o)}
                        title={o.isActive === false ? 'Enable' : 'Disable'}
                        className="text-slate-400 hover:text-slate-700"
                      >{o.isActive === false ? <RotateCcw size={15} /> : <Ban size={15} />}</button>
                    )}
                    {config.rowKebab
                      ? <RowKebab onDelete={() => askDelete(o)} />
                      : <button onClick={() => askDelete(o)} className="text-slate-400 hover:text-red-500"><Trash2 size={15} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (config.preferenceBuilder ? (
        <PaymentPreferenceModal category={category} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); refresh(); }} />
      ) : config.cabBuilder ? (
        <CabTypeModal category={category} valuePlaceholder={valuePlaceholder} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); refresh(); }} />
      ) : (
        <AddOptionModal
          category={category} title={addLabel} valueHeader={valueHeader}
          valuePlaceholder={valuePlaceholder} showDescription={showDescription}
          onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); refresh(); }}
        />
      ))}

      {editItem && (
        <CabTypeModal
          category={category} item={editItem} valuePlaceholder={valuePlaceholder}
          onClose={() => setEditItem(null)} onSaved={() => { setEditItem(null); refresh(); }}
        />
      )}
    </div>
  );
}

// Add / edit a cab type with its trip destinations, total capacity and child age.
function CabTypeModal({ category, item, valuePlaceholder, onClose, onSaved }) {
  const isEdit = !!item;
  const [name, setName] = useState(item?.value || '');
  const [destinations, setDestinations] = useState(item?.destinations || []);
  const [capacity, setCapacity] = useState(item?.capacity ?? '');
  const [childAge, setChildAge] = useState(item?.childAge ?? '');

  const valid = name.trim() && destinations.length > 0 && capacity !== '' && childAge !== '';

  const mut = useMutation({
    mutationFn: () => {
      const attrs = {
        destinations: destinations.map((d) => d._id ?? d.id ?? d),
        capacity: Number(capacity),
        childAge: Number(childAge),
      };
      return isEdit
        ? optionsApi.update(item._id, { value: name.trim(), ...attrs })
        : optionsApi.create(category, name.trim(), undefined, attrs);
    },
    onSuccess: () => { toast.success('Saved'); onSaved(); },
    onError: (e) => toast.error(e.message),
  });

  const submit = () => {
    if (!valid) return toast.error('Fill in name, trip destinations, total capacity and child age');
    return mut.mutate();
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit Cab Type' : 'New Cab Type'} width="max-w-lg">
      <div className="space-y-3">
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={valuePlaceholder} autoFocus />
        </div>
        <div>
          <label className="label">Trip Destinations</label>
          <AsyncSelect
            loadOptions={destinationsApi.search} value={destinations} onChange={setDestinations}
            isMulti creatable onCreate={(n) => destinationsApi.create({ name: n })} placeholder="Type to search..."
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Total Capacity</label>
            <input type="number" min="1" className="input" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="1" />
          </div>
          <div>
            <label className="label">Child Age</label>
            <input type="number" min="0" className="input" value={childAge} onChange={(e) => setChildAge(e.target.value)} placeholder="1" />
          </div>
        </div>
        <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
          <button onClick={submit} disabled={mut.isPending} className="btn-primary">{mut.isPending ? 'Saving…' : 'Save Details'}</button>
          <button onClick={onClose} className="text-sm font-medium text-slate-600 hover:text-slate-900">Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

function AddOptionModal({ category, title, valueHeader, valuePlaceholder, showDescription, onClose, onSaved }) {
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const mut = useMutation({
    mutationFn: () => optionsApi.create(category, value.trim(), showDescription ? description.trim() : undefined),
    onSuccess: () => { toast.success('Saved'); onSaved(); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Modal open onClose={onClose} title={title} width="max-w-lg">
      <div className="space-y-3">
        <div>
          <label className="label">{valueHeader}</label>
          <input className="input" value={value} onChange={(e) => setValue(e.target.value)} placeholder={valuePlaceholder} autoFocus />
        </div>
        {showDescription && (
          <div>
            <label className="label">Description <span className="label-optional">(optional)</span></label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Dinner + Breakfast" />
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => value.trim() && mut.mutate()} disabled={mut.isPending} className="btn-primary">{mut.isPending ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </Modal>
  );
}

function RowKebab({ onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div className="relative inline-block" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="text-slate-400 hover:text-slate-700"><MoreVertical size={16} /></button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-32 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
          <button onClick={() => { setOpen(false); onDelete(); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"><Trash2 size={14} /> Delete</button>
        </div>
      )}
    </div>
  );
}

const REFERENCES = [
  'Booking Date', 'Checkin Date', 'Checkout Date',
  'Booking Month End', 'Checkin Month End', 'Checkout Month End',
  'Trip Start', 'Trip End',
];
const emptyPrefRow = () => ({ reference: 'Checkin Date', offset: 0, share: '' });

function formatPrefRow(r) {
  const share = Number(r.share) || 0;
  const off = Number(r.offset) || 0;
  const ref = r.reference || 'Checkin Date';
  let when;
  if (off === 0) when = `on ${ref}`;
  else if (off < 0) when = `${Math.abs(off)} day${Math.abs(off) === 1 ? '' : 's'} before ${ref}`;
  else when = `${off} day${off === 1 ? '' : 's'} after ${ref}`;
  return `${share}% ${when}`;
}

// Sembark-style "New Preference" builder: compose a description from instalment rows.
function PaymentPreferenceModal({ category, onClose, onSaved }) {
  const [rows, setRows] = useState([{ reference: 'Booking Date', offset: 0, share: 50 }]);
  const setRow = (i, patch) => setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows([...rows, emptyPrefRow()]);
  const rmRow = (i) => setRows(rows.filter((_, idx) => idx !== i));

  const valid = rows.filter((r) => r.reference && r.share !== '' && Number(r.share) > 0);
  const description = valid.map(formatPrefRow).join(', ');
  const totalShare = valid.reduce((s, r) => s + (Number(r.share) || 0), 0);

  const mut = useMutation({
    mutationFn: () => optionsApi.create(category, description),
    onSuccess: () => { toast.success('Preference saved'); onSaved(); },
    onError: (e) => toast.error(e.message),
  });
  const submit = () => {
    if (!valid.length) return toast.error('Add at least one instalment with a reference and amount share');
    return mut.mutate();
  };

  return (
    <Modal open onClose={onClose} title="New Preference" width="max-w-2xl">
      <div className="space-y-4">
        <p className="text-sm font-semibold text-slate-800">Please provide the details for the new payment preference that you need for a hotel.</p>
        <p className="text-xs text-slate-500"><b>For example:</b> 100% 2 days before Checkin. Here Checkin is <i>Reference</i>, 2 Days is the <i>offset (negative)</i> and 100% is the <i>Amount Share</i>.</p>

        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500">
            <div className="col-span-5">Reference Event</div>
            <div className="col-span-3">Day offset from reference</div>
            <div className="col-span-3">Amount share from total amount</div>
            <div className="col-span-1" />
          </div>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-2">
              <select className="input col-span-5" value={r.reference} onChange={(e) => setRow(i, { reference: e.target.value })}>
                <option value="">Select a reference…</option>
                {REFERENCES.map((x) => <option key={x}>{x}</option>)}
              </select>
              <input type="number" className="input col-span-3" value={r.offset} onChange={(e) => setRow(i, { offset: e.target.value })} placeholder="0" />
              <div className="col-span-3 flex items-center gap-1">
                <input type="number" className="input" value={r.share} onChange={(e) => setRow(i, { share: e.target.value })} placeholder="50" />
                <span className="text-slate-400">%</span>
              </div>
              <div className="col-span-1 text-right">
                {rows.length > 1 && <button type="button" onClick={() => rmRow(i)} className="text-slate-400 hover:text-red-500"><X size={16} /></button>}
              </div>
            </div>
          ))}
          <button type="button" onClick={addRow} className="btn-secondary text-sm"><Plus size={14} /> Add More</button>
        </div>

        {description && (
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-400">Preview: </span>
            <span className="font-medium text-slate-800">{description}</span>
            {totalShare !== 100 && <span className="ml-2 text-xs text-amber-600">(shares total {totalShare}%, not 100%)</span>}
          </div>
        )}

        <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
          <button onClick={submit} disabled={mut.isPending} className="btn-primary">{mut.isPending ? 'Saving…' : 'Save Preference'}</button>
          <button onClick={onClose} className="text-sm font-medium text-slate-600 hover:text-slate-900">Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

// Route configs
export const HOTEL_OPTION_CONFIGS = {
  groups: { category: 'hotelGroup', title: 'Hotel Groups', addLabel: 'New Group', valueHeader: 'Name', valuePlaceholder: 'e.g. Taj', countLabel: 'Hotels' },
  'meal-plans': { category: 'mealPlan', title: 'Meal Plans', addLabel: 'New Meal Plan', valueHeader: 'Name', valuePlaceholder: 'e.g. CP', showDescription: true, countLabel: 'Hotels' },
  'room-types': { category: 'roomType', title: 'Room Types', addLabel: 'New Room Type', valueHeader: 'Name', valuePlaceholder: 'e.g. Deluxe Room', showDescription: true, bulkDelete: true, countLabel: 'Hotels' },
  'payment-preferences': { category: 'paymentPreference', title: 'Hotel Payment Preferences', addLabel: 'Add New', valueHeader: 'Description', preferenceBuilder: true, showCreatedBy: true, rowKebab: true, countLabel: 'Suppliers' },
};

// Cab / vehicle types, managed from the Transport Services page.
export const CAB_TYPES_CONFIG = { category: 'vehicleType', title: 'Cab Types', addLabel: 'New Cab Type', valueHeader: 'Name', valuePlaceholder: 'e.g. 17 Seater Tempo Traveller', hideCount: true, cabBuilder: true, backTo: '/services/transport' };

import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, UploadCloud, FileSpreadsheet, CheckCircle2, Copy, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { importApi } from '../../api/services.js';
import { destinationsApi } from '../../api/masterData.js';
import AsyncSelect from '../../components/form/AsyncSelect.jsx';

const TEMPLATE = [
  ['Name', 'Service', 'Description', 'Open Time', 'Close Time', 'Duration(Mins)', 'Slots', 'Season 1 (Ops): 1 Jul 2026 - 30 Sep 2026', '', 'Season 2: 13 Oct 2026 - 24 Oct 2026', ''],
  ['', '', '', '', '', '', '', 'Adult', 'Child (6-12)', 'Adult', 'Child (6-12)'],
  ['Port Blair To Havelock', 'Private Catamaran Ferry : Premium', 'Details for this Activity Service', '08:00', '16:00', '90', '08:00,10:45', '2200', '3000', '2500', '3500'],
  ['', 'Private Catamaran Ferry : Deluxe', '', '', '(Mon)', '90', '', '3000', '4000', '3500', '4500'],
  ['Havelock To Neil Island', 'Private Catamaran Ferry', '', '', '-', '120', '-', '2100', '3200', '2500', '3500'],
];

export default function UploadActivityPricesPage() {
  const navigate = useNavigate();
  const [destinations, setDestinations] = useState([]);
  const [files, setFiles] = useState([]);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const mut = useMutation({
    mutationFn: async () => {
      const destIds = destinations.map((d) => d._id);
      const out = [];
      for (const f of files) {
        // eslint-disable-next-line no-await-in-loop
        out.push(await importApi.upload(f, 'activities', destIds));
      }
      return out;
    },
    onSuccess: (out) => {
      const totals = out.reduce((a, s) => ({ activities: a.activities + (s.activities || 0), priceRows: a.priceRows + (s.priceRows || 0) }), { activities: 0, priceRows: 0 });
      setResult(totals);
      toast.success('Prices uploaded');
    },
    onError: (e) => toast.error(e.message || 'Upload failed'),
  });

  const pick = (list) => {
    const arr = Array.from(list || []).filter((f) => /\.(csv|xlsx|xls)$/i.test(f.name));
    if (!arr.length) return toast.error('Please choose .csv / .xlsx file(s)');
    setFiles((prev) => [...prev, ...arr]);
    setResult(null);
  };

  const copyTemplate = () => {
    const csv = TEMPLATE.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    navigator.clipboard.writeText(csv).then(() => toast.success('Template copied'), () => toast.error('Copy failed'));
  };

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-6 py-3 text-sm">
        <button onClick={() => navigate('/services/activity-prices')} className="text-slate-600 hover:text-slate-900"><ArrowLeft size={18} /></button>
        <span className="font-semibold text-slate-900">Upload Activity Prices</span>
        <span className="text-slate-400">/</span>
        <Link to="/services/activity-prices" className="text-slate-500 hover:text-slate-800">Activity Prices</Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-500">Upload CSV</span>
      </div>

      <div className="px-6 py-6">
        <div className="max-w-3xl space-y-5">
          <div>
            <label className="label">Trip Destinations</label>
            <AsyncSelect loadOptions={destinationsApi.search} value={destinations} onChange={setDestinations} isMulti creatable onCreate={(name) => destinationsApi.create({ name })} placeholder="Type to search..." />
            <p className="mt-1 text-xs text-slate-400">Imported activities will be tagged with these destinations.</p>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="label">Currency</label>
              <span className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700">INR</span>
            </div>
            <div className="flex-1">
              <label className="label">Select a csv file</label>
              <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" multiple className="hidden" onChange={(e) => pick(e.target.files)} />
              <button onClick={() => inputRef.current?.click()} className="flex w-full items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:border-brand-400">
                <UploadCloud size={16} className="text-slate-400" /> {files.length ? `${files.length} file(s) selected` : 'Choose File — no file selected'}
              </button>
              <p className="mt-1 text-xs text-slate-400">All prices will be saved in "INR" currency.</p>
            </div>
          </div>

          {files.length > 0 && (
            <div className="space-y-1">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
                  <FileSpreadsheet size={14} className="text-brand-600" />
                  <span className="flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-slate-400">{(f.size / 1024).toFixed(0)} KB</span>
                  <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button onClick={() => mut.mutate()} disabled={!files.length || mut.isPending} className="btn-primary">{mut.isPending ? 'Uploading…' : 'Upload Travel Activity Prices CSV'}</button>
            <button onClick={() => navigate('/services/activity-prices')} className="text-sm font-medium text-slate-600 hover:text-slate-900">Cancel</button>
          </div>

          {result && (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
              <div className="flex items-center gap-2 text-green-800"><CheckCircle2 size={18} /> <span className="font-semibold">Upload complete</span></div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Stat n={result.activities} label="Activities" />
                <Stat n={result.priceRows} label="Price Rows" />
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 rounded-2xl bg-slate-50 p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">CSV File Format</h2>
            <button onClick={copyTemplate} className="btn-secondary text-sm"><Copy size={14} /> Copy Template Format</button>
          </div>
          <p className="mb-3 max-w-3xl text-sm text-slate-500">
            When creating your CSV file for travel activity prices, follow this format. Each row has a <b>Name</b>, <b>Service</b> (ticket/package), optional <b>Description, Open Time, Close Time, Duration, Slots</b>, then one block of <b>Adult / Child</b> columns per season date-range. Leave the Name blank to add another service under the previous activity.
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-xs">
              <tbody>
                {TEMPLATE.map((row, ri) => (
                  <tr key={ri} className={ri < 2 ? 'bg-slate-100 font-semibold text-slate-600' : 'border-t border-slate-100'}>
                    {row.map((cell, ci) => <td key={ci} className="whitespace-nowrap px-3 py-1.5">{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ n, label }) {
  return (
    <div className="rounded-lg bg-white p-3 text-center">
      <p className="text-2xl font-bold text-slate-900">{n}</p>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}

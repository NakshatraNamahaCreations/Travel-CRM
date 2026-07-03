import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, UploadCloud, FileSpreadsheet, CheckCircle2, Download, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { importApi } from '../../api/services.js';
import { destinationsApi } from '../../api/masterData.js';
import AsyncSelect from '../../components/form/AsyncSelect.jsx';
import { downloadCsv } from '../../lib/downloadCsv.js';

const TEMPLATE = [
  ['Duty Code', 'A', 'B', 'Service', 'Distance', 'Start Time', 'Duration(mins)', 'Day Schedule', 'Season 1 (Ops): 1 Jul 2026 - 30 Sep 2026', '', 'Season 2: 13 Oct 2026 - 24 Oct 2026', ''],
  ['', '', '', '', '', '', '', '', 'Wagon R (3 Pax)', 'Innova/Xylo', 'Wagon R', 'Toyota'],
  ['101', 'Bagdogra Airport (BDG Arpt)', 'Gangtok (GTK)', 'Pickup', '90', '08:30', '210', 'Upon your arrival at NJP / Bagdogra…', '2000', '3000', '3000', '4000'],
  ['102', 'Gangtok (GTK)', '', 'Sightseeing', '40', '', '90', '', '4000', '2000', '3000', '4000'],
  ['103', 'Gangtok (GTK)', 'Pelling (PLG)', 'Transfer', '', '06:00', '', 'You can also visit Zero Point…', '2500', '2800', '3000', '4000'],
];

export default function UploadTransportPricesPage() {
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
        out.push(await importApi.upload(f, 'transport', destIds));
      }
      return out;
    },
    onSuccess: (out) => {
      const totals = out.reduce((a, s) => ({ services: a.services + (s.services || 0), priceRows: a.priceRows + (s.priceRows || 0) }), { services: 0, priceRows: 0 });
      setResult(totals);
      setFiles([]);
      if (inputRef.current) inputRef.current.value = '';
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

  const downloadTemplate = () => downloadCsv(TEMPLATE, 'transport-prices-sample.csv');

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-6 py-3 text-sm">
        <button onClick={() => navigate('/services/transport-prices')} className="text-slate-600 hover:text-slate-900"><ArrowLeft size={18} /></button>
        <span className="font-semibold text-slate-900">Upload Transportation Prices</span>
        <span className="text-slate-400">/</span>
        <Link to="/services/transport-prices" className="text-slate-500 hover:text-slate-800">Transportation Prices</Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-500">Upload CSV</span>
      </div>

      <div className="px-6 py-6">
        <div className="max-w-3xl space-y-5">
          <div>
            <label className="label">Trip Destinations</label>
            <AsyncSelect loadOptions={destinationsApi.search} value={destinations} onChange={setDestinations} isMulti creatable onCreate={(name) => destinationsApi.create({ name })} placeholder="Type to search..." />
            <p className="mt-1 text-xs text-slate-400">Imported services will be tagged with these destinations.</p>
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
            <button onClick={() => mut.mutate()} disabled={!files.length || mut.isPending} className="btn-primary">{mut.isPending ? 'Uploading…' : 'Upload Transportation Prices CSV'}</button>
            <button onClick={() => navigate('/services/transport-prices')} className="text-sm font-medium text-slate-600 hover:text-slate-900">Cancel</button>
          </div>

          {result && (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
              <div className="flex items-center gap-2 text-green-800"><CheckCircle2 size={18} /> <span className="font-semibold">Upload complete</span></div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Stat n={result.services} label="Services" />
                <Stat n={result.priceRows} label="Price Rows" />
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 rounded-2xl bg-slate-50 p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">CSV File Format</h2>
            <button onClick={downloadTemplate} className="btn-secondary text-sm"><Download size={14} /> Download Sample CSV</button>
          </div>
          <p className="mb-3 max-w-3xl text-sm text-slate-500">
            When creating your CSV file for transport service prices, follow this format. Each row has a <b>Duty Code</b>, locations (<b>A → B</b>), <b>Service</b>, <b>Distance, Start Time, Duration, Day Schedule</b>, then one block of <b>vehicle-type</b> columns per season date-range. Re-uploading a file refreshes that supplier's prices.
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

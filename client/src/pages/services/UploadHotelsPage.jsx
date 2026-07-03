import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, UploadCloud, FileSpreadsheet, CheckCircle2, Download, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { importApi } from '../../api/services.js';
import { destinationsApi } from '../../api/masterData.js';
import AsyncSelect from '../../components/form/AsyncSelect.jsx';
import { downloadCsv } from '../../lib/downloadCsv.js';

// Flat hotels master CSV (no prices).
const TEMPLATE = [
  ['Group Name', 'Location', 'Name', 'Star', 'Address Line 1', 'Landmark', 'Pin Code', 'Phone Dial Code', 'Contact Number', 'Contact Number 2', 'Email Id', 'Checkin Time', 'Checkout Time', 'Url'],
  ['The MRS Group', 'Jaipur, Rajasthan, India', 'Nahargarh Haveli', '3', 'B - 4, Ajmer Rd, Gopalbari', 'Behind Corporate Park', '302001', '+91', '9810997861', '9998889988', 'support@example.com', '14:00', '11:00', 'https://hotelxyz.com'],
  ['The MRS Group', 'Jaipur, Rajasthan, India', 'Hilton Jaipur', '3', 'B - 4, Ajmer Rd, Gopalbari', 'Behind Corporate Park', '302001', '+91', '9810997861', '', 'support@example.com', '14:00', '11:00', ''],
  ['Sky Stays', 'Ahmedabad, Gujarat, India', 'Royal Square', '4', '4th Floor, Sparsh Arcade, Zundal', 'Near Bagga Hyundai', '382424', '+91', '8511084939', '8988899888', 'support@example.com', '13:00', '10:00', 'https://mmt.com/hotel/1212'],
];

export default function UploadHotelsPage() {
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
        out.push(await importApi.upload(f, 'hotels-master', destIds));
      }
      return out;
    },
    onSuccess: (out) => {
      const totals = out.reduce((a, s) => ({ hotels: a.hotels + (s.hotels || 0), skipped: a.skipped + (s.skipped || 0) }), { hotels: 0, skipped: 0 });
      setResult(totals);
      setFiles([]);
      if (inputRef.current) inputRef.current.value = '';
      toast.success('Hotels uploaded');
    },
    onError: (e) => toast.error(e.message || 'Upload failed'),
  });

  const pick = (list) => {
    const arr = Array.from(list || []).filter((f) => /\.(csv|xlsx|xls)$/i.test(f.name));
    if (!arr.length) return toast.error('Please choose .csv / .xlsx file(s)');
    setFiles((prev) => [...prev, ...arr]);
    setResult(null);
  };

  const downloadTemplate = () => downloadCsv(TEMPLATE, 'hotels-sample.csv');

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-6 py-3 text-sm">
        <button onClick={() => navigate('/services/hotels')} className="text-slate-600 hover:text-slate-900"><ArrowLeft size={18} /></button>
        <span className="font-semibold text-slate-900">Upload Hotels</span>
        <span className="text-slate-400">/</span>
        <Link to="/services/hotels" className="text-slate-500 hover:text-slate-800">Hotels</Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-500">Upload CSV</span>
      </div>

      <div className="px-6 py-6">
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Want to upload hotels <b>with prices</b>?{' '}
          <Link to="/services/hotel-prices/upload" className="font-semibold underline">Upload hotel prices</Link> instead — that also creates the hotels.
        </div>

        <div className="max-w-3xl space-y-5">
          <div>
            <label className="label">Trip Destinations</label>
            <AsyncSelect loadOptions={destinationsApi.search} value={destinations} onChange={setDestinations} isMulti creatable onCreate={(name) => destinationsApi.create({ name })} placeholder="Type to search..." />
            <p className="mt-1 text-xs text-slate-400">Imported hotels will also be tagged with these destinations.</p>
          </div>

          <div>
            <label className="label">Select a csv file</label>
            <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" multiple className="hidden" onChange={(e) => pick(e.target.files)} />
            <button onClick={() => inputRef.current?.click()} className="flex w-full max-w-md items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:border-brand-400">
              <UploadCloud size={16} className="text-slate-400" /> {files.length ? `${files.length} file(s) selected` : 'Choose File — no file selected'}
            </button>
          </div>

          {files.length > 0 && (
            <div className="space-y-1">
              {files.map((f, i) => (
                <div key={i} className="flex max-w-md items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
                  <FileSpreadsheet size={14} className="text-brand-600" />
                  <span className="flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-slate-400">{(f.size / 1024).toFixed(0)} KB</span>
                  <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button onClick={() => mut.mutate()} disabled={!files.length || mut.isPending} className="btn-primary">{mut.isPending ? 'Uploading…' : 'Upload Hotels CSV'}</button>
            <button onClick={() => navigate('/services/hotels')} className="text-sm font-medium text-slate-600 hover:text-slate-900">Cancel</button>
          </div>

          {result && (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
              <div className="flex items-center gap-2 text-green-800"><CheckCircle2 size={18} /> <span className="font-semibold">Upload complete</span></div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Stat n={result.hotels} label="Hotels" />
                <Stat n={result.skipped} label="Skipped" />
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
            One row per hotel. Leave <b>Group Name</b> / <b>Location</b> blank (or use <b>…</b>) to repeat the previous row's value. <b>Location</b> is "City, State, Country".
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-xs">
              <tbody>
                {TEMPLATE.map((row, ri) => (
                  <tr key={ri} className={ri === 0 ? 'bg-slate-100 font-semibold text-slate-600' : 'border-t border-slate-100'}>
                    {row.map((c, ci) => <td key={ci} className="whitespace-nowrap px-3 py-1.5">{c}</td>)}
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

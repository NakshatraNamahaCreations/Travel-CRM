import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { UploadCloud, FileSpreadsheet, CheckCircle2, Hotel, Bus, Ticket, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { importApi } from '../../api/services.js';
import { cn } from '../../lib/cn.js';

const TYPES = [
  { value: 'auto', label: 'Auto-detect', icon: Sparkles, hint: 'Figure out the type from the columns' },
  { value: 'hotels', label: 'Hotels', icon: Hotel, hint: 'Hotel rate cards (Port Blair / Havelock / Neil)' },
  { value: 'transport', label: 'Transport', icon: Bus, hint: 'Transport services & vehicle prices' },
  { value: 'activities', label: 'Activities', icon: Ticket, hint: 'Ferries & activities with ticket prices' },
];

export default function ImportPage() {
  const [type, setType] = useState('auto');
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const mut = useMutation({
    mutationFn: () => importApi.upload(file, type),
    onSuccess: (data) => { setResult(data); toast.success('Import complete'); },
    onError: (e) => toast.error(e.message || 'Import failed'),
  });

  const pick = (f) => {
    if (!f) return;
    if (!/\.(xlsx|xls|csv)$/i.test(f.name)) return toast.error('Please choose an .xlsx / .xls / .csv file');
    setFile(f); setResult(null);
  };

  const summaryRows = result
    ? Object.entries(result).filter(([k]) => ['hotels', 'priceRows', 'services', 'activities', 'skipped'].includes(k))
    : [];

  return (
    <div className="px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Import / Upload Inventory</h1>
        <p className="mt-1 text-sm text-slate-500">Upload the client's Excel rate sheets to load Hotels, Transport & Activities into the CRM. Re-uploading a file refreshes that supplier's prices.</p>
      </div>

      {/* Type selector */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TYPES.map((t) => (
          <button key={t.value} onClick={() => setType(t.value)}
            className={cn('flex flex-col items-center gap-1 rounded-xl border p-3 text-center text-sm transition', type === t.value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300')}>
            <t.icon size={20} /> <span className="font-semibold">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
        onClick={() => inputRef.current?.click()}
        className={cn('flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition', drag ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-white hover:border-brand-400')}
      >
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        {file ? (
          <>
            <FileSpreadsheet className="mb-2 text-brand-600" size={40} />
            <p className="font-semibold text-gray-900">{file.name}</p>
            <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(0)} KB · click to choose a different file</p>
          </>
        ) : (
          <>
            <UploadCloud className="mb-2 text-slate-400" size={40} />
            <p className="font-semibold text-gray-700">Drop an Excel file here, or click to browse</p>
            <p className="text-xs text-slate-400">.xlsx, .xls or .csv — up to 20 MB</p>
          </>
        )}
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        {file && <button onClick={() => { setFile(null); setResult(null); }} className="btn-ghost">Clear</button>}
        <button onClick={() => mut.mutate()} disabled={!file || mut.isPending} className="btn-primary">
          {mut.isPending ? 'Importing…' : 'Upload & Import'}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5">
          <div className="flex items-center gap-2 text-green-800">
            <CheckCircle2 size={18} /> <span className="font-semibold">Imported “{result.file}”</span>
          </div>
          <p className="mt-1 text-sm text-green-700">Detected as <b>{result.type}</b> · {result.sheets} sheet(s) processed.</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {summaryRows.map(([k, v]) => (
              <div key={k} className="rounded-lg bg-white p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{v}</p>
                <p className="text-xs uppercase tracking-wide text-slate-400">{k === 'priceRows' ? 'Price Rows' : k}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
        <b>Expected formats</b> — Hotels: one sheet per hotel with seasonal CP/MAP/AP columns. Transport: Duty Code / Service / Day Schedule with vehicle-type columns. Activities: Name / Service with Adult/Child season columns. “Copy of …” sheets are treated as the latest revision.
      </div>
    </div>
  );
}

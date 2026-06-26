import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, UploadCloud, FileSpreadsheet, CheckCircle2, Clipboard, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { queriesApi } from '../../api/queries.js';
import { querySourcesApi, usersApi } from '../../api/masterData.js';
import { useAuth } from '../../store/AuthContext.jsx';
import AsyncSelect from '../../components/form/AsyncSelect.jsx';

const COLUMNS = ['Destination', 'Start Date', 'No of Nights', 'Trip ID', 'Guest Name', 'Phone Number', 'Email', 'No of Adults', 'Children', 'Comments'];
const SAMPLE_ROWS = [
  ['Rajasthan', '20-12-2026', '9', '1231312', 'Sudhir M', '9999999999', 'sudhir@example.com', '4', '3,3,5,8', ''],
  ['Sikkim', '13-01-2026', '5', '', 'Anand SS', '', '', '4', '', 'Budget:56,000'],
  ['Kerala', '07-12-2026', '5', 'AB123232', 'Rajat Sharma', '', 'rajat@example.com', '6', '1,2', '5 star Hotels'],
];

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function UploadQueriesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(false);
  const [source, setSource] = useState(null);
  const [owner, setOwner] = useState(null); // null = "You"
  const [result, setResult] = useState(null);

  const mut = useMutation({
    mutationFn: () => queriesApi.uploadCsv(file, { source: source?._id, owner: owner?._id }),
    onSuccess: (data) => { setResult(data); toast.success(`Imported ${data.created} quer${data.created === 1 ? 'y' : 'ies'}`); },
    onError: (e) => toast.error(e.message || 'Upload failed'),
  });

  const pick = (f) => {
    if (!f) return;
    if (!/\.(csv|xlsx|xls)$/i.test(f.name)) return toast.error('Please choose a .csv file');
    setFile(f); setFileError(false); setResult(null);
  };

  const submit = () => {
    if (!file) { setFileError(true); return; }
    mut.mutate();
  };

  const copyTemplate = async () => {
    const csv = [COLUMNS, ...SAMPLE_ROWS].map((r) => r.map(csvCell).join(',')).join('\n');
    try {
      await navigator.clipboard.writeText(csv);
      toast.success('Template copied to clipboard');
    } catch {
      toast.error('Could not copy — select the table and copy manually');
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-3 text-sm">
        <button onClick={() => navigate(-1)} className="text-slate-600 hover:text-slate-900"><ArrowLeft size={18} /></button>
        <span className="font-semibold text-slate-900">Upload Queries</span>
        <span className="text-slate-400">/</span>
        <Link to="/trips" className="text-slate-500 hover:text-slate-800">Trips</Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-500">Upload CSV</span>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-7">
        {/* File */}
        <label className="label">Select a CSV file</label>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
          <span className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">Choose File</span>
          <span className="text-sm text-slate-500">{file ? file.name : 'No file selected'}</span>
          <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        {fileError && (
          <p className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-red-500 px-2 py-1 text-xs font-medium text-white">
            <AlertTriangle size={12} /> File field is required
          </p>
        )}

        {/* Source + Sales Person */}
        <div className="mt-5 grid max-w-xl gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Trip Source</label>
            <AsyncSelect loadOptions={querySourcesApi.search} value={source} onChange={setSource} creatable onCreate={(name) => querySourcesApi.create({ name })} placeholder="Select a Trip Source" />
          </div>
          <div>
            <label className="label">Sales Person</label>
            <AsyncSelect loadOptions={usersApi.search} value={owner} onChange={setOwner} placeholder={`You (${user?.name?.split(' ')[0]})`} />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3 border-t border-slate-200 pt-5">
          <button onClick={submit} disabled={mut.isPending} className="btn-primary"><UploadCloud size={16} /> {mut.isPending ? 'Uploading…' : 'Upload Queries CSV'}</button>
          <button onClick={() => navigate('/trips')} className="btn-ghost">Cancel</button>
        </div>

        {/* Result */}
        {result && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5">
            <p className="flex items-center gap-2 font-semibold text-green-800"><CheckCircle2 size={18} /> Imported {result.created} of {result.totalRows} rows</p>
            {result.queryNumbers?.length > 0 && <p className="mt-1 text-sm text-green-700">Query #s: {result.queryNumbers.join(', ')}</p>}
            {result.errors?.length > 0 && (
              <div className="mt-2 text-sm text-amber-700">
                <p className="font-medium">{result.errors.length} row(s) skipped:</p>
                <ul className="ml-4 list-disc">{result.errors.slice(0, 10).map((e, i) => <li key={i}>Row {e.row}: {e.error}</li>)}</ul>
              </div>
            )}
            <Link to="/trips?status=all" className="link mt-3 inline-block">View all trips →</Link>
          </div>
        )}

        {/* Format docs */}
        <div className="mt-10">
          <h2 className="heading-h3 text-slate-900">CSV File Format</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Follow this format for your CSV. <b>Destination, Start Date (DD-MM-YYYY)</b> and <b>Guest Name</b> are the key columns; the rest are optional.
            Multiple children ages go in one cell comma-separated (e.g. <code className="kbd">3,3,5,8</code>).
          </p>
          <div className="card card-flush mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs font-semibold text-slate-600">
                <tr>{COLUMNS.map((c) => <th key={c} className="whitespace-nowrap px-3 py-2.5">{c}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {SAMPLE_ROWS.map((row, i) => (
                  <tr key={i} className="even:bg-slate-50/40">
                    {row.map((cell, j) => <td key={j} className="whitespace-nowrap px-3 py-2.5 text-slate-600">{cell || <span className="text-slate-300">—</span>}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={copyTemplate} className="btn-secondary mt-3 text-sm"><Clipboard size={15} /> Copy Template Format</button>
        </div>
      </div>
    </div>
  );
}

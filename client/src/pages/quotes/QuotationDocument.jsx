import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Printer, Download, Send, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { quotesApi } from '../../api/quotes.js';
import Modal from '../../components/ui/Modal.jsx';

/**
 * On-screen quotation preview — renders the SAME server-built HTML the PDF is
 * generated from (GET /quotes/:id/pdf?format=html) inside an iframe, so what
 * you see here is pixel-for-pixel what "Download PDF" produces.
 */
export default function QuotationDocument() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const iframeRef = useRef(null);
  const [frameHeight, setFrameHeight] = useState(1200);
  const [emailOpen, setEmailOpen] = useState(false);
  const [toEmail, setToEmail] = useState('');

  const { data: q } = useQuery({ queryKey: ['quote', id], queryFn: () => quotesApi.get(id) });
  const { data: html, isLoading, error } = useQuery({
    queryKey: ['quote-doc-html', id],
    queryFn: () => quotesApi.pdfHtml(id),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (q) setToEmail(q.query?.guest?.email || '');
  }, [q]);

  const printFrame = () => iframeRef.current?.contentWindow?.print();

  // ?print=1 → auto-open the print dialog once the document is in the frame.
  useEffect(() => {
    if (html && params.get('print') === '1') {
      const t = setTimeout(printFrame, 800);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [html, params]);

  const onFrameLoad = () => {
    const doc = iframeRef.current?.contentDocument;
    if (doc?.body) setFrameHeight(Math.max(1200, doc.body.scrollHeight + 40));
  };

  const pdfMut = useMutation({
    mutationFn: () => quotesApi.pdf(id),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    },
    onError: (e) => toast.error(e.message || 'Could not generate PDF'),
  });

  const emailMut = useMutation({
    mutationFn: () => quotesApi.email(id, toEmail),
    onSuccess: (d) => { toast.success(`Quotation emailed to ${d.to}`); setEmailOpen(false); },
    onError: (e) => toast.error(e.message || 'Email failed — is SMTP configured in server/.env?'),
  });

  return (
    <div className="min-h-screen bg-slate-100 py-6">
      {/* Toolbar */}
      <div className="mx-auto mb-4 flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4">
        <button onClick={() => navigate(-1)} className="btn-secondary text-sm"><ArrowLeft size={15} /> Back</button>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => navigate(`/quotes/${id}/edit`)} className="btn-secondary text-sm">Edit Quote</button>
          <button onClick={printFrame} disabled={!html} className="btn-secondary text-sm"><Printer size={15} /> Print</button>
          <button onClick={() => setEmailOpen(true)} className="btn-secondary text-sm"><Send size={15} /> Email Guest</button>
          <button onClick={() => pdfMut.mutate()} disabled={pdfMut.isPending} className="btn-primary text-sm">
            <Download size={15} /> {pdfMut.isPending ? 'Generating…' : 'Download PDF'}
          </button>
        </div>
      </div>

      <Modal open={emailOpen} onClose={() => setEmailOpen(false)} title="Email Quotation to Guest">
        <div className="space-y-3">
          <div>
            <label className="label">Recipient email</label>
            <input type="email" className="input" value={toEmail} onChange={(e) => setToEmail(e.target.value)} placeholder="guest@email.com" />
            <p className="mt-1 text-xs text-slate-400">The quotation PDF is attached automatically.</p>
          </div>
          <div className="flex justify-end">
            <button onClick={() => emailMut.mutate()} disabled={!toEmail || emailMut.isPending} className="btn-primary">
              {emailMut.isPending ? 'Sending…' : 'Send Email'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Document — the PDF's own HTML, embedded */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-24 text-slate-400">
          <Loader2 size={18} className="animate-spin" /> Preparing quotation…
        </div>
      ) : error || !html ? (
        <div className="py-24 text-center text-slate-500">Could not load the quotation document.</div>
      ) : (
        // The quotation is fixed-width A4 HTML. Shrinking the iframe would clip
        // it with no way to reach the left edge, so below lg we keep the frame
        // at its natural width and let the wrapper pan horizontally.
        <div className="overflow-x-auto pb-2">
          <iframe
            ref={iframeRef}
            title="Quotation"
            srcDoc={html}
            onLoad={onFrameLoad}
            className="block w-[850px] border-0 bg-white shadow-soft lg:mx-auto lg:max-w-full"
            style={{ height: frameHeight }}
          />
        </div>
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { MessageCircle, Mail, Copy, Download, Send, FileText, Loader2 } from 'lucide-react';
import { quotesApi } from '../../api/quotes.js';
import { company } from '../../config/company.js';
import { cn } from '../../lib/cn.js';
import {
  buildWhatsAppText, whatsappToHtml, buildEmailHtml, emailHtmlToWordDoc,
} from '../../lib/shareContent.js';

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600" />
      {label}
    </label>
  );
}

const htmlToPlain = (html) => html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim();

async function copyRichHtml(html) {
  try {
    if (window.ClipboardItem && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new window.ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([htmlToPlain(html)], { type: 'text/plain' }),
        }),
      ]);
    } else {
      await navigator.clipboard.writeText(htmlToPlain(html));
    }
    toast.success('Copied to clipboard');
  } catch {
    toast.error('Copy failed — your browser blocked clipboard access');
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function SharePackageModal({ quoteId, open, onClose }) {
  const [tab, setTab] = useState('whatsapp');
  const [wa, setWa] = useState({ hideTotalPrice: false, includeItinerary: false, attachPdf: false });
  const [em, setEm] = useState({ removeItinerary: false, removeTerms: false, removeTransports: false, attachPdf: false });
  const [pdfBusy, setPdfBusy] = useState(false);

  const { data: q, isLoading } = useQuery({
    queryKey: ['quote', quoteId, 'share'],
    queryFn: () => quotesApi.get(quoteId),
    enabled: open && !!quoteId,
  });

  const waText = useMemo(() => {
    if (!q) return '';
    let t = buildWhatsAppText(q, wa);
    if (wa.attachPdf) t += '\n\n📄 A detailed PDF itinerary is attached for your reference.';
    return t;
  }, [q, wa]);

  const emailHtml = useMemo(() => {
    if (!q) return '';
    let h = buildEmailHtml(q, em);
    if (em.attachPdf) h += '<p style="color:#6b7280;font-size:11px;margin-top:8px">📎 A detailed PDF itinerary is attached for your reference.</p>';
    return h;
  }, [q, em]);

  if (!open) return null;

  const guest = q?.query?.guest || {};
  const phone = guest.phones?.[0];
  const waNum = phone ? `${phone.countryCode || '91'}${phone.number || ''}`.replace(/\D/g, '') : '';
  const num = q?.quoteNumber || q?.query?.queryNumber || '';

  const sendWhatsApp = () => {
    const base = waNum ? `https://wa.me/${waNum}` : 'https://wa.me/';
    window.open(`${base}?text=${encodeURIComponent(waText)}`, '_blank');
  };

  const downloadPdf = async () => {
    try {
      setPdfBusy(true);
      const blob = await quotesApi.pdf(quoteId);
      downloadBlob(blob, `Package-${num}.pdf`);
    } catch (e) {
      toast.error(e.message || 'Could not generate PDF');
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-12" onClick={onClose}>
      <div className="card card-flush w-full max-w-2xl animate-scale-in overflow-hidden bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h3 className="font-semibold text-slate-900">Share Package</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-5">
          {[{ k: 'whatsapp', label: 'WhatsApp', icon: MessageCircle }, { k: 'email', label: 'Email', icon: Mail }].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={cn('flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium -mb-px',
                tab === t.k ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700')}
            >
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        {isLoading || !q ? (
          <div className="flex items-center justify-center gap-2 py-20 text-slate-400"><Loader2 size={18} className="animate-spin" /> Loading package…</div>
        ) : tab === 'whatsapp' ? (
          <div>
            {/* Toggle bar */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100 bg-slate-50 px-5 py-2.5">
              <span className="text-xs text-slate-400">Use toggles to customise the content according to your needs.</span>
              <Toggle checked={wa.hideTotalPrice} onChange={(v) => setWa((s) => ({ ...s, hideTotalPrice: v }))} label="Hide Total Price" />
              <Toggle checked={wa.includeItinerary} onChange={(v) => setWa((s) => ({ ...s, includeItinerary: v }))} label="Itinerary" />
              <Toggle checked={wa.attachPdf} onChange={(v) => setWa((s) => ({ ...s, attachPdf: v }))} label="PDF" />
              <button onClick={downloadPdf} disabled={pdfBusy} className="btn-secondary ml-auto text-xs">
                {pdfBusy ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />} Download PDF
              </button>
            </div>
            {/* Preview */}
            <div className="max-h-[55vh] overflow-y-auto bg-slate-100 p-4">
              <div
                className="rounded-lg bg-[#dcf8c6] p-4 text-[13px] leading-relaxed text-slate-800 shadow-sm"
                dangerouslySetInnerHTML={{ __html: whatsappToHtml(waText) }}
              />
            </div>
            {/* Footer */}
            <div className="flex items-center gap-2 border-t border-slate-200 px-5 py-3">
              <button onClick={sendWhatsApp} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600">
                <Send size={15} /> Send via WhatsApp
              </button>
              <button onClick={() => navigator.clipboard.writeText(waText).then(() => toast.success('Copied'), () => toast.error('Copy failed'))} className="btn-secondary text-sm">
                <Copy size={14} /> Copy
              </button>
              {!waNum && <span className="text-xs text-amber-600">No guest phone on file — opens WhatsApp without a recipient.</span>}
            </div>
          </div>
        ) : (
          <div>
            {/* Toggle bar */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100 bg-slate-50 px-5 py-2.5">
              <Toggle checked={em.removeItinerary} onChange={(v) => setEm((s) => ({ ...s, removeItinerary: v }))} label="Remove Itinerary" />
              <Toggle checked={em.removeTerms} onChange={(v) => setEm((s) => ({ ...s, removeTerms: v }))} label="Remove Terms" />
              <Toggle checked={em.removeTransports} onChange={(v) => setEm((s) => ({ ...s, removeTransports: v }))} label="Remove Transports & Activities" />
              <Toggle checked={em.attachPdf} onChange={(v) => setEm((s) => ({ ...s, attachPdf: v }))} label="PDF" />
              <div className="ml-auto flex gap-2">
                <button onClick={() => copyRichHtml(emailHtml)} className="btn-secondary text-xs"><Copy size={13} /> Copy</button>
                <button onClick={() => downloadBlob(new Blob([emailHtmlToWordDoc(emailHtml)], { type: 'application/msword' }), `Package-${num}.doc`)} className="btn-secondary text-xs">
                  <Download size={13} /> Word
                </button>
              </div>
            </div>
            {/* Preview */}
            <div className="max-h-[60vh] overflow-y-auto bg-white p-5">
              <div dangerouslySetInnerHTML={{ __html: emailHtml }} />
            </div>
          </div>
        )}

        <div className="border-t border-slate-100 px-5 py-2 text-center text-[11px] text-slate-400">
          ProTip: Install {company.shortName} WhatsApp (mobile or desktop) for easy messaging.
        </div>
      </div>
    </div>
  );
}

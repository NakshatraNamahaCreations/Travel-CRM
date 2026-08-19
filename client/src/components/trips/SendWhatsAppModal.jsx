import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Send, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { queriesApi } from '../../api/queries.js';
import { shareLinksApi } from '../../api/shareLinks.js';
import { WHATSAPP_TEMPLATES, templateByKey, renderTemplateBody } from '../../lib/whatsappTemplates.js';
import { whatsappToHtml } from '../../lib/shareContent.js';
import Modal from '../ui/Modal.jsx';
import { cn } from '../../lib/cn.js';

// Picks one of the approved Gallabox templates, auto-fills its variables from
// the trip, previews the exact message, and sends it to the trip's guest.
//
// `defaultKey` preselects the template for the stage the button lives on.
// `ctx` = { query, quote, booking, installment, invoice, links }.
export default function SendWhatsAppModal({ ctx, defaultKey, onClose }) {
  const [key, setKey] = useState(defaultKey || WHATSAPP_TEMPLATES[0].key);
  const tpl = templateByKey(key);

  // Templates that reference a document mint a public, tokenised link for it
  // on demand — the guest can open it without logging into the CRM.
  const needs = tpl?.needs;
  const docId = needs && (needs.kind === 'receipt' ? ctx?.installment?._id
    : needs.kind === 'invoice' ? ctx?.invoice?._id
    : ctx?.quote?._id);
  const { data: shared, isFetching: linking, error: linkError } = useQuery({
    queryKey: ['share-link', needs?.kind, docId],
    queryFn: () => shareLinksApi.create(needs.kind, docId),
    enabled: !!(needs && docId),
    staleTime: Infinity,
  });

  // Auto-filled values, then whatever the agent tweaked by hand.
  const auto = useMemo(() => {
    if (!tpl) return {};
    const links = { ...(ctx?.links || {}) };
    if (needs && shared?.url) links[needs.as] = shared.url;
    return tpl.fill({ ...ctx, links });
  }, [tpl, ctx, needs, shared]);
  const [overrides, setOverrides] = useState({});
  const values = useMemo(() => ({ ...auto, ...overrides }), [auto, overrides]);

  // Switching template drops any edits made for the previous one.
  const pick = (k) => { setKey(k); setOverrides({}); };

  const preview = renderTemplateBody(tpl, values);
  const missing = Object.entries(values).filter(([, v]) => !String(v ?? '').trim()).map(([k]) => k);

  const guestPhone = (() => {
    const p = (ctx?.query?.guest?.phones || []).find((x) => x.isPrimary) || ctx?.query?.guest?.phones?.[0];
    return p ? `+${p.countryCode || '91'} ${p.number}` : null;
  })();

  const mut = useMutation({
    mutationFn: () => queriesApi.sendWhatsAppTemplate(ctx.query._id, {
      templateName: tpl.name,
      bodyValues: values,
    }),
    onSuccess: () => { toast.success('WhatsApp message sent'); onClose(); },
    onError: (e) => toast.error(e.response?.data?.message || e.message || 'Could not send'),
  });

  return (
    <Modal open onClose={onClose} title="Send WhatsApp Message" width="max-w-2xl">
      <div className="space-y-4">
        <div>
          <label className="label">Template</label>
          <select className="input" value={key} onChange={(e) => pick(e.target.value)}>
            {WHATSAPP_TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <p className="mt-1 text-xs text-gray-400">
            Sends via Gallabox as template <code className="rounded bg-slate-100 px-1">{tpl?.name}</code> — it must already be approved in your Gallabox dashboard under this exact name.
          </p>
        </div>

        <div>
          <label className="label">Variables</label>
          <div className="space-y-2 rounded-lg border border-slate-200 p-3">
            {Object.keys(auto).map((k) => (
              <div key={k} className="grid grid-cols-[150px_1fr] items-center gap-2">
                <code className="truncate text-xs text-slate-500">{`{{${k}}}`}</code>
                <input
                  className={cn('input py-1.5 text-sm', !String(values[k] ?? '').trim() && 'border-amber-300 bg-amber-50')}
                  value={values[k] ?? ''}
                  onChange={(e) => setOverrides((s) => ({ ...s, [k]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          {linking && <p className="mt-1 text-xs text-slate-400">Generating the customer link…</p>}
          {linkError && <p className="mt-1 text-xs text-red-600">Could not generate the document link: {linkError.message}</p>}
          {needs && !docId && (
            <p className="mt-1 text-xs text-amber-600">
              ⚠ No {needs.kind} on this trip yet, so its link can't be generated. Create it first, or pick another template.
            </p>
          )}
          {missing.length > 0 && !linking && (
            <p className="mt-1 text-xs text-amber-600">⚠ Empty: {missing.join(', ')} — fill these in before sending.</p>
          )}
        </div>

        <div>
          <label className="label">Preview</label>
          <div className="max-h-64 overflow-y-auto rounded-lg bg-slate-100 p-3">
            <div
              className="whitespace-pre-wrap rounded-lg bg-[#dcf8c6] p-3 text-[13px] leading-relaxed text-slate-800 shadow-sm"
              dangerouslySetInnerHTML={{ __html: whatsappToHtml(preview) }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <MessageCircle size={13} /> {guestPhone || <span className="text-amber-600">No guest phone on this trip</span>}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              onClick={() => mut.mutate()}
              disabled={mut.isPending || linking || !guestPhone || missing.length > 0}
              className="btn-primary disabled:opacity-50"
            >
              <Send size={14} /> {mut.isPending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

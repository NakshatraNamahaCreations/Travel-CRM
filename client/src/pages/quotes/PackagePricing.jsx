import { Check } from 'lucide-react';
import { money } from '../../lib/pricing.js';
import { cn } from '../../lib/cn.js';

/**
 * Markup / discount / tax / rounding for ONE package option. The builder
 * renders one of these per option, stacked, so a quote with two packages
 * shows both pricings together instead of hiding one behind the option tab.
 *
 * @param {object}   pkg       the package option (markupType, markupValue, discount…, tax…, rounding, comments)
 * @param {object}   computed  computePackage(pkg) result for this option
 * @param {function} onChange  (patch) => void — merged into the option
 */
export default function PackagePricing({ pkg, computed: c, currency, onChange, isDefault, isActive, onSelect, single }) {
  const update = (patch) => onChange(patch);
  return (
    <div className={cn('rounded-2xl border p-4 sm:p-5', isActive ? 'border-brand-300 ring-1 ring-brand-200' : 'border-slate-200')}>
      {!single && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <button type="button" onClick={onSelect} className="flex items-center gap-2 text-left">
            <span className="text-[15px] font-bold text-slate-900">{pkg.name || 'Package'}</span>
            {isDefault && <span className="flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white"><Check size={11} /> Default</span>}
          </button>
          <span className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-bold tabular-nums text-slate-800">{money(c.sellingPrice, currency)}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.6fr_1fr]">
        {/* Markup */}
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Markup</p>
          <div className="flex flex-wrap items-center gap-2">
            <select className="input w-36" value={pkg.markupType} onChange={(e) => update({ markupType: e.target.value })}>
              <option value="percent">Percentage</option><option value="flat">Flat</option>
            </select>
            <input type="number" className="input w-24 text-center" value={pkg.markupValue} onChange={(e) => update({ markupValue: Number(e.target.value) })} />
            <span className="text-sm text-slate-400">{pkg.markupType === 'percent' ? '%' : currency}</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">Markup amount: <span className="font-semibold text-slate-600">{money(c.markupAmount, currency)}</span></p>
        </div>

        {/* Discount */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-emerald-500">Discount</p>
          <div className="flex flex-wrap items-center gap-2">
            <select className="input w-36" value={pkg.discountType || 'flat'} onChange={(e) => update({ discountType: e.target.value })}>
              <option value="flat">Flat</option><option value="percent">Percentage</option>
            </select>
            <input type="number" min="0" className="input w-24 text-center" value={pkg.discountValue ?? 0} onChange={(e) => update({ discountValue: Number(e.target.value) })} />
            <span className="text-sm text-slate-400">{(pkg.discountType || 'flat') === 'percent' ? '%' : currency}</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">Discount amount: <span className="font-semibold text-emerald-600">&minus; {money(c.discountAmount, currency)}</span></p>
        </div>

        {/* Tax */}
        <div className="rounded-xl border border-slate-200 p-4">
          <label className="mb-3 flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <input type="checkbox" className="accent-brand-600" checked={!!pkg.taxApplied} onChange={(e) => update({ taxApplied: e.target.checked })} />
            Apply Tax
          </label>
          <div className={cn('flex flex-wrap items-center gap-2', !pkg.taxApplied && 'opacity-50')}>
            <select className="input w-24" value={pkg.taxName || 'GST'} onChange={(e) => update({ taxName: e.target.value })} disabled={!pkg.taxApplied}>
              {['GST', 'IGST', 'CGST', 'VAT'].map((t) => <option key={t}>{t}</option>)}
            </select>
            <input type="number" className="input w-20 text-center" value={pkg.taxPercent} onChange={(e) => update({ taxPercent: Number(e.target.value) })} disabled={!pkg.taxApplied} />
            <span className="text-sm text-slate-400">%</span>
            <select className="input flex-1" value={pkg.taxOn || 'cost_markup'} onChange={(e) => update({ taxOn: e.target.value })} disabled={!pkg.taxApplied}>
              <option value="cost_markup">On Cost + Markup</option><option value="markup">On Markup Only</option>
            </select>
          </div>
          <p className="mt-2 text-xs text-slate-400">Tax amount: <span className="font-semibold text-slate-600">{money(c.taxAmount, currency)}</span></p>
        </div>

        {/* Rounding */}
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Round Final Price</p>
          <select className="input w-40" value={pkg.rounding || 1} onChange={(e) => update({ rounding: Number(e.target.value) || 1 })}>
            {[1, 5, 10, 50, 100].map((r) => <option key={r} value={r}>Nearest {r}</option>)}
          </select>
          <p className="mt-2 text-xs text-slate-400">Final price is rounded to the nearest {pkg.rounding || 1}.</p>
        </div>
      </div>

      {/* Calculation strip */}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-sm">
        <span><span className="text-xs text-slate-400">Cost Price&nbsp;&nbsp;</span><span className="font-semibold tabular-nums text-slate-800">{money(c.costPrice, currency)}</span></span>
        <span className="text-slate-300">+</span>
        <span><span className="text-xs text-slate-400">Markup&nbsp;&nbsp;</span><span className="font-semibold tabular-nums text-slate-800">{money(c.markupAmount, currency)}</span></span>
        <span className="text-slate-300">&minus;</span>
        <span><span className="text-xs text-slate-400">Discount&nbsp;&nbsp;</span><span className="font-semibold tabular-nums text-emerald-600">{money(c.discountAmount, currency)}</span></span>
        <span className="text-slate-300">+</span>
        <span><span className="text-xs text-slate-400">{pkg.taxApplied ? `${pkg.taxName || 'GST'} ${pkg.taxPercent || 0}%` : 'Tax'}&nbsp;&nbsp;</span><span className="font-semibold tabular-nums text-slate-800">{money(c.taxAmount, currency)}</span></span>
        <span className="ml-auto flex items-baseline gap-2 rounded-lg bg-brand-600 px-4 py-1.5 text-white">
          <span className="text-xs text-blue-100">Final Price</span>
          <span className="text-base font-bold tabular-nums">{money(c.sellingPrice, currency)}</span>
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Any internal comments regarding selling price <span className="label-optional">(optional)</span></label>
          <textarea rows={2} className="input" value={pkg.internalComments || ''} onChange={(e) => update({ internalComments: e.target.value })} />
        </div>
        <div>
          <label className="label">Remarks for Agent/Customer <span className="label-optional">(optional)</span></label>
          <textarea rows={2} className="input" placeholder="Any special remarks for the customer." value={pkg.customerRemarks || ''} onChange={(e) => update({ customerRemarks: e.target.value })} />
          <p className="mt-1 text-xs text-slate-400">These remarks will be shared with the customer.</p>
        </div>
      </div>
    </div>
  );
}

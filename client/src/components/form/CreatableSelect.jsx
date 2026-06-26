import AsyncSelect from './AsyncSelect.jsx';
import { optionsApi } from '../../api/options.js';

const toOpt = (v) => (v ? { _id: v, name: v } : null);

/**
 * A dynamic, user-extensible dropdown bound to a generic Option category
 * (mealPlan, salutation, currency, paymentMode, vehicleType, …).
 * Stores plain string value(s); lets the user "Add '…'" inline.
 *
 * @param {string}   category
 * @param {string|string[]} value
 * @param {function} onChange  (string | string[]) => void
 * @param {boolean}  [isMulti]
 */
export default function CreatableSelect({ category, value, onChange, isMulti = false, placeholder = 'Select or add…' }) {
  return (
    <AsyncSelect
      loadOptions={(s) => optionsApi.search(category, s).then((opts) => opts.map((o) => ({ _id: o.value, name: o.label })))}
      value={isMulti ? (Array.isArray(value) ? value.map(toOpt) : []) : toOpt(value)}
      onChange={(v) => (isMulti ? onChange((v || []).map((o) => o._id)) : onChange(v ? v._id : ''))}
      isMulti={isMulti}
      creatable
      onCreate={async (label) => {
        const o = await optionsApi.create(category, label);
        return { _id: o.value, name: o.label };
      }}
      placeholder={placeholder}
    />
  );
}

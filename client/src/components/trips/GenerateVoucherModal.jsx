import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { serviceBookingsApi } from '../../api/serviceBookings.js';
import Modal from '../ui/Modal.jsx';
import RichTextEditor from '../form/RichTextEditor.jsx';

// "Please BOOK & CONFIRM" voucher for a single hotel stay — mirrors the trip's
// Docs/Vouchers options (Price Bifurcation = prices, Remove Branding) but
// scoped to one ServiceBooking row, with a confirmation number / contact /
// notes attached. Shared by the trip's own Hotel Bookings tab and the
// cross-trip Hotel Check-Ins report — `row` accepts either shape
// (`row.name` from ServiceBooking docs directly, or `row.hotelName` from the
// Hotel Check-Ins view's mapped response).
export default function GenerateVoucherModal({ row, onClose }) {
  const hotelName = row.hotelName || row.name || 'Hotel';
  const [confirmationNumber, setConfirmationNumber] = useState(row.confirmationNumber || '');
  const [voucherContact, setVoucherContact] = useState('');
  const [voucherNotes, setVoucherNotes] = useState('');
  const [prices, setPrices] = useState(false);
  const [removeBranding, setRemoveBranding] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: info } = useQuery({
    queryKey: ['service-booking-hotel-info', row._id],
    queryFn: () => serviceBookingsApi.hotelInfo(row._id),
  });

  const generate = async () => {
    setBusy(true);
    try {
      const blob = await serviceBookingsApi.voucherPdf(row._id, { confirmationNumber, voucherContact, voucherNotes, prices, removeBranding });
      window.open(URL.createObjectURL(blob), '_blank');
      toast.success('Voucher generated');
      onClose();
    } catch {
      toast.error('Could not generate the voucher');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Generate Voucher for ${hotelName}`} width="max-w-xl">
      <div className="space-y-4">
        <div>
          <label className="label">Hotel Confirmation Details</label>
          <input className="input" value={confirmationNumber} onChange={(e) => setConfirmationNumber(e.target.value)} placeholder="e.g. No. TSK123 by Contact Person" />
        </div>

        <div>
          <label className="label">Booking Confirmed by Hotel's Contact Person <span className="font-normal text-gray-400">(optional)</span></label>
          <input className="input" value={voucherContact} onChange={(e) => setVoucherContact(e.target.value)} placeholder="Type contact name…" />
          <p className="mt-1 text-xs text-gray-400">Contact details will be included in the Voucher PDF</p>
        </div>

        <div>
          <label className="label">Voucher Notes <span className="font-normal text-gray-400">(optional)</span></label>
          <RichTextEditor value={voucherNotes} onChange={setVoucherNotes} placeholder="Example: Please pay 50% at the time of checkin" minHeight="80px" />
        </div>

        <div className="space-y-2 border-t border-slate-100 pt-3">
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="checkbox" checked={prices} onChange={(e) => setPrices(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600" />
            <span>
              <span className="font-medium text-slate-800">Include Price Bifurcation</span>
              <span className="block text-xs text-gray-400">Select the checkbox to include the booking price bifurcation in the generated pdf</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="checkbox" checked={removeBranding} onChange={(e) => setRemoveBranding(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600" />
            <span>
              <span className="font-medium text-slate-800">Remove Branding</span>
              <span className="block text-xs text-gray-400">Select the checkbox to remove the branding from the generated pdf and booking price bifurcation will not be included</span>
            </span>
          </label>
        </div>

        <div className="border-t border-slate-100 pt-3">
          <p className="mb-2 text-xs text-gray-500">Please verify hotel details that will be used in voucher. Edit if required.</p>
          <div className="grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3 text-sm">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Hotel Address</div>
              <div className="text-slate-700">{info?.address || row.city || '—'}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Checkin Time</div>
              <div className="text-slate-700">{info?.checkIn || '—'}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Checkout Time</div>
              <div className="text-slate-700">{info?.checkOut || '—'}</div>
            </div>
          </div>
          {info?.hotelId && (
            <Link to={`/services/hotels/${info.hotelId}/edit`} className="btn-secondary mt-2 text-xs">Edit Hotel details</Link>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button onClick={generate} disabled={busy} className="btn-primary">{busy ? 'Generating…' : 'Generate Voucher'}</button>
          <button onClick={onClose} className="btn-secondary">Close</button>
        </div>
      </div>
    </Modal>
  );
}

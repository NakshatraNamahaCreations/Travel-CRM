import { useRef, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadsApi } from '../../api/uploads.js';

// Image field used by every "Image URL" modal (hotels, transport, activities,
// …): paste a public link, or upload a file from the device — both end up
// setting the same URL string via onChange, so callers don't need to change
// how they save it.
export default function ImageUrlInput({ value, onChange, placeholder = 'https://example.com/image.jpg' }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again later
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Please choose an image file');
    try {
      setBusy(true);
      const url = await uploadsApi.image(file);
      onChange(url);
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex gap-1.5">
        <input className="input flex-1" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          title="Upload from your device"
          className="btn-secondary shrink-0 whitespace-nowrap text-sm"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Upload
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      <p className="mt-1 text-xs text-gray-400">Paste a public image link, or upload one from your device.</p>
    </div>
  );
}

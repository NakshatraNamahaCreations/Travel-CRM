import { Construction } from 'lucide-react';

export default function Placeholder({ title, note }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-center">
      <Construction className="mx-auto mb-4 text-gray-300" size={48} />
      <h1 className="text-xl font-semibold text-gray-800">{title}</h1>
      <p className="mt-1 text-sm text-gray-500">
        {note || 'This module is on the roadmap and will be built next.'}
      </p>
    </div>
  );
}

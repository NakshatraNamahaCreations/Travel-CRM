import { Star } from 'lucide-react';

export default function StarRating({ value = 0, size = 13 }) {
  return (
    <span className="inline-flex items-center">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={size}
          className={i < value ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
        />
      ))}
    </span>
  );
}

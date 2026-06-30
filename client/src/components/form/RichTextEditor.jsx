import { useRef, useEffect, useCallback } from 'react';
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Heading2 } from 'lucide-react';

const cmd = (command, value = null) => {
  document.execCommand(command, false, value);
};

const TOOLS = [
  { icon: Heading2, title: 'Heading', action: () => cmd('formatBlock', '<h3>') },
  null,
  { icon: Bold,      title: 'Bold',       action: () => cmd('bold') },
  { icon: Italic,    title: 'Italic',     action: () => cmd('italic') },
  { icon: Underline, title: 'Underline',  action: () => cmd('underline') },
  null,
  { icon: AlignLeft,   title: 'Align Left',   action: () => cmd('justifyLeft') },
  { icon: AlignCenter, title: 'Align Center', action: () => cmd('justifyCenter') },
  { icon: AlignRight,  title: 'Align Right',  action: () => cmd('justifyRight') },
  null,
  { icon: ListOrdered, title: 'Numbered List', action: () => cmd('insertOrderedList') },
  { icon: List,        title: 'Bullet List',   action: () => cmd('insertUnorderedList') },
];

/**
 * Lightweight rich-text editor (no extra packages).
 * Stores value as an HTML string.
 *
 * Props:
 *   value      string  — HTML content
 *   onChange   (html: string) => void
 *   placeholder string
 *   minHeight  string  (tailwind or CSS, default '120px')
 */
export default function RichTextEditor({ value = '', onChange, placeholder = 'Enter description…', minHeight = '120px' }) {
  const ref = useRef(null);
  const skipSync = useRef(false);

  // Sync external value → DOM (only when value changes externally, not on user input)
  useEffect(() => {
    if (!ref.current) return;
    if (skipSync.current) { skipSync.current = false; return; }
    const el = ref.current;
    if (el.innerHTML !== value) el.innerHTML = value;
  }, [value]);

  const handleInput = useCallback(() => {
    skipSync.current = true;
    onChange?.(ref.current?.innerHTML ?? '');
  }, [onChange]);

  const handleToolClick = (e, action) => {
    e.preventDefault();
    ref.current?.focus();
    action();
    handleInput();
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-200">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-100 bg-slate-50 px-2 py-1.5">
        {TOOLS.map((t, i) =>
          t === null ? (
            <div key={i} className="mx-1 h-5 w-px bg-slate-200" />
          ) : (
            <button
              key={t.title}
              type="button"
              title={t.title}
              onMouseDown={(e) => handleToolClick(e, t.action)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
            >
              <t.icon size={14} />
            </button>
          )
        )}
      </div>

      {/* Editable area */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        data-placeholder={placeholder}
        className="w-full px-3 py-2.5 text-sm text-slate-800 outline-none rich-content"
        style={{ minHeight }}
      />
    </div>
  );
}

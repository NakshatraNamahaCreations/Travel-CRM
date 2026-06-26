export default function FormSection({ icon: Icon, title, description, children }) {
  return (
    <div className="grid gap-6 border-b border-gray-100 py-6 md:grid-cols-[280px_1fr]">
      <div>
        <div className="flex items-center gap-2">
          {Icon && <Icon size={18} className="text-gray-500" />}
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        </div>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

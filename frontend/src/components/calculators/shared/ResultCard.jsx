export default function ResultCard({ label, value, sub, hero }) {
  return (
    <div className={`bg-gray-100 dark:bg-gray-800 rounded-lg p-4 ${hero ? 'border-l-4 border-primary-600' : ''}`}>
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
        {value ?? '—'}
      </p>
      {sub && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {sub}
        </p>
      )}
    </div>
  )
}

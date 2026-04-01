/**
 * frontend/src/components/Pagination.jsx
 *
 * Reusable pagination bar used by AllProducts, Products (brand view),
 * and PartsShop.  Renders:
 *   ← Prev  [1] … [4] [5*] [6] … [12]  Next →
 *
 * Props
 * ──────
 *   currentPage   {number}   1-based current page (required)
 *   totalPages    {number}   Total number of pages (required)
 *   onPageChange  {function} Called with the new 1-based page number
 *   className     {string}   Extra class names for the wrapper (optional)
 */

export default function Pagination({ currentPage, totalPages, onPageChange, className = '' }) {
  if (totalPages <= 1) return null;

  // Build the array of page tokens to display.
  // Tokens are either a page number (integer) or the string '…' (ellipsis).
  function buildPageTokens() {
    const tokens = [];
    const WING = 2; // pages to show on each side of current page

    const addPage = (p) => {
      if (!tokens.includes(p) && p >= 1 && p <= totalPages) tokens.push(p);
    };

    // Always show first and last pages
    addPage(1);
    addPage(totalPages);

    // Wing around current page
    for (let i = currentPage - WING; i <= currentPage + WING; i++) addPage(i);

    // Sort and insert ellipses
    const sorted = [...tokens].sort((a, b) => a - b);
    const withEllipsis = [];
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
        withEllipsis.push('…');
      }
      withEllipsis.push(sorted[i]);
    }
    return withEllipsis;
  }

  const tokens = buildPageTokens();

  const btnBase = [
    'inline-flex items-center justify-center',
    'min-w-[2.25rem] h-9 px-2 rounded-lg',
    'text-sm font-medium border transition-colors',
  ].join(' ');

  const activeCls  = 'bg-primary-600 border-primary-600 text-white shadow-sm';
  const defaultCls = 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400';
  const disabledCls = 'bg-white border-gray-200 text-gray-300 cursor-not-allowed';

  return (
    <nav
      aria-label="Pagination"
      className={`flex items-center justify-center gap-1 py-4 ${className}`}
    >
      {/* Previous */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`${btnBase} ${currentPage === 1 ? disabledCls : defaultCls}`}
        aria-label="Previous page"
      >
        ←
      </button>

      {/* Page tokens */}
      {tokens.map((token, i) =>
        token === '…' ? (
          <span
            key={`ellipsis-${i}`}
            className="inline-flex items-center justify-center min-w-[2.25rem] h-9 text-sm text-gray-400 select-none"
          >
            …
          </span>
        ) : (
          <button
            key={token}
            onClick={() => onPageChange(token)}
            aria-current={token === currentPage ? 'page' : undefined}
            className={`${btnBase} ${token === currentPage ? activeCls : defaultCls}`}
          >
            {token}
          </button>
        )
      )}

      {/* Next */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`${btnBase} ${currentPage === totalPages ? disabledCls : defaultCls}`}
        aria-label="Next page"
      >
        →
      </button>
    </nav>
  );
}

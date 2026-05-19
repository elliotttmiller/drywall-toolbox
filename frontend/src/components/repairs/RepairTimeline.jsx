/**
 * frontend/src/components/repairs/RepairTimeline.jsx
 *
 * Chronological list of repair lifecycle events.
 *
 * Props:
 *   events  Array<{ type: string, label: string, occurred_at: string }>
 */

// ─── Event type metadata ──────────────────────────────────────────────────────

const EVENT_META = {
  'repair.submitted':         { icon: '📬', color: 'blue'    },
  'repair.reviewed':          { icon: '🔍', color: 'blue'    },
  'repair.awaiting_customer': { icon: '⏳', color: 'yellow'  },
  'repair.approved':          { icon: '✅', color: 'green'   },
  'repair.quoted':            { icon: '💰', color: 'yellow'  },
  'repair.quote_accepted':    { icon: '🤝', color: 'green'   },
  'repair.quote_declined':    { icon: '❌', color: 'red'     },
  'repair.parts_allocated':   { icon: '📦', color: 'blue'    },
  'repair.in_progress':       { icon: '🔧', color: 'yellow'  },
  'repair.ready_to_ship':     { icon: '🚚', color: 'green'   },
  'repair.completed':         { icon: '🎉', color: 'green'   },
  'repair.closed':            { icon: '🗂️', color: 'neutral' },
  'repair.cancelled':         { icon: '🚫', color: 'red'     },
  'repair.note_added':        { icon: '📝', color: 'blue'    },
  'repair.media_uploaded':    { icon: '📷', color: 'blue'    },
};

const COLOR_CLASSES = {
  blue:    { dot: 'bg-blue-500',    line: 'bg-blue-200',    text: 'text-blue-700'    },
  green:   { dot: 'bg-green-500',   line: 'bg-green-200',   text: 'text-green-700'   },
  yellow:  { dot: 'bg-yellow-400',  line: 'bg-yellow-200',  text: 'text-yellow-700'  },
  red:     { dot: 'bg-red-500',     line: 'bg-red-200',     text: 'text-red-700'     },
  neutral: { dot: 'bg-neutral-400', line: 'bg-neutral-200', text: 'text-neutral-600' },
};

function getEventMeta( type ) {
  // Exact match first
  if ( EVENT_META[ type ] ) return EVENT_META[ type ];
  // Partial match (e.g. custom event types)
  if ( type?.includes( 'cancel' ) ) return { icon: '🚫', color: 'red'     };
  if ( type?.includes( 'complete' ) || type?.includes( 'ship' ) )
                                    return { icon: '✅', color: 'green'   };
  if ( type?.includes( 'progress' ) ) return { icon: '🔧', color: 'yellow' };
  return { icon: '📋', color: 'neutral' };
}

// ─── Timestamp formatter ──────────────────────────────────────────────────────

function fmtRelative( iso ) {
  if ( ! iso ) return '';
  try {
    const diff = Date.now() - new Date( iso ).getTime();
    const mins  = Math.floor( diff / 60_000 );
    const hours = Math.floor( diff / 3_600_000 );
    const days  = Math.floor( diff / 86_400_000 );

    if ( mins < 1   ) return 'Just now';
    if ( mins < 60  ) return `${ mins }m ago`;
    if ( hours < 24 ) return `${ hours }h ago`;
    if ( days < 7   ) return `${ days }d ago`;

    return new Date( iso ).toLocaleDateString( undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    } );
  } catch {
    return iso;
  }
}

function fmtAbsolute( iso ) {
  if ( ! iso ) return '';
  try {
    return new Date( iso ).toLocaleString( undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    } );
  } catch {
    return iso;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RepairTimeline( { events = [] } ) {
  if ( events.length === 0 ) {
    return (
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-neutral-700 mb-3">Timeline</h3>
        <div className="flex flex-col items-center justify-center py-8 text-neutral-300">
          <div className="text-3xl mb-2">📋</div>
          <p className="text-sm">No events yet</p>
        </div>
      </div>
    );
  }

  // Newest-first for display
  const sorted = [ ...events ].sort(
    ( a, b ) => new Date( b.occurred_at ) - new Date( a.occurred_at )
  );

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
      <h3 className="text-sm font-semibold text-neutral-700 mb-4">Timeline</h3>

      <ol className="relative" aria-label="Repair event timeline">
        { sorted.map( ( event, idx ) => {
          const { icon, color } = getEventMeta( event.type );
          const colors          = COLOR_CLASSES[ color ] || COLOR_CLASSES.neutral;
          const isLast          = idx === sorted.length - 1;

          return (
            <li key={ `${ event.type }-${ event.occurred_at }-${ idx }` }
              className="flex gap-3 pb-5 last:pb-0 relative"
            >
              {/* Vertical connector line */}
              { ! isLast && (
                <div
                  aria-hidden="true"
                  className={ `absolute left-4 top-7 bottom-0 w-0.5 ${ colors.line }` }
                />
              ) }

              {/* Dot + icon */}
              <div className={ `w-8 h-8 rounded-full ${ colors.dot } flex items-center justify-center text-sm shrink-0 z-10` }>
                { icon }
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <p className={ `text-sm font-medium ${ colors.text }` }>
                  { event.label || event.type }
                </p>
                <p
                  className="text-xs text-neutral-400 mt-0.5"
                  title={ fmtAbsolute( event.occurred_at ) }
                >
                  { fmtRelative( event.occurred_at ) }
                </p>
              </div>
            </li>
          );
        } ) }
      </ol>
    </div>
  );
}

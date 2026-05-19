/**
 * frontend/src/components/repairs/RepairStatusTracker.jsx
 *
 * Visual status tracker showing the repair's current position in the workflow.
 *
 * Props:
 *   status         string       — machine status key
 *   label          string       — customer-facing label
 *   submittedAt    string       — ISO date string
 *   lastUpdatedAt  string       — ISO date string
 *   trackingNumber string|null  — shown when status is ready_to_ship or completed
 */

import { REPAIR_STATUS_PROGRESS } from '../../api/repairs.js';

// Ordered milestones shown in the step track (a simplified customer-facing flow)
const MILESTONES = [
  { key: 'submitted',   label: 'Submitted'  },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'ready_to_ship', label: 'Ready to Ship' },
  { key: 'completed',   label: 'Completed'  },
];

// Milestone index for a given status (used to highlight completed milestones)
const MILESTONE_ORDER = {
  submitted:         0,
  reviewed:          0,
  awaiting_customer: 0,
  approved:          1,
  quoted:            1,
  quote_accepted:    1,
  parts_allocated:   1,
  in_progress:       1,
  ready_to_ship:     2,
  completed:         3,
  closed:            3,
  cancelled:        -1,
  quote_declined:   -1,
};

const TERMINAL_NEGATIVE = [ 'cancelled', 'quote_declined' ];

function fmt( iso ) {
  if ( ! iso ) return '—';
  try {
    return new Date( iso ).toLocaleString( undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    } );
  } catch {
    return iso;
  }
}

export default function RepairStatusTracker( {
  status,
  label,
  submittedAt,
  lastUpdatedAt,
  trackingNumber,
} ) {
  const progress       = REPAIR_STATUS_PROGRESS[ status ] ?? 0;
  const milestoneIndex = MILESTONE_ORDER[ status ] ?? 0;
  const isNegative     = TERMINAL_NEGATIVE.includes( status );
  const isCompleted    = status === 'completed' || status === 'closed';

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 space-y-5">
      {/* Current status badge */}
      <div className="flex items-center gap-3">
        <StatusIcon status={ status } />
        <div>
          <div className="text-xs text-neutral-400 uppercase tracking-wider">Current Status</div>
          <div className={ [
            'text-lg font-bold',
            isNegative  ? 'text-red-600'   : '',
            isCompleted ? 'text-green-600' : '',
            ! isNegative && ! isCompleted ? 'text-blue-700' : '',
          ].join( ' ' ) }>
            { label || status }
          </div>
        </div>
      </div>

      {/* Terminal negative message */}
      { isNegative && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
          { status === 'cancelled'
            ? 'This repair request has been cancelled. Please contact us if you have questions.'
            : "The repair quote was declined. Contact us if you'd like to revisit your options." }
        </div>
      ) }

      {/* Progress bar */}
      { ! isNegative && (
        <div>
          <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className={ [
                'h-full rounded-full transition-all duration-700',
                isCompleted ? 'bg-green-500' : 'bg-blue-500',
              ].join( ' ' ) }
              style={ { width: `${ progress }%` } }
              role="progressbar"
              aria-valuenow={ progress }
              aria-valuemin={ 0 }
              aria-valuemax={ 100 }
              aria-label={ `Repair progress: ${ progress }%` }
            />
          </div>

          {/* Milestone steps */}
          <div className="flex justify-between mt-2">
            { MILESTONES.map( ( m, i ) => {
              const done   = milestoneIndex > i;
              const active = milestoneIndex === i;
              return (
                <div key={ m.key } className="flex flex-col items-center gap-1 flex-1">
                  <div className={ [
                    'w-3 h-3 rounded-full border-2',
                    done    ? 'bg-blue-500 border-blue-500'        : '',
                    active  ? 'bg-white border-blue-500 shadow-sm' : '',
                    ! done && ! active ? 'bg-white border-neutral-300' : '',
                  ].join( ' ' ) } />
                  <span className={ [
                    'text-xs text-center leading-tight',
                    active ? 'text-blue-700 font-medium' : 'text-neutral-400',
                  ].join( ' ' ) }>
                    { m.label }
                  </span>
                </div>
              );
            } ) }
          </div>
        </div>
      ) }

      {/* Dates */}
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-neutral-400">Submitted</dt>
          <dd className="text-neutral-700 font-medium">{ fmt( submittedAt ) }</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-400">Last Updated</dt>
          <dd className="text-neutral-700 font-medium">{ fmt( lastUpdatedAt ) }</dd>
        </div>
      </dl>

      {/* Tracking number */}
      { trackingNumber && (
        <div className="p-3 bg-green-50 border border-green-100 rounded-xl">
          <div className="text-xs text-green-600 font-medium mb-1">Shipping Tracking</div>
          <div className="text-sm font-mono font-bold text-green-800">{ trackingNumber }</div>
          <p className="text-xs text-green-600 mt-1">
            Use this number to track your shipment with your carrier.
          </p>
        </div>
      ) }
    </div>
  );
}

// ─── Status icon ──────────────────────────────────────────────────────────────

function StatusIcon( { status } ) {
  const icons = {
    submitted:         { emoji: '📬', bg: 'bg-blue-50'   },
    reviewed:          { emoji: '🔍', bg: 'bg-blue-50'   },
    awaiting_customer: { emoji: '⏳', bg: 'bg-yellow-50' },
    approved:          { emoji: '✅', bg: 'bg-green-50'  },
    quoted:            { emoji: '💰', bg: 'bg-yellow-50' },
    quote_accepted:    { emoji: '🤝', bg: 'bg-green-50'  },
    quote_declined:    { emoji: '❌', bg: 'bg-red-50'    },
    parts_allocated:   { emoji: '📦', bg: 'bg-blue-50'   },
    in_progress:       { emoji: '🔧', bg: 'bg-yellow-50' },
    ready_to_ship:     { emoji: '🚚', bg: 'bg-green-50'  },
    completed:         { emoji: '🎉', bg: 'bg-green-50'  },
    closed:            { emoji: '🗂️', bg: 'bg-neutral-50' },
    cancelled:         { emoji: '🚫', bg: 'bg-red-50'    },
  };
  const { emoji, bg } = icons[ status ] || { emoji: '🔧', bg: 'bg-neutral-50' };
  return (
    <div className={ `w-12 h-12 rounded-xl ${ bg } flex items-center justify-center text-2xl` }>
      { emoji }
    </div>
  );
}

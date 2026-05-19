/**
 * frontend/src/pages/RepairStatus.jsx
 *
 * Public repair tracking page — /repairs/status/:id
 *
 * - Uses :id from URL params + ?token=xxx from search params
 * - No auth required; token is the public repair token issued at submission
 * - If no token is present and user is not authenticated, shows a token entry form
 * - Live updates via SSE (with polling fallback) through useRepairEventStream
 */

import { useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import SEOHead from '../components/shared/SEOHead.jsx';
import useRepairStatus       from '../hooks/useRepairStatus.js';
import useRepairEventStream  from '../hooks/useRepairEventStream.js';
import RepairStatusTracker   from '../components/repairs/RepairStatusTracker.jsx';
import RepairTimeline        from '../components/repairs/RepairTimeline.jsx';
import RepairQuoteReview     from '../components/repairs/RepairQuoteReview.jsx';
import RepairIntegrationNotice from '../components/repairs/RepairIntegrationNotice.jsx';
import RepairMediaUploader   from '../components/repairs/RepairMediaUploader.jsx';
import { REPAIR_STATUS_LABELS } from '../api/repairs.js';

// ─── Token entry form (shown when no token in URL) ────────────────────────────

function TokenEntryForm( { onSubmit } ) {
  const [ repairId, setRepairId ] = useState( '' );
  const [ token,    setToken    ] = useState( '' );
  const [ error,    setError    ] = useState( '' );

  const handleSubmit = ( e ) => {
    e.preventDefault();
    if ( ! repairId.trim() || ! token.trim() ) {
      setError( 'Please enter both your Repair ID and tracking token.' );
      return;
    }
    setError( '' );
    onSubmit( repairId.trim(), token.trim() );
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🔍</div>
          <h1 className="text-2xl font-bold text-neutral-900">Track Your Repair</h1>
          <p className="text-sm text-neutral-500 mt-2">
            Enter your repair ID and the tracking token from your confirmation email.
          </p>
        </div>

        <form onSubmit={ handleSubmit } className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 space-y-4">
          <div>
            <label htmlFor="repair-id" className="block text-sm font-medium text-neutral-700 mb-1">
              Repair ID
            </label>
            <input
              id="repair-id"
              type="text"
              value={ repairId }
              onChange={ ( e ) => setRepairId( e.target.value ) }
              placeholder="e.g. 1042"
              className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="repair-token" className="block text-sm font-medium text-neutral-700 mb-1">
              Tracking Token
            </label>
            <input
              id="repair-token"
              type="text"
              value={ token }
              onChange={ ( e ) => setToken( e.target.value ) }
              placeholder="From your confirmation email"
              className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="off"
            />
          </div>

          { error && (
            <p className="text-xs text-red-600" role="alert">{ error }</p>
          ) }

          <button
            type="submit"
            className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Look Up Repair →
          </button>
        </form>

        <p className="text-center text-xs text-neutral-400 mt-4">
          Need help?{' '}
          <Link to="/contact" className="text-blue-600 hover:underline">Contact us</Link>
        </p>
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function Skeleton( { className } ) {
  return <div className={ `animate-pulse rounded bg-neutral-100 ${ className }` } />;
}

function StatusSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-40" />
        </div>
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
    </div>
  );
}

// ─── Error display ────────────────────────────────────────────────────────────

function ErrorDisplay( { message, onRetry } ) {
  const isNotFound  = message?.toLowerCase().includes( 'not found' ) || message?.includes( '404' );
  const isUnauth    = message?.toLowerCase().includes( 'token' ) || message?.includes( '401' ) || message?.includes( '403' );

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="text-4xl mb-3">{ isNotFound ? '🔍' : '⚠️' }</div>
        <h2 className="text-lg font-semibold text-neutral-800 mb-2">
          { isNotFound ? 'Repair Not Found' : isUnauth ? 'Access Denied' : 'Something Went Wrong' }
        </h2>
        <p className="text-sm text-neutral-500 mb-4">
          { isNotFound
            ? 'We couldn\'t find a repair matching this ID. Please double-check your repair ID and token.'
            : isUnauth
            ? 'The tracking token is invalid or has expired. Please check your confirmation email.'
            : message || 'An unexpected error occurred. Please try again.' }
        </p>
        <div className="flex gap-3 justify-center">
          { onRetry && (
            <button
              onClick={ onRetry }
              className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          ) }
          <Link
            to="/repairs"
            className="px-4 py-2 border border-neutral-300 text-neutral-700 text-sm font-semibold rounded-lg hover:bg-neutral-50 transition-colors"
          >
            Submit a Repair
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RepairStatus() {
  const { id: urlRepairId }    = useParams();
  const [ searchParams ]       = useSearchParams();
  const urlToken               = searchParams.get( 'token' );

  // When the token-entry form is submitted, we store the resolved IDs here
  const [ resolvedId,    setResolvedId    ] = useState( urlRepairId  || null );
  const [ resolvedToken, setResolvedToken ] = useState( urlToken     || null );

  const needsTokenEntry = ! resolvedId || ! resolvedToken;

  const { data, loading, error, refresh } = useRepairStatus(
    needsTokenEntry ? null : resolvedId,
    needsTokenEntry ? null : resolvedToken
  );

  const { events } = useRepairEventStream(
    needsTokenEntry ? null : resolvedId,
    needsTokenEntry ? null : resolvedToken
  );

  // Merge streamed events with the timeline from the polling snapshot
  const mergedEvents = mergeTimelines( data?.timeline, events );

  const handleTokenFormSubmit = ( repairId, token ) => {
    setResolvedId( repairId );
    setResolvedToken( token );
  };

  const handleQuoteResponse = () => {
    // Re-fetch status after quote response
    setTimeout( () => refresh(), 800 );
  };

  if ( needsTokenEntry ) {
    return (
      <>
        <SEOHead title="Track Your Repair | Drywall Toolbox" />
        <TokenEntryForm onSubmit={ handleTokenFormSubmit } />
      </>
    );
  }

  if ( error && ! data ) {
    return (
      <>
        <SEOHead title="Repair Status | Drywall Toolbox" />
        <ErrorDisplay message={ error } onRetry={ refresh } />
      </>
    );
  }

  const status = data?.status;
  const label  = data?.label || REPAIR_STATUS_LABELS[ status ] || status;

  return (
    <>
      <SEOHead
        title={ data ? `Repair DTB-${ resolvedId } — ${ label } | Drywall Toolbox` : 'Repair Status | Drywall Toolbox' }
      />

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-neutral-400 uppercase tracking-wider">Repair ID</div>
            <h1 className="text-xl font-bold text-neutral-900">DTB-{ resolvedId }</h1>
          </div>
          <button
            onClick={ refresh }
            disabled={ loading }
            aria-label="Refresh status"
            className="p-2 text-neutral-400 hover:text-blue-600 disabled:opacity-40 transition-colors"
          >
            { loading ? (
              <span className="inline-block animate-spin text-lg">⟳</span>
            ) : (
              <span className="text-lg">⟳</span>
            ) }
          </button>
        </div>

        {/* Status tracker */}
        { loading && ! data ? (
          <StatusSkeleton />
        ) : data ? (
          <RepairStatusTracker
            status={ data.status }
            label={ label }
            submittedAt={ data.submitted_at }
            lastUpdatedAt={ data.last_updated_at }
            trackingNumber={ data.tracking_number }
          />
        ) : null }

        {/* Integration notice — shown for processing states */}
        { status && (
          <RepairIntegrationNotice status={ status } />
        ) }

        {/* Quote review — only when status is 'quoted' */}
        { status === 'quoted' && (
          <RepairQuoteReview
            repairId={ resolvedId }
            token={ resolvedToken }
            onAccepted={ handleQuoteResponse }
            onDeclined={ handleQuoteResponse }
          />
        ) }

        {/* Media upload — shown for active (non-terminal) repairs */}
        { data && ! [ 'completed', 'closed', 'cancelled', 'quote_declined' ].includes( status ) && (
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-neutral-700 mb-3">Add Photos</h3>
            <RepairMediaUploader
              mode="upload"
              repairId={ resolvedId }
              token={ resolvedToken }
              onUploaded={ () => refresh() }
              maxFiles={ 5 }
              maxSizeMB={ 5 }
            />
          </div>
        ) }

        {/* Timeline */}
        { ( loading && ! data ) ? (
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 space-y-3">
            <Skeleton className="h-4 w-24" />
            { [ 1, 2 ].map( ( i ) => (
              <div key={ i } className="flex gap-3">
                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5 pt-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ) ) }
          </div>
        ) : (
          <RepairTimeline events={ mergedEvents } />
        ) }

        {/* Persistent error banner (when we have stale data + a new error) */}
        { error && data && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800 text-xs" role="alert">
            Could not refresh status — showing last known data.
          </div>
        ) }

        <div className="text-center pt-4">
          <Link to="/contact" className="text-xs text-neutral-400 hover:text-blue-600 underline">
            Need help with your repair?
          </Link>
        </div>
      </div>
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mergeTimelines( polledTimeline, streamedEvents ) {
  const base   = Array.isArray( polledTimeline ) ? polledTimeline : [];
  const stream = Array.isArray( streamedEvents  ) ? streamedEvents  : [];
  if ( stream.length === 0 ) return base;

  const seen = new Set( base.map( ( e ) => `${ e.type }|${ e.occurred_at }` ) );
  const extras = stream.filter( ( e ) => ! seen.has( `${ e.type }|${ e.occurred_at }` ) );
  return [ ...base, ...extras ].sort(
    ( a, b ) => new Date( a.occurred_at ) - new Date( b.occurred_at )
  );
}

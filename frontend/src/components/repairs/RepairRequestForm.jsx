/**
 * frontend/src/components/repairs/RepairRequestForm.jsx
 *
 * Multi-step repair submission form.
 *
 * Steps:
 *   1 — Contact   (name, email, phone)
 *   2 — Tool      (brand, model/serial, service tier)
 *   3 — Issue     (description textarea)
 *   4 — Media     (optional file upload)
 *   5 — Review    (summary + submit)
 *
 * Props:
 *   onSuccess(repairId, publicToken) — called after successful submission
 *
 * No auth required — anonymous submission works.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { submitRepair } from '../../api/repairs.js';
import RepairMediaUploader from './RepairMediaUploader.jsx';

// ─── Constants ────────────────────────────────────────────────────────────────

const TOOL_BRANDS = [ 'TapeTech', 'Columbia Tools', 'Asgard', 'Other' ];

const SERVICE_TIERS = [
  {
    id:    'standard',
    name:  'Standard Repair',
    price: 'Quoted after review',
    desc:  'Diagnosis + repair of the reported issue. Parts billed separately.',
  },
  {
    id:    'rush',
    name:  'Rush Service',
    price: '+$45 expedite fee',
    desc:  'Prioritised queue placement — typical 2–3 business day turnaround.',
  },
  {
    id:    'rebuild',
    name:  'Full Rebuild',
    price: 'Quoted after review',
    desc:  'Complete disassembly, worn-parts replacement, calibration and test.',
  },
];

const STEPS = [
  { id: 1, label: 'Contact' },
  { id: 2, label: 'Tool'    },
  { id: 3, label: 'Issue'   },
  { id: 4, label: 'Media'   },
  { id: 5, label: 'Review'  },
];

const BLANK = {
  full_name: '', email: '', phone: '',
  tool_brand: '', tool_model: '', tool_serial: '', service_tier: '',
  issue: '',
  website: '', // honeypot
};

// ─── Validators ───────────────────────────────────────────────────────────────

function validateStep( step, form ) {
  const errs = {};
  if ( step === 1 ) {
    if ( ! form.full_name.trim() )
      errs.full_name = 'Full name is required.';
    if ( ! form.email.trim() )
      errs.email = 'Email is required.';
    else if ( ! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( form.email ) )
      errs.email = 'Enter a valid email address.';
  }
  if ( step === 2 ) {
    if ( ! form.tool_brand )   errs.tool_brand   = 'Select a tool brand.';
    if ( ! form.service_tier ) errs.service_tier = 'Select a service tier.';
  }
  if ( step === 3 ) {
    if ( ! form.issue.trim() )
      errs.issue = 'Please describe the issue.';
    else if ( form.issue.trim().length < 20 )
      errs.issue = 'Please provide at least 20 characters.';
  }
  return errs;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RepairRequestForm( { onSuccess } ) {
  const [ step,        setStep        ] = useState( 1 );
  const [ form,        setForm        ] = useState( BLANK );
  const [ errors,      setErrors      ] = useState( {} );
  const [ mediaFiles,  setMediaFiles  ] = useState( [] );
  const [ submitting,  setSubmitting  ] = useState( false );
  const [ submitError, setSubmitError ] = useState( null );
  const [ success,     setSuccess     ] = useState( null );

  const stepHeadingRef = useRef( null );

  useEffect( () => {
    stepHeadingRef.current?.focus();
  }, [ step ] );

  const set = useCallback( ( field, value ) => {
    setForm( ( prev ) => ( { ...prev, [ field ]: value } ) );
    setErrors( ( prev ) => {
      if ( ! prev[ field ] ) return prev;
      const next = { ...prev };
      delete next[ field ];
      return next;
    } );
  }, [] );

  const handleNext = () => {
    const errs = validateStep( step, form );
    if ( Object.keys( errs ).length ) {
      setErrors( errs );
      return;
    }
    setErrors( {} );
    setStep( ( s ) => s + 1 );
  };

  const handleBack = () => {
    setErrors( {} );
    setStep( ( s ) => s - 1 );
  };

  const handleSubmit = async ( e ) => {
    e.preventDefault();
    // Honeypot — silently abort if filled by a bot
    if ( form.website ) return;

    setSubmitting( true );
    setSubmitError( null );

    try {
      const result = await submitRepair( {
        full_name:    form.full_name.trim(),
        email:        form.email.trim(),
        phone:        form.phone.trim() || undefined,
        tool_brand:   form.tool_brand,
        tool_model:   form.tool_model.trim()  || undefined,
        tool_serial:  form.tool_serial.trim() || undefined,
        service_tier: form.service_tier,
        issue:        form.issue.trim(),
      } );

      setSuccess( result );
      if ( onSuccess ) onSuccess( result.repair_id, result.public_token );
    } catch ( err ) {
      setSubmitError( err.message || 'Submission failed. Please try again.' );
    } finally {
      setSubmitting( false );
    }
  };

  if ( success ) {
    return <SuccessScreen result={ success } mediaFiles={ mediaFiles } />;
  }

  const stepTitles = [
    'Your Contact Information',
    'Tool Details & Service',
    'Describe the Issue',
    'Photos (Optional)',
    'Review & Submit',
  ];

  return (
    <div className="w-full max-w-2xl mx-auto">
      <StepIndicator current={ step } steps={ STEPS } />

      <form onSubmit={ handleSubmit } noValidate>
        {/* Honeypot — hidden from real users */}
        <div aria-hidden="true" style={ { display: 'none' } }>
          <input
            type="text"
            name="website"
            tabIndex={ -1 }
            autoComplete="off"
            value={ form.website }
            onChange={ ( e ) => set( 'website', e.target.value ) }
          />
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 mt-4">
          <h2
            ref={ stepHeadingRef }
            tabIndex={ -1 }
            className="text-lg font-semibold text-neutral-900 mb-5 outline-none"
          >
            { stepTitles[ step - 1 ] }
          </h2>

          { step === 1 && <StepContact form={ form } set={ set } errors={ errors } /> }
          { step === 2 && <StepTool    form={ form } set={ set } errors={ errors } /> }
          { step === 3 && <StepIssue   form={ form } set={ set } errors={ errors } /> }
          { step === 4 && (
            <StepMedia files={ mediaFiles } onFilesChange={ setMediaFiles } />
          ) }
          { step === 5 && (
            <StepReview
              form={ form }
              mediaFiles={ mediaFiles }
              submitError={ submitError }
              submitting={ submitting }
            />
          ) }
        </div>

        <div className="flex items-center justify-between mt-4">
          { step > 1 ? (
            <button
              type="button"
              onClick={ handleBack }
              disabled={ submitting }
              className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 disabled:opacity-40"
            >
              ← Back
            </button>
          ) : (
            <span />
          ) }

          { step < STEPS.length ? (
            <button
              type="button"
              onClick={ handleNext }
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Next →
            </button>
          ) : (
            <button
              type="submit"
              disabled={ submitting }
              className="px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              { submitting ? 'Submitting…' : 'Submit Repair Request' }
            </button>
          ) }
        </div>
      </form>
    </div>
  );
}

// ─── Shared field wrapper ─────────────────────────────────────────────────────

function Field( { label, id, error, children } ) {
  return (
    <div className="mb-4">
      <label htmlFor={ id } className="block text-sm font-medium text-neutral-700 mb-1">
        { label }
      </label>
      { children }
      { error && (
        <p className="mt-1 text-xs text-red-600" role="alert">{ error }</p>
      ) }
    </div>
  );
}

function TextInput( { id, value, onChange, type = 'text', placeholder, required, autoComplete } ) {
  return (
    <input
      id={ id }
      type={ type }
      value={ value }
      onChange={ onChange }
      placeholder={ placeholder }
      required={ required }
      autoComplete={ autoComplete }
      className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
  );
}

// ─── Step 1: Contact ──────────────────────────────────────────────────────────

function StepContact( { form, set, errors } ) {
  return (
    <>
      <Field label="Full Name *" id="full_name" error={ errors.full_name }>
        <TextInput
          id="full_name"
          value={ form.full_name }
          onChange={ ( e ) => set( 'full_name', e.target.value ) }
          placeholder="John Smith"
          required
          autoComplete="name"
        />
      </Field>
      <Field label="Email Address *" id="email" error={ errors.email }>
        <TextInput
          id="email"
          type="email"
          value={ form.email }
          onChange={ ( e ) => set( 'email', e.target.value ) }
          placeholder="john@example.com"
          required
          autoComplete="email"
        />
      </Field>
      <Field label="Phone Number" id="phone" error={ errors.phone }>
        <TextInput
          id="phone"
          type="tel"
          value={ form.phone }
          onChange={ ( e ) => set( 'phone', e.target.value ) }
          placeholder="555-123-4567"
          autoComplete="tel"
        />
      </Field>
    </>
  );
}

// ─── Step 2: Tool ─────────────────────────────────────────────────────────────

function StepTool( { form, set, errors } ) {
  return (
    <>
      <Field label="Tool Brand *" id="tool_brand" error={ errors.tool_brand }>
        <select
          id="tool_brand"
          value={ form.tool_brand }
          onChange={ ( e ) => set( 'tool_brand', e.target.value ) }
          className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select brand…</option>
          { TOOL_BRANDS.map( ( b ) => (
            <option key={ b } value={ b }>{ b }</option>
          ) ) }
        </select>
      </Field>
      <Field label="Model / Description" id="tool_model" error={ errors.tool_model }>
        <TextInput
          id="tool_model"
          value={ form.tool_model }
          onChange={ ( e ) => set( 'tool_model', e.target.value ) }
          placeholder="e.g. 6201-B, Mega Flat Box"
        />
      </Field>
      <Field label="Serial Number" id="tool_serial" error={ errors.tool_serial }>
        <TextInput
          id="tool_serial"
          value={ form.tool_serial }
          onChange={ ( e ) => set( 'tool_serial', e.target.value ) }
          placeholder="Optional"
        />
      </Field>

      <fieldset className="mt-2">
        <legend className="text-sm font-medium text-neutral-700 mb-2">
          Service Tier *
        </legend>
        { errors.service_tier && (
          <p className="mb-2 text-xs text-red-600" role="alert">{ errors.service_tier }</p>
        ) }
        <div className="grid gap-3">
          { SERVICE_TIERS.map( ( tier ) => (
            <label
              key={ tier.id }
              className={ [
                'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors',
                form.service_tier === tier.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-neutral-200 hover:border-neutral-300',
              ].join( ' ' ) }
            >
              <input
                type="radio"
                name="service_tier"
                value={ tier.id }
                checked={ form.service_tier === tier.id }
                onChange={ () => set( 'service_tier', tier.id ) }
                className="mt-0.5 accent-blue-600"
              />
              <div>
                <div className="text-sm font-semibold text-neutral-800">
                  { tier.name }
                  <span className="ml-2 text-xs font-normal text-neutral-500">{ tier.price }</span>
                </div>
                <div className="text-xs text-neutral-500 mt-0.5">{ tier.desc }</div>
              </div>
            </label>
          ) ) }
        </div>
      </fieldset>
    </>
  );
}

// ─── Step 3: Issue ────────────────────────────────────────────────────────────

function StepIssue( { form, set, errors } ) {
  const len = form.issue.trim().length;
  return (
    <Field label="Describe the issue *" id="issue" error={ errors.issue }>
      <textarea
        id="issue"
        value={ form.issue }
        onChange={ ( e ) => set( 'issue', e.target.value ) }
        rows={ 6 }
        placeholder="Describe what's wrong — when it started, symptoms, anything you've already tried…"
        className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
      />
      <p className={ `text-xs mt-1 ${ len < 20 ? 'text-neutral-400' : 'text-green-600' }` }>
        { len } / 20 character minimum
      </p>
    </Field>
  );
}

// ─── Step 4: Media ────────────────────────────────────────────────────────────

function StepMedia( { onFilesChange } ) {
  return (
    <div>
      <p className="text-sm text-neutral-500 mb-4">
        Photos help our technicians diagnose the issue faster. You can also add
        photos later from your repair status page.
      </p>
      <RepairMediaUploader
        mode="local"
        onChange={ onFilesChange }
        maxFiles={ 5 }
        maxSizeMB={ 5 }
      />
    </div>
  );
}

// ─── Step 5: Review ───────────────────────────────────────────────────────────

function StepReview( { form, mediaFiles, submitError } ) {
  const tier = SERVICE_TIERS.find( ( t ) => t.id === form.service_tier );
  return (
    <div className="space-y-4 text-sm">
      <ReviewSection title="Contact">
        <ReviewRow label="Name"  value={ form.full_name } />
        <ReviewRow label="Email" value={ form.email }     />
        { form.phone && <ReviewRow label="Phone" value={ form.phone } /> }
      </ReviewSection>

      <ReviewSection title="Tool">
        <ReviewRow label="Brand"   value={ form.tool_brand } />
        { form.tool_model  && <ReviewRow label="Model"   value={ form.tool_model  } /> }
        { form.tool_serial && <ReviewRow label="Serial"  value={ form.tool_serial } /> }
        <ReviewRow label="Service" value={ tier?.name || form.service_tier } />
      </ReviewSection>

      <ReviewSection title="Issue">
        <p className="text-neutral-700 whitespace-pre-wrap">{ form.issue }</p>
      </ReviewSection>

      { mediaFiles.length > 0 && (
        <ReviewSection title="Photos">
          <p className="text-neutral-500">
            { mediaFiles.length } file{ mediaFiles.length !== 1 ? 's' : '' } ready to attach
          </p>
        </ReviewSection>
      ) }

      { submitError && (
        <div
          className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs"
          role="alert"
        >
          { submitError }
        </div>
      ) }

      <p className="text-xs text-neutral-400">
        By submitting you agree to our repair terms. We'll email a confirmation with your repair ID.
      </p>
    </div>
  );
}

function ReviewSection( { title, children } ) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
        { title }
      </h3>
      <div className="bg-neutral-50 rounded-lg px-3 py-2">{ children }</div>
    </div>
  );
}

function ReviewRow( { label, value } ) {
  return (
    <div className="flex gap-2 py-0.5">
      <span className="w-20 text-neutral-400 shrink-0">{ label }</span>
      <span className="text-neutral-800">{ value }</span>
    </div>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator( { current, steps } ) {
  return (
    <nav aria-label="Form steps" className="flex items-center">
      { steps.map( ( s, i ) => {
        const done   = s.id < current;
        const active = s.id === current;
        return (
          <div key={ s.id } className="flex items-center flex-1 min-w-0">
            <div
              className={ [
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                done   ? 'bg-green-500 text-white'  : '',
                active ? 'bg-blue-600 text-white'   : '',
                ! done && ! active ? 'bg-neutral-200 text-neutral-400' : '',
              ].join( ' ' ) }
              aria-current={ active ? 'step' : undefined }
            >
              { done ? '✓' : s.id }
            </div>
            <span
              className={ [
                'text-xs mx-1 truncate',
                active ? 'text-blue-700 font-medium' : 'text-neutral-400',
              ].join( ' ' ) }
            >
              { s.label }
            </span>
            { i < steps.length - 1 && (
              <div className={ `h-px flex-1 ${ done ? 'bg-green-300' : 'bg-neutral-200' }` } />
            ) }
          </div>
        );
      } ) }
    </nav>
  );
}

// ─── Success screen ───────────────────────────────────────────────────────────

function SuccessScreen( { result, mediaFiles } ) {
  return (
    <div className="w-full max-w-2xl mx-auto text-center py-10 px-4">
      <div className="text-5xl mb-4">✅</div>
      <h2 className="text-2xl font-bold text-neutral-900 mb-2">Repair Request Submitted!</h2>
      <p className="text-neutral-600 mb-6">
        { result.message || "We've received your request and will be in touch soon." }
      </p>

      <div className="inline-block bg-neutral-50 border border-neutral-200 rounded-xl px-6 py-4 mb-6 text-left">
        <div className="text-xs text-neutral-400 mb-1">Your Repair ID</div>
        <div className="text-2xl font-mono font-bold text-blue-700">DTB-{ result.repair_id }</div>
      </div>

      { result.public_token && (
        <div className="mb-6">
          <a
            href={ `/repairs/status/${ result.repair_id }?token=${ encodeURIComponent( result.public_token ) }` }
            className="inline-block px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Track Your Repair →
          </a>
        </div>
      ) }

      { mediaFiles.length > 0 && result.public_token && (
        <p className="text-xs text-neutral-400">
          Upload your { mediaFiles.length } photo{ mediaFiles.length !== 1 ? 's' : '' } from the tracking page.
        </p>
      ) }
    </div>
  );
}

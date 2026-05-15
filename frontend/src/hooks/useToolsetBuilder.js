/**
 * frontend/src/hooks/useToolsetBuilder.js
 *
 * State and data-fetching hook for the Toolset Builder.
 *
 * Replaces:
 *   - SET_TEMPLATES keyword-matching in ToolsetBuilder.jsx
 *   - getProducts() + getSlotProducts() variation fetching
 *
 * Usage:
 *   const {
 *     templates,              // all available templates
 *     activeTemplate,         // currently selected template object
 *     selectTemplate,         // (templateId) => void
 *     optionsBySlot,          // { [slotId]: ToolsetOption[] }
 *     selections,             // { [slotId]: ToolsetOption | null }
 *     selectOption,           // (slotId, option) => void
 *     clearSlot,              // (slotId) => void
 *     validate,               // () => Promise<ValidationResult>
 *     cartLines,              // ready-to-submit cart line items
 *     loadingTemplates,       // boolean
 *     loadingOptions,         // boolean
 *     validating,             // boolean
 *     error,                  // Error | null
 *   } = useToolsetBuilder({ brandKey })
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient }                                from '../api/client.js';
import { buildToolsetCartLines }                    from '../utils/cartLineFactory.js';

export function useToolsetBuilder( { brandKey = '' } = {} ) {
  const [ templates,        setTemplates        ] = useState( [] );
  const [ activeTemplateId, setActiveTemplateId ] = useState( null );
  const [ optionsBySlot,    setOptionsBySlot    ] = useState( {} );
  const [ selections,       setSelections       ] = useState( {} );
  const [ loadingTemplates, setLoadingTemplates ] = useState( true );
  const [ loadingOptions,   setLoadingOptions   ] = useState( false );
  const [ validating,       setValidating       ] = useState( false );
  const [ error,            setError            ] = useState( null );

  const mountedRef = useRef( true );
  useEffect( () => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, [] );

  // ── Load templates ─────────────────────────────────────────────────────────
  useEffect( () => {
    setLoadingTemplates( true );
    setError( null );

    const qs = brandKey ? `?brand=${ encodeURIComponent( brandKey ) }` : '';
    apiClient( `/wp-json/dtb/v1/toolsets${ qs }` )
      .then( data => {
        if ( ! mountedRef.current ) return;
        const list = data?.templates ?? [];
        setTemplates( list );
        // If the current activeTemplateId exists in the new list, keep it.
        // Otherwise auto-select the first available template.
        setActiveTemplateId( prev => {
          const stillValid = list.some( t => t.id === prev );
          return stillValid ? prev : ( list.length > 0 ? list[ 0 ].id : null );
        } );
        setLoadingTemplates( false );
      } )
      .catch( err => {
        if ( ! mountedRef.current ) return;
        setError( err );
        setLoadingTemplates( false );
      } );
  }, [ brandKey ] );

  // ── Load options when template changes ─────────────────────────────────────
  useEffect( () => {
    if ( ! activeTemplateId ) return;

    setLoadingOptions( true );
    setOptionsBySlot( {} );
    setSelections( {} ); // Reset selections when template changes.

    apiClient( `/wp-json/dtb/v1/toolsets/${ encodeURIComponent( activeTemplateId ) }/options` )
      .then( data => {
        if ( ! mountedRef.current ) return;
        setOptionsBySlot( data?.optionsBySlot ?? {} );
        setLoadingOptions( false );
      } )
      .catch( err => {
        if ( ! mountedRef.current ) return;
        setError( err );
        setLoadingOptions( false );
      } );
  }, [ activeTemplateId ] );

  // ── Selectors ──────────────────────────────────────────────────────────────

  const selectTemplate = useCallback( ( templateId ) => {
    setActiveTemplateId( templateId );
  }, [] );

  const selectOption = useCallback( ( slotId, option ) => {
    setSelections( prev => ( { ...prev, [ slotId ]: option } ) );
  }, [] );

  const clearSlot = useCallback( ( slotId ) => {
    setSelections( prev => {
      const next = { ...prev };
      delete next[ slotId ];
      return next;
    } );
  }, [] );

  // ── Validate ───────────────────────────────────────────────────────────────

  const validate = useCallback( async () => {
    if ( ! activeTemplateId ) {
      return { valid: false, errors: [ { code: 'no_template', message: 'No template selected.' } ], warnings: [] };
    }

    setValidating( true );
    setError( null );

    // Convert selections to the { productId, variationId } shape the API expects.
    const selPayload = {};
    for ( const [ slotId, option ] of Object.entries( selections ) ) {
      if ( option ) {
        selPayload[ slotId ] = {
          productId:   option.productId,
          variationId: option.variationId ?? 0,
        };
      }
    }

    try {
      const result = await apiClient( '/wp-json/dtb/v1/toolsets/validate', {
        method: 'POST',
        body:   JSON.stringify( {
          templateId: activeTemplateId,
          selections: selPayload,
        } ),
      } );
      return result;
    } catch ( err ) {
      setError( err );
      return { valid: false, errors: [ { code: 'network_error', message: err?.message ?? 'Validation failed.' } ], warnings: [] };
    } finally {
      if ( mountedRef.current ) setValidating( false );
    }
  }, [ activeTemplateId, selections ] );

  // ── Derive cart lines from current selections ──────────────────────────────

  const activeTemplate = templates.find( t => t.id === activeTemplateId ) ?? null;

  let cartLines = [];
  if ( activeTemplate && Object.keys( selections ).length > 0 ) {
    try {
      cartLines = buildToolsetCartLines( {
        templateId: activeTemplateId,
        brandKey:   activeTemplate.brandKey ?? brandKey,
        scope:      activeTemplate.scope    ?? '',
        selections: Object.fromEntries(
          Object.entries( selections )
            .filter( ( [ , opt ] ) => opt != null )
            .map( ( [ slotId, opt ] ) => {
              const slot = ( activeTemplate.slots ?? [] ).find( s => s.id === slotId );
              return [
                slotId,
                {
                  slotLabel:      slot?.label ?? slotId,
                  productId:      opt.productId,
                  variationId:    opt.variationId ?? 0,
                  quantity:       1,
                  isIncluded:     false,
                },
              ];
            } )
        ),
      } );
    } catch {
      // Cart lines will be empty — caller must validate before adding to cart.
      cartLines = [];
    }
  }

  return {
    templates,
    activeTemplate,
    selectTemplate,
    optionsBySlot,
    selections,
    selectOption,
    clearSlot,
    validate,
    cartLines,
    loadingTemplates,
    loadingOptions,
    validating,
    error,
  };
}

export default useToolsetBuilder;

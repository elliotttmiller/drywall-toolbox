/**
 * frontend/src/components/repairs/RepairMediaUploader.jsx
 *
 * File upload component used in two modes:
 *
 *   mode="local"   — stores files in local state only (for pre-submission use in RepairRequestForm).
 *                    Calls onChange(files) whenever the file list changes.
 *
 *   mode="upload"  — uploads files to the backend immediately via uploadRepairMedia().
 *                    Requires repairId + token. Calls onUploaded(attachmentIds) on success.
 *
 * Props:
 *   mode         'local' | 'upload'
 *   repairId     number|string  (required when mode='upload')
 *   token        string         (public repair token, required when mode='upload')
 *   onChange     (files: File[]) => void   — local mode callback
 *   onUploaded   (ids: number[]) => void   — upload mode callback
 *   maxFiles     number  default 5
 *   maxSizeMB    number  default 5
 */

import { useState, useRef, useCallback } from 'react';
import { uploadRepairMedia } from '../../api/repairs.js';

const ACCEPTED_TYPES = [ 'image/jpeg', 'image/png', 'image/gif', 'image/webp' ];

export default function RepairMediaUploader( {
  mode       = 'local',
  repairId,
  token,
  onChange,
  onUploaded,
  maxFiles   = 5,
  maxSizeMB  = 5,
} ) {
  const [ files,      setFiles      ] = useState( [] ); // { file, preview, id? }
  const [ dragging,   setDragging   ] = useState( false );
  const [ uploading,  setUploading  ] = useState( false );
  const [ uploadErr,  setUploadErr  ] = useState( null );
  const [ fileErrors, setFileErrors ] = useState( [] );

  const inputRef = useRef( null );

  const maxBytes = maxSizeMB * 1024 * 1024;

  const addFiles = useCallback( ( rawFiles ) => {
    const errs  = [];
    const valid = [];

    for ( const f of rawFiles ) {
      if ( ! ACCEPTED_TYPES.includes( f.type ) ) {
        errs.push( `"${ f.name }" is not a supported image type (JPEG, PNG, GIF, WebP).` );
        continue;
      }
      if ( f.size > maxBytes ) {
        errs.push( `"${ f.name }" exceeds the ${ maxSizeMB } MB size limit.` );
        continue;
      }
      valid.push( f );
    }

    setFileErrors( errs );

    setFiles( ( prev ) => {
      const remaining = maxFiles - prev.length;
      if ( remaining <= 0 ) return prev;
      const toAdd = valid.slice( 0, remaining ).map( ( file ) => ( {
        file,
        preview: URL.createObjectURL( file ),
      } ) );
      const next = [ ...prev, ...toAdd ];
      if ( onChange ) onChange( next.map( ( e ) => e.file ) );
      return next;
    } );
  }, [ maxFiles, maxBytes, maxSizeMB, onChange ] );

  const removeFile = ( index ) => {
    setFiles( ( prev ) => {
      URL.revokeObjectURL( prev[ index ]?.preview );
      const next = prev.filter( ( _, i ) => i !== index );
      if ( onChange ) onChange( next.map( ( e ) => e.file ) );
      return next;
    } );
  };

  const handleInputChange = ( e ) => {
    if ( e.target.files?.length ) {
      addFiles( Array.from( e.target.files ) );
      // Reset input so the same file can be re-added after removal
      e.target.value = '';
    }
  };

  const handleDrop = ( e ) => {
    e.preventDefault();
    setDragging( false );
    if ( e.dataTransfer.files?.length ) {
      addFiles( Array.from( e.dataTransfer.files ) );
    }
  };

  const handleUpload = async () => {
    if ( ! repairId || ! token || files.length === 0 ) return;

    setUploading( true );
    setUploadErr( null );

    try {
      const formData = new FormData();
      files.forEach( ( { file } ) => formData.append( 'files[]', file ) );
      const result = await uploadRepairMedia( repairId, formData, token );
      if ( onUploaded ) onUploaded( result.attachment_ids || [] );
      // Clear files after successful upload
      files.forEach( ( { preview } ) => URL.revokeObjectURL( preview ) );
      setFiles( [] );
    } catch ( err ) {
      setUploadErr( err.message || 'Upload failed. Please try again.' );
    } finally {
      setUploading( false );
    }
  };

  const atLimit = files.length >= maxFiles;

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      { ! atLimit && (
        <div
          role="button"
          tabIndex={ 0 }
          aria-label="Upload photos — click or drag files here"
          onClick={ () => inputRef.current?.click() }
          onKeyDown={ ( e ) => e.key === 'Enter' && inputRef.current?.click() }
          onDragOver={ ( e ) => { e.preventDefault(); setDragging( true );  } }
          onDragLeave={ ()  => setDragging( false ) }
          onDrop={ handleDrop }
          className={ [
            'border-2 border-dashed rounded-xl px-6 py-8 text-center cursor-pointer transition-colors select-none',
            dragging
              ? 'border-blue-400 bg-blue-50'
              : 'border-neutral-300 hover:border-neutral-400 bg-neutral-50',
          ].join( ' ' ) }
        >
          <div className="text-2xl mb-1">📎</div>
          <p className="text-sm text-neutral-600 font-medium">
            Drag &amp; drop photos here, or click to browse
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            JPEG, PNG, GIF, WebP — up to { maxSizeMB } MB each — max { maxFiles } files
          </p>
        </div>
      ) }

      <input
        ref={ inputRef }
        type="file"
        accept={ ACCEPTED_TYPES.join( ',' ) }
        multiple
        className="hidden"
        aria-hidden="true"
        onChange={ handleInputChange }
      />

      {/* Validation errors */}
      { fileErrors.map( ( msg, i ) => (
        <p key={ i } className="text-xs text-red-600" role="alert">{ msg }</p>
      ) ) }

      {/* Thumbnails */}
      { files.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          { files.map( ( { file, preview }, idx ) => (
            <div key={ idx } className="relative group aspect-square rounded-lg overflow-hidden border border-neutral-200 bg-neutral-100">
              <img
                src={ preview }
                alt={ file.name }
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                aria-label={ `Remove ${ file.name }` }
                onClick={ () => removeFile( idx ) }
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
              >
                ×
              </button>
              <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-black/40 text-white text-xs truncate">
                { file.name }
              </div>
            </div>
          ) ) }
        </div>
      ) }

      { atLimit && (
        <p className="text-xs text-neutral-400">Maximum of { maxFiles } files reached.</p>
      ) }

      {/* Upload button (upload mode only) */}
      { mode === 'upload' && files.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={ handleUpload }
            disabled={ uploading }
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            { uploading ? 'Uploading…' : `Upload ${ files.length } Photo${ files.length !== 1 ? 's' : '' }` }
          </button>
          { uploading && (
            <span className="text-xs text-neutral-500 animate-pulse">Please wait…</span>
          ) }
        </div>
      ) }

      { uploadErr && (
        <p className="text-xs text-red-600" role="alert">{ uploadErr }</p>
      ) }
    </div>
  );
}

// Matches the emitted webpack entry scripts. This stays in sync with
// frontend/webpack.config.cjs, which writes JS bundles to assets/js/.
const ASSET_SCRIPT_SUFFIX_SOURCE = String.raw`\/assets\/js\/[^/]+\.js`;
const ASSET_SCRIPT_PATH_PATTERN = new RegExp( `${ ASSET_SCRIPT_SUFFIX_SOURCE }(?:[?#].*)?$`, 'i' );
const ASSET_SCRIPT_SUFFIX_PATTERN = new RegExp( `${ ASSET_SCRIPT_SUFFIX_SOURCE }$`, 'i' );

export function resolveRuntimeAssetBase() {
  if ( typeof window === 'undefined' ) {
    return '';
  }

  const configuredAssetsUrl = window.DTB_CONFIG?.assetsUrl;
  if ( typeof configuredAssetsUrl === 'string' && configuredAssetsUrl.trim() ) {
    return configuredAssetsUrl.trim().replace( /\/+$/, '' );
  }

  if ( typeof document === 'undefined' ) {
    return '';
  }

  const scriptElements = document.scripts || [];
  let entryScriptUrl = '';

  for ( let index = scriptElements.length - 1; index >= 0; index -= 1 ) {
    const candidateSrc = scriptElements[index]?.src || '';
    if ( candidateSrc && ASSET_SCRIPT_PATH_PATTERN.test( candidateSrc ) ) {
      entryScriptUrl = candidateSrc;
      break;
    }
  }

  if ( ! entryScriptUrl ) {
    return '';
  }

  return entryScriptUrl
    .replace( /[?#].*$/, '' )
    .replace( ASSET_SCRIPT_SUFFIX_PATTERN, '' )
    .replace( /\/+$/, '' );
}

export function joinRuntimeAssetUrl( relativePath = '' ) {
  const normalizedRelativePath = String( relativePath || '' ).replace( /^\/+/, '' );
  const runtimeAssetBase = resolveRuntimeAssetBase();

  if ( ! normalizedRelativePath ) {
    return runtimeAssetBase || '/';
  }

  if ( ! runtimeAssetBase ) {
    return `/${ normalizedRelativePath }`;
  }

  return `${ runtimeAssetBase }/${ normalizedRelativePath }`;
}

export function initializeWebpackPublicPath() {
  const runtimeAssetBase = resolveRuntimeAssetBase();

  if ( runtimeAssetBase ) {
    // eslint-disable-next-line no-undef
    __webpack_public_path__ = `${ runtimeAssetBase }/`;
  }
}

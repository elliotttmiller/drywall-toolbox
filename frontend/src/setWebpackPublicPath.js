// Matches the emitted webpack entry scripts. This stays in sync with
// frontend/webpack.config.cjs, which writes JS bundles to assets/js/.
const ASSET_SCRIPT_PATH_PATTERN = /\/assets\/js\/[^/]+\.js(?:[?#].*)?$/i;
const ASSET_SCRIPT_SUFFIX_PATTERN = /\/assets\/js\/[^/]+\.js$/i;

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

  const scriptSources = Array.from( document.scripts || [] )
    .map( ( script ) => script?.src || '' )
    .filter( Boolean )
    .reverse();

  const activeScriptUrl = scriptSources.find( ( src ) => ASSET_SCRIPT_PATH_PATTERN.test( src ) );
  if ( ! activeScriptUrl ) {
    return '';
  }

  return activeScriptUrl
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

const runtimeAssetBase = resolveRuntimeAssetBase();

if ( runtimeAssetBase ) {
  // eslint-disable-next-line no-undef
  __webpack_public_path__ = `${ runtimeAssetBase }/`;
}

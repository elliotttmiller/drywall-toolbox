/* global __webpack_public_path__ */

function resolveRuntimeAssetBase() {
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

  const activeScriptUrl = scriptSources.find( ( src ) => /\/assets\/js\/[^/]+\.js(?:[?#].*)?$/i.test( src ) );
  if ( ! activeScriptUrl ) {
    return '';
  }

  return activeScriptUrl
    .replace( /[?#].*$/, '' )
    .replace( /\/assets\/js\/[^/]+\.js$/i, '' )
    .replace( /\/+$/, '' );
}

const runtimeAssetBase = resolveRuntimeAssetBase();

if ( runtimeAssetBase ) {
  __webpack_public_path__ = `${ runtimeAssetBase }/`;
}

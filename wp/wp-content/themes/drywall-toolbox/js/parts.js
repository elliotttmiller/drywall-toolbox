/**
 * Drywall Toolbox - Parts & Schematics JS
 * Supplemental utilities for the parts page.
 * Core logic is in page-parts.php inline script.
 * This file handles any cross-page utilities needed by parts.
 */
(function () {
  'use strict';

  /**
   * Utility: load a JSON file and return a promise.
   */
  window.DTBParts = {
    loadJson: function (url) {
      return fetch(url).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
        return r.json();
      });
    },

    /**
     * Build image URL for a schematic page.
     * @param {string} themeUri - base theme URI
     * @param {string} brand    - 'Columbia' or 'TapeTech'
     * @param {string} toolPath - relative path within brand schematics
     * @param {string} imgFile  - image filename
     */
    buildImageUrl: function (themeUri, brand, toolPath, imgFile) {
      var base = brand === 'Columbia'
        ? themeUri + '/assets/brands/Columbia/Schematics/' + toolPath + '/'
        : themeUri + '/assets/brands/' + toolPath + '/';
      return base + imgFile;
    },

    /**
     * Escape HTML for safe rendering.
     */
    escHtml: function (str) {
      return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
  };

})();

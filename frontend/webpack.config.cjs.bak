/**
 * frontend/webpack.config.cjs  —  Drywall Toolbox React SPA
 *
 * Production-grade build configuration.
 * Run from the frontend/ directory: npm run build
 *
 * Key behaviours:
 *  – Production build outputs to ../dist/ (repo-root dist/) for clean separation.
 *  – All import.meta.env.* and process.env.* references are statically replaced
 *    via DefinePlugin at compile time.
 *  – public/ folder contents are copied verbatim into dist/.
 *  – CSS goes through PostCSS (Tailwind v4 + autoprefixer), extracted to a
 *    separate file in production, injected via style-loader in dev.
 *  – Deterministic chunk IDs + content hashes guarantee safe long-term caching.
 *  – Tree-shaking and minification via TerserPlugin + CssMinimizerPlugin.
 *  – Bundle analysis available via ANALYZE=true npm run build.
 */

'use strict';

const path                  = require('path');
const fs                    = require('fs');
const webpack               = require('webpack');
const HtmlWebpackPlugin     = require('html-webpack-plugin');
const CopyWebpackPlugin     = require('copy-webpack-plugin');
const MiniCssExtractPlugin  = require('mini-css-extract-plugin');
const CssMinimizerPlugin    = require('css-minimizer-webpack-plugin');
const TerserPlugin          = require('terser-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const { GenerateSW }            = require('workbox-webpack-plugin');
// ─── Load environment-specific .env files ──────────────────────────────────
// This MUST happen inside module.exports so we can read argv/env flags passed
// by webpack CLI (for example: --env appEnv=staging).
//
// Resolution order:
//   1. CLI --env appEnv=... (explicit build target)
//   2. APP_ENV / REACT_APP_APP_ENV / REACT_APP_ENV from shell/CI
//   3. Fallback from webpack mode (production/development)
//
// dotenv.config() does not override pre-set env vars by default, so CI secrets
// and workflow-level env still win over file values.

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Read an env var, trim whitespace, return empty string if absent/empty. */
const env = (key) => (process.env[key] || '').trim();
const SERVER_ERROR_CODES = [
  400, 401, 402, 403, 404, 405, 406, 408, 409, 410, 411, 412, 413, 414, 415, 416, 417,
  421, 422, 423, 424, 426, 428, 429, 431, 451,
  500, 501, 502, 503, 504, 505, 507, 508, 511,
];

// ─── Config factory ──────────────────────────────────────────────────────────

module.exports = (envFlags, argv) => {
  // Determine build mode from webpack argv FIRST
  const mode   = (argv && argv.mode) ? argv.mode : (process.env.NODE_ENV || 'development');

  // Resolve application environment (production/staging/development).
  const cliAppEnv = (envFlags && envFlags.appEnv) ? String(envFlags.appEnv).trim() : '';
  const inferredAppEnv = mode === 'production' ? 'production' : 'development';
  const appEnv = (
    cliAppEnv ||
    process.env.APP_ENV ||
    process.env.REACT_APP_APP_ENV ||
    process.env.REACT_APP_ENV ||
    inferredAppEnv
  ).trim().toLowerCase();

  const envFileByAppEnv = {
    development: '.env.development',
    production: '.env.production',
    staging: '.env.staging',
    test: '.env.test',
  };

  const envFiles = [];
  if (envFileByAppEnv[appEnv]) {
    envFiles.push(envFileByAppEnv[appEnv]);
  }
  envFiles.push(mode === 'production' ? '.env.production' : '.env.development');
  envFiles.push('.env');

  const seen = new Set();
  for (const envFile of envFiles) {
    if (!envFile || seen.has(envFile)) {
      continue;
    }
    seen.add(envFile);
    if (fs.existsSync(envFile)) {
      require('dotenv').config({ path: envFile, quiet: true });
    }
  }

  // Now that env vars are loaded, continue with the rest of config
  const isDev  = mode !== 'production';
  const analyze = process.env.ANALYZE === 'true';

  // Production: assets are served from / at the domain root.
  // Development: serve from / (webpack-dev-server).
  const PUBLIC_URL = env('PUBLIC_URL').replace(/\/+$/, '');
  const publicPath = isDev ? '/' : (PUBLIC_URL ? `${PUBLIC_URL}/` : '/');

  // Production writes to repo-root dist/ for clean CI separation.
  // Staging writes to repo-root dist-staging/ to avoid clobbering production.
  // Development writes to a local dist/ inside frontend/.
  const outputPath = isDev
    ? path.resolve(__dirname, 'dist')
    : appEnv === 'staging'
      ? path.resolve(__dirname, '..', 'dist-staging')
      : path.resolve(__dirname, '..', 'dist');

  const DEV_PROXY_TARGET = env('REACT_APP_API_BASE_URL') || 'https://drywalltoolbox.com';
  const cacheName = `${mode}-${appEnv}-${PUBLIC_URL || 'root'}`.replace(/[^a-z0-9_.-]+/gi, '-');
  const siteUrl = (env('REACT_APP_SITE_URL') || 'https://drywalltoolbox.com').replace(/\/+$/, '');
  const searchIndexingEnabled = env('REACT_APP_SEARCH_INDEXING') !== '0' && appEnv === 'production';
  const robotsContent = searchIndexingEnabled
    ? 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1'
    : 'noindex, nofollow, noarchive';

  // ─── DefinePlugin values ────────────────────────────────────────────────
  const defines = {
    // Node / CRA conventions
    'process.env.NODE_ENV':              JSON.stringify(isDev ? 'development' : 'production'),
    'process.env.PUBLIC_URL':            JSON.stringify(publicPath),

    // WooCommerce REST API (CRA-style — legacy compat)
    'process.env.REACT_APP_WP_BASE_URL':        JSON.stringify(env('REACT_APP_WP_BASE_URL')),
    'process.env.REACT_APP_WC_BASE_URL':        JSON.stringify(env('REACT_APP_WC_BASE_URL')),
    'process.env.REACT_APP_WC_AUTH_USER':       JSON.stringify(env('REACT_APP_WC_AUTH_USER')),
    'process.env.REACT_APP_WC_AUTH_PASS':       JSON.stringify(env('REACT_APP_WC_AUTH_PASS')),

    // import.meta.env shims — Webpack DefinePlugin replaces these at compile time.
    // All variables follow the REACT_APP_* convention (process.env.REACT_APP_*).
    'import.meta.env.BASE_URL':                         JSON.stringify(publicPath),
    'import.meta.env.MODE':                             JSON.stringify(mode),
    'import.meta.env.DEV':                              JSON.stringify(isDev),
    'import.meta.env.PROD':                             JSON.stringify(!isDev),

    // Headless WP + WooCommerce architecture
    'process.env.REACT_APP_WP_API_BASE':                JSON.stringify(env('REACT_APP_WP_API_BASE')),
    'process.env.REACT_APP_WC_API_BASE':                JSON.stringify(env('REACT_APP_WC_API_BASE')),
    'process.env.REACT_APP_JWT_ENDPOINT':               JSON.stringify(env('REACT_APP_JWT_ENDPOINT')),
    'process.env.REACT_APP_SITE_URL':                   JSON.stringify(env('REACT_APP_SITE_URL')),
    'process.env.REACT_APP_APP_ENV':                    JSON.stringify(env('REACT_APP_APP_ENV') || appEnv),

    // WooCommerce legacy compat (previously VITE_WOOCOMMERCE_*)
    'process.env.REACT_APP_WOOCOMMERCE_STORE_URL':      JSON.stringify(env('REACT_APP_WOOCOMMERCE_STORE_URL')),
    'process.env.REACT_APP_WOOCOMMERCE_CONSUMER_KEY':   JSON.stringify(env('REACT_APP_WOOCOMMERCE_CONSUMER_KEY')),
    'process.env.REACT_APP_WOOCOMMERCE_CONSUMER_SECRET':JSON.stringify(env('REACT_APP_WOOCOMMERCE_CONSUMER_SECRET')),

    // ─── Headless WooCommerce proxy (drywall/v1) ──────────────────────────────
    // Read from the environment-specific .env file loaded above.
    'process.env.REACT_APP_API_BASE_URL':               JSON.stringify(env('REACT_APP_API_BASE_URL')),
    'process.env.REACT_APP_DTB_API_BASE':               JSON.stringify(env('REACT_APP_DTB_API_BASE')),
    'process.env.REACT_APP_STORE_API_BASE':             JSON.stringify(env('REACT_APP_STORE_API_BASE')),
    'process.env.REACT_APP_JWT_AUTH_ENDPOINT':          JSON.stringify(env('REACT_APP_JWT_AUTH_ENDPOINT')),
    'process.env.REACT_APP_ENV':                        JSON.stringify(env('REACT_APP_ENV') || appEnv),
    'process.env.REACT_APP_REWARDS_ENABLED':            JSON.stringify(env('REACT_APP_REWARDS_ENABLED')),
    'process.env.REACT_APP_CATALOG_SNAPSHOTS_ENABLED':  JSON.stringify(env('REACT_APP_CATALOG_SNAPSHOTS_ENABLED')),
    'process.env.REACT_APP_DTB_CATALOG_PLATFORM':       JSON.stringify(env('REACT_APP_DTB_CATALOG_PLATFORM')),
    'process.env.REACT_APP_GOOGLE_MAPS_PLACES_API_KEY': JSON.stringify(env('REACT_APP_GOOGLE_MAPS_PLACES_API_KEY')),
    'process.env.REACT_APP_SEARCH_INDEXING':            JSON.stringify(env('REACT_APP_SEARCH_INDEXING')),
    'process.env.REACT_APP_GOOGLE_SSO_URL':             JSON.stringify(env('REACT_APP_GOOGLE_SSO_URL')),
    'process.env.REACT_APP_AUTH_GOOGLE_URL':            JSON.stringify(env('REACT_APP_AUTH_GOOGLE_URL')),
    'process.env.REACT_APP_APPLE_SSO_URL':              JSON.stringify(env('REACT_APP_APPLE_SSO_URL')),
    'process.env.REACT_APP_AUTH_APPLE_URL':             JSON.stringify(env('REACT_APP_AUTH_APPLE_URL')),

    // Build timestamp — set once at config evaluation time (not per-module).
    'process.env.BUILD_TIMESTAMP':                      JSON.stringify(new Date().toISOString()),

    // Founding-member promo window (ISO-8601 date string, e.g. "2026-06-01T00:00:00Z")
    'process.env.REACT_APP_STORE_LAUNCH_DATE':          JSON.stringify(env('REACT_APP_STORE_LAUNCH_DATE')),
  };

  // ─── Inline asset manifest plugin ───────────────────────────────────────
  // Writes dist/asset-manifest.json so WordPress PHP can resolve hashed filenames.
  const EmitAssetManifestPlugin = {
    apply(compiler) {
      compiler.hooks.thisCompilation.tap('EmitAssetManifestPlugin', (compilation) => {
        compilation.hooks.processAssets.tap(
          { name: 'EmitAssetManifestPlugin', stage: webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE },
          (assets) => {
            try {
              const files = {};
              for (const [filename] of Object.entries(assets)) {
                if (filename === 'asset-manifest.json') continue;
                const basename = path.basename(filename);
                const key = basename.replace(/\.[a-f0-9]{8}(\.\w+)$/, '$1').replace(/^(\w+)(\.\w+)$/, '$1$2');
                files[key] = publicPath + filename;
              }
              const manifest = { files, entrypoints: ['main.js', 'main.css'] };
              compilation.emitAsset('asset-manifest.json', new webpack.sources.RawSource(JSON.stringify(manifest, null, 2)));
            } catch (err) {
              compilation.errors.push(err);
            }
          },
        );
      });
    },
  };

  const EmitServerErrorPagesPlugin = {
    apply(compiler) {
      compiler.hooks.thisCompilation.tap('EmitServerErrorPagesPlugin', (compilation) => {
        compilation.hooks.processAssets.tap(
          { name: 'EmitServerErrorPagesPlugin', stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL },
          () => {
            const template = fs.readFileSync(path.resolve(__dirname, 'error-page.html'), 'utf8')
              .replaceAll('__PUBLIC_URL__', PUBLIC_URL);
            for (const code of SERVER_ERROR_CODES) {
              compilation.emitAsset(
                `errors/${code}.html`,
                new webpack.sources.RawSource(template.replaceAll('__ERROR_CODE__', String(code))),
              );
            }
          },
        );
      });
    },
  };

  return {
    mode,
    bail: !isDev,
    cache: {
      type: 'filesystem',
      name: cacheName,
      buildDependencies: {
        config: [
          __filename,
          path.resolve(__dirname, 'babel.config.json'),
          path.resolve(__dirname, 'postcss.config.js'),
          path.resolve(__dirname, 'package-lock.json'),
        ],
      },
    },

    // ─── Entry ─────────────────────────────────────────────────────────────
    entry: './src/main.jsx',

    // ─── Output ────────────────────────────────────────────────────────────
    output: {
      path:      outputPath,
      publicPath,
      // Use stable JS entry/chunk names in production to avoid transient
      // GitHub Pages 404s when a stale HTML shell references a previous
      // content-hashed filename during edge/browser cache propagation.
      filename:  'assets/js/[name].js',
      chunkFilename: 'assets/js/[name].chunk.js',
      assetModuleFilename: 'assets/media/[name].[hash:8][ext]',
      clean: true,
    },

    // ─── Resolution ────────────────────────────────────────────────────────
    resolve: {
      extensions: ['.js', '.jsx', '.json'],
      // Resolve absolute imports from frontend/public/, root public/, and project root.
      // Brands and schematics live in the root public/brands/ (not duplicated in frontend/).
      roots: [
        path.resolve(__dirname, 'public'),
        path.resolve(__dirname, '..', 'public'),  // root public/ for brands/schematics
        path.resolve(__dirname),
      ],
      alias: {
        '@':           path.resolve(__dirname, 'src'),
        '@api':        path.resolve(__dirname, 'src/api'),
        '@components': path.resolve(__dirname, 'src/components'),
        '@hooks':      path.resolve(__dirname, 'src/hooks'),
        '@pages':      path.resolve(__dirname, 'src/pages'),
        '@styles':     path.resolve(__dirname, 'src/styles'),
        '@context':    path.resolve(__dirname, 'src/context'),
      },
    },

    // ─── Loaders ───────────────────────────────────────────────────────────
    module: {
      rules: [
        {
          test:    /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              cacheDirectory: true,
              cacheCompression: false,
            },
          },
        },
        {
          test: /\.css$/,
          use: [
            isDev ? 'style-loader' : MiniCssExtractPlugin.loader,
            {
              loader: 'css-loader',
              options: { importLoaders: 1, sourceMap: isDev },
            },
            {
              loader: 'postcss-loader',
              options: { sourceMap: isDev },
            },
          ],
        },
        {
          test: /\.(png|jpe?g|gif|ico|webp)$/i,
          type: 'asset',
          parser: { dataUrlCondition: { maxSize: 4 * 1024 } },
          generator: { 
            filename: 'assets/images/[name].[hash:8][ext]',
            // Don't inline large images; always reference them as separate files
          },
          // NOTE: Schematic PNGs (4+ MiB) should be CDN-served, not bundled
        },
        {
          test: /\.svg$/i,
          type: 'asset/resource',
          generator: { filename: 'assets/images/[name].[hash:8][ext]' },
        },
        {
          test: /\.(woff2?|eot|ttf|otf)$/i,
          type: 'asset/resource',
          generator: { filename: 'assets/fonts/[name].[hash:8][ext]' },
        },
      ],
    },

    // ─── Plugins ───────────────────────────────────────────────────────────
    plugins: [
      new webpack.DefinePlugin(defines),

      new HtmlWebpackPlugin({
        template:  './index.html',
        publicPath,
        siteUrl,
        robotsContent,
        inject:    'body',
        minify: isDev ? false : {
          removeComments:                true,
          collapseWhitespace:            true,
          removeRedundantAttributes:     true,
          useShortDoctype:               true,
          removeEmptyAttributes:         true,
          removeStyleLinkTypeAttributes: true,
          keepClosingSlash:              true,
          minifyJS:                      true,
          minifyCSS:                     true,
          minifyURLs:                    true,
        },
      }),

      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'public',
            to:   '.',
            globOptions: {
              dot: true,
              ignore: [
                // HTML handled by HtmlWebpackPlugin
                '**/index.html',
                '**/.htaccess',
                // CSV data files — served via WooCommerce REST API, not bundled
                '**/*.csv',
                '**/*.bak',
                '**/products_catalog.csv',
                '**/products_catalog_*.csv',
                // Dev/build scripts — never ship to dist
                '**/scripts/**',
                // Scraped product data — source files only, not for dist
                '**/scraped_results/**',
              ],
            },
          },
          {
            from: 'public/.htaccess',
            to: '.htaccess',
            toType: 'file',
            transform(content) {
              return content.toString().replaceAll('__DTB_PUBLIC_URL__', PUBLIC_URL);
            },
          },
        ],
      }),

      EmitServerErrorPagesPlugin,

      ...(!isDev ? [
        new MiniCssExtractPlugin({
          // Keep CSS entry/chunk names stable for the same reason as JS.
          filename:      'assets/css/[name].css',
          chunkFilename: 'assets/css/[name].chunk.css',
        }),

        // ── Service Worker (Workbox GenerateSW) ─────────────────────────────
        // Generates a production service worker in dist/service-worker.js.
        // Precaches all hashed JS/CSS chunks emitted by webpack (safe since
        // they are content-addressed and never change once deployed).
        // Runtime caching covers images, fonts, and DTB/WC REST API responses.
        new GenerateSW({
          clientsClaim: true,
          skipWaiting:  true,
          swDest:       'service-worker.js',

          // Precache all webpack-emitted JS/CSS/HTML — they're content-hashed
          // so any changed file gets a new URL and is re-fetched automatically.
          // Images, fonts, and large brand/schematic trees are intentionally
          // excluded from precache (they'd blow the storage quota at 191 MB).
          // They are instead served by the runtime caching strategies below.
          exclude: [
            /\.map$/,
            /asset-manifest\.json$/,
            /\.(?:png|jpe?g|gif|webp|avif|svg|ico)$/i,   // all images → runtime cache
            /\.(?:woff2?|ttf|eot|otf)$/i,                  // fonts → runtime cache
            /^brands\//,                                    // brand image trees
            /^schematics\//,                               // schematic image/PDF trees
          ],

          // Offline fallback: serve cached index.html for any navigation that
          // fails while the user is offline so the SPA shell remains usable.
          navigateFallback: publicPath + 'index.html',
          navigateFallbackDenylist: [
            // Never intercept wp-json or admin requests.
            /\/wp-json\//,
            /\/wp-admin\//,
            /\/wp\//,
          ],

          // Runtime caching strategies
          runtimeCaching: [
            // Images — CacheFirst with 1-year expiry; images are immutable once published
            {
              urlPattern:  /\.(?:png|jpe?g|gif|webp|avif|svg|ico)$/i,
              handler:     'CacheFirst',
              options: {
                cacheName:  'dtb-images-v1',
                expiration: { maxEntries: 300, maxAgeSeconds: 365 * 24 * 60 * 60 },
              },
            },
            // Web fonts — CacheFirst; fonts don't change between builds
            {
              urlPattern:  /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
              handler:     'CacheFirst',
              options: {
                cacheName:  'dtb-fonts-v1',
                expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 },
              },
            },
            // DTB REST API (dtb/v1) — StaleWhileRevalidate: renders instantly from
            // cache, silently refreshed in background. Auth routes are excluded.
            {
              urlPattern:  /\/wp-json\/dtb\/v1\/(?!auth|jwt|login)/,
              handler:     'StaleWhileRevalidate',
              options: {
                cacheName:  'dtb-api-v1',
                expiration: { maxEntries: 60, maxAgeSeconds: 24 * 60 * 60 },
              },
            },
            // WooCommerce Store API (wc/store/v1) — NetworkFirst so cart/checkout
            // always get fresh data, but fall back to cache if offline.
            {
              urlPattern:  /\/wp-json\/wc\/store\/v1\//,
              handler:     'NetworkFirst',
              options: {
                cacheName:            'dtb-wc-store-v1',
                networkTimeoutSeconds: 4,
                expiration:           { maxEntries: 30, maxAgeSeconds: 5 * 60 },
              },
            },
          ],
        }),
      ] : []),

      EmitAssetManifestPlugin,

      ...(analyze ? [new BundleAnalyzerPlugin({ analyzerMode: 'static', openAnalyzer: true })] : []),
    ],

    // ─── Optimisation ──────────────────────────────────────────────────────
    optimization: {
      minimize: !isDev,
      minimizer: [
        new TerserPlugin({
          parallel: true,
          terserOptions: {
            compress: {
              drop_console: true,
              drop_debugger: true,
              pure_funcs: ['console.log', 'console.info', 'console.debug'],
            },
            output: { comments: false },
          },
          extractComments: false,
        }),
        new CssMinimizerPlugin(),
      ],

      splitChunks: {
        chunks: 'all',
        maxInitialRequests: 6,
        maxAsyncRequests:   8,
        minSize: 20_000,
        minRemainingSize: 0,
        cacheGroups: {
          // Disable Webpack's implicit default groups. They emit numeric shared
          // async chunks (for example 770.chunk.js) that are easy to miss during
          // selective staging deploys, leaving lazy checkout routes unable to
          // load even when their route-specific chunk exists.
          default: false,
          defaultVendors: false,
          // React core — must be in the initial bundle for every route.
          reactVendor: {
            test:     /[\\/]node_modules[\\/](react|react-dom|react-router(-dom)?)[\\/]/,
            name:     'vendor-react',
            chunks:   'initial',
            priority: 50,
            reuseExistingChunk: true,
          },
          // framer-motion (~280 kB min) — used by PageTransition (sync) and
          // animated page components (async). 'all' puts it in one named chunk
          // shared by both initial and async consumers; avoids duplication.
          framerMotion: {
            test:     /[\\/]node_modules[\\/]framer-motion[\\/]/,
            name:     'vendor-framer-motion',
            chunks:   'all',
            priority: 45,
            reuseExistingChunk: true,
          },
          // lucide-react is tree-shaken per icon, but its shared runtime is
          // used by both the initial shell (Header/Footer) and async pages.
          // 'all' canonicalises it into one chunk.
          lucide: {
            test:     /[\\/]node_modules[\\/]lucide-react[\\/]/,
            name:     'vendor-lucide',
            chunks:   'all',
            priority: 45,
            reuseExistingChunk: true,
          },
          // Stripe JS is only needed on the checkout route (lazy-loaded).
          stripe: {
            test:     /[\\/]node_modules[\\/]@stripe[\\/]/,
            name:     'vendor-stripe',
            chunks:   'async',
            priority: 45,
            reuseExistingChunk: true,
          },
          // Remaining node_modules share one initial vendor chunk.
          vendor: {
            test:     /[\\/]node_modules[\\/]/,
            name:     'vendor',
            chunks:   'initial',
            priority: 20,
            reuseExistingChunk: true,
          },
          // App code shared across ≥2 async chunks (e.g. api/client, utils).
          common: {
            name:               'common',
            minChunks:          2,
            chunks:             'all',
            priority:           10,
            reuseExistingChunk: true,
            enforce:            true,
          },
        },
      },

      runtimeChunk: 'single',
      moduleIds: 'deterministic',
      chunkIds:  'deterministic',
    },

    // ─── Dev server ────────────────────────────────────────────────────────
    devServer: {
      port:               5173,
      historyApiFallback: true,
      hot:                true,
      open:               true,
      compress:           true,
      static: [
        {
          directory:  path.join(__dirname, 'public'),
          publicPath,
        },
        {
          // Also serve root public/ for brands/ and schematics/ directories.
          // These are large assets not duplicated in frontend/public/.
          directory:  path.join(__dirname, '..', 'public'),
          publicPath,
        },
      ],
      proxy: [
        {
          // Proxy all WP/WC REST and DTB API paths to the live backend.
          // This lets the dev server add the correct Origin and rewrite
          // CORS headers so the browser never sees a cross-origin request.
          context: [
            '/wp-json',       // canonical WP REST alias
            '/wp/wp-json',    // WP in /wp subdir
            '/wp-admin',      // WP admin-ajax etc.
          ],
          target: DEV_PROXY_TARGET,
          changeOrigin: true,
          secure: true,
        },
      ],
      client: {
        overlay: { errors: true, warnings: false },
        progress: true,
      },
    },

    devtool: isDev ? 'eval-cheap-module-source-map' : 'hidden-source-map',

    performance: {
      hints:             isDev ? false : 'warning',
      // Keep budgets close to the measured split-bundle baseline so warnings
      // flag real growth instead of the expected React/vendor storefront shell.
      maxEntrypointSize: 1_300_000,
      maxAssetSize:      1_000_000,
      // Only warn on JS and CSS — images/fonts/media are expected to be large
      assetFilter: (assetFilename) =>
        /\.(js|css)$/.test(assetFilename) && !assetFilename.endsWith('.map'),
    },

    stats: isDev ? 'errors-warnings' : 'errors-warnings',
  };
};



/**
 * webpack.config.cjs  —  Drywall Toolbox React SPA
 *
 * Production-grade build configuration.
 *
 * Key behaviours:
 *  – process.env.PUBLIC_URL drives the deployment base path.
 *    Production CI sets PUBLIC_URL via GitHub Actions secret.
 *    Leave it empty (or unset) for local dev to get paths at /.
 *  – All import.meta.env.* references in source are statically replaced
 *    via DefinePlugin at compile time (Vite-compat, no Vite runtime needed).
 *  – public/ folder contents are copied verbatim into dist/.
 *  – CSS goes through PostCSS (Tailwind v4 + autoprefixer), extracted to
 *    a separate file in production, injected via style-loader in dev.
 *  – Deterministic chunk IDs + content hashes guarantee safe long-term caching.
 *  – Tree-shaking and minification via TerserPlugin + CssMinimizerPlugin.
 *  – Bundle analysis available via ANALYZE=true npm run build.
 */

'use strict';

const path                  = require('path');
const webpack               = require('webpack');
const HtmlWebpackPlugin     = require('html-webpack-plugin');
const CopyWebpackPlugin     = require('copy-webpack-plugin');
const MiniCssExtractPlugin  = require('mini-css-extract-plugin');
const CssMinimizerPlugin    = require('css-minimizer-webpack-plugin');
const TerserPlugin          = require('terser-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Read an env var, trim whitespace, return empty string if absent/empty. */
const env = (key) => (process.env[key] || '').trim();

// ─── Config factory ──────────────────────────────────────────────────────────

module.exports = (envFlags, argv) => {
  const mode   = (argv && argv.mode) ? argv.mode : (process.env.NODE_ENV || 'development');
  const isDev  = mode !== 'production';
  const analyze = process.env.ANALYZE === 'true';

  // Normalise PUBLIC_URL — strip trailing slashes; empty = serve from root.
  const PUBLIC_URL  = env('PUBLIC_URL').replace(/\/+$/, '');
  // In production the React build lives inside the WordPress theme directory.
  // publicPath must point here so webpack's runtime can resolve lazy-loaded
  // route chunks (e.g. assets/js/Products.hash.chunk.js).  If PUBLIC_URL is
  // explicitly set (e.g. a full HTTPS URL) that value wins; otherwise we fall
  // back to the theme-relative path.
  const WP_THEME_DIST = '/wp-content/themes/drywall-toolbox/dist';
  const publicPath  = isDev ? '/' : (PUBLIC_URL ? `${PUBLIC_URL}/` : `${WP_THEME_DIST}/`);

  // Production writes directly into the WordPress theme for zero-copy CI deploys.
  const outputPath = isDev
    ? path.resolve(__dirname, 'dist')
    : path.resolve(__dirname, 'wp-content', 'themes', 'drywall-toolbox', 'dist');

  // ─── DefinePlugin values ────────────────────────────────────────────────
  // Group all compile-time replacements so they're easy to audit / extend.
  const defines = {
    // Node / CRA conventions
    'process.env.NODE_ENV':              JSON.stringify(isDev ? 'development' : 'production'),
    'process.env.PUBLIC_URL':            JSON.stringify(publicPath),

    // WooCommerce REST API (CRA-style)
    'process.env.REACT_APP_WP_BASE_URL':        JSON.stringify(env('REACT_APP_WP_BASE_URL')),
    'process.env.REACT_APP_WC_BASE_URL':        JSON.stringify(env('REACT_APP_WC_BASE_URL')),
    'process.env.REACT_APP_WC_CONSUMER_KEY':    JSON.stringify(env('REACT_APP_WC_CONSUMER_KEY')),
    'process.env.REACT_APP_WC_CONSUMER_SECRET': JSON.stringify(env('REACT_APP_WC_CONSUMER_SECRET')),

    // Vite-compat shims — replaces import.meta.env.* at compile time
    'import.meta.env.BASE_URL':                       JSON.stringify(publicPath),
    'import.meta.env.MODE':                           JSON.stringify(mode),
    'import.meta.env.DEV':                            JSON.stringify(isDev),
    'import.meta.env.PROD':                           JSON.stringify(!isDev),
    'import.meta.env.VITE_WOOCOMMERCE_STORE_URL':     JSON.stringify(env('VITE_WOOCOMMERCE_STORE_URL')),
    'import.meta.env.VITE_WOOCOMMERCE_CONSUMER_KEY':  JSON.stringify(env('VITE_WOOCOMMERCE_CONSUMER_KEY')),
    'import.meta.env.VITE_WOOCOMMERCE_CONSUMER_SECRET': JSON.stringify(env('VITE_WOOCOMMERCE_CONSUMER_SECRET')),
    'import.meta.env.VITE_VEEQO_CLIENT_ID':           JSON.stringify(env('VITE_VEEQO_CLIENT_ID')),
    'import.meta.env.VITE_VEEQO_CLIENT_SECRET':       JSON.stringify(env('VITE_VEEQO_CLIENT_SECRET')),
    'import.meta.env.VITE_VEEQO_REDIRECT_URI':        JSON.stringify(env('VITE_VEEQO_REDIRECT_URI')),
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
                // Build a stable key: strip hash + ext, then re-add ext.
                // e.g. "assets/js/main.a1b2c3d4.js" → key "main.js"
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

  return {
    mode,
    bail: !isDev, // Fail fast on first error in production builds

    // ─── Entry ─────────────────────────────────────────────────────────────
    entry: './src/main.jsx',

    // ─── Output ────────────────────────────────────────────────────────────
    output: {
      path:      outputPath,
      publicPath,
      // Deterministic hashes for reliable long-term browser caching
      filename:  isDev ? 'assets/js/[name].js'                  : 'assets/js/[name].[contenthash:8].js',
      // Lazy-loaded route chunks get readable names in dev, hashed in prod.
      // [name] resolves to the page component name (e.g. "Home", "Products")
      // because App.jsx uses named import() calls via React.lazy().
      chunkFilename: isDev ? 'assets/js/[name].chunk.js'        : 'assets/js/[name].[contenthash:8].chunk.js',
      assetModuleFilename: 'assets/media/[name].[hash:8][ext]',
      clean: true,
    },

    // ─── Resolution ────────────────────────────────────────────────────────
    resolve: {
      extensions: ['.js', '.jsx', '.json'],
      // Resolve absolute imports from public/ and project root (Vite parity)
      roots: [
        path.resolve(__dirname, 'public'),
        path.resolve(__dirname),
      ],
      // Alias for cleaner imports: "@/components/Foo" → "src/components/Foo"
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },

    // ─── Loaders ───────────────────────────────────────────────────────────
    module: {
      rules: [
        // JS / JSX via Babel
        {
          test:    /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              // Persistent cache speeds up repeated builds significantly
              cacheDirectory: true,
              cacheCompression: false,
            },
          },
        },
        // CSS → PostCSS (Tailwind v4 + autoprefixer) → css-loader
        {
          test: /\.css$/,
          use: [
            isDev ? 'style-loader' : MiniCssExtractPlugin.loader,
            {
              loader: 'css-loader',
              options: {
                importLoaders: 1,
                // Disable sourceMap in production (maps are pruned in CI anyway)
                sourceMap: isDev,
              },
            },
            {
              loader: 'postcss-loader',
              options: { sourceMap: isDev },
            },
          ],
        },
        // Raster images: inline tiny icons (<4 KB), emit larger ones as files
        {
          test: /\.(png|jpe?g|gif|ico|webp)$/i,
          type: 'asset',
          parser: { dataUrlCondition: { maxSize: 4 * 1024 } }, // 4 KB threshold
          generator: { filename: 'assets/images/[name].[hash:8][ext]' },
        },
        // SVG: always emit as file (never inline) — keeps bundle lean
        {
          test: /\.svg$/i,
          type: 'asset/resource',
          generator: { filename: 'assets/images/[name].[hash:8][ext]' },
        },
        // Fonts
        {
          test: /\.(woff2?|eot|ttf|otf)$/i,
          type: 'asset/resource',
          generator: { filename: 'assets/fonts/[name].[hash:8][ext]' },
        },
        // JSON handled natively by webpack 5 — no rule needed
      ],
    },

    // ─── Plugins ───────────────────────────────────────────────────────────
    plugins: [
      new webpack.DefinePlugin(defines),

      new HtmlWebpackPlugin({
        template:  './index.html',
        publicPath,
        inject:    'body',
        // Minify HTML in production
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
              // dot: true ensures dotfiles (e.g. public/.htaccess) are included.
              dot: true,
              ignore: [
                // HtmlWebpackPlugin owns index.html
                '**/index.html',
                // Large CSVs are never served from the static build
                '**/products_catalog.csv',
                '**/products_catalog_*.csv',
                // Brand schematics are uploaded once; skip every deploy
                '**/brands/**',
              ],
            },
          },
        ],
      }),

      // CSS extraction (production only)
      ...(!isDev ? [
        new MiniCssExtractPlugin({
          filename:      'assets/css/[name].[contenthash:8].css',
          chunkFilename: 'assets/css/[name].[contenthash:8].chunk.css',
        }),
      ] : []),

      // Key→path asset manifest for WordPress PHP enqueue
      EmitAssetManifestPlugin,

      // Optional bundle visualiser — run with: ANALYZE=true npm run build
      ...(analyze ? [new BundleAnalyzerPlugin({ analyzerMode: 'static', openAnalyzer: true })] : []),
    ],

    // ─── Optimisation ──────────────────────────────────────────────────────
    optimization: {
      minimize: !isDev,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: true,      // Strip console.* in production
              drop_debugger: true,
              pure_funcs: ['console.log', 'console.info', 'console.debug'],
            },
            output: { comments: false },
          },
          extractComments: false,      // No separate LICENSE.txt files
        }),
        new CssMinimizerPlugin(),
      ],

      splitChunks: {
        chunks: 'all',
        maxInitialRequests: 25,
        maxAsyncRequests:   30,   // Allow up to 30 parallel lazy chunk requests
        minSize: 20_000,
        cacheGroups: {
          // React core — changes only on React version bumps, very long cache life
          reactVendor: {
            test:     /[\\/]node_modules[\\/](react|react-dom|react-router(-dom)?)[\\/]/,
            name:     'vendor-react',
            chunks:   'all',
            priority: 30,
          },
          // All other node_modules — changes less often than app code
          vendor: {
            test:     /[\\/]node_modules[\\/]/,
            name:     'vendor',
            chunks:   'all',
            priority: 20,
          },
          // Shared app modules used by ≥2 chunks (including lazy route chunks)
          // e.g. shared hooks, utility functions, shared components
          common: {
            name:               'common',
            minChunks:          2,
            chunks:             'all',
            priority:           10,
            reuseExistingChunk: true,
            enforce:            true,  // Always split even if below minSize
          },
        },
      },

      // Keeps the webpack runtime in its own tiny chunk (better caching)
      runtimeChunk: 'single',

      // Deterministic module/chunk IDs — stable hashes across builds
      moduleIds: 'deterministic',
      chunkIds:  'deterministic',
    },

    // ─── Dev server ────────────────────────────────────────────────────────
    devServer: {
      port:               5173,        // Preserve former Vite default port
      historyApiFallback: true,        // React Router: serve index.html on 404
      hot:                true,
      open:               true,
      compress:           true,        // Gzip assets served by dev server
      static: {
        directory:  path.join(__dirname, 'public'),
        publicPath,
      },
      client: {
        overlay: { errors: true, warnings: false },
        progress: true,
      },
    },

    // ─── Source maps ───────────────────────────────────────────────────────
    // eval-cheap-module-source-map: fast rebuilds in dev, useful stack traces.
    // hidden-source-map: full maps in production but NOT referenced in bundles
    // (CI prunes the .map files anyway, so this is a safety belt).
    devtool: isDev ? 'eval-cheap-module-source-map' : 'hidden-source-map',

    // ─── Performance ───────────────────────────────────────────────────────
    performance: {
      // Warn when a bundle or asset exceeds these sizes (bytes).
      // Thresholds are tighter now that route chunks are lazy-loaded —
      // the initial entrypoint should be well under 500 KB.
      hints:             isDev ? false : 'warning',
      maxEntrypointSize: 500_000,   // 500 KB — should be comfortably met post-lazy
      maxAssetSize:      1_000_000, // 1 MB — schematic images are intentionally large
    },

    // ─── Stats ─────────────────────────────────────────────────────────────
    // Clean, readable output in CI logs; full detail locally via --display verbose
    stats: isDev ? 'errors-warnings' : {
      assets:       true,
      chunks:       true,          // Show chunk list — useful to verify lazy splits
      chunkGroups:  false,
      modules:      false,
      entrypoints:  true,
      colors:       true,
    },
  };
};

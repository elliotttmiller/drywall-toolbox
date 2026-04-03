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
// ─── Load environment-specific .env files ──────────────────────────────────
// This MUST happen inside the module.exports function so we can access argv.mode
// from webpack. If we do this at the top level, webpack hasn't passed argv yet.
//
// Priority order (first found wins):
//   1. NODE_ENV already set in shell (GitHub Actions, CI/CD)
//   2. argv.mode from webpack (--mode flag)
//   3. .env.development or .env.production (based on detected mode)
//   4. .env (legacy fallback)
//
// dotenv.config() is a no-op if variables are already set, so it's always safe.

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Read an env var, trim whitespace, return empty string if absent/empty. */
const env = (key) => (process.env[key] || '').trim();

// ─── Config factory ──────────────────────────────────────────────────────────

module.exports = (envFlags, argv) => {
  // Determine build mode from webpack argv FIRST
  const mode   = (argv && argv.mode) ? argv.mode : (process.env.NODE_ENV || 'development');

  // NOW load the appropriate .env file based on the actual build mode
  const envFile = mode === 'production' ? '.env.production' : '.env.development';
  
  // Load environment-specific .env file
  require('dotenv').config({ path: envFile });

  // Fallback to .env if the environment-specific file doesn't exist
  if (!require('fs').existsSync(envFile)) {
    require('dotenv').config({ path: '.env' });
  }

  // Now that env vars are loaded, continue with the rest of config
  const isDev  = mode !== 'production';
  const analyze = process.env.ANALYZE === 'true';

  // Production: assets are served from / at the domain root.
  // Development: serve from / (webpack-dev-server).
  const PUBLIC_URL = env('PUBLIC_URL').replace(/\/+$/, '');
  const publicPath = isDev ? '/' : (PUBLIC_URL ? `${PUBLIC_URL}/` : '/');

  // Production writes to repo-root dist/ for clean CI separation.
  // Development writes to a local dist/ inside frontend/.
  const outputPath = isDev
    ? path.resolve(__dirname, 'dist')
    : path.resolve(__dirname, '..', 'dist');

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

    // Vite-compat shims — replaces import.meta.env.* at compile time
    // NOTE: We're using Webpack (not Vite), but our source code uses import.meta.env.VITE_*
    // naming conventions. DefinePlugin below handles these automatically at build time.
    // No separate Vite config needed — this is standard Webpack practice for compatibility.
    'import.meta.env.BASE_URL':                         JSON.stringify(publicPath),
    'import.meta.env.MODE':                             JSON.stringify(mode),
    'import.meta.env.DEV':                              JSON.stringify(isDev),
    'import.meta.env.PROD':                             JSON.stringify(!isDev),

    // New VITE_* vars for headless WP + WooCommerce architecture
    // (These are just naming conventions; DefinePlugin replaces them at build time)
    'import.meta.env.VITE_WP_API_BASE':                 JSON.stringify(env('VITE_WP_API_BASE')),
    'import.meta.env.VITE_WC_API_BASE':                 JSON.stringify(env('VITE_WC_API_BASE')),
    'import.meta.env.VITE_JWT_ENDPOINT':                JSON.stringify(env('VITE_JWT_ENDPOINT')),
    'import.meta.env.VITE_SITE_URL':                    JSON.stringify(env('VITE_SITE_URL')),
    'import.meta.env.VITE_APP_ENV':                     JSON.stringify(env('VITE_APP_ENV')),
    'import.meta.env.VITE_WC_AUTH_USER':                JSON.stringify(env('VITE_WC_AUTH_USER')),
    'import.meta.env.VITE_WC_AUTH_PASS':                JSON.stringify(env('VITE_WC_AUTH_PASS')),

    // Legacy vars — kept for backward compat with existing source files
    'import.meta.env.VITE_WOOCOMMERCE_STORE_URL':       JSON.stringify(env('VITE_WOOCOMMERCE_STORE_URL')),
    'import.meta.env.VITE_WOOCOMMERCE_CONSUMER_KEY':    JSON.stringify(env('VITE_WOOCOMMERCE_CONSUMER_KEY')),
    'import.meta.env.VITE_WOOCOMMERCE_CONSUMER_SECRET': JSON.stringify(env('VITE_WOOCOMMERCE_CONSUMER_SECRET')),
    'import.meta.env.VITE_VEEQO_CLIENT_ID':             JSON.stringify(env('VITE_VEEQO_CLIENT_ID')),
    'import.meta.env.VITE_VEEQO_CLIENT_SECRET':         JSON.stringify(env('VITE_VEEQO_CLIENT_SECRET')),
    'import.meta.env.VITE_VEEQO_REDIRECT_URI':          JSON.stringify(env('VITE_VEEQO_REDIRECT_URI')),

    // Product catalog CSV fallback URL
    'process.env.REACT_APP_WC_CSV_URL':                 JSON.stringify(env('REACT_APP_WC_CSV_URL')),
    'import.meta.env.VITE_WC_CSV_URL':                  JSON.stringify(env('VITE_WC_CSV_URL')),

    // ─── Local Development Mode ───────────────────────────────────────────────
    // When set, frontend loads from /public/wp-catalog.csv instead of live API.
    // Only used in 'npm run dev' with .env.local; never affects production builds.
    'process.env.REACT_APP_USE_LOCAL_CSV':              JSON.stringify(env('REACT_APP_USE_LOCAL_CSV')),
    'import.meta.env.VITE_USE_LOCAL_CSV':               JSON.stringify(env('VITE_USE_LOCAL_CSV')),

    // ─── Headless WooCommerce proxy (drywall/v1) ──────────────────────────────
    // Read from the environment-specific .env file loaded above.
    'process.env.REACT_APP_API_BASE_URL':               JSON.stringify(env('REACT_APP_API_BASE_URL')),
    'process.env.REACT_APP_STORE_API_BASE':             JSON.stringify(env('REACT_APP_STORE_API_BASE')),
    'process.env.REACT_APP_JWT_AUTH_ENDPOINT':          JSON.stringify(env('REACT_APP_JWT_AUTH_ENDPOINT')),
    'process.env.REACT_APP_ENV':                        JSON.stringify(env('REACT_APP_ENV')),

    // Build timestamp — set once at config evaluation time (not per-module).
    'process.env.BUILD_TIMESTAMP':                      JSON.stringify(new Date().toISOString()),
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

  return {
    mode,
    bail: !isDev,

    // ─── Entry ─────────────────────────────────────────────────────────────
    entry: './src/main.jsx',

    // ─── Output ────────────────────────────────────────────────────────────
    output: {
      path:      outputPath,
      publicPath,
      filename:  isDev ? 'assets/js/[name].js'         : 'assets/js/[name].[contenthash:8].js',
      chunkFilename: isDev ? 'assets/js/[name].chunk.js' : 'assets/js/[name].[contenthash:8].chunk.js',
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
          generator: { filename: 'assets/images/[name].[hash:8][ext]' },
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
                '**/index.html',
                '**/products_catalog.csv',
                '**/products_catalog_*.csv',
              ],
            },
          },
        ],
      }),

      ...(!isDev ? [
        new MiniCssExtractPlugin({
          filename:      'assets/css/[name].[contenthash:8].css',
          chunkFilename: 'assets/css/[name].[contenthash:8].chunk.css',
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
        maxInitialRequests: 25,
        maxAsyncRequests:   30,
        minSize: 20_000,
        cacheGroups: {
          reactVendor: {
            test:     /[\\/]node_modules[\\/](react|react-dom|react-router(-dom)?)[\\/]/,
            name:     'vendor-react',
            chunks:   'all',
            priority: 30,
          },
          vendor: {
            test:     /[\\/]node_modules[\\/]/,
            name:     'vendor',
            chunks:   'all',
            priority: 20,
          },
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
          context: ['/wp-json'],
          target: 'http://localhost',
          changeOrigin: true,
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
      maxEntrypointSize: 500_000,
      maxAssetSize:      1_000_000,
    },

    stats: isDev ? 'errors-warnings' : {
      assets:      true,
      chunks:      true,
      chunkGroups: false,
      modules:     false,
      entrypoints: true,
      colors:      true,
    },
  };
};



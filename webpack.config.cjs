/**
 * webpack.config.cjs
 *
 * Build configuration for the Drywall Toolbox React SPA.
 * Replaces Vite as the build tool.  Named .cjs so Node treats it as
 * CommonJS even though the rest of the project uses "type":"module".
 *
 * Key behaviours:
 *  - process.env.PUBLIC_URL drives the deployment base path.
 *    Production CI sets PUBLIC_URL=/drywall-toolbox (see deploy.yml).
 *    Leave it empty (or unset) for local dev to get paths at /.
 *  - All import.meta.env.* references in source are statically replaced
 *    via DefinePlugin at compile time so no Vite runtime is needed.
 *  - public/ folder contents are copied verbatim into dist/ (images,
 *    JSON data files, 404.html, etc.).
 *  - CSS goes through PostCSS (Tailwind v4 + autoprefixer), extracted to
 *    a separate file in production, injected via style-loader in dev.
 */

'use strict';

const path                = require('path');
const webpack             = require('webpack');
const HtmlWebpackPlugin   = require('html-webpack-plugin');
const CopyWebpackPlugin   = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const isDev       = process.env.NODE_ENV !== 'production';
// Normalise: strip any trailing slash, default to '' (serves from /)
const PUBLIC_URL  = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
// publicPath must end with /  e.g. "/drywall-toolbox/"  or  "/"
const publicPath  = PUBLIC_URL ? `${PUBLIC_URL}/` : '/';

module.exports = {
  mode: isDev ? 'development' : 'production',

  // ─── Entry point ─────────────────────────────────────────────────────────
  entry: './src/main.jsx',

  // ─── Output ──────────────────────────────────────────────────────────────
  output: {
    path:       path.resolve(__dirname, 'dist'),
    filename:   isDev ? 'assets/js/[name].js' : 'assets/js/[name].[contenthash:8].js',
    publicPath,
    clean:      true,
  },

  // ─── Module resolution ───────────────────────────────────────────────────
  resolve: {
    extensions: ['.js', '.jsx', '.json'],
    // Vite resolves absolute import paths (starting with "/") against the
    // project root / public folder.  webpack.resolve.roots does the same.
    roots: [
      path.resolve(__dirname, 'public'),
      path.resolve(__dirname),
    ],
  },

  // ─── Loaders ─────────────────────────────────────────────────────────────
  module: {
    rules: [
      // JavaScript + JSX via Babel
      {
        test:    /\.(js|jsx)$/,
        exclude: /node_modules/,
        use:     'babel-loader',
      },
      // CSS → PostCSS (Tailwind v4 + autoprefixer) → css-loader → extract/inject
      {
        test: /\.css$/,
        use: [
          isDev ? 'style-loader' : MiniCssExtractPlugin.loader,
          { loader: 'css-loader', options: { importLoaders: 1 } },
          'postcss-loader',
        ],
      },
      // Raster images & SVG: emit as separate files (no inlining)
      {
        test: /\.(png|jpe?g|gif|ico|webp)$/i,
        type: 'asset/resource',
        generator: { filename: 'assets/images/[name].[hash:8][ext]' },
      },
      {
        test: /\.svg$/i,
        type: 'asset/resource',
        generator: { filename: 'assets/images/[name].[hash:8][ext]' },
      },
      // JSON — webpack 5 handles JSON natively; no extra rule needed.
    ],
  },

  // ─── Plugins ─────────────────────────────────────────────────────────────
  plugins: [
    // Replace compile-time constants so the source works without Vite
    new webpack.DefinePlugin({
      // Standard CRA-style public URL constant
      'process.env.PUBLIC_URL': JSON.stringify(publicPath),
      'process.env.NODE_ENV':   JSON.stringify(process.env.NODE_ENV || 'development'),

      // Vite-compat: replace all import.meta.env.BASE_URL occurrences
      'import.meta.env.BASE_URL': JSON.stringify(publicPath),

      // Vite-compat: optional integration secrets (default to empty string)
      'import.meta.env.VITE_VEEQO_CLIENT_ID':        JSON.stringify(process.env.VITE_VEEQO_CLIENT_ID        || ''),
      'import.meta.env.VITE_VEEQO_CLIENT_SECRET':    JSON.stringify(process.env.VITE_VEEQO_CLIENT_SECRET    || ''),
      'import.meta.env.VITE_VEEQO_REDIRECT_URI':     JSON.stringify(process.env.VITE_VEEQO_REDIRECT_URI     || ''),
      'import.meta.env.VITE_WOOCOMMERCE_STORE_URL':  JSON.stringify(process.env.VITE_WOOCOMMERCE_STORE_URL  || ''),
      'import.meta.env.VITE_WOOCOMMERCE_CONSUMER_KEY':    JSON.stringify(process.env.VITE_WOOCOMMERCE_CONSUMER_KEY    || ''),
      'import.meta.env.VITE_WOOCOMMERCE_CONSUMER_SECRET': JSON.stringify(process.env.VITE_WOOCOMMERCE_CONSUMER_SECRET || ''),
    }),

    // Generate dist/index.html from the project root template
    new HtmlWebpackPlugin({
      template:   './index.html',
      publicPath,
      // favicon handled by the template itself
      inject:     'body',
    }),

    // Copy everything in public/ verbatim into dist/
    new CopyWebpackPlugin({
      patterns: [
        {
          from:        'public',
          to:          '.',
          // index.html is already emitted by HtmlWebpackPlugin
          globOptions: { ignore: ['**/index.html'] },
        },
      ],
    }),

    // Extract CSS to separate files in production
    ...(isDev ? [] : [
      new MiniCssExtractPlugin({
        filename: 'assets/css/[name].[contenthash:8].css',
      }),
    ]),
  ],

  // ─── Dev server ──────────────────────────────────────────────────────────
  devServer: {
    port:              5173, // keep same port as former Vite default
    historyApiFallback: true, // serve index.html for all 404s (React Router)
    hot:               true,
    open:              true,
    static: {
      directory: path.join(__dirname, 'public'),
      publicPath,
    },
  },

  // ─── Optimisation ────────────────────────────────────────────────────────
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test:   /[\\/]node_modules[\\/]/,
          name:   'vendors',
          chunks: 'all',
        },
      },
    },
  },

  // Don't warn about large schematic images — they are intentional
  performance: { hints: false },

  // Source maps: fast in dev, proper in prod
  devtool: isDev ? 'eval-cheap-module-source-map' : 'source-map',
};

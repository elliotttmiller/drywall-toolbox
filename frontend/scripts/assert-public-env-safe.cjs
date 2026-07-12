'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const frontendRoot = path.resolve(__dirname, '..');
const mode = process.argv[2] || 'pre';
const envFilenames = ['.env', '.env.development', '.env.production', '.env.staging', '.env.test'];
const forbiddenKeys = new Set([
  'REACT_APP_WC_AUTH_USER',
  'REACT_APP_WC_AUTH_PASS',
  'REACT_APP_WOOCOMMERCE_CONSUMER_KEY',
  'REACT_APP_WOOCOMMERCE_CONSUMER_SECRET',
  'REACT_APP_VEEQO_API_KEY',
  'REACT_APP_VEEQO_WEBHOOK_SECRET',
  'REACT_APP_QBO_CLIENT_SECRET',
  'REACT_APP_JWT_SECRET',
]);
const forbiddenArtifactPatterns = [
  ['WooCommerce consumer key', /\bck_[A-Za-z0-9]{24,}\b/],
  ['WooCommerce consumer secret', /\bcs_[A-Za-z0-9]{24,}\b/],
  ['Stripe secret key', /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/],
  ['Private key material', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
];

function readEnvFile(filename) {
  const filepath = path.join(frontendRoot, filename);
  if (!fs.existsSync(filepath)) return {};
  return dotenv.parse(fs.readFileSync(filepath));
}

function readCandidateEnvValues() {
  const values = { ...process.env };
  for (const filename of envFilenames) Object.assign(values, readEnvFile(filename));
  return values;
}

function configuredSecrets(values) {
  return [...forbiddenKeys]
    .map((key) => [key, String(values[key] || '').trim()])
    .filter(([, value]) => value.length >= 4);
}

function fail(message, findings) {
  console.error(message);
  for (const finding of findings) console.error(`  - ${finding}`);
  process.exit(1);
}

const values = readCandidateEnvValues();
const secrets = configuredSecrets(values);

if (mode === 'pre') {
  const fileDefined = secrets.filter(([key]) =>
    envFilenames.some((filename) => String(readEnvFile(filename)[key] || '').trim().length >= 4));

  if (fileDefined.length > 0) {
    fail(
      'Refusing frontend build: server credentials are defined in a browser environment file.',
      fileDefined.map(([key]) => key),
    );
  }
  process.exit(0);
}

if (mode !== 'post') fail(`Unknown safety-check mode: ${mode}`, []);

const appEnv = String(
  process.env.APP_ENV || process.env.REACT_APP_APP_ENV || process.env.REACT_APP_ENV || 'production',
).toLowerCase();
const outputRoot = appEnv === 'staging'
  ? path.resolve(frontendRoot, '..', 'dist-staging')
  : path.resolve(frontendRoot, '..', 'dist');

if (!fs.existsSync(outputRoot)) fail(`Frontend output directory not found: ${outputRoot}`, []);

const textExtensions = new Set(['.js', '.css', '.html', '.json', '.map', '.txt']);
const findings = new Set();

function scan(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filepath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      scan(filepath);
      continue;
    }
    if (!textExtensions.has(path.extname(entry.name).toLowerCase())) continue;

    const content = fs.readFileSync(filepath, 'utf8');
    const relativePath = path.relative(outputRoot, filepath);

    for (const [key, value] of secrets) {
      if (content.includes(value)) findings.add(`${key} in ${relativePath}`);
    }
    for (const [label, pattern] of forbiddenArtifactPatterns) {
      if (pattern.test(content)) findings.add(`${label} in ${relativePath}`);
    }
  }
}

scan(outputRoot);
if (findings.size > 0) {
  fail('Refusing frontend artifact: credential material was embedded in generated browser assets.', [...findings]);
}

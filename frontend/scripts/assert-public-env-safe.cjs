'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const frontendRoot = path.resolve(__dirname, '..');
const mode = process.argv[2] || 'pre';
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

function readCandidateEnvValues() {
  const values = { ...process.env };
  for (const filename of ['.env', '.env.development', '.env.production', '.env.staging', '.env.test']) {
    const filepath = path.join(frontendRoot, filename);
    if (!fs.existsSync(filepath)) continue;
    Object.assign(values, dotenv.parse(fs.readFileSync(filepath)));
  }
  return values;
}

function configuredSecrets(values) {
  return [...forbiddenKeys]
    .map((key) => [key, String(values[key] || '').trim()])
    .filter(([, value]) => value.length >= 4);
}

function fail(message, keys) {
  console.error(message);
  for (const key of keys) console.error(`  - ${key}`);
  process.exit(1);
}

const values = readCandidateEnvValues();
const secrets = configuredSecrets(values);

if (mode === 'pre') {
  const fileDefined = secrets.filter(([key]) => {
    return ['.env', '.env.development', '.env.production', '.env.staging', '.env.test'].some((filename) => {
      const filepath = path.join(frontendRoot, filename);
      if (!fs.existsSync(filepath)) return false;
      const parsed = dotenv.parse(fs.readFileSync(filepath));
      return String(parsed[key] || '').trim().length >= 4;
    });
  });

  if (fileDefined.length > 0) {
    fail('Refusing frontend build: server credentials are defined in a browser environment file.', fileDefined.map(([key]) => key));
  }
  process.exit(0);
}

if (mode !== 'post') {
  fail(`Unknown safety-check mode: ${mode}`, []);
}

if (secrets.length === 0) process.exit(0);

const appEnv = String(process.env.APP_ENV || process.env.REACT_APP_APP_ENV || process.env.REACT_APP_ENV || 'production').toLowerCase();
const outputRoot = appEnv === 'staging'
  ? path.resolve(frontendRoot, '..', 'dist-staging')
  : path.resolve(frontendRoot, '..', 'dist');

if (!fs.existsSync(outputRoot)) {
  fail(`Frontend output directory not found: ${outputRoot}`, []);
}

const textExtensions = new Set(['.js', '.css', '.html', '.json', '.map', '.txt']);
const leakedKeys = new Set();

function scan(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filepath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      scan(filepath);
      continue;
    }
    if (!textExtensions.has(path.extname(entry.name).toLowerCase())) continue;
    const content = fs.readFileSync(filepath, 'utf8');
    for (const [key, value] of secrets) {
      if (content.includes(value)) leakedKeys.add(key);
    }
  }
}

scan(outputRoot);
if (leakedKeys.size > 0) {
  fail('Refusing frontend artifact: server credentials were embedded in generated browser assets.', [...leakedKeys]);
}

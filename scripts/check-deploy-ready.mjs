#!/usr/bin/env node

import fs from 'node:fs';

const files = [
  'wrangler.toml',
  'seeds/dev_seed.sql',
  '.dev.vars.example',
  'scripts/generate-dev-seed.mjs'
].filter((file) => fs.existsSync(file));

const patterns = [
  /REPLACE_WITH_ADMIN_PASSWORD_HASH/g,
  /G-REPLACE_ME/g,
  /GTM-REPLACE/g,
  /https:\/\/example\.com/gi,
  /admin@example\.com/gi,
  /demo@example\.com/gi,
  /replace-with-strong-password/gi
];

let failures = 0;

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const hits = [];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) hits.push(pattern.toString());
  }
  if (hits.length) {
    failures += 1;
    console.log(`⚠ ${file}`);
    for (const hit of hits) console.log(`  - matched placeholder pattern ${hit}`);
  }
}

if (!failures) {
  console.log('✓ No common deployment placeholders detected in checked files.');
  process.exit(0);
}

console.log(`\nFound placeholder-like content in ${failures} file(s). Review before production deploy.`);
process.exit(1);

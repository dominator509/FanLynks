#!/usr/bin/env node

import fs from 'node:fs';

const files = [
  'wrangler.toml',
  'seeds/dev_seed.sql',
  '.dev.vars.example',
  'README.md',
  'docs/DEPLOYMENT.md'
].filter((file) => fs.existsSync(file));

const patterns = [
  /replace-with-strong-password/gi,
  /replace placeholders/gi,
  /paste the returned ids?/gi,
  /your-password/gi,
  /demo@example\.com/gi,
  /G-XXXXXXXXXX/gi,
  /123456789012345/gi
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

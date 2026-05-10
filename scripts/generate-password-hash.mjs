import crypto from "node:crypto";

const password = process.argv.slice(2).join(' ').trim();
if (!password) {
  console.error('Usage: npm run hash:password -- "your-password"');
  process.exit(1);
}

const iterations = 100000;
const salt = crypto.randomBytes(16).toString('base64url');
const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('base64');
console.log(`pbkdf2_sha256$${iterations}$${salt}$${hash}`);

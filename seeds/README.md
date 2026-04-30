# Seeds

- `dev_seed.sql` is a generated starter seed for local or remote D1.
- Re-generate it with `npm run seed:generate`.
- Generate a real PBKDF2 password hash with `npm run hash:password -- "your-password"` and replace the placeholder hash before executing the seed.
- Apply locally with:

```bash
npx wrangler d1 execute custom-link-hub --local --file=./seeds/dev_seed.sql
```

- Apply remotely with:

```bash
npx wrangler d1 execute custom-link-hub --remote --file=./seeds/dev_seed.sql
```

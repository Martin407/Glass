```txt
npm install
npm run dev
```

```txt
npm run deploy
```

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```txt
npm run cf-typegen
```

Pass the `CloudflareBindings` as generics when instantiation `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```

Authentication environment variables:

- `OKTA_DOMAIN` (required in non-dev environments)
- `OKTA_AUDIENCE` (recommended) or `OKTA_CLIENT_ID` (fallback)
- `OKTA_ISSUER` (optional, defaults to `https://<OKTA_DOMAIN>/oauth2/default`)
- `AUTH_BYPASS_FOR_DEV=true` only for local/dev bypass when Okta is unavailable

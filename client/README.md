# Credit cabinet web interface

Next.js / React. Run the complete application using the [root README](../README.md).

- `npm ci` installs the locked dependencies.
- `npm test` verifies the product selection rules against the supplied examples.
- `npm run build` creates a standalone production build.
- `npm run dev` starts local development on port 3000.

`API_INTERNAL_URL` selects the backend rewrite destination at build time (default `http://127.0.0.1:4000`; Docker uses `http://backend:4000`). The browser always requests the same-origin `/api` proxy. Tokens and guest drafts are stored locally; application data is persisted in PostgreSQL by the backend.

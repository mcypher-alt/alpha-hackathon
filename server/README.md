# Credit pipeline API

NestJS / Prisma / PostgreSQL. Run the complete application using the [root README](../README.md).

- `npm ci` generates Prisma from `src/prisma/schema.prisma`.
- `npm run build` compiles into `dist/`.
- `npm test` runs policy, validation and model tests without a database.
- `npm run test:e2e` runs the end-to-end smoke checks against an already running Docker stack.
- Swagger: http://localhost:4000/api/docs

Required production variables: `DATABASE_URL`, `JWT_SECRET` (at least 32 characters), `PORT`. `SEED_DEMO=true` creates synthetic demo fixtures. See `.env.example` in the repository root.

All external checks, signing and disbursement are simulated.

# Elite Battle India Backend

This folder contains the deployable backend for Elite Battle India.

## Structure

- `index.js`: runtime entrypoint used by `npm start`
- `src/`: application bootstrap, middleware, shared backend utilities, and API schemas
- `routes/`: Express route modules mounted under `/api`
- `controllers/`: controller helpers used by routes
- `models/`: database connection and schema models
- `migrations/`: SQL migrations applied in deployment or locally

## Requirements

- Node.js 24+
- npm 11+
- A PostgreSQL database

## Environment Variables

Create `.env` in this folder or copy from `.env.example`.

Required variables:

- `DATABASE_URL`
- `SESSION_SECRET`
- `NODE_ENV`
- `FRONTEND_ORIGIN`
- `CORS_ORIGINS`

Optional variables:

- `PORT`
- `LOG_LEVEL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Install

```bash
npm install
```

## Run Locally

Build and start:

```bash
npm start
```

Useful commands:

```bash
npm run build
npm run migrate
npm run typecheck
```

`npm start` works through `index.js`, and `prestart` automatically builds the backend before Node loads the Express server bundle from `dist/index.mjs`.

## Deployment

### Railway

This folder is intended for backend deployment on Railway.

Recommended steps:

1. Create a new Railway project from this backend repository.
2. Set the root directory to `ELITE-BATTLE-INDIA/backend` if your project is based on the monorepo root.
3. Add the environment variables from `.env` in the Railway dashboard.
4. Set Railway build command to:

```bash
npm install && npm run build
```

Start command:

```bash
npm start
```

Pre-deploy migration command:

```bash
npm run migrate
```

## Entry Flow

- `npm start`
- `node index.js`
- `index.js` loads `dist/index.mjs`
- `dist/index.mjs` comes from `src/index.ts`
- `src/index.ts` starts the Express app from `src/app.ts`


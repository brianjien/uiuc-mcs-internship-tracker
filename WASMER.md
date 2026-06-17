# Wasmer Deployment

This project is configured as a full-stack Wasmer Edge app:

- `server/http.mjs` serves the built React app and handles `/api/*`.
- `server/api.mjs` handles auth, profile, workspace persistence, health checks, and live jobs.
- `server/db.mjs` stores accounts, sessions, and workspace data in MySQL.
- `scripts/build-server.mjs` bundles the Node backend for Wasmer Edge.

The backend runs on Wasmer's Node-compatible Edge.js runtime because the MySQL driver needs Node networking APIs. The entrypoint is configured in `wasmer.toml` via `main-args`.

## Local Full-Stack Test

```bash
npm run build
npm start
```

Open `http://127.0.0.1:8787`.

## Wasmer Local Test

```bash
npm run wasmer:local
```

Wasmer serves the full-stack app locally at `http://127.0.0.1:8080`.

## Deploy

Install and authenticate Wasmer first:

```bash
curl https://get.wasmer.io -sSfL | sh
wasmer login
```

If your Wasmer namespace is not `brianjien`, update it in `wasmer.toml` and `app.yaml`.

## Database

`app.yaml` is configured for the Wasmer database capability in the `fr-pari1` region. Wasmer provides these environment variables to the app:

```bash
DB_HOST
DB_PORT
DB_NAME
DB_USERNAME
DB_PASSWORD
```

The backend also accepts `DB_USER` as an alias for `DB_USERNAME`.

Keep real database values out of GitHub. For manual secret setup, copy `.env.example` to a local ignored file, fill in the values, and upload it through the Wasmer dashboard Secrets tab or the CLI:

```bash
wasmer app secrets create --from-file=.env.local
```

Then deploy:

```bash
npm run wasmer:deploy
```

The app URL will look like `https://<app-name>-<app-owner>.wasmer.app`.

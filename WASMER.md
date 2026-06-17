# Wasmer Deployment

This project is configured as a full-stack Wasmer Edge app:

- `edge/index.js` serves the built React app and handles `/api/jobs`.
- `server/jobFeeds.mjs` fetches live roles from public job sources.
- `scripts/build-edge-assets.mjs` packages the Vite `dist` output for the Wasmer JS worker.

The worker entrypoint is configured in `wasmer.toml` via `main-args`. Do not also pass `/edge/index.js` through `app.yaml` `cli_args`, because that forwards an extra argument to the app process and Wasmer will exit with `unexpected argument '/edge/index.js'`.

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

Wasmer serves the worker locally at `http://127.0.0.1:8080`.

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

Keep real database values out of GitHub. For manual secret setup, copy `.env.example` to a local ignored file, fill in the values, and upload it through the Wasmer dashboard Secrets tab or the CLI:

```bash
wasmer app secrets create --from-file=.env.local
```

Then deploy:

```bash
npm run wasmer:deploy
```

The app URL will look like `https://<app-name>-<app-owner>.wasmer.app`.

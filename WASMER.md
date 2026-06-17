# Wasmer Deployment

This project is configured as a full-stack Wasmer Edge app:

- `edge/index.js` serves the built React app and handles `/api/jobs`.
- `server/jobFeeds.mjs` fetches live roles from public job sources.
- `scripts/build-edge-assets.mjs` packages the Vite `dist` output for the Wasmer JS worker.

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

Then deploy:

```bash
npm run wasmer:deploy
```

The app URL will look like `https://<app-name>-<app-owner>.wasmer.app`.

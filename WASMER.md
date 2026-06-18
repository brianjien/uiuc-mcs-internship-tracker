# Wasmer Deployment

Production is live at:

```bash
https://internship-tracker.wasmer.app
```

The Wasmer deployment uses the Python/Flask entrypoint in `app.py`. The small `a.py` file re-exports the Flask app because Wasmer Shipit currently launches Flask projects as `a:app`.

## Runtime

- `app.py` serves the built React app from `dist/`.
- `app.py` handles `/api/*` for auth, Google sign-in, workspace persistence, health checks, and live job fetching.
- MySQL data is stored in `users`, `sessions`, and `workspace_data`.
- Live jobs are fetched dynamically from SimplifyJobs, Greenhouse public boards, Remotive, and RemoteOK.

The older Node/EdgeJS path is still present for local development, but the production Wasmer app is using Flask because the EdgeJS package currently fails on the Wasmer N-API runtime.

## Local Full-Stack Test

```bash
npm run build
PORT=8796 python3 app.py
```

Open `http://127.0.0.1:8796`.

## Database

Wasmer provides these environment variables to the app:

```bash
DB_HOST
DB_PORT
DB_NAME
DB_USERNAME
DB_PASSWORD
```

The backend also accepts `DB_USER` as an alias for `DB_USERNAME`.

Keep real database values out of GitHub. For local work, copy `.env.example` to an ignored env file and fill in the values locally.

## Google Sign-In

The Google OAuth client must include the exact production callback:

```bash
https://internship-tracker.wasmer.app/api/auth/google/redirect
```

For local testing, also add:

```bash
http://127.0.0.1:8794/api/auth/google/redirect
http://localhost:8794/api/auth/google/redirect
```

Authorized JavaScript origins should include:

```bash
https://internship-tracker.wasmer.app
http://127.0.0.1:8794
http://localhost:8794
```

## Deploy

Build the frontend first:

```bash
npm run build
```

Then deploy the Flask app with Wasmer remote build. Use the Wasmer app name/owner that owns the `internship-tracker.wasmer.app` alias.

```bash
wasmer deploy --build-remote --non-interactive --no-persist-id
```

After deploy, verify:

```bash
curl https://internship-tracker.wasmer.app/api/health
curl 'https://internship-tracker.wasmer.app/api/jobs?refresh=true&limit=10'
```

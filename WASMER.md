# Wasmer Deployment

Production is live at:

```bash
https://internship-tracker.wasmer.app
```

The Wasmer deployment uses the Python/Flask entrypoint in `app.py`. The small `a.py` file re-exports the Flask app because Wasmer Shipit currently launches Flask projects as `a:app`.

## Runtime

- `app.py` serves the built React app from `dist/`.
- `app.py` handles `/api/*` for auth, Google sign-in, workspace persistence, health checks, and live job fetching.
- MySQL data is stored in normalized relational tables. The active schema is version 2 and is designed to BCNF.
- Live jobs are fetched dynamically from SimplifyJobs, Greenhouse public boards, Remotive, and RemoteOK.

The Flask backend is the single active local and production backend. Older Node backend files remain only as migration history and are not used by the npm scripts or Wasmer deployment.

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

The schema separates candidate profiles, jobs, tags, OA attempts, OA question types, activities, tasks, contacts, documents, goals, and notification state. On first startup, legacy JSON workspace rows are copied into the relational tables. See `docs/database-normalization.md`.

## Document Storage

Uploaded resume and application files are stored in an S3-compatible bucket and served through authenticated Flask proxy routes:

```bash
POST /api/documents/upload
GET /api/documents/file?key=...
```

For Supabase Storage S3, create a private bucket, enable the S3 protocol connection, then add these Wasmer secrets:

```bash
S3_ENDPOINT_URL=https://pynqcxlpzjgxhgshgpwi.storage.supabase.co/storage/v1/s3
S3_REGION=us-west-2
S3_BUCKET=<your private bucket name>
S3_ACCESS_KEY_ID=<Supabase S3 access key id>
S3_SECRET_ACCESS_KEY=<Supabase S3 secret access key>
S3_ADDRESSING_STYLE=path
```

Keep the bucket private. The browser never receives the S3 key; it only sees same-origin `/api/documents/file` URLs. PDF, image, text, CSV, Markdown, and JSON files can preview in the app. Word documents are stored securely and can be downloaded.

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

Then deploy the Flask app through the project script:

```bash
npm run wasmer:deploy
```

Do not run `wasmer deploy` directly from the repo root for production. Wasmer may auto-detect the Vite frontend and deploy a static-only build, which breaks `/api/*`. The npm script creates a temporary Flask-only bundle before calling Wasmer.

After deploy, verify:

```bash
curl https://internship-tracker.wasmer.app/api/health
curl 'https://internship-tracker.wasmer.app/api/jobs?refresh=true&limit=10'
```

Interactive API documentation is available at:

```bash
https://internship-tracker.wasmer.app/api/docs
```

The machine-readable OpenAPI 3.1 document is served from `/api/openapi.json`.

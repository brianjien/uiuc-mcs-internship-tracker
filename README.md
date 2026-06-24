# Career Tracker Dashboard

Modern green SaaS dashboard for tracking 2026 fall internships, 2027 roles, and new-grad opportunities.

## Features

- Full React dashboard with pipeline, tasks, companies, contacts, analytics, resources, and settings.
- Database-backed email/password and Google sign-in with profile image presets.
- Live job feed from public sources through `/api/jobs`.
- Filters for 2026 Fall, 2027, New Grad, and remote mode.
- Goal setting and pipeline progress tracking.
- BCNF-normalized MySQL persistence for profiles, jobs, OA attempts, tasks, contacts, documents, goals, and notifications.
- OpenAPI 3.1 specification and interactive Swagger UI at `/api/docs`.
- Private S3-compatible document upload with in-app preview for PDF, image, text, CSV, Markdown, and JSON files.
- Mobile-responsive layout.
- Wasmer deployment config using the Flask backend in `app.py`.
- Wasmer database capability configured for the `fr-pari1` region.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

## Full-Stack Local Server

```bash
npm run build
npm start
```

Open `http://127.0.0.1:8080`.

Run the backend mapping tests with:

```bash
npm test
```

## Deploy To Wasmer

```bash
wasmer login
npm run wasmer:deploy
```

If your Wasmer namespace is not `brianjien`, update `wasmer.toml` and `app.yaml`.

Database credentials should be configured as Wasmer secrets or provided by the Wasmer database capability. Do not commit real `DB_PASSWORD` values.

For document uploads, configure these Wasmer secrets:

```bash
S3_ENDPOINT_URL
S3_REGION
S3_BUCKET
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
S3_ADDRESSING_STYLE=path
```

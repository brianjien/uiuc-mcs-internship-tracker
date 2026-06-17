# UIUC MCS Internship Tracker

Modern green SaaS dashboard for a UIUC MCS student tracking 2026 fall internships, 2027 roles, and new-grad opportunities.

## Features

- Full React dashboard with pipeline, tasks, companies, contacts, analytics, resources, and settings.
- Local sign up / login prototype with profile image presets.
- Live job feed from public sources through `/api/jobs`.
- Filters for 2026 Fall, 2027, New Grad, and remote mode.
- Goal setting and pipeline progress tracking.
- Mobile-responsive layout.
- Wasmer Edge deployment config.
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

Open `http://127.0.0.1:8787`.

## Deploy To Wasmer

```bash
wasmer login
npm run wasmer:deploy
```

If your Wasmer namespace is not `brianjien`, update `wasmer.toml` and `app.yaml`.

Database credentials should be configured as Wasmer secrets or provided by the Wasmer database capability. Do not commit real `DB_PASSWORD` values.

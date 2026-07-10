# CI/CD Pipeline

This repo is a monorepo with two deployables:

- **`app/`** — the Expo / React Native client (built with EAS).
- **`backend/functions/`** — Firebase Cloud Functions (+ Firestore rules/indexes).

GitHub Actions wires validation on every change and deployment on demand.

## Workflows

| Workflow | File | Trigger | Secrets | What it does |
|---|---|---|---|---|
| **CI** | `.github/workflows/ci.yml` | every PR + push to `main` | none | App: `typecheck` + `lint`. Backend: `typecheck` + `build`. Fails the check if either breaks. |
| **Deploy Backend** | `.github/workflows/deploy-backend.yml` | push to `main` touching `backend/**`, `firestore.*`, `firebase.json` · or manual | `FIREBASE_SERVICE_ACCOUNT` | Builds functions, deploys `functions` + `firestore` to project `laxie-family-os-f7077`. |
| **EAS Build** | `.github/workflows/eas-build.yml` | manual (`workflow_dispatch`) | `EXPO_TOKEN` | Runs `eas build` for the chosen platform/profile. |

> Code review is handled by **Claude Code** (in-editor / PR review), not a
> GitHub Actions bot. The former OpenAI-based `code-review.yml` workflow was
> removed; `OPENAI_API_KEY` is no longer used by CI and can be deleted from the
> repo secrets.

## Safe-by-default deploys

The two deploy workflows are **gated on their secret**. If the secret is
absent, the workflow runs, prints a `::warning::`, and exits without deploying —
no outward-facing action can happen until you opt in by adding the secret.
Adding the secret is what turns the deploy on.

## Required secrets

Add these under **Settings → Secrets and variables → Actions**.

### `FIREBASE_SERVICE_ACCOUNT` (backend deploy)

1. Firebase Console → Project settings → **Service accounts** → **Generate new
   private key**. This downloads a JSON file.
2. Paste the **entire JSON** as the secret value.
3. The service account needs the *Firebase Admin* / *Cloud Functions Admin* and
   *Cloud Datastore/Firestore* roles to deploy.

### `EXPO_TOKEN` (EAS build)

1. [expo.dev](https://expo.dev) → account → **Access tokens** → create a token.
2. Paste the token as the secret value.
3. `app/eas.json` already defines `development` / `preview` / `production`
   profiles; the project is `owner: okischuang`, slug `laxie`.

## Running things locally

```bash
# App
cd app
npm ci
npm run typecheck
npm run lint

# Backend
cd backend/functions
npm ci
npm run typecheck
npm run build
```

## Deploying manually

```bash
# Backend (needs firebase login / service account)
cd backend/functions && npm run deploy

# Mobile (needs eas login)
cd app && eas build --profile preview --platform all
```

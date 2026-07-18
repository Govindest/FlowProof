# FlowProof hybrid deployment

> FlowProof separates its judge-facing dashboard from its browser execution plane. Vercel delivers the product interface, while Railway provides a persistent isolated environment for Chromium, SQLite, screenshots, traces, and queued workflow execution.

## Prerequisites

- A GitHub repository containing this monorepo.
- Railway and Vercel accounts connected to that repository.
- An OpenAI project with access to `gpt-5.6` for live diagnosis. Seeded mode works without it.
- Railway persistent-volume capacity.
- A 32-byte random shared secret:

```bash
openssl rand -hex 32
```

Store the result in the Railway and Vercel secret managers. Do not place it in a tracked file.

## Railway execution plane

1. In Railway, choose **New Project → Deploy from GitHub repo** and select FlowProof.
2. Keep the repository root as the build context. Railway detects [`railway.toml`](railway.toml) and builds [`Dockerfile`](Dockerfile).
3. Add one persistent volume and mount it at exactly `/data`.
4. Add the variables below. Replace every example domain and secret.
5. Generate a Railway public domain for the service.
6. Update `FLOWPROOF_PUBLIC_BASE_URL` to that HTTPS domain.
7. Set `FLOWPROOF_ALLOWED_ORIGINS` to the exact production Vercel origin. Multiple exact origins use commas.
8. Redeploy. `pnpm start:railway` automatically runs `prisma migrate deploy`, ensures seed records exist without resetting prior data, and starts the API, demo targets, and worker.
9. Verify `/health` and `/ready` before connecting Vercel.

Railway variables:

```env
PORT=8080
FLOWPROOF_PUBLIC_BASE_URL=https://your-service.up.railway.app
FLOWPROOF_ALLOWED_ORIGINS=https://your-project.vercel.app
FLOWPROOF_BACKEND_SHARED_SECRET=<generated-random-secret>
DATABASE_URL=file:/data/flowproof.db
FLOWPROOF_ARTIFACT_DIR=/data/artifacts
DEMO_BASE_URL=http://127.0.0.1:3100

FLOWPROOF_LLM_MODE=live
FLOWPROOF_LLM_MODEL=gpt-5.6
OPENAI_API_KEY=<railway-secret>

GITHUB_TOKEN=
GITHUB_REPOSITORY=owner/repository
```

For credential-free deterministic judging, set `FLOWPROOF_LLM_MODE=seeded` and omit `OPENAI_API_KEY`.

Do not set `FLOWPROOF_MOCK` or `OPENAI_MODEL` in new deployments. They remain supported only as backward-compatible local aliases.

### Railway health checks

```bash
curl -fsS https://your-service.up.railway.app/health
curl -fsS https://your-service.up.railway.app/ready
```

`/ready` verifies database access, schema availability, artifact-directory writes, worker configuration, and required production configuration. It does not spend an OpenAI request.

## Vercel dashboard

Import the same GitHub repository into Vercel with these settings:

| Setting          | Value                                |
| ---------------- | ------------------------------------ |
| Root directory   | Repository root (`.`)                |
| Framework preset | Next.js                              |
| Install command  | `pnpm install --frozen-lockfile`     |
| Build command    | `pnpm --filter @flowproof/web build` |
| Output directory | `apps/web/.next`                     |
| Node.js          | 22.x                                 |

The root [`vercel.json`](vercel.json) records the build settings. The Vercel install path skips Prisma generation and Chromium installation; the dashboard bundle does not import SQLite or worker execution code.

Required Vercel variables:

```env
NEXT_PUBLIC_FLOWPROOF_API_URL=https://your-service.up.railway.app
FLOWPROOF_BACKEND_SHARED_SECRET=<same-generated-random-secret>
```

`NEXT_PUBLIC_FLOWPROOF_API_URL` is only an origin and is safe for browser bundles. The shared secret is server-only and must never use a `NEXT_PUBLIC_` prefix.

For preview deployments, add each exact Vercel preview origin to Railway's comma-separated `FLOWPROOF_ALLOWED_ORIGINS`. Wildcard origins are intentionally unsupported. Production can remain restricted to the production Vercel domain.

After Vercel supplies its final production domain, update Railway's allowed origin and redeploy Railway once.

## First deployment smoke test

1. Open the Vercel dashboard and confirm **Execution backend online**.
2. Open **Fixture control** and click **Reset all to pass mode**.
3. Return home and click **Run failure demo**.
4. Confirm the page moves through QUEUED and RUNNING to FAIL.
5. Confirm `Repository membership removed` is the violated invariant.
6. Open at least one screenshot through the Vercel artifact proxy.
7. Download `trace.zip` and confirm the report labels the diagnosis as live or seeded accurately.
8. Click **Repair & rerun** and confirm the new run reaches PASS.
9. Restart the Railway service without deleting the volume.
10. Reopen both run URLs and confirm their database records and artifacts still resolve.

## Local development remains deterministic

```bash
pnpm install
pnpm prisma migrate dev
pnpm demo
```

Local defaults are dashboard `:3000`, demo targets `:3100`, backend `:3200`, `prisma/dev.db`, and repository-local `artifacts/`. `pnpm dev:web`, `pnpm dev:backend`, and `pnpm dev:worker` are available for focused work. Neither Railway nor Vercel is required.

## Verified local production-entrypoint persistence

Run:

```bash
pnpm verify:persistence
```

Verified on 2026-07-18 with Node.js 24.16 and pnpm 11.9 on macOS. The script
built the demo target, started `pnpm start:railway` with production validation
and a temporary persistent directory, created FAIL run
`cmrq0iabx0001jpiiu8wtoxmq`, created repaired PASS run
`cmrq0ibwv0004jpii1dywtts2`, stopped the full process group, restarted against
the same SQLite and artifact paths, and reopened both records plus screenshot,
`trace.zip`, `result.json`, `evidence.md`, and `issue-draft.json`. Fixture state
remained repaired. The script removes only its own temporary directory after
verification.

No Docker-compatible runtime was installed on that machine, so no Docker image
build, digest, container restart, or container persistence result is claimed.
Install Docker Desktop or OrbStack, then run:

```bash
docker build -t flowproof-railway .
docker volume create flowproof-data
docker run --name flowproof-railway --rm -p 8080:8080 \
  -v flowproof-data:/data --env-file .env.railway flowproof-railway
```

Use another terminal for `/health`, `/ready`, and judge-path calls. Stop with
`docker stop flowproof-railway`, start a new container with the same
`flowproof-data` volume, and reopen historical run and artifact URLs.

## Manual migration and initialization

Railway startup performs these automatically:

```bash
pnpm prisma migrate deploy
pnpm seed:production
```

`seed:production` upserts required runbooks and creates only missing fixture records. It does not erase existing runs, reset active regression controls, or replace existing demo state. The judge-facing reset endpoint resets fixture state without deleting schema or historical reports.

## Rollback

1. In Railway, choose the last known-good deployment and redeploy it. Keep the `/data` volume attached.
2. In Vercel, promote the last known-good deployment.
3. If a newer Prisma migration is not backward compatible, stop before rolling application code back and restore a volume snapshot made before that migration. Current migrations are additive and SQLite remains the system of record.
4. Verify `/ready`, then execute one clean Offboard Contractor PASS run.

Never delete or replace the Railway volume as an application rollback.

## Troubleshooting

### Dashboard says backend unavailable

- Open Railway `/health` and `/ready` directly.
- Confirm `NEXT_PUBLIC_FLOWPROOF_API_URL` contains the Railway HTTPS origin with no path.
- Confirm Railway is listening on its injected `PORT`.

### Mutations return 401

The Vercel and Railway shared secrets differ or one is missing. Replace both from the same generated value and redeploy both services.

### Browser origin returns 403

Add the exact Vercel origin to `FLOWPROOF_ALLOWED_ORIGINS`. Scheme, hostname, and port must match. Do not use `*`.

### `/ready` fails after deployment

- Confirm the volume is mounted at `/data`.
- Confirm `DATABASE_URL=file:/data/flowproof.db`.
- Confirm `FLOWPROOF_ARTIFACT_DIR=/data/artifacts`.
- Inspect migration output before restarting repeatedly.

### Worker remains QUEUED

Check Railway logs for the `FlowProof worker ready` line and confirm the worker and API have the same `DATABASE_URL`. `start:railway` terminates the service if the API, demo target, or worker exits unexpectedly so Railway can restart a coherent process group.

### Chromium launch fails

Confirm Railway built the repository Dockerfile. It uses the pinned `mcr.microsoft.com/playwright:v1.61.1-noble` image matching the pinned workspace Playwright packages, so the expected Chromium binary and Linux dependencies are present.

### GPT diagnosis fails

Confirm the backend has `FLOWPROOF_LLM_MODE=live`, `FLOWPROOF_LLM_MODEL=gpt-5.6`, a valid `OPENAI_API_KEY`, and model access. For a guaranteed judge path, switch back to `seeded`; deterministic PASS/FAIL behavior is unchanged.

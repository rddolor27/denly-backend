# Deployment runbook — Cloud Run (ADR 0013)

The API ships as one container (`Dockerfile`) to **Cloud Run**, with **Cloud SQL for PostgreSQL 17**
over the unix socket, images in **Artifact Registry** and app secrets in **Secret Manager**.
GitHub reaches GCP only through **Workload Identity Federation** — no service-account keys exist,
and GitHub holds no secrets. Staging and production are **separate GCP projects**.

## 1. Workflows

| Workflow | Trigger | Target |
|---|---|---|
| `CI` (`ci.yml`) | pull request, push to `main` (also called by both deploys) | checks only: lint, typecheck, build, unit + e2e tests (Postgres 17 service), `pnpm audit --prod`, Docker build |
| `Deploy Staging (manual)` (`deploy-staging.yml`) | Actions → Run workflow, input `ref` (branch, tag or full commit SHA; default `main`) | staging project, image `denly-api:sha-<short>` |
| `Deploy Production (release)` (`deploy-production.yml`) | GitHub Release **published** with tag `vMAJOR.MINOR.PATCH` (prereleases ignored) | production project after approval, image `denly-api:vX.Y.Z` (+ `sha-<short>`) |

Both deploys run `CI` on the ref first and deploy exactly the commit CI tested. The shared steps
live in `.github/actions/deploy-cloud-run`: build + push → Cloud Run job `denly-api-migrate`
(`typeorm migration:run`) → Cloud Run job `denly-api-seed` (idempotent catalog sync) →
`gcloud run deploy denly-api` (startup probe on `/api/health`) → 100% traffic to the new revision →
smoke test `GET /api/health` → job summary with image, revision and URL.

Fixed names: Artifact Registry repo `denly`, service `denly-api`, jobs `denly-api-migrate` /
`denly-api-seed`, secrets `db-password` / `jwt-access-secret`.

Runtime config set by the deploy: `NODE_ENV=production` (Swagger off, also on staging),
`LOG_FORMAT=json`, `LOG_LEVEL=info`, `GCP_PROJECT_ID`, `DB_HOST=/cloudsql/<connection name>`,
`DB_USERNAME`, `DB_NAME`, `CORS_ORIGINS` (service only, when set); `DB_PASSWORD` and
`JWT_ACCESS_SECRET` (service; jobs get only `DB_PASSWORD`) come from Secret Manager. Cloud Run
sets `PORT`.

## 2. One-time GCP setup (run once per project)

Run in a local shell with `gcloud` signed in as a project owner. Do it for staging, then again for
production with the production values. Secrets are generated locally and piped straight into
Secret Manager — never printed, pasted into chat or committed.

```bash
PROJECT_ID=denly-staging          # production: your production project id
REGION=asia-southeast1            # one region for Cloud Run, Artifact Registry and Cloud SQL
ENVIRONMENT=staging               # production: production
REPO=rddolor27/denly-backend
gcloud config set project "$PROJECT_ID"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
```

**APIs and Artifact Registry**

```bash
gcloud services enable run.googleapis.com sqladmin.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com
gcloud artifacts repositories create denly --repository-format=docker --location="$REGION" \
  --description="Denly container images"
```

**Cloud SQL (PostgreSQL 17, Enterprise edition)**

```bash
# staging: small shared-core tier, daily backups
gcloud sql instances create denly-pg --database-version=POSTGRES_17 --edition=enterprise \
  --tier=db-g1-small --region="$REGION" --storage-auto-increase --backup-start-time=18:00

# production instead: dedicated core, backups + point-in-time recovery, deletion protection
gcloud sql instances create denly-pg --database-version=POSTGRES_17 --edition=enterprise \
  --tier=db-custom-1-3840 --region="$REGION" --storage-auto-increase \
  --backup-start-time=18:00 --retained-backups-count=14 \
  --enable-point-in-time-recovery --retained-transaction-log-days=7 --deletion-protection
```

**Database, user and secrets**

```bash
gcloud sql databases create denly --instance=denly-pg

DB_PASSWORD="$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64url'))")"
gcloud sql users create denly_app --instance=denly-pg --password="$DB_PASSWORD"
printf '%s' "$DB_PASSWORD" | gcloud secrets create db-password --replication-policy=automatic --data-file=-
unset DB_PASSWORD

# JWT signing key: 48 random bytes, base64url (same generator as the README)
node -e "process.stdout.write(require('crypto').randomBytes(48).toString('base64url'))" \
  | gcloud secrets create jwt-access-secret --replication-policy=automatic --data-file=-
```

Rotate later with `gcloud secrets versions add <secret> --data-file=-` (same pipes); new instances
read `:latest`. Rotating `jwt-access-secret` signs everyone out after at most one access-token TTL.

**Runtime service account** — what the service and both jobs run as

```bash
gcloud iam service-accounts create denly-api-runtime --display-name="denly-api runtime"
RUNTIME_SA="denly-api-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SA}" --role=roles/cloudsql.client
for secret in db-password jwt-access-secret; do
  gcloud secrets add-iam-policy-binding "$secret" \
    --member="serviceAccount:${RUNTIME_SA}" --role=roles/secretmanager.secretAccessor
done
```

**Deploy service account** — what GitHub Actions impersonates

```bash
gcloud iam service-accounts create denly-deployer --display-name="GitHub Actions deployer"
DEPLOY_SA="denly-deployer@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOY_SA}" --role=roles/run.admin
gcloud artifacts repositories add-iam-policy-binding denly --location="$REGION" \
  --member="serviceAccount:${DEPLOY_SA}" --role=roles/artifactregistry.writer
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="serviceAccount:${DEPLOY_SA}" --role=roles/iam.serviceAccountUser
```

**Workload Identity Federation** — only this repo (and, in production, only jobs running in the
`production` GitHub Environment) can obtain the deployer's credentials

```bash
CONDITION="assertion.repository=='${REPO}'"
# production only:
# CONDITION="assertion.repository=='${REPO}' && assertion.environment=='production'"

gcloud iam workload-identity-pools create github --location=global --display-name="GitHub Actions"
gcloud iam workload-identity-pools providers create-oidc denly-backend \
  --location=global --workload-identity-pool=github --display-name="denly-backend" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.environment=assertion.environment" \
  --attribute-condition="$CONDITION"
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/${REPO}"

# Values for the GitHub Environment (section 3)
gcloud iam workload-identity-pools providers describe denly-backend --location=global \
  --workload-identity-pool=github --format='value(name)'          # GCP_WORKLOAD_IDENTITY_PROVIDER
gcloud sql instances describe denly-pg --format='value(connectionName)'   # CLOUD_SQL_CONNECTION_NAME
```

## 3. GitHub setup

Repo → Settings → Environments:

- **`staging`** — no reviewers; deployment branches and tags: all (a manual deploy may pick any ref).
- **`production`** — *Required reviewers*: you (or the release approvers); *Deployment branches
  and tags*: **Selected** → add a **tag** rule `v*`. (Required reviewers on a private repo need a
  paid GitHub plan; without them the tag rule and the WIF condition still apply.)

Variables per environment (Environment → Add variable; no GitHub secrets are needed):

| Variable | Example (staging) | Notes |
|---|---|---|
| `GCP_PROJECT_ID` | `denly-staging` | |
| `GCP_REGION` | `asia-southeast1` | |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/123456789/locations/global/workloadIdentityPools/github/providers/denly-backend` | from the `describe` above |
| `GCP_DEPLOY_SERVICE_ACCOUNT` | `denly-deployer@denly-staging.iam.gserviceaccount.com` | |
| `GCP_RUNTIME_SERVICE_ACCOUNT` | `denly-api-runtime@denly-staging.iam.gserviceaccount.com` | |
| `CLOUD_SQL_CONNECTION_NAME` | `denly-staging:asia-southeast1:denly-pg` | |
| `DB_NAME` | `denly` | |
| `DB_USERNAME` | `denly_app` | password = secret `db-password` |
| `CORS_ORIGINS` | *(unset)* | optional; comma-separated browser origins. The mobile app sends no `Origin` and needs none |
| `CLOUD_RUN_MAX_INSTANCES` | `3` | optional; default 3 |

With the GitHub CLI: `gh variable set GCP_PROJECT_ID --env staging --body denly-staging --repo rddolor27/denly-backend`
(repeat per variable and environment). A deploy fails fast, naming the missing variables, until
they exist.

## 4. Deploying

**Production** — create a release with a `vX.Y.Z` tag:

```bash
gh release create v0.1.0 --repo rddolor27/denly-backend --target main --title v0.1.0 --generate-notes
```

`Deploy Production (release)` checks the tag, runs `CI` on it, then waits for approval
(Actions → the run → *Review deployments* → approve) before deploying. A prerelease or a tag like
`v1.0` never deploys.

**Staging** — Actions → **Deploy Staging (manual)** → *Run workflow* → `ref` (branch, tag or full
commit SHA), or:

```bash
gh workflow run "Deploy Staging (manual)" --repo rddolor27/denly-backend -f ref=main
```

**Build the image locally** (what CI builds; no push):

```bash
docker build -t denly-backend:local .
```

## 5. Rollback

```bash
gcloud run revisions list --service=denly-api --region="$REGION"
gcloud run services update-traffic denly-api --region="$REGION" --to-revisions=<revision>=100
```

Traffic stays pinned to that revision until the next deploy, which moves 100% to the new revision.

**Migrations are forward-only.** Rolling traffic back does not touch the schema, so every
migration must leave the previous release working (add nullable columns / new tables first, drop
old ones in a later release). If a migration itself must be undone, revert it with the migrate
job, which still holds the newer image (the one containing that migration's `down()`); each run
reverts one migration:

```bash
gcloud run jobs execute denly-api-migrate --region="$REGION" --wait \
  --args="node_modules/typeorm/cli.js,migration:revert,-d,dist/data-source.js"
```

Take an on-demand backup first on production: `gcloud sql backups create --instance=denly-pg`.

## 6. Not automated yet

- **Model-registry import.** `registry:import` needs the model's `classes.yaml` from denly-ml, so
  no deploy runs it. Until a model version is registered in an environment, every scan submission
  there is rejected with `422 UNSUPPORTED_MODEL_VERSION`. To register one today, run the import
  from a checkout through the Cloud SQL Auth Proxy (`cloud-sql-proxy <connection name>`) with that
  environment's `DB_*` values (README § denly-ml integration).
- **Rate limiting on `/api/v1/auth/*`** (open decision #14) must land before production is
  announced publicly.

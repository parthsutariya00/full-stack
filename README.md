# Task Manager — Next.js + TypeScript + PostgreSQL

Dynamic full-stack app. Every page is server-rendered per request against PostgreSQL —
nothing is prebuilt or cached.

| Layer     | Choice                                              |
| --------- | --------------------------------------------------- |
| Framework | Next.js 15 (App Router, Server Components + Actions) |
| Language  | TypeScript 5, `strict`, **no `any`, no `unknown`**   |
| Database  | PostgreSQL via Prisma 6                              |
| Styling   | Tailwind CSS 3                                       |
| Validation| Zod 4 (shared by server actions and the REST API)    |
| Package manager | pnpm                                          |

## Setup

```bash
pnpm install
cp .env.example .env          # then set DATABASE_URL
pnpm db:migrate               # creates the schema
pnpm db:seed                  # optional demo data
pnpm dev                      # http://localhost:3000
```

Deploying: `pnpm db:deploy` runs pending migrations without prompting.

### Deploying to Railway

`railway.json` drives the deploy, so nothing needs configuring in the dashboard:

| Phase | Command | Why |
| ----- | ------- | --- |
| Build | `pnpm build` | Runs `prisma generate` then `next build` |
| Start | `pnpm db:deploy && pnpm start` | Applies pending migrations, then serves |

Migrating in the start command rather than a `preDeployCommand` keeps it visible: the
output lands in the deploy logs you already read, and it runs on every container start.
`prisma migrate deploy` is idempotent — with nothing pending it prints
`No pending migrations to apply` and costs about a second.

The container runs inside Railway's network, so it reaches `postgres.railway.internal`
without a public proxy. If the migration fails the container exits, the deploy is marked
failed, and the previous version keeps serving.

Running multiple replicas? Move this to a `preDeployCommand` instead, so migrations run
once per deploy rather than once per replica.

The app service needs one variable, referencing the database service:

```
DATABASE_URL = ${{Postgres.DATABASE_URL}}
```

Seeding is deliberately **not** part of the deploy — `prisma/seed.ts` truncates both
tables before inserting, so running it on every deploy would wipe production. Seed once,
by hand, when you actually want demo data.

### Running against Railway from a workstation

Railway's Postgres is reachable at `postgres.railway.internal`, which only resolves
inside Railway's network — your laptop cannot connect to it. Rather than exposing the
database through a public TCP proxy, prefix local commands with `railway run`, which
injects the service's variables and tunnels the connection:

```bash
railway login
railway link                      # pick the project + Postgres service
railway run pnpm db:migrate
railway run pnpm db:seed
railway run pnpm dev
```

`railway run` overrides `DATABASE_URL` from `.env`, so the value sitting in your local
`.env` does not matter while you use it.

### If you move to a pooled host

Neon and Supabase hand out a **pooled** host fronted by PgBouncer. That works for the
app but not for `prisma migrate`, which needs session-level access. In that case add a
second variable and wire it up:

```
DATABASE_URL=...ep-name-pooler.region.aws.neon.tech/neondb?sslmode=require   # app
DIRECT_URL=...ep-name.region.aws.neon.tech/neondb?sslmode=require            # migrations
```

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

On Neon the direct host is the pooled host with `-pooler` removed. Railway needs none of
this — it has no pooler, so the datasource here carries `url` only.

### There is no root `loading.tsx`

A root loading boundary starts streaming the response before the page body runs, which
flushes `200` headers and makes `notFound()` render the 404 page under a `200` status.
The pages here resolve fast, so the boundary was dropped to keep status codes honest.

## Scripts

| Script            | What it does                          |
| ----------------- | ------------------------------------- |
| `pnpm dev`        | Dev server                            |
| `pnpm build`      | `prisma generate` + production build   |
| `pnpm start`      | Serve the production build            |
| `pnpm lint`       | ESLint (fails on `any` / `unknown`)    |
| `pnpm typecheck`  | `tsc --noEmit`                         |
| `pnpm db:migrate` | Create + apply a dev migration         |
| `pnpm db:deploy`  | Apply migrations (production)          |
| `pnpm db:studio`  | Prisma Studio                          |
| `pnpm db:seed`    | Reset and load demo data               |

## Redis cache

Optional. With `REDIS_URL` unset every helper in `src/lib/cache.ts` becomes a
pass-through and reads go straight to PostgreSQL — local development needs no Redis.

Cached reads:

| Key | TTL | Holds |
| --- | --- | ----- |
| `tm:v1:projects:list` | 60s | Dashboard project grid with per-project stats |
| `tm:v1:stats:workspace` | 60s | Workspace totals tile row |
| `tm:v1:project:<id>:<status>:<priority>:<sort>:<search>` | 30s | One filter combination of a project page |

Every write — server action or REST route — calls `invalidateProject(projectId)`, which
drops both workspace keys and `SCAN`s away every filter variant of that project. The TTLs
are a safety net for invalidations that never arrive, not the primary mechanism.

Three properties worth keeping if you extend this:

- **Cached JSON is parsed, not trusted.** `src/lib/dto-schemas.ts` holds a zod schema per
  cached shape, each annotated `z.ZodType<TheDTO>` so TypeScript fails the build if a DTO
  and its schema drift. A stale entry from an older deploy fails `safeParse`, gets deleted,
  and the request falls through to the database.
- **Redis failures never surface.** Connection errors, timeouts and malformed entries all
  fall back to `load()`. A Redis outage makes the app slower, not broken.
- **Misses are not cached.** `cachedNullable` skips storing `null`, so a project fetched
  before it exists does not pin a 404 for the whole TTL.

### Adding Redis on Railway

1. Project canvas → **+ New** → **Database** → **Redis**
2. App service → **Variables** → `REDIS_URL` = `${{Redis.REDIS_URL}}`
3. Redeploy

Use the `${{...}}` reference rather than a pasted literal — Railway resolves it at deploy
time and it survives credential rotation.

## Image uploads (Railway Storage Bucket)

Tasks hold images, stored in a Railway bucket over its S3-compatible API.

```
browser ──1. POST multipart /api/tasks/[taskId]/attachments──> app
app     ──2. signed PUT──────────────────────────────────────> bucket
app     ──3. write TaskAttachment row, return the DTO────────> browser
browser ──4. GET /api/attachments/[id] ──> 302 ──> presigned GET (5 min)
```

The upload is **proxied through the app** rather than sent straight from the browser.
Railway buckets have no documented CORS control, and a browser PUT to the bucket needs
one; going through the app sidesteps that entirely. It is a route handler, not a server
action, because server actions cap the request body at 1 MB.

Reads go through `/api/attachments/[id]`, which redirects to a five-minute signed URL —
Railway buckets are private and have no public URLs, and a link that leaks expires on its
own. `?download=1` returns it as a file download.

Limits live in `src/lib/uploads.ts` (8 MB, PNG/JPEG/WebP/GIF/AVIF) and are enforced on
both sides — the client for fast feedback, the route handler because a client can lie.

There is no auth in this app yet, so anyone who can reach it can attach an image to any
task and read any attachment id. Add the session check in the two routes under
`src/app/api/` and in `src/lib/attachment-actions.ts` once there is one.

### Setup on Railway

1. Project canvas → **+ New** → **Bucket**.
2. App service → **Variables** → add the bucket's variable references:
   `ENDPOINT`, `BUCKET`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`, `REGION`
   (e.g. `ENDPOINT = ${{Bucket.ENDPOINT}}`). The app reads those bare names directly.
3. Redeploy.

### Setup locally

Copy the values from the bucket's **Credentials** tab into `.env`:

```bash
STORAGE_ENDPOINT="https://t3.storageapi.dev"
STORAGE_BUCKET="your-bucket-name"
STORAGE_ACCESS_KEY_ID="..."
STORAGE_SECRET_ACCESS_KEY="..."
STORAGE_REGION="auto"
```

Leave them unset and the app runs as before with the upload panel disabled. If the
Credentials tab says the bucket needs **path-style** URLs, add
`STORAGE_FORCE_PATH_STYLE="true"`. The same variables point at any other S3-compatible
bucket (MinIO, Garage, R2, S3) — only the endpoint changes.

Deleting an image, a task or a project removes the objects from the bucket too
(best-effort — a failed delete leaves an orphan object, never a broken row).

## Data model

```
Project 1 ──< Task 1 ──< TaskAttachment
  id, name, description, color, createdAt, updatedAt
             id, title, description, status, priority, dueDate, projectId
                        id, key, filename, contentType, size, taskId, createdAt
```

`TaskStatus` = `TODO | IN_PROGRESS | BLOCKED | DONE`
`TaskPriority` = `LOW | MEDIUM | HIGH | URGENT`

Indexes: `Project(createdAt)`, `Task(projectId, status)`, `Task(dueDate)`,
`TaskAttachment(taskId, createdAt)`, unique on `TaskAttachment(key)`.
Deleting a project cascades to its tasks, and a task to its attachment rows.

## Routes

**Pages**

| Path                                    | What                                              |
| --------------------------------------- | ------------------------------------------------- |
| `/`                                     | Workspace stats + project grid + create project   |
| `/projects/[projectId]`                 | Task list with live filter / search / sort        |
| `/projects/[projectId]/edit`            | Edit project                                      |
| `/projects/[projectId]/tasks/[taskId]`  | Edit task                                         |

**REST API** (same zod schemas as the UI)

| Method | Path                                | Body / query                                     |
| ------ | ----------------------------------- | ------------------------------------------------ |
| GET    | `/api/projects`                     | —                                                |
| POST   | `/api/projects`                     | `{ name, description?, color? }`                 |
| GET    | `/api/projects/[projectId]`         | `?status=&priority=&search=&sort=`               |
| DELETE | `/api/projects/[projectId]`         | —                                                |
| GET    | `/api/projects/[projectId]/tasks`   | —                                                |
| POST   | `/api/projects/[projectId]/tasks`   | `{ title, description?, status?, priority?, dueDate? }` |
| GET    | `/api/tasks/[taskId]`               | —                                                |
| PATCH  | `/api/tasks/[taskId]`               | any subset of the task fields                    |
| DELETE | `/api/tasks/[taskId]`               | —                                                |
| POST   | `/api/tasks/[taskId]/attachments`   | multipart, field `file` — one image              |
| GET    | `/api/attachments/[attachmentId]`   | `?download=1` optional — 302 to a signed URL     |

```bash
curl -X POST localhost:3000/api/projects \
  -H 'content-type: application/json' \
  -d '{"name":"Launch prep","color":"#f59e0b"}'
```

## How `any` and `unknown` are kept out

1. `tsconfig.json` runs `strict`.
2. ESLint fails the build on either keyword:
   - `@typescript-eslint/no-explicit-any: error`
   - `no-restricted-syntax` blocks the `TSAnyKeyword` and `TSUnknownKeyword` AST nodes.
3. Patterns used instead:
   - **JSON request bodies** → the `JsonValue` union in `src/lib/types.ts`, then
     `schema.safeParse(...)` narrows it to a real type.
   - **`catch` blocks** → narrowed inline with `caught instanceof Error ? caught : null`,
     so no variable is ever annotated.
   - **Form data** → `readField(formData, key)` returns `string`, never `FormDataEntryValue`.
   - **Search params** → parsed through a zod schema with `.catch(...)` fallbacks.
   - **DB rows** → Prisma's generated types, mapped to the DTOs in `src/lib/types.ts`.

## Layout

```
prisma/
  schema.prisma          models + enums
  seed.ts                demo data
src/
  app/
    page.tsx             dashboard
    projects/…           dynamic project + task pages
    api/…                REST route handlers
    error.tsx  not-found.tsx
  components/            client components (forms, filters, cards)
  lib/
    env.ts               validated environment
    prisma.ts            singleton client
    types.ts             DTOs, JsonValue, FormState
    validation.ts        zod schemas + form/search-param readers
    queries.ts           read paths
    actions.ts           server actions (write paths)
    labels.ts            enum labels, date formatting
    http.ts              JSON body reader + error responses
```

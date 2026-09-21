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

### Running against Railway

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

## Data model

```
Project 1 ──< Task
  id, name, description, color, createdAt, updatedAt
             id, title, description, status, priority, dueDate, projectId
```

`TaskStatus` = `TODO | IN_PROGRESS | BLOCKED | DONE`
`TaskPriority` = `LOW | MEDIUM | HIGH | URGENT`

Indexes: `Project(createdAt)`, `Task(projectId, status)`, `Task(dueDate)`.
Deleting a project cascades to its tasks.

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

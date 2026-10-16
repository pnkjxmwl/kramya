# Kramya

An OPD queue platform for patients to wait away from the clinic and arrive closer
to their turn. ETA accuracy, clear uncertainty and recovery from queue changes are
core product requirements.

| Directory            | Responsibility                                                           |
| -------------------- | ------------------------------------------------------------------------ |
| `apps/api`           | NestJS API, Prisma/PostgreSQL, queue commands, ETA, payments, FCM outbox |
| `apps/web`           | Next.js staff/admin console and public demo                              |
| `apps/native`        | Kotlin/Jetpack Compose Android patient app                               |
| `packages/contracts` | Shared Zod/TypeScript API contracts; mirror changes in Kotlin models     |
| `packages/config`    | Shared TypeScript/ESLint configuration                                   |

The Expo/React Native patient application was retired at the founder's request on
16 October 2026. Android is the current patient platform. See the
[native build/device guide](apps/native/README.md).

Use the pinned Node version in `.node-version` and pnpm version in `package.json`.

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm db:up
corepack pnpm build
corepack pnpm test
```

API integration tests use a separate local `*_test` database. Never point them at
hosted Supabase. The hosted environment remains disposable staging; see the
[staging runbook](docs/staging-runbook.md) and
[security access design](docs/security/data-access-model.md).

Production work follows the [safeguard rollout](docs/production-readiness.md).
Hands-on phone testing and the complete UI/workflow review are saved for the final
phase in [TESTING.md](TESTING.md). The current Android visual direction is documented
[here](docs/design/kramya-android-direction.md).

Start with one supervised clinic pilot and record prediction error, window coverage,
physical waiting time, late/missed arrivals and staff effort before expanding to
3–4 clinics. Automated tests verify behavior; observed outcomes establish whether
the product saves patients time.

See the [ETA measurement and supervised pilot guide](docs/pilot-eta-validation.md).

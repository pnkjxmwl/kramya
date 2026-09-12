# The API, explained from zero

**What this is.** A start-to-finish walkthrough of `apps/api` — the NestJS backend that
is the only part of this product that runs on a server. It assumes you know nothing
about TypeScript, NestJS, Prisma, SQL transactions or WebSockets, and explains each as
it comes up.

**One thing in your favour.** This code is commented far more heavily than normal
production code, and the comments explain *why*, not *what*. Many of them describe a
bug that was actually hit and fixed. This document is the map; the comments in the
files are the territory, and they are worth reading.

**How to read this.** Top to bottom, in order, with the repo open beside it. Each part
builds on the one before. Parts 1–4 are one sitting. Part 7 is a sitting on its own —
it is the heart of the product. There are exercises at the end.

---

## Table of contents

| Part | Subject | Why it is here |
|---|---|---|
| 0 | [The 5-minute map](#part-0--the-5-minute-map) | Orientation before detail |
| 1 | [TypeScript, Node and the syntax you will meet](#part-1--typescript-node-and-the-syntax-you-will-meet) | You cannot read the code without this |
| 2 | [NestJS: modules, injection, decorators](#part-2--nestjs-modules-injection-decorators) | The framework's three ideas |
| 3 | [Boot: from `node dist/main.js` to a listening server](#part-3--boot-from-node-distmainjs-to-a-listening-server) | Where execution starts |
| 4 | [The database: Prisma and the schema](#part-4--the-database-prisma-and-the-schema) | Every rule ends up here |
| 5 | [The request pipeline: guards, pipes, filters](#part-5--the-request-pipeline-guards-pipes-filters) | What runs before your code |
| 6 | [Auth: passwords, tokens, invitations](#part-6--auth-passwords-tokens-invitations) | Who is calling |
| 7 | [The queue engine](#part-7--the-queue-engine) | **The heart of the product** |
| 8 | [Money: join, webhook, refund](#part-8--money-join-webhook-refund) | The part that must never be wrong |
| 9 | [The ETA engine](#part-9--the-eta-engine) | The product's actual promise |
| 10 | [Realtime: WebSockets](#part-10--realtime-websockets) | How screens update live |
| 11 | [Background workers (sweepers)](#part-11--background-workers-sweepers) | Things that happen with nobody watching |
| 12 | [Notifications](#part-12--notifications) | Getting a message onto a phone |
| 13 | [Discovery and the patient read path](#part-13--discovery-and-the-patient-read-path) | The shop window |
| 14 | [Cross-cutting concerns](#part-14--cross-cutting-concerns) | Time, PII, health, rate limits |
| 15 | [Five end-to-end traces](#part-15--five-end-to-end-traces) | **Everything joined up** |
| — | [Exercises](#exercises) | Prove you understood it |

---

# Part 0 — The 5-minute map

## What the product does

A patient opens the phone app, finds a doctor's clinic session for today, pays the
fee, and gets a **token** (like `A007`). Instead of sitting in a waiting room for three
hours, they stay home. The app shows a live estimate of when they will be seen. When
their turn is near, the app tells them to leave. They arrive, reception scans their QR
code (that is "check-in"), and the doctor calls them in.

Meanwhile a receptionist and the doctor are looking at a web console showing the same
queue, live.

**The queue is the product.** Everything in this codebase supports that one thing.

## The three programs

```
apps/mobile   Expo / React Native   the patient's phone app
apps/web      Next.js               the doctor + reception + admin console
apps/api      NestJS                >>> THIS DOCUMENT <<<  the only thing on a server
```

Plus one shared library:

```
packages/contracts   Zod schemas + TypeScript types shared by all three
```

The API is the **only** thing that decides anything. The phone and the console are
screens. If they disagree with the API, they are wrong.

## The folders inside `apps/api/src`

```
main.ts                  the first line of code that runs
app.module.ts            the wiring diagram — lists every module
config/env.ts            reads and validates environment variables

prisma/                  the database connection
redis/                   the Redis connection
realtime/                WebSocket gateway (live updates)
common/                  guards, errors, the exception filter, shared helpers

modules/
  auth/                  signup, login, tokens
  patients/              a patient's family profiles
  config/                departments, doctors, schedules, queue policy
  sessions/              a doctor's working block on one date
  staff/                 inviting staff to a hospital
  discovery/             the patient's browse experience
  queue/                 ***** THE QUEUE ENGINE *****
  payments/              join, Razorpay, refunds
  eta/                   the wait-time estimator
  notifications/         push messages
  health/                "are you alive?" endpoints
```

About 13,300 lines of TypeScript across 106 files, plus an 891-line database schema.

## The ten ideas that explain almost everything

If you remember nothing else, remember these. Nearly every design decision in the
codebase comes from one of them.

1. **The database is the only truth.** A phone or a console never decides queue order,
   prices or permissions. It asks.
2. **Every queue change is a "command"** — a named operation, in its own file, run
   inside a database transaction that locks the session row first.
3. **The hospital you act in is decided by the server**, from your staff membership.
   Never from anything you send.
4. **Money is confirmed by Razorpay's webhook, not by the app.** The app saying "I
   paid" means nothing.
5. **Everything that changes the queue writes two audit rows** — one for the queue's
   own timeline, one for accountability.
6. **A database constraint beats an application check.** An `if` loses a race between
   two receptionists; a `UNIQUE` index does not.
7. **Never emit a live update before the transaction commits.** Otherwise you tell a
   patient they were called and then the database rolls back.
8. **Background jobs are *sweeps over state*, not queued jobs.** State *is* the
   schedule, so an outage self-heals.
9. **The call order is computed on every read and never stored.** A stored position is
   wrong the instant anyone checks in.
10. **Answer identically for "does not exist" and "not yours."** Otherwise your API
    becomes a tool for discovering which ids are real.

---

# Part 1 — TypeScript, Node and the syntax you will meet

Skip this part only if you already write TypeScript daily.

## 1.1 What is actually running

**Node.js** runs JavaScript outside a browser. That is what `node dist/main.js` does.

**TypeScript** is JavaScript with type annotations bolted on. The types exist only
while you are writing and compiling; they are erased before Node ever sees the file.
That is why there is a build step:

```
apps/api/src/**/*.ts    →   (nest build)   →   apps/api/dist/**/*.js
```

Types catch mistakes at compile time. `pnpm --filter @opd/api typecheck` runs that
check without producing output. If it passes, a whole family of bugs is impossible.

## 1.2 Reading a type annotation

```ts
const name: string = 'Apollo';
```

`: string` says "this holds text." Everything after a colon is a type.

Here is a real function from `queue/call-order.ts`:

```ts
export const tokenLabel = (prefix: string, tokenNumber: number): string =>
  `${prefix}${String(tokenNumber).padStart(3, '0')}`;
```

Two typed parameters; the `: string` after the parentheses is the **return** type. The
backtick string is a *template literal* — `${...}` inserts a value. This turns
`("A", 7)` into `"A007"`.

### The types you will see constantly

| Written | Means |
|---|---|
| `string`, `number`, `boolean` | the obvious |
| `Date` | a point in time |
| `string \| null` | either text or the value `null` — a **union** |
| `string \| undefined` | either text or missing |
| `string[]` | an array of text |
| `Promise<string>` | text that will arrive *later* (see 1.4) |
| `Record<string, number>` | an object with text keys and number values |
| `readonly string[]` | an array nobody may modify |
| `'ADMIN' \| 'RECEPTION' \| 'DOCTOR'` | one of exactly these three strings |

That last one is worth staring at. In TypeScript a *specific string* can itself be a
type. This is how the codebase models every enum:

```ts
export type QueueCommand =
  | 'JOIN'
  | 'CONFIRM_PAYMENT'
  | 'CHECK_IN'
  | 'CALL_NEXT'
  // ... 15 more
```

Now if you write `'CALL_NEXTT'` anywhere, the compiler stops you. There is no runtime
cost — it is purely a compile-time guarantee.

### `interface`

```ts
export interface QueueActor {
  accountId: string | null;
  hospitalId: string;
  type: ActorType;
}
```

This names a *shape*. Any object with those three fields is a `QueueActor`. Nothing
exists at runtime — it is a description, not a class.

## 1.3 Syntax you will trip over

```ts
const x = a ?? b;
```
**Nullish coalescing.** `x` is `a` unless `a` is `null`/`undefined`, in which case `b`.
Note it does *not* fall back on `0` or `''` — only on genuinely absent values.

```ts
const n = session?.hospitalId;
```
**Optional chaining.** If `session` is null/undefined, `n` becomes `undefined` instead
of crashing.

```ts
cached ??= loadEnv();
```
"Assign only if currently null/undefined." That one line in `config/env.ts` is the
entire caching mechanism for environment configuration.

```ts
const { status, body } = this.toResponse(exception, requestId);
```
**Destructuring.** Pulls two named fields out of a returned object into two variables.

```ts
const patch = { ...sessionPatch, ...data };
```
**Spread.** Builds a new object containing everything from `sessionPatch`, then
everything from `data` (later wins on conflicts).

```ts
const ids = [...new Set(records.map((r) => r.entryId))];
```
Three things at once: `.map()` transforms each element, `new Set(...)` removes
duplicates, `[...]` turns the Set back into an array. This exact line is in
`queue.service.ts`, and its job is "the distinct entry ids this command touched."

```ts
(entry) => entry.status === 'CALLED'
```
An **arrow function** — an unnamed function. `===` is equality without type coercion;
always use it.

```ts
private readonly prisma: PrismaService
```
`private` = only this class may touch it. `readonly` = it may never be reassigned.
Both are compile-time only.

```ts
status?: SessionStatus;
```
The `?` means the field may be **absent**. `SessionPatch` uses this so a command can
patch only the fields it cares about.

```ts
async runCommand<T>(params: { handler: (ctx: CommandContext) => Promise<T> }): Promise<T>
```
`<T>` is a **generic** — a placeholder type meaning "whatever type the handler returns,
`runCommand` returns that same type." It is how one function serves sixteen commands
that return different things without losing type safety.

```ts
const row = raw as PolicyRow;
```
`as` is a **cast**: "trust me, this is that type." It disables checking, so the
codebase uses it sparingly and comments when it does.

```ts
const first = projected[0];
if (first === undefined) throw new NotFoundError('Booking not found');
```
This looks paranoid — the array obviously has an element. It is required because the
project turns on `noUncheckedIndexedAccess`, which makes TypeScript treat every array
index as possibly missing. A deliberately strict setting that forces the codebase to
handle cases it would otherwise ignore.

## 1.4 Asynchronous code — the single most important concept

Talking to a database takes milliseconds. Node does not sit and wait; it goes and does
something else and comes back. A value that "will exist later" is a `Promise`.

```ts
const session = await this.prisma.oPDSession.findUnique({ where: { id } });
```

`await` means "pause this function here until the promise resolves, then continue with
the actual value." Any function containing `await` must be marked `async`, and an
`async` function always returns a `Promise`.

```ts
async function get(id: string): Promise<Session> {   // returns a Promise
  const row = await db.find(id);                     // waits here
  return row;                                        // caller receives Promise<Session>
}
```

**Sequential versus parallel.** This does two round trips one after the other:

```ts
const a = await queryA();
const b = await queryB();      // starts only after A finished
```

This does them at the same time:

```ts
const [a, b] = await Promise.all([queryA(), queryB()]);
```

You will see `Promise.all` all over the read paths — `discovery`, `eta`, `health` —
because those queries do not depend on each other, and doing them serially would double
the latency for nothing.

**`void bootstrap();`** at the bottom of `main.ts` means "call this async function and
deliberately do not wait for it." The `void` tells the linter the promise is ignored on
purpose.

## 1.5 Imports

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Role } from '@opd/contracts';
```

- No leading `.` → from `node_modules` (an installed package).
- Leading `./` or `../` → a file in this repo, relative to the current file.
- `import type` → this import is *only* a type and vanishes at compile time.

`@opd/contracts` is our own shared package, imported by name because pnpm workspaces
link it in. **It is compiled** — it has its own build step producing `dist/`. That fact
caused four separate deployment failures (Render, Vercel, and EAS twice), because every
build environment has to be told separately to build it.

## 1.6 Errors

```ts
throw new NotFoundError('Session not found');
```

`throw` aborts the function immediately and travels up the call stack until something
catches it. In this API almost nothing catches: errors travel all the way to one global
handler (Part 5) which turns them into HTTP responses. That is deliberate — it means an
error can never be silently swallowed halfway.

```ts
try {
  await risky();
} catch (error) {
  // runs only if risky() threw
} finally {
  // runs either way
}
```
---

# Part 2 — NestJS: modules, injection, decorators

NestJS is the web framework. It has exactly three ideas. Learn these and the whole
codebase opens up.

## 2.1 Decorators

A decorator is the `@Something` you see above a class, method or parameter. It attaches
**metadata** — it does not run your code. Something else reads that metadata later and
acts on it.

```ts
@Controller('sessions/:sessionId')
export class QueueController {

  @Post('check-in')
  checkIn(@Param('sessionId') sessionId: string) { ... }
}
```

Read it as three sentences:

- `@Controller('sessions/:sessionId')` — every route in this class starts with that path.
- `@Post('check-in')` — this method answers `POST /sessions/<something>/check-in`.
- `@Param('sessionId')` — put the value from the `:sessionId` slot into this argument.

Nest scans your classes at startup, reads all this metadata, and builds a routing table.
You never write a router yourself.

The `:sessionId` part is a **path parameter** — a wildcard. `POST /sessions/abc-123/check-in`
matches, and `sessionId` becomes `"abc-123"`.

> **Remember this, it becomes load-bearing in Part 5.** The *name* of that parameter is
> not cosmetic in this codebase. `:sessionId` triggers tenant scoping; `:id` does not.

The decorators you will meet:

| Decorator | Meaning |
|---|---|
| `@Controller('path')` | this class handles HTTP routes under `path` |
| `@Get()` `@Post()` `@Patch()` `@Delete()` | HTTP method + sub-path |
| `@Param('x')` | a value from the URL path |
| `@Query(...)` | the querystring (`?limit=20`) |
| `@Body(...)` | the JSON request body |
| `@Injectable()` | this class can be injected into others (see 2.2) |
| `@Module({...})` | this class groups controllers and services |
| `@Roles('ADMIN')` | **ours**, not Nest's — see Part 5 |
| `@Public()` | **ours** — skip authentication for this route |
| `@Throttle({...})` | tighten the rate limit for this route |

`@Roles` and `@Public` are defined in `common/decorators/index.ts` and are eight lines
each:

```ts
export const IS_PUBLIC = 'auth:public';
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES = 'auth:roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);
```

`SetMetadata` literally just tags the method with a key and a value. The guards in
Part 5 read those tags back. That is the whole mechanism.

## 2.2 Dependency injection

Look at any service:

```ts
@Injectable()
export class QueueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policies: QueuePolicyService,
    private readonly realtime: RealtimeGateway,
  ) {}
}
```

Nobody ever writes `new QueueService(...)`. At startup Nest reads those constructor
parameter *types*, finds or creates one instance of each, and passes them in. That is
**dependency injection**.

Writing `private readonly prisma: PrismaService` in the constructor does two things at
once: it declares the parameter, and it saves it as `this.prisma`. That is a TypeScript
shorthand, not a Nest feature.

Why bother? Two reasons that matter here:

1. **One shared instance.** There is exactly one `PrismaService` (one database
   connection pool) for the whole process, and everything shares it.
2. **Tests can substitute a fake.** `test/helpers.ts` swaps the real `RazorpayClient`
   for a fake object, and nothing else in the codebase notices:

```ts
let builder = Test.createTestingModule({ imports: [TestAppModule] });
for (const override of overrides) {
  builder = builder.overrideProvider(override.provide).useValue(override.useValue);
}
```

There is one wrinkle worth knowing, because it bit this codebase twice. If a
constructor parameter has a **default value** of a plain type, Nest cannot work out
what to inject and the whole application fails to start:

```ts
constructor(config: Env = env()) { ... }   // Nest sees "Object" and gives up
```

The fix, used for both `RazorpayClient` and `ExpoClient`, is to build them by hand with
a factory:

```ts
{ provide: RazorpayClient, useFactory: () => new RazorpayClient() },
```

The comment in `payments.module.ts` records why: it broke every other e2e suite while
the payment tests kept passing, because those tests overrode the provider anyway.

## 2.3 Modules

A module is a labelled box of controllers and services.

```ts
@Module({
  imports: [ConfigModule, RealtimeModule, EtaModule],
  controllers: [QueueController],
  providers: [QueueService, ReservationSweeper, GraceSweeper, CutoffSweeper],
  exports: [QueueService, ReservationSweeper, GraceSweeper, CutoffSweeper],
})
export class QueueModule {}
```

- `controllers` — HTTP routes this module answers.
- `providers` — services this module creates.
- `exports` — of those, which other modules may use.
- `imports` — other modules whose exports this one needs.

**`exports` is an enforcement mechanism, not bookkeeping.** If `QueueModule` does not
export `QueueService`, `PaymentsModule` physically cannot get hold of it. That is how
`docs/Rules.md` §3 ("no cross-module DB access — call the other module's service") is
enforced by the compiler rather than by discipline.

Two modules are marked `@Global()` — `PrismaModule` and `RedisModule` — meaning
everything can inject them without importing. That is a deliberate exception for two
infrastructure connections, and the only one.

### The dependency direction matters

```
PaymentsModule  ──imports──▶  QueueModule
QueueModule     ──imports──▶  RealtimeModule, ConfigModule, EtaModule
```

Payments depends on Queue; **Queue never depends on Payments**. That is why the staff
cancellation endpoint lives in `payments.controller.ts` even though it feels like a
queue command — it raises a refund, and the dependency cannot run backwards. The
comment in that file says exactly that.

Realtime is at the bottom and depends on nothing. That is what makes it removable: turn
the gateway off and every REST path still works.

## 2.4 Controller versus service

The rule (`docs/Rules.md` §4) is: **controllers are thin**.

A controller may only: read the request, validate it, and call something. No business
logic, ever. Here is a whole controller method:

```ts
@Post('check-in')
checkIn(
  @Param('sessionId') sessionId: string,
  @CurrentAccount() account: AuthedAccount,
  @CurrentHospital() tenant: TenantContext,
  @Body(new ZodBody(CheckInRequest)) body: CheckInRequest,
): Promise<QueueCommandResult> {
  return checkIn(this.queue, sessionId, actorOf(account, tenant), body);
}
```

Four inputs, one call, no decisions. Every decision is behind that call.

Notice it does not even `await` — it returns the promise directly and lets Nest await
it. Same result, one less line.

---

# Part 3 — Boot: from `node dist/main.js` to a listening server

Open `src/main.ts`. It is 62 lines and every one matters. Execution starts here.

## 3.1 The sequence

```ts
async function bootstrap(): Promise<void> {
  const config = env();                                            // 1
  initSentry(config.SENTRY_DSN, config.NODE_ENV);                  // 2
  const app = await NestFactory.create(AppModule, {                // 3
    bufferLogs: true, rawBody: true,
  });
  app.getHttpAdapter().getInstance().disable('x-powered-by');      // 4
  app.use(helmet({ ... }));                                        // 5
  app.useLogger(app.get(Logger));                                  // 6
  app.enableShutdownHooks();                                       // 7
  const realtime = new RedisIoAdapter(app);                        // 8
  await realtime.connect();
  app.useWebSocketAdapter(realtime);
  await app.listen(config.PORT);                                   // 9
}
void bootstrap();
```

**1 — Validate configuration first.** Before anything else. If `DATABASE_URL` is
missing, the process dies here with a readable message rather than throwing a confusing
500 on the first request an hour later.

**2 — Error reporting before the app exists**, so a crash *during* boot is still
reported.

**3 — Build the application.** `NestFactory.create` scans `AppModule`, follows every
import, instantiates every service, and wires the routing table.

The `rawBody: true` option is genuinely important and is explained at length in the
file. Nest normally parses JSON and hands you an object. The Razorpay webhook needs the
**original bytes**, because its signature is a hash over exactly what was sent, and
`JSON.parse` then `JSON.stringify` produces a byte-for-byte different string with the
same meaning — and therefore a different hash. Turning this option on *after* writing
the verification is, in the file's words, "how hours get lost to a phantom invalid
signature."

**4 — Remove the `X-Powered-By: Express` header.** It tells an attacker which stack to
look up known issues for and tells a legitimate client nothing.

**5 — Security headers**, with two deliberate overrides of helmet's defaults:

```ts
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
```

CSP is off because this process serves JSON to two native clients and a console on
another origin, never HTML — a CSP here protects nothing. CORP is set to `cross-origin`
because helmet's default (`same-origin`) would break the console on Vercel and the Expo
app, which are *both* on different origins. That is the deployment shape, so the default
would be a header whose only effect is breaking the product.

**6 — Swap in the real logger.** `bufferLogs: true` in step 3 held every log line in
memory until this point, so nothing logged during startup is lost.

**7 — Shutdown hooks.** On `SIGTERM`, Nest calls `onModuleDestroy()` on every service.
That is how `PrismaService` disconnects cleanly and how sweepers stop their timers.

**8 — WebSocket adapter.** Covered in Part 10.

**9 — Listen.** `config.PORT` — Render injects `PORT` and this reads it.

## 3.2 `config/env.ts` — configuration as a contract

This file is worth reading in full. It is the pattern the whole codebase uses.

```ts
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  CHECKIN_SECRET: z.string().min(32),
  // ... about 20 more
});
```

### What Zod is

Zod is a runtime validation library. TypeScript's types vanish at compile time, so they
cannot check data arriving from outside the program — an HTTP body, an environment
variable. Zod schemas exist at runtime and *do* check.

Read the chain left to right:

- `z.string()` — must be text
- `.url()` — and must parse as a URL
- `.min(32)` — and must be at least 32 characters
- `.default('')` — or if absent, use `''`
- `z.coerce.number()` — convert to a number first (env vars are always strings)

Then:

```ts
export type Env = z.infer<typeof EnvSchema>;
```

**`z.infer` derives the TypeScript type from the schema.** One definition, two
guarantees: compile-time types and runtime validation, which can never disagree. This
single trick is used everywhere in this codebase and in `packages/contracts`. It is the
most important pattern to internalise.

### Reading it

```ts
let cached: Env | undefined;

export function env(): Env {
  cached ??= loadEnv();
  return cached;
}
```

Validated once, cached forever. **Consequence to remember:** changing an environment
variable on Render requires a *restart*, not just a save. Nothing re-reads it.

### Two design choices worth noticing

**Separate secrets per token type.** `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are
different values. If the access secret leaks, the attacker still cannot mint refresh
tokens. The check-in QR has a third secret of its own, for the same reason.

**Optional integrations default to empty and the API still boots.**

```ts
export function paymentsConfigured(config: Env = env()): boolean {
  return (
    config.RAZORPAY_KEY_ID !== '' &&
    config.RAZORPAY_KEY_SECRET !== '' &&
    config.RAZORPAY_WEBHOOK_SECRET !== ''
  );
}
```

A contributor with no Razorpay account can still run discovery and the queue engine.
And note it requires **all three**: a half-configured environment counts as OFF, rather
than accepting payments it could never verify.

## 3.3 `app.module.ts` — the wiring diagram

Two things live here beyond the module list.

### Logging

```ts
LoggerModule.forRoot({
  pinoHttp: {
    level: env().LOG_LEVEL,
    genReqId: (req, res) => { /* reuse or generate an x-request-id */ },
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie',
              'req.body.password', 'req.body.passwordHash'],
      remove: true,
    },
    autoLogging: { ignore: (req) => req.url === '/health' },
  },
})
```

Every request gets an id, echoed back in the `x-request-id` response header. When
something breaks in production, that id is how you find the exact log line. `redact`
strips credentials before anything is written. `/health` is excluded because an
orchestrator polls it constantly and would otherwise drown the log.

### The global guard order

```ts
providers: [
  { provide: APP_FILTER, useClass: AllExceptionsFilter },
  { provide: APP_GUARD, useClass: ThrottlerGuard },
  { provide: APP_GUARD, useClass: JwtGuard },
  { provide: APP_GUARD, useClass: TenantGuard },
  { provide: APP_GUARD, useClass: RolesGuard },
]
```

**This list is the security model, and the order is the design.**

- **Throttle first** — deliberately *before* authentication. The attack being defended
  against is credential stuffing, where every request is unauthenticated by definition.
  A limiter behind the JWT guard would only ever throttle people who had already logged
  in.
- **Then authenticate** (who are you?).
- **Then resolve the tenant** (which hospital are you acting in?).
- **Then check the role** (are you allowed to do this here?). A role is meaningless
  without a hospital, which is why it must come last.

Because all four are **global**, a route added tomorrow is protected by default. You opt
*out* with `@Public()`, which is greppable — every use is a visible decision. That is
the opposite of the usual arrangement, where you opt in and the one route somebody
forgot is the breach.
---

# Part 4 — The database: Prisma and the schema

## 4.1 What Prisma is

PostgreSQL stores the data. **Prisma** is the layer between TypeScript and SQL. You
describe your tables once in `prisma/schema.prisma`, and Prisma generates a fully typed
client.

```ts
const session = await this.prisma.oPDSession.findUnique({
  where: { id: sessionId },
  select: { hospitalId: true },
});
```

That is a `SELECT "hospitalId" FROM "OPDSession" WHERE id = $1`. The return type is
inferred: `session` is `{ hospitalId: string } | null`, and TypeScript will not let you
read `session.hospitalId` without first handling the `null`.

The odd casing (`oPDSession`) is Prisma lowercasing the first letter of the model name
`OPDSession`. It looks wrong and it is correct.

The methods you will see:

| Method | Does |
|---|---|
| `findUnique` | by a unique key; `null` if absent |
| `findFirst` | first match of any filter |
| `findMany` | a list |
| `create` / `update` / `delete` | one row |
| `updateMany` / `deleteMany` | many rows, returns a count |
| `upsert` | update if present, insert if not |
| `count` | how many |
| `groupBy` | SQL `GROUP BY` with aggregates |
| `aggregate` | `_max`, `_avg`, `_count` |
| `$transaction` | run several operations atomically |
| `$queryRaw` | raw SQL (used in exactly two places, both deliberate) |

### Migrations

You never edit the database by hand. You change `schema.prisma`, then generate a
migration — a timestamped SQL file in `prisma/migrations/`. There are twelve, and their
names read as the project's history:

```
20260829193125_init
20260830004758_phase2_hospital_config
20260831120000_phase4_queue_engine
20260831160000_phase5_payments
20260902060000_phase8_notifications
20260905120000_notification_dedupe_by_occasion
```

- `prisma migrate dev` — for local development; it can **reset your database**.
- `prisma migrate deploy` — applies pending migrations, never destroys anything. This
  is what runs on Render.

`scripts/no-migrate-dev.mjs` guards this: it refuses to run `migrate dev` or
`migrate reset` if `DATABASE_URL` points anywhere but localhost.

## 4.2 The shape of the data

Read the schema in three groups.

### Group 1 — Global (not owned by any hospital)

| Model | Is |
|---|---|
| `Account` | a login — email, password hash, optional Google id |
| `Patient` | a *person receiving care* — you, your mother, your child |
| `RefreshToken` | one issued refresh token |

**`Account` and `Patient` are different things, and that split is a real product
decision.** One login can hold several patient profiles, because you book appointments
for your family. `Patient.relation` is `SELF | SPOUSE | MOTHER | FATHER | CHILD | ...`.

`Patient.accountId` is **nullable**, and the schema explains why at length: a walk-in
registered at a reception desk has no app account at all. The alternatives were
inventing a fake Account per walk-in, attributing the patient to the receptionist (a lie
in the data), or storing a walk-in's name on `QueueEntry` so the same person is modelled
two different ways depending on how they arrived. Nullable is the honest option.

### Group 2 — Tenant-scoped (owned by one hospital)

```
Hospital
 ├── HospitalStaff     an Account's membership + role in this hospital
 ├── Department        e.g. Cardiology
 ├── Doctor
 ├── DoctorSchedule    "Dr Rao, Tuesdays, 10:00–13:00, ₹500"
 ├── QueuePolicy       ONE row per hospital — the rules
 └── OPDSession        a doctor's working block on ONE date  ◀── the queue hangs off this
      └── QueueEntry   one patient's place in that queue
           ├── QueueEvent      append-only timeline
           ├── Consultation    a completed visit
           └── Payment → Refund
```

Every one of these tables has a `hospitalId` column, and it is indexed. That is
`docs/Rules.md` §5, and it is what makes tenant scoping cheap.

**`HospitalStaff` is where authority lives — not `Account`.** Your account is your
identity; your *membership* is your permission. The same person can be a DOCTOR at one
hospital and RECEPTION at another, and the model handles that without any special case.

### Group 3 — Supporting

`AuditLog`, `PushToken`, `Notification`.

## 4.3 The nine data decisions worth understanding

### 1. Money is stored in paise, as an integer

`feePaise: Int`. ₹500 is `50000`. Never a floating-point number — `0.1 + 0.2` is not
`0.3` in binary floating point, and that error in a payments table is a real problem.

### 2. Times are UTC; dates are IST

```prisma
date           DateTime @db.Date     // the Asia/Kolkata CALENDAR DATE
scheduledStart DateTime              // the UTC INSTANT
scheduledEnd   DateTime
```

Two different concepts stored separately, deliberately. "Which sessions are today?" is
then an equality test on `date`, not timezone arithmetic on every row.

`DoctorSchedule.startTime` is a **string** `"10:00"`, not a timestamp — because a
schedule is a rule about clock faces, and it only becomes a real instant when combined
with a calendar date. There is a nice side effect noted in the schema: zero-padded
`HH:mm` sorts lexicographically exactly as it sorts chronologically, so `endTime >
startTime` works as a genuine database CHECK constraint.

### 3. `tokenNumber` is a label, not a position

```prisma
/// `tokenNumber` is an immutable booking-order LABEL, not the call order.
/// The effective call order is computed on every read and deliberately NOT stored.
```

This is idea #9 from Part 0, and Part 7 is built on it.

### 4. `QueueEvent` and `AuditLog` are append-only

Never updated, never deleted. A mistake is corrected with a *compensating row*, not an
edit. `QueueEvent` deliberately has no `updatedAt` column: a column nothing may change
should not exist.

Why two tables? `QueueEvent` is the queue's own timeline — read by patients and by the
ETA engine. `AuditLog` is the accountability record, and it covers actions with no
queue at all (config edits, staff invitations). The same action writes one of each.

### 5. `status` and `doctorPresence` are independent

```prisma
status         SessionStatus  @default(OPEN_FOR_REGISTRATION)
doctorPresence DoctorPresence @default(NOT_PRESENT)
```

A doctor being late, on a break, or gone **never** changes the session's status.
Conflating them makes "ACTIVE but nobody in the room" unrepresentable — a state that
happens every single day.

### 6. Uniqueness is enforced by the database

```prisma
@@unique([sessionId, tokenNumber])                  // two walk-ins at once
@@unique([originalDoctorId, date, scheduledStart])  // a double-clicked "generate"
razorpayPaymentId String? @unique                   // a replayed webhook
dedupeKey         String  @unique                   // a duplicate push
```

Each of these replaces an application-level "does this already exist?" check, which
loses the race. The schema comment on `razorpayPaymentId` calls it "the replay guard,"
and the handler treats a violation as *success* rather than an error.

### 7. Configuration is deactivated, never deleted

`Department.isActive`, `Doctor.isActive`. `DELETE /doctors/:id` sets the flag false.
The reason is in the schema: sessions reference a doctor with `onDelete: Restrict`, so a
hard delete stops working the day the doctor is first used — permanently. And a doctor
who leaves still owns every past session.

### 8. Nullable timestamps carry meaning

Look at `QueueEntry` and notice how much is expressed by *when a column is null*:

| Column | Null means |
|---|---|
| `checkedInAt` | has not arrived |
| `requeuedAt` | has never been sent to the back of the queue |
| `reservationExpiresAt` | never needed a hold, or already paid |
| `predictedCallFrom/To` | no "leave now" nudge was ever sent |
| `priorityAt` | priority is NORMAL |

`requeuedAt` is the subtle one. Since the token number is immutable and the call order
is computed, that column is the **only** thing that can express "move to the end of the
queue." Without it, a skipped patient with an early token gets handed straight back to
the doctor — the exact loop the grace period exists to stop.

### 9. `reservationExpiresAt` is the mechanism, not a job

```prisma
/// **This column, not a job, is what releases the slot.** Every rule that counts
/// people in a session treats a RESERVED entry past this instant as not holding a
/// place, so the slot frees at exactly the right moment even if no worker is
/// running. The sweeper only writes down what is already true.
```

Read that twice. It is idea #8 from Part 0, and it is the single argument that shaped
every background worker in this codebase.

## 4.4 The enums

`QueueEntryStatus` is the one to memorise:

```
RESERVED          joined, not paid — holding a slot, NOT callable
CONFIRMED         paid, has a token, still at home
VIRTUAL_WAITING   (reserved for later use)
CHECKED_IN        physically present — CALLABLE
READY             reserved and unreachable in v1
CALLED            the doctor has asked for them
IN_CONSULTATION   in the room
COMPLETED         done                        ─┐
CANCELLED         withdrawn                    │ terminal —
NO_SHOW           never appeared               │ nothing further
SKIPPED           called, absent, passed over  │ happens
RESCHEDULED       present but the clinic ended ─┘  (SKIPPED is not terminal)
```

`READY` exists in the enum but is unreachable in v1. It is there because
`docs/Architecture.md` defines the "callable" predicate as `CHECKED_IN | READY`, and the
codebase implements the specified predicate rather than a simplified version of it.

`QueueEntryType` (`ONLINE | WALK_IN | FOLLOW_UP`) is **immutable provenance** — how the
entry got here. It is deliberately separate from `QueueEntryPriority`
(`NORMAL | PRIORITY | EMERGENCY`), so that an escalated walk-in is still recorded as a
walk-in.

---

# Part 5 — The request pipeline: guards, pipes, filters

## 5.1 The order of everything

For `POST /sessions/abc-123/call-next`:

```
HTTP request
   ↓
pino logger        assigns x-request-id
   ↓
ThrottlerGuard     too many requests?            → 429
   ↓
JwtGuard           valid Bearer token?           → 401
   ↓
TenantGuard        which hospital? are you in it?→ 403
   ↓
RolesGuard         is your role allowed here?    → 403
   ↓
ZodBody pipe       is the body the right shape?  → 400
   ↓
CONTROLLER  →  COMMAND  →  SERVICE  →  DATABASE
   ↓
AllExceptionsFilter   catches anything thrown anywhere above
   ↓
HTTP response
```

A guard is a class with one method, `canActivate`, returning true (continue) or
throwing (stop).

## 5.2 `JwtGuard` — who are you

```ts
async canActivate(ctx: ExecutionContext): Promise<boolean> {
  const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
    ctx.getHandler(),
    ctx.getClass(),
  ]);
  if (isPublic) return true;

  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new UnauthorizedError();

  try {
    const claims = await this.jwt.verifyAsync<AccessTokenClaims>(header.slice(7), {
      secret: env().JWT_ACCESS_SECRET,
    });
    req.account = { id: claims.sub, email: claims.email };
    return true;
  } catch {
    throw new UnauthorizedError();
  }
}
```

**`Reflector`** is how a guard reads the decorator metadata from Part 2.
`getAllAndOverride(KEY, [handler, class])` looks at the method first and falls back to
the class — so a method-level decorator **wins** over a class-level one. That fact
becomes load-bearing in Part 7.

**A JWT** is three base64 chunks: header, payload, signature. The payload is *not
encrypted* — anyone can read it. What the signature proves is that it was issued by
someone holding `JWT_ACCESS_SECRET` and has not been altered. That is why the claims are
kept tiny (`sub` and `email` only) and why a role is never put in a token: roles change,
and a token cannot be un-issued.

The `catch` block returns one generic error for expired, tampered, and
signed-with-the-wrong-secret. All the same to a caller, and distinguishing them tells an
attacker which guess was closer.

On success it hangs `req.account` on the request object, and everything downstream reads
it from there.

## 5.3 `TenantGuard` — which hospital, and are you in it

This is the most security-critical file in the codebase. Read it slowly.

```ts
async canActivate(ctx: ExecutionContext): Promise<boolean> {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  const params = req.params as Record<string, string> | undefined;
  const hospitalId = params?.hospitalId ?? (await this.hospitalOfSession(params?.sessionId));
  if (!hospitalId) return true;

  if (!req.account) throw new UnauthorizedError();

  const membership = await this.prisma.hospitalStaff.findUnique({
    where: { hospitalId_accountId: { hospitalId, accountId: req.account.id } },
    select: { role: true, permissions: true, status: true },
  });

  if (!membership) throw new TenantMismatchError();
  if (membership.status !== 'ACTIVE') throw new ForbiddenError('Membership is not active');

  req.tenant = {
    hospitalId,
    role: membership.role as Role,
    permissions: membership.permissions,
  };
  return true;
}
```

Four things are happening.

**1. The hospital comes from the route, never from the body.** Either the URL says
`hospitals/:hospitalId/...`, or it says `sessions/:sessionId/...` and the guard looks up
which hospital that session belongs to. In both cases the *server* decides. A client
that sends `{"hospitalId": "someone-elses"}` in a JSON body is simply ignored.

**2. The parameter name is the opt-in.** This is the trap the codebase refers to as
"trap 12," and it is genuinely non-obvious:

| Route | Guard | Because |
|---|---|---|
| `POST /sessions/:sessionId/call-next` | **scoped** | staff acting inside a hospital |
| `POST /sessions/:id/join` | **not scoped** | a patient has no membership anywhere |
| `GET /sessions/:id` | **not scoped** | patient browsing |

Rename `:id` to `:sessionId` on the join route and every patient in the country is
locked out of booking, because they have no `HospitalStaff` row. Rename `:sessionId` to
`:id` on the queue commands and twelve endpoints silently lose their tenant scoping.
There are tests specifically pinning this.

**3. Registered globally.** There is no per-controller decorator to forget — which is
exactly the failure mode that leaks another hospital's data.

**4. The same answer for "no such hospital" and "not your hospital."** Both are
`TenantMismatchError` → 403. A 404-vs-403 difference would let anyone enumerate which
hospital ids exist, one request at a time.

### The bug at the bottom of this file

That last guarantee needs a sentinel for "this session does not exist," so the membership
lookup misses and produces the same 403:

```ts
private async hospitalOfSession(sessionId: string | undefined): Promise<string | undefined> {
  if (!sessionId) return undefined;
  const session = await this.prisma.oPDSession.findUnique({
    where: { id: sessionId },
    select: { hospitalId: true },
  });
  return session?.hospitalId ?? NO_SUCH_HOSPITAL;
}

const NO_SUCH_HOSPITAL = 'no-such-hospital';
```

That constant used to be a literal NUL byte followed by the phrase. It looked airtight —
nothing can collide with a string containing a byte no id may hold.

**Postgres rejects NUL in text outright** (SQLSTATE 22021). So the membership query
*threw* instead of returning null, and every unknown session id on a tenant-scoped route
answered **500** while a real session from another hospital answered **403**. That is
precisely the enumerable difference the sentinel existed to prevent, inverted. It also
logged an unhandled server error on every probe, and made the file read as *binary* to
`grep`.

The fix is the comment's last line: "Hospital ids are UUIDs, so a plain lowercase phrase
can never be one. The impossibility does not need an unrepresentable byte to hold."
There are now two regression tests asserting a missing session and another hospital's
real session return an identical status *and* an identical error code.

**The lesson generalises.** A clever value that is "obviously impossible" is still a
value that has to travel through every layer beneath you.

## 5.4 `RolesGuard` — are you allowed to do this

```ts
canActivate(ctx: ExecutionContext): boolean {
  const required = this.reflector.getAllAndOverride<Role[]>(ROLES, [
    ctx.getHandler(), ctx.getClass(),
  ]);
  if (!required?.length) return true;

  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  if (!req.tenant) throw new ForbiddenError('Route requires a hospital context');
  if (!required.includes(req.tenant.role)) throw new ForbiddenError();
  return true;
}
```

Note the middle check. `@Roles()` on a route with **no** `:hospitalId` or `:sessionId`
is a *wiring bug*, not a permission failure — the guard says so explicitly rather than
failing open.

And note `getAllAndOverride` again: method beats class. That is what lets
`QueueController` say "all three roles" at the class level and then restrict two
specific endpoints (Part 7.9).

## 5.5 `ZodBody` — is the request the right shape

```ts
export class ZodBody<T extends ZodTypeAny> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    const parsed = this.schema.safeParse(value);
    if (parsed.success) return parsed.data;

    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.') || '(root)'] = issue.message;
    }
    throw new ValidationFailedError('Request validation failed', fieldErrors);
  }
}
```

Used as `@Body(new ZodBody(CheckInRequest)) body: CheckInRequest`. The schema comes from
`packages/contracts`, so the phone, the console and the API all validate against the
same definition. That is `docs/Rules.md` §6.

Two details: `safeParse` returns a result object rather than throwing, and the error
reply carries **field names only** — never the submitted value, which might be a
password.

`parsed.data` is what continues onward — the *parsed* value, which matters because Zod
applies defaults and coercions. `?limit=20` arrives as the string `"20"` and reaches the
controller as the number `20`.

## 5.6 `AllExceptionsFilter` — one shape for every failure

Every error in the system funnels through this one class.

```ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const { status, body } = this.toResponse(exception, requestId);

    if (status >= 500) {
      this.logger.error(`Unhandled server error: ${where}`, /* full stack */);
      reportFault(exception, requestId);
    } else {
      this.logger.warn(`${body.error.code}: ${where} - ${body.error.message}`);
    }

    res.status(status).json(body);
  }
}
```

Every response has the same shape:

```json
{ "error": { "code": "INVALID_QUEUE_TRANSITION",
             "message": "human-readable",
             "details": {},
             "requestId": "..." } }
```

Three branches inside `toResponse`:

1. **`AppError`** — one of ours. Its code, its status, its message.
2. **`HttpException`** — Nest's own. Mapped to our codes, with one special case worth
   noting: `ThrottlerGuard` throws a plain `HttpException`, so without an explicit
   mapping a rate-limited caller would be told their *request* was invalid — and would
   "fix" it and retry, which is the opposite of what a 429 is asking for.
3. **Anything else** — status 500, message `"Internal server error"`, and *nothing*
   useful to the client. The full stack goes to the log.

That third branch is `docs/Rules.md` §7: **fail loudly in the log, safely in the
response.** A stack trace in an HTTP response tells an attacker your file layout,
your library versions and sometimes your SQL.

## 5.7 `common/errors.ts` — the typed error catalogue

```ts
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly httpStatus: number,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
```

Every deliberate error extends this. Then eighteen subclasses, each carrying its own
code and status. A few worth reading for the reasoning:

```ts
export class InvalidCredentialsError extends AppError {
  constructor() {
    super('INVALID_CREDENTIALS', 401, 'Email or password is incorrect');
  }
}
```

Deliberately identical for "no such email" and "wrong password." Distinguishing them
turns the login endpoint into an account-enumeration oracle.

```ts
export class InvalidQueueTransitionError extends AppError {
  constructor(command: string, from: string) {
    super('INVALID_QUEUE_TRANSITION', 409,
      `That is no longer possible - this is already ${humanState(from)}. ` +
        'Someone may have acted first; reload to see what changed.',
      { command, from });
  }
}
```

**409, not 400** — the request was well-formed and the caller was permitted; the world
simply moved. And the message is written for a receptionist while `details` keeps
`command` and `from` for a developer. It used to read "Cannot COMPLETE_CONSULTATION from
COMPLETED", which told staff nothing actionable while leaking the engine's internal
vocabulary.

The three doctor-presence errors are separate classes for one reason, stated in the
file: **the remedy differs.** A break is waited out; a departure means the session
should be ended; an unmarked doctor just needs marking present. One error for all three
would leave a receptionist guessing.
---

# Part 6 — Auth: passwords, tokens, invitations

Four files: `auth.controller.ts`, `auth.service.ts`, `token.service.ts`, and
`staff.service.ts` for invitations.

## 6.1 Passwords

```ts
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';

const passwordHash = await argonHash(input.password);
```

**Argon2id** is a deliberately *slow* hash — that is the feature. If your database
leaks, an attacker with the hashes has to spend real time and memory per guess. A fast
hash (MD5, SHA-1, plain SHA-256) can be brute-forced at billions of guesses per second.

The plaintext password is never stored and never logged (`app.module.ts` redacts
`req.body.password` before pino writes anything).

One nice detail in `acceptInvite`:

```ts
// Hashed outside the transaction: Argon2id is deliberately slow, and holding a
// transaction open across it holds locks for no reason.
const passwordHash = account.passwordHash ?? (await argonHash(input.password));
```

Being slow is exactly why it must not happen inside a transaction.

## 6.2 Two kinds of token

| | Access token | Refresh token |
|---|---|---|
| What | a signed JWT | 48 random bytes, base64url |
| Lives | 15 minutes | 30 days |
| Sent | on every request | only to `/auth/refresh` |
| Stored server-side | no | only its SHA-256 hash |
| Readable | yes (it is not encrypted) | it is meaningless random bytes |

The access token is short-lived so a leak has a small window. The refresh token carries
the session and is opaque — the server keeps only its hash, so a database leak yields
nothing usable.

## 6.3 Rotation and reuse detection

Every use of a refresh token **destroys it and issues a successor**, in the same
`familyId`. So a family is the chain of tokens descending from one login.

If someone presents a token that exists but is already revoked, that token was replayed
— which means it leaked. Revoking only that row would leave the *attacker's* newer token
valid, so **the entire family is revoked** and both parties must log in again.

Now read the transaction that implements it:

```ts
const rotated = await this.prisma.$transaction(async (tx) => {
  await tx.$queryRaw`
    SELECT "id" FROM "RefreshToken" WHERE "familyId" = ${existing.familyId} FOR UPDATE
  `;

  const claimed = await tx.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  if (claimed.count === 0) return null;

  return this.mint(existing.account, existing.familyId, tx);
});

if (rotated === null) {
  await this.revokeFamily(existing.familyId);
  throw new UnauthorizedError('Refresh token reuse detected; session revoked');
}
```

Three separate concurrency lessons live in those fifteen lines.

**`SELECT ... FOR UPDATE` — a row lock.** It says "I am going to modify these rows;
anyone else who asks for this lock waits until I commit." It is the same instrument that
serialises two receptionists pressing *Call next* (Part 7). Without it, this sequence
was possible:

1. the winner claims the presented token (marks it revoked)
2. the loser's claim fails, so it revokes every unrevoked row in the family — which at
   that instant is **none**, because…
3. …the winner now inserts its *new* token

The replay was detected and announced, and the new token survived it anyway. "Reuse
detected, everyone logs in again" is the entire security value of a token family, and
that ordering quietly withdrew it. CI found this, on a build that had nothing to do with
auth.

**The atomic claim.** `updateMany` with `revokedAt: null` in the `where` is a single
conditional UPDATE — exactly one caller can consume a given token. A read-then-write
here would let two concurrent refreshes both succeed, handing out two live sessions *and*
hiding genuine replay, because neither would observe the other's revocation.

**Revoking outside the transaction.** `if (claimed.count === 0) return null;` — the
throw happens *after* the transaction. Throwing inside would roll back the very
revocation you were performing: the replay would be announced while every token it was
meant to kill stayed alive. The comment records that it did exactly that for one run.

And why it is correct to revoke afterwards: the lock is what orders these. The loser
waited for the winner to COMMIT before it could claim, so by the time it revokes the
family, the winner's new token exists and is caught.

## 6.4 Logout

```ts
async revoke(presented: string): Promise<void> {
  const existing = await this.prisma.refreshToken.findUnique({
    where: { tokenHash: hash(presented) },
    select: { familyId: true },
  });
  if (existing) await this.revokeFamily(existing.familyId);
}
```

Kills the whole family, not just the presented token. An unknown token succeeds silently:
logout is idempotent and must not leak whether a token was real.

## 6.5 Rate limiting, chosen per route

```ts
const GUESSABLE = { default: { limit: 10, ttl: 60_000 } };
```

Applied to `signup`, `login`, `google` and `accept-invite`. Ten a minute is far more than
a person mistyping a password and far less than a script is worth running.

`auth/refresh` is deliberately **not** throttled, and the comment argues the case: a
refresh token is a high-entropy secret, not a guess, and the real defence is already
stronger than counting requests — reuse revokes the family, so a stolen token is worth
one attempt and then kills itself. Throttling it would mostly punish a client with two
tabs open.

## 6.6 Google sign-in

```ts
const ticket = await this.googleClient.verifyIdToken({ idToken, audience });
const payload = ticket.getPayload();
if (payload?.sub && payload.email && payload.email_verified) {
  return { sub: payload.sub, email: payload.email };
}
```

The client sends Google's ID token; the **server** verifies it against Google's public
keys. A client-supplied email or subject is never trusted. And `email_verified` is
required — an unverified Google email must not be able to claim an existing account.

Then:

```ts
if (!existing.googleId) {
  await this.prisma.account.update({ where: { id: existing.id }, data: { googleId: sub } });
}
```

Same verified email as an existing password account → **link**, do not duplicate.

Also note in `login`:

```ts
if (!account?.passwordHash) throw new InvalidCredentialsError();
```

A Google-only account has no password hash and must not be loggable by password.

## 6.7 Invitations

`docs/PRD.md` §14: doctors and staff are admin-invited, never self-signup.

```ts
const token = randomBytes(32).toString('base64url');
const inviteTokenHash = hashInviteToken(token);
```

An invited person gets an `Account` with **no password hash** — the column is nullable
precisely so an identity can exist before a credential does — plus a `HospitalStaff` row
in `INVITED` state carrying a single-use hashed token.

Why a token at all? Without one, the only way to claim an invited account would be to
sign up with its email — so anyone who guesses `dr.sharma@hospital.in` gets a DOCTOR
role in that hospital.

Three deliberate choices in `acceptInvite`:

- **The password is set only if the account has none.** An existing user invited to a
  second hospital keeps the password they already have. Letting an invitation overwrite a
  live credential turns "invite someone" into "reset their password," which is an
  account-takeover primitive.
- **The token is cleared in the same transaction that activates the membership**, so it
  is single-use by construction rather than by a flag someone has to remember to check.
- **Every failure returns the same error.** Distinguishing "no such token" from "expired"
  from "already used" tells an attacker which guesses were close.

Note also how `AuthService` reaches `HospitalStaff` — through `StaffService`, never by
querying the table. That is `docs/Rules.md` §3 in practice.

## 6.8 `GET /me`

Returns the account plus **memberships** — and this line is subtle:

```ts
doctorId: account.doctor?.hospitalId === m.hospitalId ? account.doctor.id : null,
```

`Doctor.accountId` is unique, so an account has at most one doctor row. Matching it to
the membership *by hospital* means a doctor at one hospital who is also reception at
another does not appear to be a doctor at both.

---

# Part 7 — The queue engine

**This is the heart of the product.** Everything so far was scaffolding. Give this part
its own sitting.

```
modules/queue/
  state-machine.ts      what is legal — the ONLY place transitions are decided
  call-order.ts         who is next — computed, never stored
  queue.service.ts      the transaction + lock + audit skeleton
  queue.controller.ts   thin HTTP surface
  commands/             one file per command (16), plus result.ts
  *-sweeper.ts          the timers
```

## 7.1 The problem being solved

Two receptionists are looking at the same queue. Both press **Call next** at the same
instant. Without protection, both read "the next patient is A007," both write "A007 is
CALLED," and two people walk into the room.

That class of bug only appears under real concurrency, in a hospital, on a busy morning
— never on your laptop. So the design does not rely on anyone remembering to prevent it.

## 7.2 The state machine — `state-machine.ts`

> **This file is the ONLY place a queue transition is decided.** Not "mostly" — only.
> The moment transition logic appears as an `if` inside a command file, the commands
> stop agreeing with each other and nobody can answer "can this happen?" by reading one
> table.

Everything in it is **pure**: values in, a value or a typed throw out. No Prisma, no
clock, no config. That is what allows every transition to be tested exhaustively without
a database.

There are two machines, deliberately independent, plus presence which is not a machine
at all.

### The entry table

```ts
const ENTRY_TRANSITIONS: Record<QueueCommand, Partial<Record<QueueEntryStatus, QueueEntryStatus>>> = {
  CHECK_IN: {
    CONFIRMED:   'CHECKED_IN',
    VIRTUAL_WAITING: 'CHECKED_IN',
    CHECKED_IN:  'CHECKED_IN',     // ← legal NO-OP
  },
  CALL_NEXT: {
    CHECKED_IN: 'CALLED',
    READY:      'CALLED',
  },
  START_CONSULTATION:    { CALLED: 'IN_CONSULTATION' },
  COMPLETE_CONSULTATION: { IN_CONSULTATION: 'COMPLETED' },
  SKIP:    { CALLED: 'SKIPPED' },
  NO_SHOW: { CALLED: 'NO_SHOW', SKIPPED: 'NO_SHOW' },
  REQUEUE: { SKIPPED: 'CHECKED_IN' },
  // ...
};
```

Read it as a lookup: *"given this command and this current status, what is the new
status?"*

```ts
export function nextEntryStatus(command: QueueCommand, from: QueueEntryStatus): QueueEntryStatus {
  const to = ENTRY_TRANSITIONS[command][from];
  if (to === undefined) throw new InvalidQueueTransitionError(command, from);
  return to;
}
```

**A missing key is an illegal transition.** That is the entire safety property, which is
why the file says never to add a catch-all.

**A value equal to its key is a legal no-op**, and that is how idempotency is expressed.
`CHECKED_IN → CHECKED_IN` exists because reception double-scans QR codes constantly, and
a 409 there would train staff to ignore errors.

Two commands have an empty map — `JOIN` and `WALK_IN` — because they *create* an entry
rather than moving one. They are listed anyway so the table stays exhaustive over
`QueueCommand` and a future reader cannot mistake the omission for an oversight.

### The three sets

```ts
export const ELIGIBLE_TO_CALL: readonly QueueEntryStatus[] = ['CHECKED_IN', 'READY'];
```

Membership of this set is the **only** definition of "callable." `docs/PRD.md` §8.2 says
the doctor never idles waiting for someone still at home, and that rule lives here rather
than in `call-next.ts` so no other command can quietly disagree with it.

```ts
export const HOLDS_A_SLOT: readonly QueueEntryStatus[] = [ /* everything except CANCELLED */ ];
```

Which statuses consume one of the session's online token slots. The rule is precise: **a
cancelled booking and a lapsed unpaid hold free their slot, and nothing else does.** A
no-show still consumed a booking — the cap limits how many people the clinic *accepted*,
not how many turned up — and handing their place to someone else after the fact would
quietly overbook a session that had already closed.

```ts
export const TERMINAL_ENTRY_STATUSES = ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'];
```

Note `SKIPPED` is **not** here. A skipped patient can still be requeued.

### The interesting rows

**`END_SESSION`** — read this table and the product decision falls out of it:

```ts
END_SESSION: {
  RESERVED:        'CANCELLED',      // never paid — a hold was never a booking
  CONFIRMED:       'NO_SHOW',        // never arrived
  VIRTUAL_WAITING: 'NO_SHOW',
  CHECKED_IN:      'RESCHEDULED',    // present, not seen — not their fault
  READY:           'RESCHEDULED',
  CALLED:          'RESCHEDULED',
  COMPLETED:       'COMPLETED',      // terminal states map to themselves
  CANCELLED:       'CANCELLED',
  NO_SHOW:         'NO_SHOW',
  RESCHEDULED:     'RESCHEDULED',
}
```

`docs/PRD.md` §8.9 and §8.11 read like they disagree about end-of-session, and do not:
they describe different people. Someone who took the afternoon off, came to the hospital
and was not seen **is not a no-show**, and their refund must not be decided as though
they were.

**`REINSTATE`** — the only transition in the product that leaves a terminal state:

```ts
REINSTATE: { CANCELLED: 'CONFIRMED' },
```

A payment captured for a hold that had already lapsed. It is a *separate command* from
`CONFIRM_PAYMENT` even though the destination is identical, so that it is named, audited
under its own action, and impossible to reach by accident — a manually cancelled entry
cannot be resurrected by a stray webhook just because the status happens to match.

The rule it implements: **the webhook wins.** The money moved and the token number was
never handed to anyone else, so giving the slot back is a status change. When there is no
queue left to rejoin, the session machine refuses it and the caller refunds instead.

**`EXPIRE_RESERVATION`** — only ever from `RESERVED`:

```ts
EXPIRE_RESERVATION: { RESERVED: 'CANCELLED' },
```

Anything already paid for is *structurally* untouchable by the sweeper. That property
comes from this one narrow row, not from the caller remembering a `where` clause.

### The session machine

```ts
const SESSION_ACCEPTS: Record<QueueCommand, readonly SessionStatus[]> = {
  JOIN:               ['OPEN_FOR_REGISTRATION', 'ACTIVE'],
  CALL_NEXT:          ['OPEN_FOR_REGISTRATION', 'ACTIVE'],
  START_CONSULTATION: ['ACTIVE'],
  PRESENCE:           ['SCHEDULED', 'OPEN_FOR_REGISTRATION', 'ACTIVE'],
  // COMPLETED / CANCELLED / ENDED_EARLY accept nothing at all
};
```

Note `ACTIVE` is in the `JOIN` list. A running clinic still takes bookings — the first
`call-next` activates a session, and closing registration the moment the doctor sees
their first patient would shut every clinic as it opened its doors.

`PRESENCE` accepts `SCHEDULED` because a doctor can be in the room before the session
opens, and recording that is not a queue mutation.

### Pause and presence

```ts
const BLOCKED_WHILE_PAUSED: readonly QueueCommand[] = ['CALL_NEXT'];
```

**One command.** Pausing must not stop joins, check-ins or walk-ins: people keep arriving
at a reception desk while the doctor is on a break, and turning them away would be a
worse product than a slightly longer queue.

```ts
const NEEDS_THE_DOCTOR_PRESENT: readonly QueueCommand[] = ['CALL_NEXT', 'START_CONSULTATION'];
const PRESENCE_ALLOWS_CALLING: readonly DoctorPresence[] = ['PRESENT'];
```

That second line is written as *the one that allows* rather than the three that block,
because three-quarters of the enum now blocks and a list of exclusions reads as an
accident.

**`NOT_PRESENT` blocking is a deliberate reversal**, and the comment argues both sides
honestly. It is the default on every session, so blocking it makes marking the doctor
present a mandatory ceremony before the first patient of every clinic. That cost was
accepted anyway, because the alternative is a receptionist calling patients in and
completing consultations for a doctor nobody ever said had arrived — which writes a
`Consultation` row and teaches the ETA engine a duration for a doctor who may not be in
the building.

And the file records what must **never** be presence-blocked, so the reasoning survives:

- `CHECK_IN` / `WALK_IN` — patients arrive whether or not the doctor is in the room.
- `COMPLETE_CONSULTATION` — a consultation that has started must always be closable.
  Blocking it would strand a patient `IN_CONSULTATION` for good the moment anyone touched
  presence mid-visit, with no way back out.

### The single gate

```ts
export function assertSessionAccepts(
  command: QueueCommand,
  session: { status: SessionStatus; pausedAt: Date | null; doctorPresence: DoctorPresence },
): void {
  if (!SESSION_ACCEPTS[command].includes(session.status)) {
    throw new InvalidQueueTransitionError(command, session.status);
  }
  if (session.pausedAt !== null && BLOCKED_WHILE_PAUSED.includes(command)) {
    throw new QueuePausedError();
  }
  if (NEEDS_THE_DOCTOR_PRESENT.includes(command) &&
      !PRESENCE_ALLOWS_CALLING.includes(session.doctorPresence)) {
    throw presenceRefusal(session.doctorPresence);
  }
}
```

It takes a plain object rather than a Prisma row, which is what keeps it pure and
testable.

## 7.3 Who is next — `call-order.ts`

```ts
export const CALL_ORDER: Prisma.QueueEntryOrderByWithRelationInput[] = [
  { priority: 'desc' },
  { priorityAt: 'asc' },
  { requeuedAt: { sort: 'asc', nulls: 'first' } },
  { tokenNumber: 'asc' },
];
```

Four lines that encode four product rules, in priority order:

1. **Emergency, then priority, then everyone else** (`docs/PRD.md` §8.7).
2. Within a level, **whoever was escalated first**.
3. **Anyone requeued goes behind everyone who was not** (§8.8's "move to end").
4. **Otherwise token order** — earliest booking first (§8.3). This is the fairness rule,
   and it is why a late check-in slots into its natural position (§8.4) rather than going
   to the back: its token number never changed, so the moment it becomes eligible it sits
   exactly where it always belonged.

Two things in there are quietly load-bearing, and the file says so:

- `priority: 'desc'` works because Postgres sorts an enum by its **declaration order**,
  which is `NORMAL, PRIORITY, EMERGENCY`. Reorder that enum and this silently inverts.
- `nulls: 'first'` on `requeuedAt` is not decoration. Null means "never sent to the
  back," and Postgres puts nulls **last** on ASC by default — which would invert the rule
  exactly.

Then:

```ts
export async function nextEligibleEntry(ctx: CommandContext): Promise<QueueEntryRow | null> {
  return ctx.tx.queueEntry.findFirst({
    where: { sessionId: ctx.session.id, status: { in: [...ELIGIBLE_TO_CALL] } },
    orderBy: CALL_ORDER,
    include: ENTRY_INCLUDE,
  });
}
```

Eligibility comes from the state machine; nothing here re-decides it.

**The same `CALL_ORDER` constant is used by the staff board, the patient's "3 ahead of
you" count, and the leave-now notifier.** That is deliberate: if the patient's position
came from a token sort while the doctor's came from this, the two would disagree the
moment anyone was escalated — and the patient's number would be a lie.

## 7.4 The skeleton — `queue.service.ts`

Every command is a *handler function* passed to `runCommand`. Commands do not open their
own transactions and do not take their own locks.

```ts
async runCommand<T>(params: {
  sessionId: string;
  actor: QueueActor;
  command: QueueCommand;
  reason?: string | null;
  handler: (ctx: CommandContext) => Promise<T>;
}): Promise<T>
```

Here is the whole thing, trimmed to its skeleton:

```ts
const now = new Date();
const policy = await this.policies.ensure(actor.hospitalId);      // OUTSIDE the transaction

let touchedEntryIds: string[] = [];
let committedVersion = 0;

const result = await this.prisma.$transaction(
  async (tx) => {
    const session = await lockSession(tx, sessionId);              // 1. LOCK
    if (session === null) throw new NotFoundError('Session not found');

    if (session.hospitalId !== actor.hospitalId) {                 // 2. TENANT
      throw new TenantMismatchError();
    }

    assertSessionAccepts(command, session);                        // 3. STATE MACHINE

    const ctx: CommandContext = { tx, session, actor, now, policy,
                                  patchSession, record, entryInSession };

    const result = await params.handler(ctx);                      // 4. THE COMMAND

    await tx.oPDSession.update({                                   // 5. PATCH + VERSION
      where: { id: sessionId },
      data: { ...sessionPatch, version: { increment: 1 } },
    });

    await writeRecords(tx, { ... });                               // 6. EVENT + AUDIT

    committedVersion = session.version + 1;
    touchedEntryIds = [...new Set(records.map((r) => r.entryId).filter(...))];
    return result;
  },
  { timeout: 10_000, maxWait: 15_000 },
);

await this.announce(sessionId, committedVersion, touchedEntryIds); // 7. REALTIME, AFTER
return result;
```

### The lock

```ts
async function lockSession(tx, sessionId): Promise<LockedSession | null> {
  const rows = await tx.$queryRaw<LockedSession[]>`
    SELECT id, "hospitalId", "departmentId", "currentProviderDoctorId",
           status::text AS status, "doctorPresence"::text AS "doctorPresence",
           "tokenPrefix", "feePaise", "scheduledStart", "scheduledEnd",
           "registrationClosedAt", "pausedAt", version
    FROM "OPDSession"
    WHERE id = ${sessionId}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}
```

`FOR UPDATE` takes an exclusive row lock held until the transaction commits or rolls
back. **Two staff pressing *Call next* at the same instant serialise here**: the second
waits, then sees the first's committed state, and gets the *next* patient rather than the
same one.

There is deliberately no `NOWAIT` — blocking is the point.

This is raw SQL, which `docs/Rules.md` §2 otherwise forbids. It is one of exactly two
documented exceptions, because Prisma has no row-lock API and this lock is the entire
concurrency design.

**Why the lock is in `runCommand` and not in each command file:** one command that forgot
`FOR UPDATE` would silently defeat the whole scheme, and the bug would only appear under
real concurrency, in a hospital. A command physically cannot forget a lock it never
takes.

**Always the session row, always first.** Locking in a consistent order is what prevents
deadlocks between commands touching the same entries from different directions. There is
exactly one lock and it is this one.

### The context object

The handler receives a `ctx` with everything it needs and nothing it does not:

| Field | Is |
|---|---|
| `ctx.tx` | the transaction — commands must use this, never the root Prisma |
| `ctx.session` | the locked row, updated in place as the command patches it |
| `ctx.actor` | who is doing this, resolved server-side |
| `ctx.now` | **one** clock reading for the whole command |
| `ctx.policy` | the hospital's rules |
| `ctx.patchSession(...)` | change the session |
| `ctx.record(...)` | append to the timeline |
| `ctx.entryInSession(id)` | fetch an entry, **verifying it belongs to this session** |

`ctx.now` being a single reading matters: without it a command's timestamps could
disagree with each other by milliseconds, and comparisons between them stop being
reliable.

`ctx.entryInSession` is the anti-IDOR primitive:

```ts
entryInSession: async (entryId) => {
  const entry = await tx.queueEntry.findFirst({
    where: { id: entryId, sessionId },     // ← both, always
    include: ENTRY_INCLUDE,
  });
  if (entry === null) throw new NotFoundError('Queue entry not found in this session');
  return entry;
},
```

An entry id from a request body is attacker-controlled. A bare `findUnique({ where: { id } })`
is how one hospital's console reaches another's queue.

### `patchSession` and the version bump

```ts
patchSession: (data) => {
  sessionPatch = { ...sessionPatch, ...data };
  Object.assign(session, data);           // ← also updates ctx.session in place
},
```

Two effects: the change is remembered for the single UPDATE at the end, *and*
`ctx.session` immediately reflects it, so the command's return value describes the world
after the command.

Then, once:

```ts
data: { ...sessionPatch, version: { increment: 1 } }
```

**Every command bumps `version`, and no command writes it.** A client holding version 7
that receives an event for version 9 knows it is stale. That is the whole
stale-detection mechanism, and it cannot be forgotten because no command touches it.

`{ increment: 1 }` is an atomic SQL `version = version + 1`, not a read-then-write.

### The audit trail

```ts
await tx.queueEvent.createMany({ data: records.map((r) => ({ ... })) });
await tx.auditLog.createMany({ data: records.map((r) => ({
  action: `queue.${command}`,
  entityType: r.entryId != null ? 'QueueEntry' : 'OPDSession',
  entityId: r.entryId ?? session.id,
  ...
})) });
```

Both, from one call, inside the same transaction as the mutation. **If the command rolls
back, so does its audit trail** — which is correct: an action that did not happen must not
be recorded as if it did.

### Realtime, after the commit

```ts
const result = await this.prisma.$transaction(...);       // committed here
await this.announce(sessionId, committedVersion, touchedEntryIds);
```

Idea #7 from Part 0. An event emitted inside a transaction that then rolls back is a
*ghost update*: the patient is told they were called and the database disagrees.

`announce` never throws:

```ts
} catch (error) {
  this.log.error({ err: error, sessionId },
    'realtime announce failed - the command committed, clients will refetch');
}
```

The command already succeeded and is correct. A realtime failure downgrades the product
from *live* to *stale*, and stale is what every client already knows how to recover from.
Failing the command over it would turn a cosmetic problem into a clinical one.
## 7.5 A command end to end: `call-next`

Now read one whole command with everything above in mind.

```ts
export function callNext(
  queue: QueueService,
  sessionId: string,
  actor: QueueActor,
): Promise<QueueCommandResult> {
  return queue.runCommand({
    sessionId,
    actor,
    command: 'CALL_NEXT',
    handler: async (ctx) => {
      // Refuse to call anyone while someone is still with the doctor. Without this
      // a double-click produces two CALLED patients and two people walk in.
      const busy = await ctx.tx.queueEntry.findFirst({
        where: { sessionId, status: { in: ['CALLED', 'IN_CONSULTATION'] } },
        orderBy: { calledAt: 'asc' },
      });
      if (busy !== null) throw new InvalidQueueTransitionError('CALL_NEXT', busy.status);

      const entry = await nextEligibleEntry(ctx);
      if (entry === null) throw new NoEligiblePatientError();

      const status = nextEntryStatus('CALL_NEXT', entry.status);
      const updated = await ctx.tx.queueEntry.update({
        where: { id: entry.id },
        data: { status, calledAt: ctx.now },
        include: ENTRY_INCLUDE,
      });

      const sessionStatus = nextSessionStatus('CALL_NEXT', ctx.session.status);
      if (sessionStatus !== ctx.session.status) {
        ctx.patchSession({ status: sessionStatus });
        ctx.record({ type: 'SESSION_ACTIVATED', metadata: { from: 'OPEN_FOR_REGISTRATION' } });
      }

      ctx.record({
        type: 'ENTRY_CALLED',
        entryId: entry.id,
        metadata: { tokenLabel: entry.tokenLabel, priority: entry.priority,
                    recallCount: entry.recallCount },
      });

      return toCommandResult(ctx, updated);
    },
  });
}
```

Five things to notice.

**The request carries no patient id.** A client that named one would be deciding call
order. Who is next comes from `call-order.ts` and nowhere else.

**`NoEligiblePatientError` is distinct from an illegal transition.** Nothing is wrong —
nobody has arrived yet. The console can say "nobody has checked in yet" instead of
showing an error.

**Calling the first patient *is* the session starting.** There is no separate
`start-session` command, because inventing one would add a button whose only job is to be
forgotten.

**The busy check** is inside the transaction, so it is protected by the lock too.

**Nothing here decides anything about legality.** `nextEntryStatus` and
`nextSessionStatus` do that, and `assertSessionAccepts` already ran in `runCommand`.

### The full sequence for one press of *Call next*

```
POST /sessions/abc/call-next    Authorization: Bearer <jwt>
  ↓ ThrottlerGuard    under 120/min?
  ↓ JwtGuard          verify JWT → req.account = { id, email }
  ↓ TenantGuard       session abc → hospital H; membership? → req.tenant = { H, DOCTOR }
  ↓ RolesGuard        DOCTOR ∈ (ADMIN, RECEPTION, DOCTOR) ✓
  ↓ QueueController   actorOf(account, tenant) → { accountId, hospitalId: H, type: DOCTOR }
  ↓ callNext(...)
  ↓ runCommand
      BEGIN
      SELECT ... FOR UPDATE   ← other callers now WAIT here
      hospital matches?
      assertSessionAccepts('CALL_NEXT', session)
          status OPEN_FOR_REGISTRATION ✓
          pausedAt null ✓
          doctorPresence PRESENT ✓
      handler:
          anyone CALLED / IN_CONSULTATION? no
          nextEligibleEntry → A007 (CHECKED_IN)
          A007 → CALLED, calledAt = now
          session → ACTIVE, record SESSION_ACTIVATED
          record ENTRY_CALLED
      UPDATE OPDSession SET status=ACTIVE, version = version + 1
      INSERT QueueEvent  × 2
      INSERT AuditLog    × 2
      COMMIT                  ← the lock releases; the next caller proceeds
  ↓ announce  → socket: sessionUpdated { sessionId, version }
             → socket: entryUpdated  { entryId } to A007's account room
  ↓ 200 { sessionId, sessionStatus: 'ACTIVE', version, entry: {...} }
```

The second receptionist's request resumes at the `SELECT ... FOR UPDATE` line, reads
A007 as `CALLED`, hits the busy check, and gets a 409 saying "that is no longer possible."

## 7.6 The other commands, briefly

Each is one file in `commands/`. That is `docs/Rules.md` §4's "command-per-file," so
parallel agents never edit the same file — and it also means you can read any one of
them in two minutes.

**`check-in.ts`** — staff confirm a patient is here. Accepts either a scanned QR payload
or a token number, both scoped to *this* session. Idempotent: a second scan returns
success and writes nothing, so `checkedInAt` keeps recording when they actually arrived.

The QR verification is worth a look:

```ts
async function findByCode(ctx, sessionId, payload) {
  const reference = verifyCheckInCode(payload);
  if (reference === null) return null;
  return ctx.tx.queueEntry.findFirst({
    where: { sessionId, checkInCode: reference },
    include: ENTRY_INCLUDE,
  });
}
```

The signature is checked **before** the database is touched, so a camera pointed at a
shampoo bottle costs one hash. And note what is deliberately absent: there is no fallback
that tries the raw string as a `checkInCode` when verification fails. That fallback is
exactly how a signing scheme becomes decoration.

**`start-consultation.ts`** — stamps `consultStartedAt`. The comment explains why this is
a separate timestamp from `calledAt`: the gap between being called and sitting down is
*walking time, not consultation time*, and folding them together would inflate every
doctor's average.

**`complete-consultation.ts`** — writes the `Consultation` row, which is the **entire
input to the ETA engine's learning**. Attributed to `ctx.session.currentProviderDoctorId`,
not the booked doctor: after a substitution, crediting the timings to the doctor who
never showed up would poison both doctors' averages.

**`skip.ts`** — called, did not appear, move on. Increments `recallCount`. Skipping is
*not* a no-show; the patient is still today's patient. The threshold it is compared
against is never in this file — the policy owns it.

**`no-show.ts`** — the terminal end of that road. Reachable from `SKIPPED` (the normal
path) and directly from `CALLED` (staff who already know the patient has left).

**`requeue.ts`** — back into the pool, at the **back** of it, by stamping `requeuedAt`.
Honours `QueuePolicy.requeueBehavior`: a `NO_REQUEUE` hospital gets a refusal rather than
a silent no-op.

**`pause.ts`** — `pause` and `resume` in one file. Both idempotent. `resume` records how
long the pause lasted.

**`presence.ts`** — records where the doctor is. **No transition table**, because any
presence may follow any other: a human walking out of a room is a fact to record, not a
move to validate.

**`priority.ts`** — audited escalation. The key line in the comment:

> **Changes priority, never status.** That is what makes it safe: the entry stays exactly
> where it is in its own lifecycle, and only its position in the computed call order
> moves. Nobody else's row is touched — "everyone behind shifts" is what the ORDER BY
> does, not something written to twelve rows.

Also: setting `NORMAL` undoes an escalation and is audited identically, because an
un-escalation with no trail would be the easiest way to hide one.

**`walk-in.ts`** — someone turned up at reception. Born `CHECKED_IN` (present by
definition), appended at the next token number. There is **no way to place a walk-in
anywhere else**, deliberately: an arbitrary-placement API is a queue-jumping API, and the
audited `priority` command already exists for the cases that justify it.

**`end-session.ts`** — walks the `END_SESSION` table. Two details:

```ts
const inConsultation = await ctx.tx.queueEntry.findFirst({
  where: { sessionId, status: 'IN_CONSULTATION' },
});
if (inConsultation !== null) throw new InvalidQueueTransitionError('END_SESSION', 'IN_CONSULTATION');
```

Refuses to end mid-consultation. A patient sitting with the doctor is neither "not seen"
nor finished, and guessing would either fabricate a `Consultation` or throw one away.

And the outstanding entries are grouped into one `updateMany` per target status rather
than a write per entry — a busy session has hundreds of entries and this runs while the
session lock is held.

**`close-registration.ts`** — the doors shut. `docs/PRD.md` §8.12 names four ways
registration ends; three are computed on every read, and this is the fourth — the one
that is a *decision* rather than a calculation.

Its comment states the general principle for every background worker in the codebase:

> **It is a command, not a column update from a worker.** A timer that wrote
> `registrationClosedAt` directly would skip the session lock, the audit log, the timeline
> and the realtime broadcast — and `docs/Phases.md` calls that "the single most damaging
> shortcut available in this phase."

**`join.ts`, `confirm-payment.ts`, `cancel-entry.ts`** — Part 8.

### Two of them are not commands

`applyPaymentConfirmation` and `applyCancellation` are **steps inside** a command rather
than whole ones. The payments module runs them inside its own `runCommand`, so the entry
transition and the `Payment`/`Refund` row commit together or not at all.

Anything else has a failure mode where the patient has paid and has no token, or has a
token we have no record of paying for.

`applyCancellation` returns a flag that the caller must branch on:

```ts
if (entry.status === status) {
  return { entry, changed: false };
}
```

> `changed` is what the caller MUST branch on before doing anything with money.
> Returning only the row let the cancel path raise a second refund for a second tap,
> because the no-op is invisible in the returned entry.

That is a real bug that shipped and was fixed. Remember it for Part 8.

## 7.7 The read path

```ts
async listEntries(sessionId, hospitalId, query): Promise<Paginated<QueueEntryView>> {
  const where = { sessionId, hospitalId, ...(query.status ? { status: query.status } : {}) };
  const [rows, total] = await Promise.all([
    this.prisma.queueEntry.findMany({ where, orderBy: CALL_ORDER, include: ENTRY_INCLUDE,
                                      take: query.limit, skip: query.offset }),
    this.prisma.queueEntry.count({ where }),
  ]);
  return { items: rows.map(toEntryView), total, limit: query.limit, offset: query.offset };
}
```

**A read, so no lock and no command.** Putting it through `runCommand` would take the
session lock every time a console re-rendered, serialising reads against the very
commands they are watching.

**Ordered by `CALL_ORDER`** — the same comparator `call-next` uses — so the console has no
reason to sort and therefore no way to disagree with the engine about who is next.

**`hospitalId` is in the WHERE clause** even though `TenantGuard` already resolved it from
this session row. Two independent checks: a by-id fetch verifies the row belongs to the
caller's hospital, always.

## 7.8 One place shapes the response

```ts
export const toCommandResult = (ctx: CommandContext, entry: QueueEntryRow | null): QueueCommandResult => ({
  sessionId: ctx.session.id,
  sessionStatus: ctx.session.status,
  doctorPresence: ctx.session.doctorPresence,
  pausedAt: ctx.session.pausedAt?.toISOString() ?? null,
  version: ctx.session.version + 1,
  entry: entry === null ? null : toEntryView(entry),
});
```

Sixteen command files, one response shape. `version: + 1` because `ctx.session.version` is
the value that was *read* under the lock and the row was written one higher — so the
client is told the number it will see on its next fetch, not the one it is replacing.

## 7.9 Roles on the queue controller

```ts
@Roles('ADMIN', 'RECEPTION', 'DOCTOR')
@Controller('sessions/:sessionId')
export class QueueController {

  @Roles('ADMIN', 'DOCTOR')          // ← overrides the class
  @Post('start-consultation')
  startConsultation(...) { ... }

  @Roles('ADMIN', 'DOCTOR')
  @Post('complete-consultation')
  completeConsultation(...) { ... }
```

The class default is every role that can exist in a hospital, because a small hospital's
admin genuinely does run reception and the desk genuinely does drive the board.

**Two commands override it.** Starting and completing a consultation are the *clinical
record* — they assert a doctor saw this patient — and `docs/PRD.md` §6.2 gives them to
the doctor. ADMIN keeps them deliberately: it is the hospital's own owner account and the
only role that can always unstick a clinic. RECEPTION is the role being excluded.

This works because `RolesGuard` uses `getAllAndOverride([handler, class])` — method beats
class. The override is additive and reads locally.

The rest stay shared **on purpose**, and the comment defends it: §6.2 lists Call Next,
Skip and End Session under the doctor's console, but that section describes what a doctor
*sees*, not an exclusive grant — §6.3 gives reception "operational fixes" over the same
queue, and `call-next` is already gated on the doctor being present, which is the
guarantee that actually matters.

### The actor

```ts
const ACTOR_TYPE: Record<TenantContext['role'], ActorType> = {
  DOCTOR: 'DOCTOR',
  ADMIN: 'STAFF',
  RECEPTION: 'STAFF',
};

const actorOf = (account: AuthedAccount, tenant: TenantContext): QueueActor => ({
  accountId: account.id,
  hospitalId: tenant.hospitalId,
  type: ACTOR_TYPE[tenant.role],
});
```

Both values are server-resolved. `hospitalId` comes from `TenantGuard`'s membership
lookup and never from the request.

ADMIN and RECEPTION both record as `STAFF` because on the audit trail the meaningful
distinction is "the clinician" versus "the desk," and the exact membership role is
already recoverable from `HospitalStaff`.

---

# Part 8 — Money: join, webhook, refund

The rule that shapes this entire module: **money has already moved by the time we find
out about it.** Everything follows from that.

Three rules stated at the top of `payments.service.ts`:

1. **The client never creates a token.** Only a signature-verified webhook does.
2. **The amount is never sent by the client.** It is read from the locked session row.
3. **A replay is a no-op, not an error.** Razorpay retries anything non-2xx, so answering
   "already handled" with a failure turns one successful payment into a retry storm.

## 8.1 The whole flow

```
PATIENT                     API                          RAZORPAY
   │
   │ POST /sessions/:id/join
   ├──────────────────────────▶
   │                    joinQueue()  ── locks session
   │                       creates QueueEntry RESERVED
   │                       assigns token number
   │                       reservationExpiresAt = now + 10 min
   │                    COMMIT
   │                          │
   │                          │ createOrder(amountPaise from the LOCKED row)
   │                          ├────────────────────────────▶
   │                          ◀────────────────────────────┤ order_xyz
   │                       INSERT Payment(status: CREATED)
   │ ◀────────────────────────┤ { orderId, keyId, amountPaise, callbackUrl }
   │
   │ opens Razorpay Checkout, pays
   ├──────────────────────────────────────────────────────▶
   │                                                        money moves
   │                          ◀────────────────────────────┤ POST /webhooks/razorpay
   │                       verify HMAC over RAW BYTES         payment.captured
   │                       runCommand(CONFIRM_PAYMENT)
   │                         entry RESERVED → CONFIRMED
   │                         mint checkInCode
   │                         Payment → SUCCESS
   │                       COMMIT
   │                          ├────────────────────────────▶ 200 { handled: 'CONFIRMED' }
   │ ◀── socket: entryUpdated
   │ refetches → sees the token and its QR
```

## 8.2 `join` — reserve, then charge

```ts
async join(sessionId: string, accountId: string, input: JoinRequest): Promise<JoinResponse> {
  if (!this.razorpay.configured) {
    throw new Error('Razorpay is not configured - set RAZORPAY_KEY_ID, ...');
  }

  const hospitalId = await this.hospitalOfSession(sessionId);
  const actor: QueueActor = { accountId, hospitalId, type: 'PATIENT' };

  const outcome = await joinQueue(this.queue, sessionId, actor, {
    patientId: input.patientId,
    accountId,
    reservationTtlSec: env().RESERVATION_TTL_SEC,
  });

  const payment = await this.ensureOrderFor(outcome.entry.id, {
    hospitalId, accountId, amountPaise: outcome.feePaise,
  });

  return { entry: await this.readMyEntry(outcome.entry.id),
           razorpayOrderId: payment.razorpayOrderId,
           razorpayKeyId: this.razorpay.keyId,
           amountPaise: payment.amountPaise,
           currency: 'INR',
           callbackUrl: checkoutReturnUrl() };
}
```

**The reservation commits before Razorpay is called.** A gateway round trip inside the
session transaction would hold the lock every other command in that clinic is waiting on.
And if the order then fails, the hold simply lapses — the failure mode is self-healing
rather than a half-written booking.

**`hospitalOfSession` reads the hospital from the session row**, because a patient has no
`HospitalStaff` membership and `TenantGuard` therefore cannot resolve it. The route keeps
`:id` for exactly that reason (Part 5.3).

Inside `join.ts`, four checks in order:

```ts
await assertPatientBelongsToAccount(ctx, input.patientId, input.accountId);
```

The patient must be one of the caller's own profiles. `accountId` comes from the JWT,
never the body. Without this, any signed-in account could book on behalf of any patient
id it could guess.

```ts
const existing = await findExistingEntry(ctx, input.patientId);
if (existing !== null) {
  if (existing.status !== 'RESERVED') throw new AlreadyInQueueError(existing.id);
  if (existing.reservationExpiresAt !== null && existing.reservationExpiresAt > ctx.now) {
    return { entry: existing, feePaise: ctx.session.feePaise, resumed: true };
  }
}
```

**A live unpaid hold is not an error — it is the retry path.** The caller resumes the same
checkout rather than opening a second one. An *expired* hold falls through to a new
reservation, because its slot is already considered free.

This read is safe without a separate idempotency key precisely because it happens under
the session lock: two simultaneous joins serialise, so the second sees the first's
committed reservation.

```ts
await assertRegistrationOpen(ctx);
```

Re-runs `registrationGate` against the **locked** row. The same function `discovery` used
to decide whether to show a Join button — because if those two ever disagreed, a patient
would tap a button the server then refuses.

Note the slot count:

```ts
NOT: { status: 'RESERVED', reservationExpiresAt: { lte: ctx.now } },
```

A lapsed hold is not holding anything, whether or not the sweeper has reached it. **The
column frees the slot.**

```ts
const tokenNumber = await nextTokenNumber(ctx);
```

**The token number is assigned at join, not at payment.** That is a deliberate divergence
from `docs/Architecture.md`, and the reasoning is recorded: reserving a slot *is* holding
a number, and confirm-time assignment would need the column nullable. The visible cost is
a gap in the sequence when someone abandons checkout — which is honest, because
`docs/PRD.md` §8.1 says the token is a label and never a position.

### `ensureOrderFor` — the double-charge guard

```ts
const existing = await this.prisma.payment.findUnique({ where: { queueEntryId: entryId } });
if (existing !== null) return existing;

const order = await this.razorpay.createOrder({ amountPaise: meta.amountPaise, receipt: entryId, ... });

try {
  return await this.prisma.payment.create({ ... });
} catch (error) {
  if (isUniqueViolation(error)) {
    return this.prisma.payment.findUniqueOrThrow({ where: { queueEntryId: entryId } });
  }
  throw error;
}
```

A retried join finds the first call's order and hands back the same one. If two joins race
past the `findUnique`, the unique constraint on `queueEntryId` decides — and the row that
won is the truth, so this request's extra order is simply an unpaid order nobody will ever
use.

`receipt: entryId` puts our own id on the Razorpay order, echoed back on every event and
visible in their dashboard. That is how the reconcile worker later matches an orphaned
order to the reservation it belongs to.

## 8.3 The webhook

```ts
async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined): Promise<WebhookAck> {
  if (rawBody === undefined) {
    throw new Error('Raw body unavailable - NestFactory must be created with { rawBody: true }');
  }

  if (!this.razorpay.verifyWebhookSignature(rawBody, signature)) {
    throw new ValidationFailedError('Webhook signature verification failed');
  }

  const parsed = RazorpayWebhookEvent.safeParse(JSON.parse(rawBody.toString('utf8')));
  if (!parsed.success) {
    this.log.error({ issues: parsed.error.issues }, 'unparseable razorpay webhook');
    return { handled: 'IGNORED' };
  }

  switch (parsed.data.event) {
    case 'payment.captured': return this.onPaymentCaptured(...);
    case 'payment.failed':   return this.onPaymentFailed(...);
    case 'refund.processed':
    case 'refund.failed':    return this.onRefundSettled(...);
    default:                 return { handled: 'IGNORED' };
  }
}
```

**`@Public()` is correct here and this is the one place in the phase it is.** Razorpay has
no account and no JWT; the HMAC signature over the raw body *is* the authentication — and
it is stronger than a bearer token, because it also proves the body was not altered.

**Never rate limited** (`@SkipThrottle()`). Razorpay retries a webhook it believes failed,
and those retries are exactly what makes payment confirmation reliable. A 429 would be
read as a failure, retried harder, and eventually abandoned — losing a payment already
taken from a patient. The gate here is the signature, not a request count.

**Everything after a valid signature answers 200**, including events we ignore and
duplicates we have already handled, because a non-2xx makes Razorpay retry.

Except one: an unparseable-but-signed body is logged loudly and acknowledged, because a
retry cannot fix a shape we do not understand.

### The signature check

```ts
verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
  const secret = this.config.RAZORPAY_WEBHOOK_SECRET;
  if (secret === '' || signature === undefined || signature === '') return false;

  const expected = createHmac('sha256', secret).update(rawBody).digest();
  const provided = Buffer.from(signature, 'hex');
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(expected, provided);
}
```

Three things are load-bearing, and the file names all three:

- **Raw bytes.** `JSON.parse` then `JSON.stringify` reorders nothing but re-encodes
  everything, and the digest changes. This takes a `Buffer` so it cannot accidentally be
  handed a parsed object.
- **`timingSafeEqual`.** A `===` on the hex string leaks the correct prefix through
  timing, and a webhook endpoint can be probed as often as an attacker likes.
- **The length guard.** `timingSafeEqual` *throws* on unequal lengths, so a garbage
  signature would become a 500 rather than a rejection.

It returns `false` rather than throwing: an unverified webhook is not an exception, it is
a stranger.

*(The same three-step shape appears in `common/checkin-code.ts` for the QR signature. Once
you have read one, you have read both.)*

### `onPaymentCaptured` — five guards before anything is confirmed

```ts
const payment = await this.prisma.payment.findUnique({ where: { razorpayOrderId: orderId }, ... });
if (payment === null) return { handled: 'IGNORED' };          // 1
```
An order we never created — another integration on the same Razorpay account.

```ts
if (entity.amount !== payment.amountPaise || entity.currency !== 'INR') {
  this.log.error({ ... }, 'razorpay capture amount does not match the order - refusing to confirm');
  return { handled: 'IGNORED' };                               // 2
}
```
Defence in depth. The amount came from an order *we* created, so it cannot legitimately
differ; if it ever does, something is wrong enough that issuing a token on the strength of
it would be worse than issuing nothing.

```ts
if (payment.status === 'SUCCESS' && payment.razorpayPaymentId === entity.id) {
  return { handled: 'DUPLICATE' };                             // 3
}
```
Already handled. Answered 200.

```ts
if (!sessionLive) {
  await this.recordCapture(payment.id, entity.id);
  await this.raiseRefund({ ..., reason: 'Session ended before the payment was confirmed' });
  return { handled: 'REFUND_UPDATED' };                        // 4
}
```
There is no queue left to join. **Take the money on the books, then give it back** — the
alternative is silently keeping it.

```ts
const reinstating = payment.entry.status === 'CANCELLED';      // 5
```
The hold had already lapsed and the money arrived anyway. Routed through `REINSTATE`
rather than `CONFIRM_PAYMENT`, so the audit trail says which of the two happened.

Then the write, in one transaction:

```ts
await this.queue.runCommand({
  sessionId: payment.entry.sessionId,
  actor: { accountId: payment.accountId, hospitalId: payment.hospitalId, type: 'SYSTEM' },
  command: reinstating ? 'REINSTATE' : 'CONFIRM_PAYMENT',
  handler: async (ctx) => {
    await applyPaymentConfirmation(ctx, payment.entry.id, reinstating ? 'REINSTATE' : 'CONFIRM_PAYMENT');
    await ctx.tx.payment.update({
      where: { id: payment.id },
      data: { status: 'SUCCESS', razorpayPaymentId: entity.id },
    });
  },
});
```

**Queue owns the entry write; payments owns the payment write; one transaction.** A paid
entry with no payment record is therefore impossible.

And the last guard:

```ts
} catch (error) {
  if (isUniqueViolation(error)) return { handled: 'DUPLICATE' };
  throw error;
}
```

Two copies of the same webhook in flight at once. The unique index on `razorpayPaymentId`
is the replay guard, and **losing that race means the other one succeeded** — which is
success, not an error.

### Count the idempotency layers

A single payment is protected four separate ways: the status check (3), the unique index
on `razorpayPaymentId`, the state machine's `CONFIRMED → CONFIRMED` no-op, and the
`checkInCode !== null` check inside `applyPaymentConfirmation`. That last one exists so a
duplicate does not mint a second code and invalidate the QR the patient is already holding
on screen.

That is not paranoia. It is one layer per thing that can go wrong independently.

## 8.4 Refunds

Refunds are **asynchronous**: a 200 from Razorpay means the request was accepted, not
that the patient has their money. Settlement arrives later as `refund.processed`.

```ts
async function refundForCancellation(ctx, input): Promise<RaisedRefund | null> {
  const payment = await ctx.tx.payment.findUnique({ where: { queueEntryId: input.entryId }, ... });
  if (payment === null || payment.status !== 'SUCCESS') return null;

  const refundable = Math.floor((payment.amountPaise * input.pct) / 100) - payment.refundedPaise;
  if (refundable <= 0) return null;

  const refund = await ctx.tx.refund.create({ data: { ..., status: 'PENDING' } });

  const refundedTotal = payment.refundedPaise + refundable;
  await ctx.tx.payment.update({
    where: { id: payment.id },
    data: { refundedPaise: refundedTotal,
            status: refundedTotal >= payment.amountPaise ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
  });

  return { refundId: refund.id, paymentId: payment.id, amountPaise: refundable };
}
```

**One function, called by both cancel paths.** The patient cancelling their own booking
and reception cancelling it for them differ in who is authorised and in what percentage
applies — and in *nothing* about the arithmetic. The comment is explicit that Phase 5's
worst bug was a second refund raised for one cancellation, and duplicating this block for
the staff path is precisely how that would come back.

**Everything about money is re-read inside the transaction, under the lock.** Computing
`refundedPaise` from a row fetched earlier is how two concurrent cancels each refund the
full amount.

### The `changed` guard

```ts
const { changed } = await applyCancellation(ctx, entry.id, 'CANCEL_ENTRY', input.reason ?? null);
if (!changed) return null;
return refundForCancellation(ctx, { ... });
```

This is the shipped bug from 7.6, in its natural habitat. Without `changed`, a second tap
on Cancel found an already-CANCELLED entry, no-opped the state change, and then happily
wrote a **second refund row** and called Razorpay again.

### The gateway call swallows failures — deliberately

```ts
private async sendRefundToGateway(refundId, paymentId, amountPaise): Promise<void> {
  try {
    const result = await this.razorpay.refund({ paymentId, amountPaise, notes: { refundId } });
    await this.prisma.refund.update({ where: { id: refundId }, data: { razorpayRefundId: result.id } });
  } catch (error) {
    this.log.error({ err: error, refundId }, 'refund request to razorpay failed - left PENDING');
  }
}
```

The cancellation has already committed and is correct. Failing the HTTP request would tell
the patient their cancellation did not work, when it did.

**But that leaves an obligation, and for a while nothing collected it.** The comment used
to claim the reconcile worker would pick it up; the worker only ever read `Payment` rows.
So a refund could sit owed forever while the payment row already said `REFUNDED` — the
books said the patient had been paid. That is what `reconcileRefunds` (Part 11) now
exists for.

Note `notes: { refundId }`. Raising a refund is **not idempotent** — two POSTs are two
refunds — so before re-sending, the reconcile worker asks Razorpay which refunds already
carry our id:

```ts
const existing = await this.razorpay.refundsForPayment(gatewayPaymentId);
const already = existing.find((r) => r.notes?.refundId === refund.id);
if (already !== undefined) { /* adopt its id, do not re-send */ }
```

Paying a patient twice is a worse outcome than paying them late.

### Staff cancellation and `cause`

```ts
const pct = input.cause === 'HOSPITAL'
  ? 100
  : refundPctIfCancelledAt(policy.cancellationRules, session.scheduledStart, new Date());
```

The refund percentage comes from `cause`, and that is the whole reason `cause` exists. A
single fixed rule is wrong half the time: always 100% makes the desk a way around the
hospital's own cancellation policy, and always applying the tier charges a patient the
hospital itself turned away. So the person cancelling says which happened, in writing, and
it lands in the `AuditLog`.

## 8.5 The Razorpay client

`razorpay.client.ts` deliberately does **not** use the official SDK — an approved
divergence, recorded. Creating an order and raising a refund are one POST each, and the
webhook signature must be computed over raw bytes by hand regardless, since no SDK can see
the body before Nest's parser has consumed it. What is left is small enough that a test can
pass a plain object literal instead of mocking a package:

```ts
export interface RazorpayApi {
  createOrder(input): Promise<RazorpayOrder>;
  refund(input): Promise<RazorpayRefund>;
  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean;
  paymentsForOrder(orderId: string): Promise<RazorpayPayment[]>;
  refundsForPayment(paymentId: string): Promise<RazorpayRefund[]>;
}
```

And note what `createOrder` does *not* take: any notion of what anything costs.

> This method has no idea what anything costs, and that is intentional: an amount argument
> that could ever originate from a request body is the single most exploitable payment bug
> there is. The one place the fee is read is the join command, from the locked session row.

## 8.6 `my-entry.ts` — the patient's own view

A separate projection from the console's `QueueEntryView`, and the reason is DPDP:

> That shape carries a patient name per row and belongs to staff; this one describes one
> person and names nobody else.

The counts differ too. "Ahead of **you**" is not "in this session," and only the first
answers the question a waiting patient is actually asking:

```ts
const position = live.eligibleOrder.indexOf(row.id);
checkedInAheadCount: position === -1 ? live.eligibleOrder.length : position,
```

If you are not in the eligible pool — still at home — then **everyone present is ahead of
you**, because `docs/PRD.md` §8.2 means an absent patient is behind every present one no
matter how early they booked.

And the QR code is signed **on read**, never stored signed:

```ts
checkInCode: row.checkInCode === null ? null : signCheckInCode(row.checkInCode),
```

So rotating `CHECKIN_SECRET` invalidates every issued QR at once — which is what a
compromised secret needs — while the stored reference itself never changes.
---

# Part 9 — The ETA engine

Two files. `eta.engine.ts` is **pure arithmetic** — no Prisma, no `new Date()`, no config.
`eta.service.ts` gathers the inputs from the database. The split is what makes the hard
cases testable: "an idle doctor's window drifts later" becomes two calls with different
clocks, not a fixture and a wait.

It is deliberately arithmetic rather than a model. `docs/Architecture.md` defers ML to v2;
what this needs to do today is be **honest** — a window rather than a promise, widening
with the wait, and saying out loud when it is guessing.

## 9.1 How long does this doctor take?

Three estimates, blended:

```ts
const WEIGHT = { today: 0.5, allTime: 0.3, seed: 0.2 } as const;
```

- **today** (50%) — this doctor's average today. It is this clinic, this morning.
- **allTime** (30%) — this doctor's average ever.
- **seed** (20%) — `Doctor.defaultConsultMins`, the cold-start value that always exists.

```ts
let weighted = WEIGHT.seed * seed;
let total = WEIGHT.seed;

if (allTime !== null) { weighted += WEIGHT.allTime * allTime; total += WEIGHT.allTime; }
if (today   !== null) { weighted += WEIGHT.today   * today;   total += WEIGHT.today;   }

return { mins: weighted / total, ... };
```

**Renormalised over the terms that actually exist.** Dividing by `total` rather than by
1.0 is the whole point. Treating a missing term as zero would drag the estimate below
every input it was given — a doctor with a 20-minute average and no data yet today would
come out at 8 minutes. With renormalisation the result is always between the smallest and
largest input.

It also reports what it is standing on rather than letting the client infer it:

```ts
basis: today !== null ? 'TODAY' : allTime !== null ? 'DOCTOR_HISTORY' : 'SEED',
sampleSize: Math.max(0, input.allTimeSamples),
```

The all-time count, not the sum — today's consultations are already inside it, and adding
them would double-count the same visits.

## 9.2 Dead time — the gap nobody was modelling

A consultation ending and the next patient being called are not the same instant. Somebody
has to walk in from the waiting room.

```ts
export function measureDeadTime(samples: readonly number[]): DeadTimeResult {
  const credible = samples.filter(
    (gap) => Number.isFinite(gap) && gap >= 0 && gap <= MAX_CREDIBLE_GAP_MIN,   // 15
  );

  if (credible.length < MIN_DEAD_TIME_SAMPLES) {                                 // 2
    return { mins: SEED_DEAD_TIME_MIN, basis: 'SEED', sampleSize: credible.length };
  }

  const sorted = [...credible].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;

  return { mins: median, basis: 'MEASURED', sampleSize: credible.length };
}
```

Three decisions worth taking:

**Median, not mean.** The distribution is not symmetric: handovers cluster around a minute
or two, and every outlier is a *long* one — a break, a phone call, a doctor stepping out.
A mean chases those; a median ignores them.

**A 15-minute cap, discarding rather than clamping.** Those long gaps are a *different
event*, not an extreme example of this one. The comment does the arithmetic: one
twenty-five minute lunch across six handovers adds four minutes to every patient's
estimate.

**A seed of 2 minutes rather than zero.** Zero is not a neutral choice — it is a claim
that handover is instantaneous, and it is wrong in the direction that hurts: it tells
patients to arrive early.

And it is measured **per session, not per doctor**, because turnaround is a property of
the room and the day — who is fetching patients, how far the waiting area is, how busy
reception is.

## 9.3 The window

```ts
export function etaWindow(expectedMins, position, now, deadTimeMins = SEED_DEAD_TIME_MIN) {
  const ahead = Math.max(0, Math.floor(position.aheadCount));

  const elapsedMins = Math.max(0, (position.currentElapsedSec ?? 0) / 60);
  const remainingCurrent = position.currentElapsedSec === null
    ? 0
    : Math.max(MIN_REMAINING_MIN, expected - elapsedMins);          // floor of 2 min

  const handovers = position.currentElapsedSec === null ? ahead : ahead + 1;
  const etaMins = remainingCurrent + ahead * expected + handovers * dead;

  const pad = Math.min(MAX_PAD_MIN, Math.max(MIN_PAD_MIN, PAD_FRACTION * etaMins));
  const centre = now.getTime() + etaMins * MS_PER_MIN;

  return {
    from: new Date(Math.max(now.getTime(), centre - pad * MS_PER_MIN)),
    to:   new Date(centre + pad * MS_PER_MIN),
  };
}
```

**`MIN_REMAINING_MIN = 2`.** A consultation in progress is never treated as about to end.
Without this floor, an overrunning doctor produces a window in the past — which reads as
"you have missed it" to the one patient who has not.

**`handovers = ahead + 1` when somebody is in the room.** Every patient ahead costs a
consultation *and* a handover, and one more handover separates the person in the room now
from the first of them. An empty room owes no handover — nobody has to leave it.

**The pad: never tighter than ±5 minutes, never vaguer than ±30, otherwise 25% of the
wait.** An exact minute is a lie; an hour-wide window is not information. Uncertainty
growing with the wait is the honest shape.

**`Math.max(now.getTime(), ...)` on the lower edge.** The window never opens in the past.
"You have missed your slot" is the one thing this must not accidentally say.

**Anchored to `now`.** That is what makes an idle queue *drift*: nothing about the inputs
changes, the clock does, and the window slides away from the patient exactly as their real
wait is doing. That property is what Part 11's `eta-tick` exists to broadcast.

## 9.4 "Running behind"

```ts
export function isRunningBehind(input): boolean {
  if (input.todayMins === null || input.todaySamples < MIN_BEHIND_SAMPLES) return false;  // 3
  const baseline = safePositive(input.baselineMins, FALLBACK_SEED_MIN);
  return input.todayMins >= baseline * BEHIND_RATIO;                                       // 1.25
}
```

Compared against **this doctor's own baseline**, not a platform average: a cardiologist
taking twenty minutes is not behind, and a dermatologist taking twenty minutes is.

Three samples minimum and 25% slower minimum, because one slow consultation is a patient,
not a trend — and a flag that cries wolf gets ignored.

## 9.5 Gathering the inputs in a fixed number of queries

```ts
async windowsFor(inputs: EtaRequest[], now = new Date()): Promise<Map<string, EtaWindowOut | null>> {
  const out = new Map(inputs.map((i) => [i.key, null]));
  const estimable = inputs.filter((i) => i.estimable);
  if (estimable.length === 0) return out;

  const [paces, deadTimes] = await Promise.all([
    this.pacesFor([...new Set(estimable.map((i) => i.doctorId))], now),
    this.deadTimesFor([...new Set(estimable.map((i) => i.sessionId))]),
  ]);
  // ... pure arithmetic per input
}
```

**The batching constraint is the whole design of this file.** The patient-facing session
card is the hottest read path in the product; `discovery` renders a page of them at a
time. An ETA costing one query per card would undo the batching that module exists to do.

So: **any number of sessions, three queries.**

```ts
const [doctors, allTime, today] = await Promise.all([
  this.prisma.doctor.findMany({ where: { id: { in: doctorIds } }, select: { id: true, defaultConsultMins: true } }),
  this.prisma.consultation.groupBy({ by: ['doctorId'], where: { doctorId: { in: doctorIds } },
                                     _avg: { durationSec: true }, _count: { _all: true } }),
  this.prisma.consultation.groupBy({ by: ['doctorId'], where: { doctorId: { in: doctorIds }, endedAt: { gte: startOfToday } },
                                     _avg: { durationSec: true }, _count: { _all: true } }),
]);
```

Averaged in the database, not in Node. There is an index on `(doctorId, endedAt)` and no
reason to move thousands of rows to compute two numbers.

And the line above them:

```ts
const startOfToday = istToUtc(istToday(now), '00:00');
```

> Midnight IST, expressed as the UTC instant it actually is. `new Date()` sliced to a
> date string would be the UTC day, which between 00:00 and 05:30 IST is **yesterday** —
> the bug this codebase has now hit twice.

`estimable` deserves a mention. It is passed *in* by the caller rather than decided here,
and anything not estimable stays in the map as `null` rather than being absent — so a
caller can tell "no honest estimate" from "you forgot to ask." A session that has ended,
or whose doctor has left, gets `null` rather than a number.

**It reads `Consultation` and `Doctor`, which other modules write.** That is a recorded
exception to `docs/CLAUDE.md` §3, and the argument is stated: it is read-only, and
`Consultation` exists *solely* so this can learn from it. Routing either through a
tenant-scoped staff service would fail for the patient who has no membership anywhere.

## 9.6 Where ETAs surface

| Surface | Question | `aheadCount` |
|---|---|---|
| A discovery session card | "if I joined now?" | everyone eligible |
| A patient's own token card | "when will **I** be seen?" | those ahead of them |
| `GET /sessions/:sessionId/eta` (staff) | queue health | everyone eligible |
| The `leave-now` notifier | "should they set off?" | everyone present |

All four are the same arithmetic over a different `aheadCount`, which is why they are the
same call.

---

# Part 10 — Realtime: WebSockets

## 10.1 What a WebSocket is

HTTP is one question, one answer, connection closed. A WebSocket is a connection that
**stays open**, so the server can speak first. That is how the queue board updates without
polling.

Socket.IO adds reconnection, fallbacks, and **rooms** — named groups you can broadcast to.

## 10.2 The rule

> **Realtime is a distribution mechanism, never a source of truth.**

Nothing in `realtime.gateway.ts` reads or writes queue state, and **no client can cause a
change through it** — the only message it accepts asks to *listen*. Every write still goes
through a REST command. So the gateway can be switched off entirely and the product
degrades from live to stale, never to broken.

## 10.3 Connecting

```ts
async handleConnection(socket: Socket): Promise<void> {
  const token = typeof socket.handshake.auth?.token === 'string'
    ? socket.handshake.auth.token
    : extractBearer(socket.handshake.headers.authorization);

  if (token === null) { socket.disconnect(true); return; }

  try {
    const claims = await this.jwt.verifyAsync<AccessTokenClaims>(token, {
      secret: env().JWT_ACCESS_SECRET,
    });
    socket.data.accountId = claims.sub;
    await socket.join(accountRoom(claims.sub));
  } catch {
    socket.disconnect(true);
  }
}
```

**The token comes from the handshake `auth` payload, not a query string** — query strings
end up in access logs and proxy logs, and this one is a bearer credential.

**A socket that fails to authenticate is disconnected, not left connected and mute.** A
client that thinks it is subscribed but is not is *worse* than one that knows it is
offline: the first shows stale data confidently.

On success it joins its own private account room immediately, and can never ask for
somebody else's.

## 10.4 Subscribing to a session

```ts
@SubscribeMessage('subscribe')
async subscribe(@ConnectedSocket() socket, @MessageBody() body): Promise<SubscribeAck> {
  const accountId: unknown = socket.data.accountId;
  if (typeof accountId !== 'string') return { ok: false, error: 'Not signed in' };

  const parsed = SubscribeRequest.safeParse(body);
  if (!parsed.success) return { ok: false, error: 'Unknown session' };

  const visible = await this.prisma.oPDSession.findFirst({
    where: { id: parsed.data.sessionId,
             status: { not: 'CANCELLED' },
             hospital: { status: 'VERIFIED' } },
    select: { id: true },
  });
  if (visible === null) return { ok: false, error: 'Unknown session' };

  await socket.join(sessionRoom(parsed.data.sessionId));
  return { ok: true };
}
```

**Authorisation is server-side, from the JWT** — never from anything the client sends.

The room carries only what `GET /sessions/:id` already returns to any signed-in patient,
so the question is exactly "may this account read this session?", and the answer is the
same one discovery gives.

An unknown id and a hidden one are refused **identically**, so this cannot be used to
discover which session ids exist. (Same principle as Part 5.3.)

The `accountId` check is belt and braces — `handleConnection` already disconnects
unauthenticated sockets — and the comment says why it is kept: if that ever changes, the
failure should be a refusal rather than an open subscription.

## 10.5 Emitting

```ts
emitSessionUpdate(sessionId: string, version: number): void {
  this.safely(() => {
    this.server?.to(sessionRoom(sessionId)).emit(REALTIME_EVENT.sessionUpdated, {
      sessionId, version,
    });
  });
}
```

**The payload is two fields.** Not the queue, not the patient list — just "this queue
moved, and it is now at version N." The client refetches over REST.

That is `docs/Rules.md` §8 (minimal payloads, no other patients' PII) and it is also
robust: a client that missed three events and gets the fourth is not behind, because it
refetches the whole truth anyway.

`emitEntryUpdate` goes to one account room only — "something about *your* booking
changed."

```ts
private safely(emit: () => void): void {
  try { emit(); }
  catch (error) {
    this.log.error({ err: error }, 'realtime emit failed - state is committed, clients will refetch');
  }
}
```

`this.server?` is optional because the gateway is unattached in unit tests — and would be
behind a kill switch. Emitting is then a no-op, which is the entire feature-flag story:
"the gateway can be feature-flagged off and every REST path still works."

## 10.6 The version number

```
client holds version 7
   ↓ socket: { sessionId, version: 9 }
9 > 7 → I am stale → GET /sessions/abc/queue → now holds 9
```

Every command increments it (Part 7.4). This is what lets a client drop a duplicate or a
late event without any ordering guarantee from the transport.

One subtlety, in `eta-tick`:

```ts
// The SAME version it already has: nothing was commanded and nothing changed in the
// database. A client drops an event only when it holds a strictly greater version,
// so an equal one still means "re-read me".
this.realtime.emitSessionUpdate(session.id, session.version);
```

## 10.7 The Redis adapter

With one server process, an in-memory room list works. With two, a patient connected to
server A never hears an event emitted by server B.

```ts
const publisher = new Redis(env().REDIS_URL, { maxRetriesPerRequest: null });
const subscriber = publisher.duplicate();
this.adapterConstructor = createAdapter(publisher, subscriber);
```

Every emit is published to Redis and every instance re-broadcasts to its own sockets.

**Installed now, on a single instance, on purpose:**

> "Add the Redis adapter now, even on a single instance. The day you scale to two, every
> socket bug you have will be an invisible one where half the users get no updates."

It needs its own pair of connections because the adapter takes over the client it is given
for pub/sub — sharing `RedisService`'s client would break every other use of it.

It is installed in `main.ts` and **not** in the test bootstrap, deliberately: the tests
exercise one process, and a suite that needed Redis pub/sub to pass would be testing the
adapter instead of the product.

---

# Part 11 — Background workers (sweepers)

Some things must happen with nobody watching. A grace period expiring. An unpaid hold
lapsing. A push being sent. An ETA drifting.

## 11.1 The central decision: sweeps, not queued jobs

`docs/Architecture.md` originally planned BullMQ (a Redis job queue). Phase 5 departed
from it for reservation expiry, with an argument that turned out to cover every worker:

> the column, not a job, is what frees the slot — the sweeper only writes down what is
> already true.

Generalised: **the state IS the schedule.** A called patient is out of time when
`calledAt + gracePeriodSec` has passed, whether or not anything fired. Registration is
past its cutoff when the clock says so. A payment is unreconciled when its row says
PENDING.

A sweep therefore has three properties a delayed job does not:

- **It cannot lose work.** A job enqueued between a command committing and the process
  restarting is simply gone. A sweep re-derives everything outstanding on its next pass,
  so an outage self-heals — which is exactly what `docs/Phases.md` asks for.
- **It is idempotent by construction.** There is nothing to deliver twice: the second pass
  finds nothing to do.
- **It needs no new dependency, no job state, and no second thing to operate.**

The cost, stated honestly: a sweep acts *within* one interval of the moment rather than
*at* it. Grace periods and cutoffs are measured in minutes, so that is affordable. If
something ever needs to fire at a specific second, BullMQ is still the right answer and
this seam is where it goes.

## 11.2 The base class

```ts
export abstract class Sweeper implements OnModuleInit, OnModuleDestroy {
  protected abstract readonly name: string;
  protected abstract readonly intervalMs: number;
  protected abstract sweep(): Promise<void>;

  onModuleInit(): void {
    if (env().NODE_ENV === 'test') return;                       // 1

    if (env().DISABLED_WORKERS.includes(this.name)) {            // 2
      this.log.warn(`${this.name} is disabled by DISABLED_WORKERS`);
      return;
    }

    this.timer = setInterval(() => void this.safeSweep(), this.intervalMs);
    this.timer.unref?.();                                        // 3
  }

  async safeSweep(): Promise<void> {
    if (this.running) return;                                    // 4
    this.running = true;
    try { await this.sweep(); }
    catch (error) { this.log.error({ err: error }, `${this.name} sweep failed`); }  // 5
    finally { this.running = false; }
  }
}
```

Five decisions in thirty lines:

1. **Never runs on its own in tests.** A timer firing mid-fixture is a flake generator.
   Every path is tested by calling the sweep method directly instead.
2. **A kill switch per worker.** `DISABLED_WORKERS=grace,notify` stops them without a
   redeploy. A timer that is skipping patients or sending pushes in a loop has to be
   stoppable in the time it takes to restart a process.
3. **`unref()`** — never keep the process alive just to run a timer.
4. **Overlap is skipped, not queued.** The next pass is moments away and re-derives
   everything anyway, so two passes racing over the same rows buys nothing and costs a
   lock fight.
5. **A failed pass is logged and swallowed.** A worker that dies takes every future pass
   with it.

And the rule every one of them obeys:

> **Workers mutate state only by calling domain commands**, so the state machine, the
> audit log and the realtime events apply to a timer's action exactly as they do to a
> receptionist's.

The actor is `SYSTEM` with `accountId: null`, so the audit trail says plainly that nobody
decided this — a clock did.

### The bug this base class was extracted to fix

Two workers — `reservation` and `eta-tick` — were written *before* the base class and
hand-rolled the same mechanics: their own interval, their own overlap flag, their own test
bail-out. In copying the mechanics they missed the one thing that only lives in the base
class: the `DISABLED_WORKERS` check.

`env.ts` advertised both names as switches you could turn off. Turning them off did
nothing at all. A kill switch you reach for when a timer is flooding production is worth
exactly nothing if it silently no-ops.

There is now a test (`workers.e2e.test.ts`) that asserts the documented list against the
running application, because a comment naming identifiers drifts — and this one had.

## 11.3 The eight workers

| Name | Every | Does |
|---|---|---|
| `reservation` | 60s | cancels lapsed unpaid holds |
| `grace` | 15s | skip → requeue or no-show after the grace period |
| `cutoff` | 60s | closes registration when the ETA overruns |
| `eta-tick` | 60s | re-broadcasts sessions so windows drift |
| `notify` | 30s | turns `QueueEvent` rows into `Notification` rows |
| `leave-now` | 30s | "time to head over" |
| `dispatch` | 15s | actually sends pending notifications |
| `reconcile` | 5min | asks Razorpay about anything unconfirmed |

### `grace-sweeper` — the no-show road

```
called → grace expires → passed over → back in the queue   (while recalls remain)
                                    → marked absent        (once they are spent)
```

```ts
for (const entry of called) {
  const policy = await this.policies.ensure(entry.hospitalId);
  const deadline = new Date(entry.calledAt!.getTime() + policy.gracePeriodSec * 1000);
  if (now < deadline) continue;

  await skip(this.queue, entry.sessionId, actor, {
    entryId: entry.id,
    reason: `No response within the ${policy.gracePeriodSec}s grace period`,
  });

  const attemptsUsed = entry.recallCount + 1;      // skip() incremented it

  if (attemptsUsed >= policy.recallAttempts) {
    await noShow(this.queue, entry.sessionId, actor, { entryId: entry.id });
  } else {
    await requeue(this.queue, entry.sessionId, actor, { entryId: entry.id });
  }
}
```

**Every threshold comes from the hospital's own policy** — `gracePeriodSec`,
`recallAttempts` — and none of it is hardcoded here. That is the whole reason they are
per-hospital columns.

**SKIP first, always.** It is what increments `recallCount`, and it is the state a patient
can be rescued from by walking up to the desk.

The candidate query is cheap because of a fact from Part 7: `call-next` refuses while
anyone is already called, so there are only ever a handful of `CALLED` entries at once.

And the error handling says something real:

```ts
} catch (error) {
  this.log.warn({ err: error, entryId: entry.id },
    'grace expiry skipped - the entry moved before the timer reached it');
}
```

> A receptionist got there first and the state machine refused us. **That is the system
> working**: they had better information than this timer did.

### `cutoff-sweeper` — closing the doors

This is the `cutoffOnEtaOverrun` mechanism that `common/registration.ts` had been carrying
an inert hook for since Phase 3:

> *Phase 7: true when a patient joining now would not be seen before the session ends.
> Always false until then, so this term is inert rather than wrong.*

The judgement call:

```ts
// The EARLY edge of the window, not the late one. Closing the doors is a decision
// against the patient, so it should need the optimistic estimate to have run out -
// not merely the pessimistic one.
if (new Date(window.from) <= session.scheduledEnd) continue;
```

And why it is a sweep as well as a join-time check: they do different jobs. The join-time
gate stops the *next booking*; this closes the session so every patient *browsing* it sees
"closed" rather than a Join button that will refuse them.

### `eta-tick` — time passing is itself an event

```ts
async tick(): Promise<string[]> {
  const sessions = await this.prisma.oPDSession.findMany({
    where: {
      status: { in: ['OPEN_FOR_REGISTRATION', 'ACTIVE'] },
      doctorPresence: { not: 'LEFT' },
      pausedAt: null,
      entries: { some: { status: { in: [...ELIGIBLE_TO_CALL] } } },
    },
    select: { id: true, version: true },
    take: MAX_SESSIONS_PER_TICK,       // 50
  });

  for (const session of sessions) {
    this.realtime.emitSessionUpdate(session.id, session.version);
  }
  return sessions.map((s) => s.id);
}
```

> Every other update in the product is caused by somebody doing something. This one is
> caused by nobody doing anything. If the doctor takes a twenty-minute phone call, no
> command runs, no event fires, and without this every waiting patient's screen would keep
> promising a time that has quietly become impossible.

It writes no rows and bumps no version. The ETA is anchored to the clock, so re-reading is
all it takes.

The interval is slow **on purpose**: the window is never narrower than ±5 minutes, so a
faster tick would repaint the same answer — and ETA thrash is a real UX bug. "Recomputing
on every single event makes the number jump around and destroys trust." One minute is
smoothing, not laziness.

### `reconcile-sweeper` — the safety net under the webhook

> Webhooks cross the internet to a server that might have been restarting. Everything else
> in the product tolerates a lost message by re-reading; **a lost `payment.captured` does
> not**, because the money has already left the patient's account and only that callback
> was going to turn it into a token.

```ts
const attempts = await this.razorpay.paymentsForOrder(payment.razorpayOrderId);
const captured = attempts.find((attempt) => attempt.status === 'captured');
if (captured === undefined) continue;

const ack = await this.onPaymentCaptured(captured);
```

**It routes the answer through the exact function the webhook uses.** A second confirm
path would drift, and it would drift on the money path.

It also handles the reverse direction — refunds we raised and never managed to send —
using the `notes.refundId` trick from Part 8.4.
---

# Part 12 — Notifications

## 12.1 The outbox pattern

Nothing calls Expo from inside a queue command — for the same reason nothing calls
Razorpay from inside one.

```
queue command commits
      ↓
QueueEvent row exists
      ↓
EventNotifier sweep (30s)  reads events, writes Notification rows (status PENDING)
      ↓
DispatchSweeper (15s)      sends them, marks SENT / FAILED
      ↓
Expo → the phone
```

**A row is written first and sent afterwards.** So a push survives a restart between the
queue command and the send, and there is a history that answers "was she told?".

## 12.2 Reading the timeline instead of being called

`EventNotifier` reads `QueueEvent` rather than being invoked from inside the commands.
The comment lists three things that buys:

1. **No coupling.** `QueueModule` does not import this, does not know it exists and cannot
   be broken by it. A notification bug can never fail a queue command — which is the right
   blast radius for something whose worst outcome is a missing push and whose alternative
   is a patient not being called.
2. **It catches up.** The timeline is already the record of everything that happened, so a
   restart re-derives what was missed. An enqueue-at-commit design cannot do that.
3. **It cannot double-send**, because of the unique constraint below.

The cost is latency: a patient hears within one sweep rather than instantly. The realtime
socket already carries the instant part — their screen updates the moment the doctor
presses the button — so the push is the nudge for a phone in a pocket, and half a minute
does not change what it means.

Only some events are worth a patient's attention:

```ts
const NOTIFY_ON: Partial<Record<string, NotificationType>> = {
  ENTRY_CONFIRMED:   'TOKEN_ISSUED',
  ENTRY_CALLED:      'CALLED',
  ENTRY_RECALLED:    'RECALLED',
  ENTRY_SKIPPED:     'SKIPPED',
  ENTRY_NO_SHOW:     'NO_SHOW',
  ENTRY_CANCELLED:   'CANCELLED',
  ENTRY_RESCHEDULED: 'RESCHEDULED',
};
```

Everything absent is deliberately silent: a pause, a presence change, a priority edit and
a consultation starting are all things the patient either cannot act on or is already in
the room for.

## 12.3 A subtle bug worth studying: the query filter

```ts
const events = await this.prisma.queueEvent.findMany({
  where: {
    createdAt: { gte: since },
    type: { in: Object.keys(NOTIFY_ON) as never[] },
    entry: { accountId: { not: null } },
    notifications: { none: {} },          // ◀── this line
  },
  orderBy: { createdAt: 'asc' },
  take: BATCH,                            // 200
  ...
});
```

That `notifications: { none: {} }` clause — "events nobody has been told about yet" — was
not originally there. The reasoning was that the unique constraint would catch duplicates
anyway.

Here is why that was wrong, in the file's own words:

> `take` applies AFTER the WHERE and this is ordered oldest-first, so a sweep would fetch
> the same 200 oldest events every half-minute, re-confirm every one of them as a
> duplicate, and never reach anything newer until the old ones aged out of the six-hour
> window. Above roughly 33 notifiable events an hour — a single busy clinic, where one
> session produces two or three hundred — "you are being called" started arriving hours
> late, silently, with nothing logged and no test above the batch size to catch it.

Three things make this an excellent bug to learn from:

- Everything was *technically correct*. No duplicates were sent. The constraint worked.
- It was invisible below the batch size — so it passed every test and every demo.
- The fix is one line, and it moves the filter from *after* the limit to *before* it.

**The general lesson: `LIMIT` applies after `WHERE`, not after your loop.** If your loop
discards most of what it fetched, you have a queue that never drains.

## 12.4 The dedupe key

```prisma
dedupeKey String @unique
```

```ts
dedupeKey: sourceEventId ?? `${input.entryId}:${input.type}`,
```

**The storm guard, as a database constraint rather than an application check.** A duplicate
insert violates it and is swallowed as "already told them." An app-level check loses that
race the first time two passes overlap — and "notification storms destroy trust faster
than silence."

It used to be `unique(entryId, type)`, which was wrong for every message that can honestly
happen twice. Follow the no-show flow:

```
called → grace → recalled → grace → skipped → requeued → CALLED AGAIN
```

That second call is a second `CALLED` for the same booking. The old constraint silently
swallowed it — so **the one patient who had already missed a call, the one who most needs
telling, was the only one who never got a second push.** And the SKIPPED message they had
just received promised "you will be called again."

So the key now names the **occasion** rather than the booking:

- caused by a queue event → the `QueueEvent` id, so each call is its own
- predicted, not caused (`LEAVE_NOW`) → `<entryId>:<type>`, still once ever

And `sourceEventId` is *also* stored as a real foreign key, deliberately duplicating the
value, because that relation is what makes `notifications: { none: {} }` from 12.3
possible at all.

## 12.5 `leave-now` — the notification the whole product is for

> Every other message reports something that happened. This one is a **prediction**, and
> it is the one that delivers the promise in `docs/PRD.md` §1: arrive when your turn is
> near instead of sitting in a waiting room for hours. Nothing else in the system tells a
> patient to get up and leave the house.

```ts
const minutesAway = (new Date(window.from).getTime() - now.getTime()) / 60_000;
if (minutesAway > policy.arriveBeforeMins) continue;
```

**The early edge again**: if they might be called at 11:05, they need to be walking in by
then, not at 11:25. Being early is an inconvenience; being late loses their turn.

It fires **once per booking, ever** — and that is why it is the one message that passes no
`sourceEventId`. Nothing *happened* to cause it, and a second prediction about the same
patient is the same promise, not a new one. This runs every half-minute and the ETA moves
on every tick, so without that the patient would be told to leave twelve times.

It deliberately does **not** re-notify when the ETA slips later. Telling somebody already
in a taxi that they need not have left is worse than saying nothing, and their screen is
live anyway.

Then the part worth pausing on:

```ts
if (isNew) {
  told.push(entry.id);
  await this.prisma.queueEntry.update({
    where: { id: entry.id },
    data: { predictedCallFrom: new Date(window.from),
            predictedCallTo:   new Date(window.to) },
  });
}
```

> This is the only place the ETA stops being a number computed on demand and becomes a
> commitment somebody acts on — they put their shoes on because of it. Recording the
> window here is what makes the estimate falsifiable afterwards: `calledAt` is already
> stored, so the pair says whether we kept our word.

Guarded by `isNew`, so the storm guard doubles as a write-once guard: a second sweep must
not overwrite the window the patient actually saw with a fresher, flattering one.

## 12.6 What the messages say

```ts
case 'CALLED':
  return { title: `${tokenLabel} - you are being called`, body: 'Please go in now.' };

case 'SKIPPED':
  return { title: `${tokenLabel} was passed over`,
           body: 'You have not lost your place. Check in at reception and you will be called again.' };
```

> **A push renders on a lock screen, in public, on a phone that may be lying on a table.**
> So none of these carry a patient name, a doctor's name, a department or anything
> clinical. The token label is meaningful to the person waiting for it and meaningless to
> anyone reading over their shoulder — which is exactly the property a token was chosen
> for.

They are written to be read in one glance, standing up, by someone who is anxious. Short
sentences, no jargon, the action first.

## 12.7 Sending

```ts
const dead = results.filter((r) => r.deviceGone).map((r) => r.token);
if (dead.length > 0) {
  await this.prisma.pushToken.updateMany({
    where: { token: { in: dead } },
    data: { disabledAt: new Date() },
  });
}

const delivered = results.some((r) => r.ok);
```

**Prune dead tokens**, or the delivery rate quietly rots as they accumulate.
**Reaching one of a patient's devices is a delivered notification** — they only have to
see it once.

And the device registration:

```ts
await this.prisma.pushToken.upsert({
  where: { token: input.token },            // ◀── on the TOKEN, not (account, token)
  create: { accountId, token: input.token, ... },
  update: { accountId, disabledAt: null, ... },
});
```

> A phone gets handed to a family member who signs in as themselves, and Expo would then
> route the first person's pushes to the second unless registering **moves** the token.

Expo messages carry `ttl: 60 * 30`: a queue nudge is worthless late, so Expo drops it
rather than delivering "you are next" an hour after the patient was seen.

---

# Part 13 — Discovery and the patient read path

`discovery` is the shop window: city → hospital → department → session.

## 13.1 Authenticated, but not tenant-scoped

```ts
@Controller()
export class DiscoveryController {
  @Get('hospitals')          hospitals(...) {}
  @Get('hospitals/:id')      hospital(...) {}
  @Get('departments/:id/sessions')  departmentSessions(...) {}
  @Get('sessions/:id')       session(...) {}
}
```

> That is expressed by the **absence** of a `:hospitalId` path segment: TenantGuard keys
> off that parameter and passes straight through, so every route here uses `:id`. Renaming
> one of these to `:hospitalId` would silently demand a staff membership and lock every
> patient out.

There is no `@Public()` either — a patient is signed in before they browse, and an
unauthenticated endpoint is one more thing to rate-limit for no gain.

Note also `GET /departments?hospitalId=` rather than
`GET /hospitals/:id/departments` — that path would collide with the admin route.

## 13.2 Two visibility filters

```ts
const LISTABLE_HOSPITAL = { status: 'VERIFIED' } as const;
```

`PENDING` means onboarding is unfinished, `SUSPENDED` means we have stopped it. Because
everything below hangs off a hospital, this one filter also hides its departments, doctors
and sessions.

```ts
const listableSession = (date?: Date): Prisma.OPDSessionWhereInput => ({
  status: { not: 'CANCELLED' },
  ...(date ? { date } : {}),
  hospital: LISTABLE_HOSPITAL,
  department: { isActive: true },
  currentProvider: { isActive: true },
});
```

Four conditions, and the comment flags why they matter: *"tenant leakage through discovery
is easy to miss because this path is deliberately public."*

Two deliberate choices in there:

- **`COMPLETED` and `ENDED_EARLY` sessions remain visible.** A patient browsing at 16:00
  should see that the morning clinic ran and is over, rather than an empty screen that
  looks like a broken app. The card carries the status and `registrationOpen` is false, so
  nothing invites a join.
- **The doctor filter is on the current provider, not the original.** After a substitution
  the session is still running, and it is the person in the room whose active flag decides
  whether it is real.

## 13.3 Never one query per card

```ts
const [counts, serving, held] = await Promise.all([
  this.prisma.queueEntry.groupBy({ by: ['sessionId', 'status'], where: { sessionId: { in: sessionIds }, ... } }),
  this.prisma.queueEntry.findMany({ where: { sessionId: { in: sessionIds }, status: { in: ['CALLED', 'IN_CONSULTATION'] } }, ... }),
  this.prisma.queueEntry.groupBy({ by: ['sessionId'], where: { ... type: 'ONLINE' ... } }),
]);
```

Whatever the page size, three queries. Then one batched `eta.windowsFor(...)` for the whole
page. That is the N+1 problem consciously designed out, and it is why the ETA service has
the batching shape it does.

There is a deliberate non-decision recorded here too:

> consistency is not worth buying here: the two queries can land either side of a
> call-next, so a card may show a token whose count moved a moment ago. This is a
> projection of a queue that changes every few seconds and is already stale by the time it
> reaches a phone; paying an interactive transaction on the hottest read path in the
> product to align two numbers nobody can perceive would be the wrong trade.

That is the right instinct to copy: know which inconsistencies matter.

## 13.4 One gate, two callers

```ts
export function registrationGate(input: RegistrationGateInput): RegistrationGateResult {
  if (!ACCEPTS_BOOKINGS.includes(input.status))   return closed('SESSION_NOT_OPEN');
  if (input.registrationClosedAt !== null)        return closed('MANUALLY_CLOSED');
  if (input.scheduledEnd <= input.now)            return closed('SESSION_ENDED');

  const cutoffMins = input.policy.cutoffMinsBeforeEnd;
  if (cutoffMins !== null) {
    const cutoffAt = new Date(input.scheduledEnd.getTime() - cutoffMins * 60_000);
    if (input.now >= cutoffAt)                    return closed('PAST_CUTOFF');
  }

  const cap = input.policy.maxOnlineTokens;
  if (cap !== null && input.onlineTokensHeld >= cap) return closed('TOKEN_CAP_REACHED');

  if (input.etaOverrun === true)                  return closed('PAST_CUTOFF');

  return { open: true, reason: null };
}
```

> **One function, two callers, on purpose.** `discovery` calls it to decide whether the
> Join button is live; the JOIN command calls it to decide whether to accept the booking.
> If those two ever disagreed, a patient would tap a button the server then refuses — or
> worse, the button would be greyed out on a session that would happily have taken them.

It lives in `common/` rather than in either module because it is **pure**: values in, an
answer out, no Prisma and no clock of its own.

The discovery answer is still only advisory: it can change between the read and the write,
which is exactly why the write re-runs it under the session lock.

`ACCEPTS_BOOKINGS` includes `ACTIVE`, and the comment calls it out as a trap: the first
`call-next` activates a session, so leaving it out would close every clinic as it opened
its doors.

## 13.5 The recorded rule-break

`discovery`, `eta` and `payments/my-entry` all read tables other modules own —
`Hospital`, `Department`, `Doctor`, `OPDSession`, `Consultation` — which
`docs/CLAUDE.md` §3 otherwise forbids. The exception is argued, not assumed:

> The rule exists to stop two modules mutating the same invariants; **nothing here
> writes.** Routing these reads through the owning services would not work anyway: those
> methods are tenant-scoped to a staff membership and apply the ADMIN visibility rules,
> while a card needs one aggregate join across four tables. Splitting it would reintroduce
> exactly the per-card N+1 that `docs/Phases.md` names as this phase's main risk.

Note what is **not** excepted: `QueuePolicy` is still read through `QueuePolicyService`,
because that is a service call and costs nothing.

And a real bug that came out of that distinction:

```ts
async read(hospitalId: string): Promise<QueuePolicy> { ... }    // does NOT insert
async ensure(hospitalId: string): Promise<QueuePolicy> { ... }  // inserts on first use
```

> `ensure` inserts on first use, which is right for a command that is about to act on the
> policy — and wrong for a read. `discovery` is a patient-facing projection documented as
> writing nothing, so calling `ensure` there meant a stranger browsing a hospital could
> insert a row into it.

The *answer* is identical either way. Only the side effect differs.

## 13.6 The other read modules

**`sessions`** — a doctor's working block on one date. Two rules shape the file:

- Every date is an IST date computed on the server. A client's "today" sent at 00:30 IST
  is still yesterday in UTC.
- Idempotency is the database's job: `@@unique(originalDoctorId, date, scheduledStart)` is
  what makes a double-clicked *Generate* harmless. This service only translates the
  resulting P2002 into "skipped."

There is deliberately no `PATCH`. Every change to a session's status is a Phase-4 domain
command.

And one guard added late, worth reading in full because it is a good example of finding a
*silent* inconsistency:

```ts
if (scheduledEnd <= new Date()) {
  throw new ValidationFailedError('That session has already ended, so no patient could join it', {
    endTime: `${input.date} ${input.endTime} IST is in the past`,
  });
}
```

> `registrationGate` closes on `scheduledEnd <= now`, so the patient app correctly shows
> "Registration closed." The console shows OPEN_FOR_REGISTRATION, because that is the only
> status creation can produce. **Nothing ever reconciles the two**: the cutoff sweeper
> skips sessions whose end has passed, and END_SESSION is a manual command nobody runs on
> a session they never worked. So the row sits there for ever, telling staff it is open
> and patients it is closed.

Note also what it deliberately allows: a session that has merely *started* is fine — a
clinic that opened at 10:00 and remembers to create the session at 10:30 is normal.

**`config`** — departments, doctors, schedules, queue policy. One module rather than four,
because they are edited together, are all ADMIN-only, and reference each other constantly.

The role split is instructive:

```ts
@Roles('ADMIN')
@Controller('hospitals/:hospitalId/doctors')
export class DoctorsController {
  @Roles('ADMIN', 'RECEPTION', 'DOCTOR')
  @Get()  list(...) {}
  // writes inherit the class-level ADMIN
}
```

Reading the doctor list was widened to all roles, because the queue console names the
doctor running each session and a receptionist who cannot read their own hospital's doctor
list cannot be shown whose queue they are working. Writes stay ADMIN-only.

**`patients`** — a patient's family profiles. Account-scoped, no hospital anywhere.

---

# Part 14 — Cross-cutting concerns

## 14.1 Time: `common/ist.ts`

India is UTC+05:30, with no daylight saving, ever. So a fixed offset is correct and a
timezone library would buy nothing.

```ts
const IST_OFFSET_MINUTES = 330;

export function istDateOf(instant: Date): string {
  return new Date(instant.getTime() + IST_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
}

export function istToUtc(date: string, time: string): Date {
  const year = Number(date.slice(0, 4));
  // ... fixed-position slicing
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - IST_OFFSET_MINUTES * 60_000);
}
```

**Every conversion between a clock face and an instant goes through this file and nowhere
else.** The reason is stated as the classic bug of the phase:

> An inline `new Date()` in the session-generation path is the 00:30 IST bug: run at 00:30
> IST the UTC date is still yesterday, so "today's sessions" would be generated for the
> wrong day, every night.

This codebase hit that class of bug **twice** — once in session generation, once in the
ETA's "today" window.

`dateColumnToString` slices the ISO string rather than using a locale formatter, because a
formatter would shift the day on any machine behind UTC.

## 14.2 PII: `common/scrub.ts`

```ts
const SENSITIVE_KEY = new RegExp(
  ['name', 'phone', 'mobile', 'email', 'dob', 'dateofbirth', 'abha',
   'address', 'password', 'token', 'secret', 'authorization', 'cookie',
   'signature', 'otp'].join('|'), 'i');
```

> **This is an egress guard, not a logging filter.** Local pino logs keep full detail: they
> live on infrastructure we control, in-region, and a receptionist's bug is undebuggable
> without knowing which hospital and which token. What must never leave is the patient: a
> stack trace shipped to a third-party error service carries names, phone numbers and dates
> of birth straight out of the country, and under DPDP that is a compliance breach.

So it runs at exactly one place — Sentry's `beforeSend` — and nowhere else.

**Key names, not value shapes.** Detecting "this looks like a phone number" fails both
ways: it misses `+91 98765 43210` written a new way, and it redacts a token number that
happens to be ten digits. Names are stable, greppable, and wrong in only one direction.

Which is why the list has an escape hatch — and the escape hatch has a story:

```ts
const NOT_SENSITIVE = /^(token(label|number|prefix)|filename|module)$/i;
```

`SENSITIVE_KEY` matches **substrings**. `tokenLabel` contains "token"; the queue token
"B007" is printed on a slip, read aloud in a waiting room and shown on a public board, and
redacting it makes an error report useless (*which patient? the one whose token is
[redacted]*) while protecting nothing.

`filename` and `module` were the second collision, found the day this was actually wired
to Sentry: both contain "name," so every stack frame in every report came back
`"filename": "[redacted]"` — a stack with the function and the line but not the file.

The file leaves a warning for the future, which is the right way to record a known edge:

> **If an upload path is ever added, a user-supplied filename must not land on this key** —
> name it `originalFilename` or scrub it at the source.

And the fail-closed posture at the boundary:

```ts
beforeSend(event) {
  try { return scrub(event) as typeof event; }
  catch { return null; }
}
```

> A throw HERE would be swallowed by the SDK and the event sent unscrubbed, so failure
> drops the event instead. **An error report is worth less than a leak.**

`reportFault` is called for 5xx only — a 403 or a failed validation is the API working,
and paging on those is how an alert channel gets muted.

## 14.3 Health

```ts
res.status(database ? 200 : 503).json(body);
```

**Postgres decides the status code; Redis is reported but does not.**

> Redis is used for exactly two things: the Socket.IO adapter and this probe. Every REST
> path, the queue engine, payments and discovery are pure Postgres. So a Redis blip used to
> 503 an API that could still answer every request correctly, and an orchestrator would
> drain or kill it: the product would have degraded from live to stale, and instead it went
> to zero.

`status` still reads `degraded` so a dashboard and an on-call engineer can both see it.
Taking traffic away is a stronger action and wants a stronger reason.

Both routes are `@Public()`: an orchestrator polling liveness has no credentials, and a 401
here reads as "unhealthy" and gets the service killed.

## 14.4 Rate limiting

```ts
ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }])
```

A generous global ceiling, tightened per route where abuse is cheap:

| Route | Limit | Why |
|---|---|---|
| everything | 120/min | catches scripts, not staff |
| `auth/login`, `signup`, `google`, `accept-invite` | 10/min | guessing |
| `sessions/:id/join` | 20/min | reserves a real seat and creates an order |
| `auth/refresh` | *none* | high-entropy secret; reuse kills the family |
| `webhooks/razorpay` | **`@SkipThrottle()`** | Razorpay's retries are the reliability |

The known ceiling is marked honestly in the code:

```ts
* ponytail: in-memory storage, so limits are per process. Redis is already a
* dependency and `ThrottlerStorageRedisService` would make them cluster-wide;
* that matters only once more than one API instance runs.
```

## 14.5 Bootstrap: `onboard.ts`

There is a chicken-and-egg problem. Every hospital-scoped route assumes the hospital
exists; `StaffService` requires an existing ADMIN before it will invite anyone; and there
is no platform-level role above ADMIN. So the first three rows for a new tenant had no way
to exist except the dev seed or hand-written SQL against a live database.

`pnpm --filter @opd/api onboard` is that path, made repeatable. It boots the **real
application context** so the invitation is created by the same code the console calls —
one 32-byte token, SHA-256 stored, the plaintext returned once, and the account created
with no password so the administrator sets their own.

> Reimplementing that here would duplicate the security-sensitive half of the invite scheme
> in a file nobody tests — and this codebase has already been bitten once by copied logic
> drifting from the original (the two workers that copied the sweep loop and silently lost
> their kill switch).

## 14.6 The tests

`apps/api/test/` — seventeen test files plus their helpers. They are the best
documentation of intended behaviour in the repo.

| File | Pins |
|---|---|
| `queue-lock.e2e.test.ts` | concurrency — two callers, one patient |
| `queue-scenarios.e2e.test.ts` | full no-show / emergency / substitution walks |
| `state-machine.test.ts` | every legal and illegal transition, no database |
| `eta.engine.test.ts` | the arithmetic, pure |
| `payments.e2e.test.ts` | duplicate and replayed webhooks |
| `tenant-isolation.e2e.test.ts` | 403 vs 404 indistinguishability |
| `route-authz.e2e.test.ts` | every route is guarded |
| `journey.e2e.test.ts` | one patient, browse to completed |
| `workers.e2e.test.ts` | the `DISABLED_WORKERS` names actually work |

Two infrastructure decisions are worth copying.

**The tests run against a real Postgres**, in a database named `<name>_test`:

```ts
if (name.endsWith('_test')) return url;
parsed.pathname = `/${name}_test`;
```

The reason is written up at length, and it is a real incident: `resetDb()` truncates every
table, and it used to do that to the *development* database on the reasoning that dev data
is regenerable. That stopped being true once the seed grew to six hospitals, 42 queue
entries mid-clinic, and a registered push token on a real phone. The suite destroyed a
working test environment twice in one day.

There is a guard in `global-setup.ts` for the same reason:

```ts
if (!name.endsWith('_test')) {
  throw new Error(`refusing to prepare a database not named *_test: ${name}`);
}
```

**Almost nothing is mocked.** The database, the guards and the queue engine are all real —
they are what the tests are about. Only `RazorpayClient` and `ExpoClient` are faked, and
only because they are third parties.

There is also a lovely piece of defensive testing in `resetThrottle()`:

```ts
if (bucket === undefined || typeof bucket.values !== 'function') {
  throw new Error(
    'resetThrottle: @nestjs/throttler no longer exposes `storage` as a Map. ' +
    'The rate limiter cannot be reset between tests, which means it is either ' +
    'leaking counters or not limiting. Fix this before trusting any rate-limit test.');
}
```

> This function has been wrong three times, and the expensive version each time was the one
> that did nothing **quietly**.

Run them with:

```bash
pnpm --filter @opd/api test
pnpm --filter @opd/api typecheck
pnpm --filter @opd/api lint
```
---

# Part 15 — Five end-to-end traces

Everything joined up. Follow each one with the files open.

## Trace 1 — A patient books a token

```
1  POST /auth/login                              auth.controller → auth.service
      argon2 verify → TokenService.issue()
      ← { accessToken (15 min), refreshToken (30 days) }

2  GET  /hospitals?city=Pune                     discovery.controller → discovery.service
      LISTABLE_HOSPITAL filter, paginated

3  GET  /departments?hospitalId=...              (querystring, not a path — avoids the admin route)

4  GET  /departments/:id/sessions?date=today     discovery.service.listSessions
      → snapshots()      3 batched queries
      → eta.windowsFor() 3 more, for the whole page
      → registrationGate() per card, pure
      ← cards with nowServing, aheadCount, joinNowEtaFrom/To, registrationOpen

5  POST /sessions/:id/join   { patientId }       ◀── ":id", so NOT tenant-scoped
      JwtGuard ✓   TenantGuard passes through   ← a patient has no membership
      payments.service.join()
        hospitalOfSession()                       server decides the hospital
        joinQueue() → runCommand('JOIN')
            SELECT ... FOR UPDATE
            assertSessionAccepts('JOIN', session)
            patient belongs to this account?
            existing entry?  → resume or refuse
            registrationGate against the LOCKED row
            tokenNumber = max + 1
            INSERT QueueEntry RESERVED, expires in 10 min
            record ENTRY_RESERVED
            version + 1
            COMMIT
        ensureOrderFor() → Razorpay POST /orders    ◀── OUTSIDE the transaction
        INSERT Payment CREATED
      ← { entry, razorpayOrderId, razorpayKeyId, amountPaise, callbackUrl }

6  the phone opens Razorpay Checkout and the patient pays

7  POST /webhooks/razorpay                       ◀── @Public(), @SkipThrottle()
      verifyWebhookSignature(req.rawBody, header)   HMAC over RAW bytes
      RazorpayWebhookEvent.safeParse
      onPaymentCaptured()
        find Payment by razorpayOrderId
        amount and currency match?
        already SUCCESS with this payment id? → DUPLICATE, 200
        session still live?  no → capture + refund
        entry CANCELLED?     yes → REINSTATE  /  no → CONFIRM_PAYMENT
        runCommand:
            applyPaymentConfirmation()  RESERVED → CONFIRMED, mint checkInCode,
                                        clear reservationExpiresAt
            Payment → SUCCESS + razorpayPaymentId
            record ENTRY_CONFIRMED
            COMMIT
        announce → socket entryUpdated to the patient's account room
      ← 200 { handled: 'CONFIRMED' }

8  the phone refetches GET /me/queue-entries
      checkInCode is SIGNED on read → the QR renders

9  EventNotifier (≤30s)  ENTRY_CONFIRMED → Notification TOKEN_ISSUED
   DispatchSweeper (≤15s) → Expo → the phone buzzes
```

## Trace 2 — The queue moves

```
LeaveNowNotifier (30s)
    sessions with CONFIRMED entries, doctor not LEFT, not paused
    present = eligible entries in CALL_ORDER
    eta.windowsFor(aheadCount = present.length)
    window.from is within arriveBeforeMins?
        Notification LEAVE_NOW  (dedupeKey = "<entryId>:LEAVE_NOW", once ever)
        write predictedCallFrom / predictedCallTo   ◀── the promise, recorded

the patient arrives

POST /sessions/:sessionId/check-in { checkInCode }   ◀── ":sessionId" → tenant-scoped
    TenantGuard: session → hospital; is this staff member in it?
    runCommand('CHECK_IN')
        verifyCheckInCode() BEFORE any database access
        find entry by the stored reference, scoped to this session
        CONFIRMED → CHECKED_IN, checkedInAt = now
        record ENTRY_CHECKED_IN
    → the patient is now in ELIGIBLE_TO_CALL

POST /sessions/:sessionId/call-next
    anyone CALLED / IN_CONSULTATION?  no
    nextEligibleEntry() by CALL_ORDER
    CHECKED_IN → CALLED, calledAt = now
    session OPEN_FOR_REGISTRATION → ACTIVE
    record SESSION_ACTIVATED + ENTRY_CALLED
    → socket sessionUpdated; EventNotifier → CALLED push

POST /sessions/:sessionId/start-consultation { entryId }   ◀── @Roles('ADMIN','DOCTOR')
    CALLED → IN_CONSULTATION, consultStartedAt = now

POST /sessions/:sessionId/complete-consultation { entryId } ◀── @Roles('ADMIN','DOCTOR')
    IN_CONSULTATION → COMPLETED
    INSERT Consultation { doctorId: currentProvider, durationSec }
    → every future ETA for this doctor now knows about this visit
```

## Trace 3 — Nobody answers

```
the doctor calls A007.  A007 is in the car park.

GraceSweeper, every 15s:
    entries CALLED in an ACTIVE, unpaused session
    deadline = calledAt + policy.gracePeriodSec
    now < deadline → skip this pass

... the grace period expires ...

    skip(entryId, reason: "No response within the 300s grace period")
        CALLED → SKIPPED, recallCount 0 → 1
    attemptsUsed (1) >= policy.recallAttempts (2)?  no
    requeue(entryId)
        SKIPPED → CHECKED_IN, calledAt = null, requeuedAt = now
        → CALL_ORDER now sorts them BEHIND everyone with requeuedAt = null

    actor is SYSTEM — the audit trail says a clock decided this

EventNotifier → SKIPPED push:
    "A007 was passed over — you have not lost your place."

the doctor calls the next patient.  later, A007 comes round again.

it is a SECOND ENTRY_CALLED for the same booking.
    dedupeKey = the QueueEvent id, not "<entryId>:CALLED"
    → a second push is sent
    → under the OLD unique(entryId, type), it was silently swallowed —
      and the one patient who had already missed a call was the only one
      who never got told about the second

A007 misses it again:
    skip → recallCount 2
    attemptsUsed (2) >= recallAttempts (2)?  yes
    noShow(entryId)   SKIPPED → NO_SHOW, terminal
```

## Trace 4 — A patient cancels

```
POST /queue-entries/:id/cancel   { reason }

payments.service.cancel()
    find the entry scoped to THIS account            ◀── not a bare findUnique
    policy = policies.ensure(hospitalId)
    pct = refundPctIfCancelledAt(rules, scheduledStart, now)
            now <= start - freeCancellationMins  →  100
            otherwise                            →  lateCancellationRefundPct

    runCommand('CANCEL_ENTRY')
        applyCancellation() → { entry, changed }
        if (!changed) return null                    ◀── the double-refund guard
        refundForCancellation()
            re-read Payment UNDER THE LOCK           ◀── stale refundedPaise = double refund
            refundable = floor(amount * pct / 100) - refundedPaise
            if (refundable <= 0) return null
            INSERT Refund PENDING
            UPDATE Payment refundedPaise, status REFUNDED / PARTIALLY_REFUNDED
        COMMIT

    sendRefundToGateway()                            ◀── AFTER the commit
        POST /payments/:id/refund  notes: { refundId }
        success → store razorpayRefundId
        failure → logged, row stays PENDING with no gateway id

... later ...

POST /webhooks/razorpay  { event: 'refund.processed' }
    find Refund by razorpayRefundId → status PROCESSED

... or, if the gateway call had failed ...

ReconcileSweeper (5 min):
    Refund PENDING, razorpayRefundId null, older than 3 min
    ask Razorpay: refundsForPayment(paymentId)
        a refund whose notes.refundId is ours?  → ADOPT its id, do not re-send
        none?                                   → send it now
```

## Trace 5 — Two receptionists, one button

```
T0   Reception A: POST /sessions/abc/call-next
T0   Reception B: POST /sessions/abc/call-next     (the same millisecond)

A                                    B
BEGIN                                BEGIN
SELECT ... FOR UPDATE  ── acquired   SELECT ... FOR UPDATE  ── BLOCKS
assertSessionAccepts ✓                        │
anyone CALLED? no                             │  (waiting on the lock)
nextEligibleEntry → A007                      │
A007 → CALLED                                 │
version 4 → 5                                 │
INSERT QueueEvent, AuditLog                   │
COMMIT ─────────────────────────────────▶ lock released
announce sessionUpdated v5           SELECT ... FOR UPDATE ── acquired
200 { entry: A007 }                  reads the COMMITTED state (version 5)
                                     assertSessionAccepts ✓
                                     anyone CALLED? YES — A007
                                     throw InvalidQueueTransitionError
                                     ROLLBACK
                                     409 "That is no longer possible - this is
                                          already called. Someone may have acted
                                          first; reload to see what changed."
```

**Nobody is called twice, nobody is skipped, and B is told something a human can act on.**

Now notice how much of that came for free. `call-next.ts` contains no locking code, no
retry, no version handling and no error mapping. It got all of it by being a handler
passed to `runCommand`.

---

# Exercises

Do these in order. They are ranked by how much they will teach you.

### Reading

1. **Trace one request by hand.** Pick `POST /sessions/:sessionId/skip`. Write down every
   file it touches, in order, from `main.ts` to the HTTP response. Check yourself against
   Trace 2.

2. **Answer from the code alone:** *why is the doctor's average consultation time weighted
   at 50% for today and 30% all-time, rather than the other way round?* The answer is a
   comment in `eta.engine.ts`.

3. **Find every place `ELIGIBLE_TO_CALL` is used** (`grep -rn ELIGIBLE_TO_CALL apps/api/src`).
   There are six. Explain why "callable" is defined in one place instead of six.

4. **Read `state-machine.ts` end to end** without skipping the comments. It is 533 lines, the densest
   file in the repo, and the highest return on your time.

### Predicting

5. What happens if a patient calls `POST /sessions/:id/join` twice in two seconds?
   *Follow `findExistingEntry` and the `resumed` flag.*

6. What happens if Razorpay delivers the same `payment.captured` webhook four times?
   *Find all four independent guards. They are in Part 8.3.*

7. A receptionist tries `call-next` while the doctor is `ON_BREAK`. Which error, what HTTP
   status, and what does the message tell them to do? Why is it a different class from
   `DoctorHasLeftError`?

8. A session's `scheduledEnd` passes while ten people are still `CHECKED_IN`. What status
   do they get when someone ends the session — and why is it not `NO_SHOW`?

### Verifying

9. **Break the state machine on purpose.** Add `CANCELLED: 'CHECKED_IN'` to the `CHECK_IN`
   table, run `pnpm --filter @opd/api test`, and read which test fails and what it says.
   Then revert.

10. **Break the call order.** Change `nulls: 'first'` to `nulls: 'last'` on `requeuedAt` in
    `call-order.ts` and run the tests. Which scenario catches it? *(This is the bug the
    comment warns about.)*

11. **Break tenant isolation.** In `TenantGuard`, change `throw new TenantMismatchError()`
    to `throw new NotFoundError()`. Run `tenant-isolation.e2e.test.ts`. Read the failure
    and explain what it is protecting.

12. **Watch the lock work.** Read `queue-lock.e2e.test.ts` and work out how it forces the
    race deterministically.

### Building

13. Add a **read-only** endpoint: `GET /sessions/:sessionId/events` returning the last 50
    `QueueEvent` rows for a session, paginated, staff-only. You will need a schema in
    `packages/contracts` first (contract-first is `docs/Rules.md` §11), then a service
    method, then a controller method. Watch how much you get for free from the guards.

14. Add a new queue command, `RECALL` — re-announce a `CALLED` patient without skipping
    them. Decide first: what does the transition table say? What event type? Which roles?
    Does it need the doctor present? Then write the command file and a test. *If you can do
    this one, you understand the engine.*

---

# Where to go when you are stuck

| Question | File |
|---|---|
| "Why is this like this?" | the comment above it — genuinely, first |
| "What is the rule?" | `docs/Rules.md` |
| "What is the product supposed to do?" | `docs/PRD.md` |
| "How was this built and what went wrong?" | `docs/PROGRESS.md` — the failures are the good bits |
| "What is left to do?" | `docs/Phases.md` |
| "What shape is this API?" | `packages/contracts/src/**` |
| "Does this actually work?" | `apps/api/test/**` |

## Running it locally

```bash
docker compose up -d                          # Postgres on 5433, Redis on 6380
pnpm install
pnpm --filter @opd/api prisma:generate
pnpm --filter @opd/api prisma:migrate         # local only — the guard script refuses remote
pnpm --filter @opd/api seed
pnpm --filter @opd/api dev                    # http://localhost:3000
```

Then, in another terminal:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/health/ready
```

Before calling any change complete:

```bash
pnpm --filter @opd/api lint
pnpm --filter @opd/api typecheck
pnpm --filter @opd/api test
```

---

## A closing note on how to read this codebase

Three habits will serve you better than memorising any of the above.

**Read the comment before the code.** In this repo the comment usually explains a decision
and often names the bug that forced it. The code without the comment is half the
information.

**When something looks over-engineered, look for the failure it prevents.** Four
idempotency layers on one webhook, a sentinel string in a guard, `nulls: 'first'` in a sort
— every one of them is there because the simpler version broke. Some of them broke in this
project, and `docs/PROGRESS.md` says when.

**When something looks under-engineered, check whether it is deliberate.** The `ponytail:`
comments mark places where a corner was cut knowingly, and each names the ceiling and the
upgrade path. In-memory rate limiting is one. Cities paginated in memory is another. Those
are decisions, not oversights.

You did not write this code, but you own it. The fastest way to make that real is exercise
14: add one command, end to end, and let the tests tell you what you got wrong.

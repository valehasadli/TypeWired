# TypeWired

**Fully type-safe dependency injection for TypeScript. Zero dependencies, no `reflect-metadata`, no decorators.**

TypeWired is a dependency injection container where the type checker does the wiring review. Every service is identified by a typed token, every dependency list is checked against the constructor it feeds, and `resolve()` returns the right type without a single cast. If your dependency graph compiles, it resolves.

```typescript
import { Container, createToken } from 'typewired';

const Db    = createToken<Database>('Database');
const Users = createToken<UserRepo>('UserRepo');

const container = new Container()
    .register(Db,    { useAsyncFactory: () => Database.connect(process.env.DATABASE_URL!) })
    .register(Users, { useClass: UserRepo, deps: [Db] });

const users = await container.resolveAsync(Users); // typed UserRepo — no cast, no string keys
```

## Why TypeWired

Most TypeScript DI libraries make a trade you shouldn't have to make:

- **tsyringe / InversifyJS** infer dependencies from constructor metadata, which requires the `reflect-metadata` polyfill, `experimentalDecorators`, and `emitDecoratorMetadata` — build-system coupling that breaks under esbuild/SWC setups that don't emit decorator metadata, and interface types are erased anyway, so you end up with token indirection regardless.
- **awilix** avoids decorators but keys services by strings, so the type system can't check your wiring: a typo or a wrong-type registration is a runtime error.

TypeWired takes a third path: **explicit registration with compile-time verification.**

- **Wrong wiring doesn't compile.** `deps` tuples are checked against the constructor or factory signature they feed. Registering a class against a token whose interface it doesn't implement is a compile error. So is passing deps in the wrong order.
- **No magic.** No decorators, no metadata reflection, no module-load side effects, no bundler/minifier hazards (nothing depends on class names). Works identically under tsc, esbuild, SWC, and Bun.
- **Honest async.** Async factories are first-class. Concurrent resolution of an async singleton shares one in-flight construction — your database connects once, no matter how many parts of the app boot in parallel.
- **Production lifecycle.** Request scoping, deterministic LIFO disposal, `await using` support, and captive-dependency detection (a singleton that tries to grab a per-request service throws instead of silently freezing the first request's state into an app-lifetime object).
- **Great errors.** Every resolution error carries the full path: `No registration found for token "DbUrl" (while resolving UserRepo → Database → DbUrl)`. Circular graphs report the cycle: `Circular dependency detected: A → B → A`.
- **Zero runtime dependencies.** The entire library is a few small files.

## Installation

```bash
npm install typewired
# or
yarn add typewired
```

Requires TypeScript 5+ and Node.js 20+ (for `Symbol.asyncDispose`; the container itself runs on Node 18).

## Core concepts

### Tokens

A token is a typed identity for a service. It carries the type at compile time and a unique `symbol` at runtime — two tokens can never collide, even with the same description.

```typescript
interface Mailer {
    send(to: string, body: string): Promise<void>;
}

const MailerToken = createToken<Mailer>('Mailer');
```

Interfaces are erased at runtime in TypeScript; tokens are how an interface gets a runtime identity. There is no separate "interface binding" API — binding an interface is just registering an implementation against the interface's token.

### Providers

Four ways to tell the container how to produce a value:

```typescript
container.register(ConfigToken, { useValue: loadedConfig });                     // an existing value
container.register(MailerToken, { useClass: SmtpMailer, deps: [ConfigToken] }); // construct a class
container.register(QueueToken,  { useFactory: (cfg: Config) => new Queue(cfg.queueUrl), deps: [ConfigToken] });
container.register(DbToken,     { useAsyncFactory: (cfg: Config) => Database.connect(cfg.dbUrl), deps: [ConfigToken] });
container.register(LogToken,    { useToken: ConsoleLogToken });                 // alias to another token
```

`deps` is a tuple of tokens matched **positionally and by type** against the constructor/factory parameters. Omit it only when there are no parameters — the compiler enforces both rules.

### Lifetimes

| Lifetime | Instances | Typical use |
|---|---|---|
| `singleton` *(default)* | one per container | config, connection pools, clients, repositories |
| `scoped` | one per scope | request context, unit-of-work, per-request logger |
| `transient` | one per resolution | stateful builders, jobs, anything not shareable |

```typescript
container.register(CtxToken, { useClass: RequestContext, lifetime: 'scoped' });
```

### Lazy resolution

Registration stores a recipe; nothing is constructed until the first `resolve`. That means **registration order never matters** — register your modules in any order, and the graph sorts itself out at resolution time. Cycles are detected and reported with the full chain instead of overflowing the stack.

## A real-world example

A typical HTTP service: config loads first, the database pool connects asynchronously, repositories are singletons on top of the pool, and each request gets an isolated scope that is disposed when the response goes out.

**tokens.ts** — the one place your app names its services:

```typescript
import { createToken } from 'typewired';

export const Config      = createToken<AppConfig>('AppConfig');
export const Db          = createToken<Pool>('DbPool');
export const UserRepo    = createToken<UserRepository>('UserRepository');
export const MatchRepo   = createToken<MatchRepository>('MatchRepository');
export const RequestCtx  = createToken<RequestContext>('RequestContext');
export const UnitOfWork  = createToken<Uow>('UnitOfWork');
```

**container.ts** — the composition root:

```typescript
import { Container } from 'typewired';
import { Pool } from 'pg';
import { Config, Db, UserRepo, MatchRepo, RequestCtx, UnitOfWork } from './tokens';

export function buildContainer(): Container {
    return new Container()
        .register(Config, { useFactory: loadConfigFromEnv })
        .register(Db, {
            // Connects on first resolve. Concurrent boots share one connection
            // attempt; a failed connect is retried on the next resolve.
            useAsyncFactory: async (cfg: AppConfig) => {
                const pool = new Pool({ connectionString: cfg.databaseUrl });
                await pool.query('select 1'); // fail fast
                return pool;
            },
            deps: [Config],
        })
        .register(UserRepo,  { useClass: UserRepository,  deps: [Db] })
        .register(MatchRepo, { useClass: MatchRepository, deps: [Db, UserRepo] })
        // One per request:
        .register(RequestCtx, { useClass: RequestContext, lifetime: 'scoped' })
        .register(UnitOfWork, {
            useClass: Uow,
            deps: [Db, RequestCtx],
            lifetime: 'scoped',
        });
}
```

**server.ts** — request scoping and graceful shutdown:

```typescript
const container = buildContainer();

// Warm the async part of the graph before accepting traffic.
await container.resolveAsync(Db);

app.use(async (req, res, next) => {
    const scope = container.createScope();
    req.scope = scope;
    res.on('finish', () => {
        // Disposes the request's Uow, RequestContext, ... in reverse
        // creation order. Singletons are untouched.
        void scope.dispose();
    });
    next();
});

app.get('/matches', async (req, res) => {
    const matches = req.scope.resolve(MatchRepo);   // singleton, shared
    const uow     = req.scope.resolve(UnitOfWork);  // this request's instance
    res.json(await matches.findFor(uow.currentUser()));
});

process.on('SIGTERM', async () => {
    server.close();
    await container.dispose(); // drains scopes, then closes the pool — LIFO
    process.exit(0);
});
```

Give `Uow` a `dispose()` method (or `[Symbol.dispose]` / `[Symbol.asyncDispose]`) and the container calls it automatically when its scope is disposed.

## Compile-time safety, concretely

All of these are **compile errors**, not runtime surprises:

```typescript
const url: string = container.resolve(DbUrlToken);        // ✅ typed by the token — no <T> cast

container.register(DbUrlToken, { useValue: 42 });          // ❌ number is not string
container.register(Db, { useClass: Database });            // ❌ deps required: ctor has parameters
container.register(Db, { useClass: Database, deps: [Db] });// ❌ ctor wants a string, not a Database
container.register(Db, { useClass: ConsoleLogger });       // ❌ ConsoleLogger doesn't implement Database
container.register(MailerToken, { useToken: DbUrlToken }); // ❌ alias target type mismatch
```

The library's own test suite asserts these with `@ts-expect-error`, so the guarantees can't silently regress.

## Async resolution in depth

`resolveAsync()` resolves any graph; `resolve()` handles the synchronous subset.

- **Mixed graphs just work.** A plain `useClass` service may depend on an async-registered token — resolve the whole thing with `resolveAsync()`.
- **In-flight memoization.** Concurrent `resolveAsync` calls for a singleton (or a scoped instance within one scope) share a single construction. This is what makes "warm up the container from three places at boot" safe.
- **Failures are not cached.** If an async factory throws (database briefly down), the next resolve retries instead of replaying the failure forever.
- **Parallel construction.** Independent async dependencies construct concurrently, so two pools boot in parallel, not back-to-back.
- **The boundary is explicit.** Calling `resolve()` on a graph containing an async node throws `AsyncResolutionRequiredError`, naming the async token and the path that reached it. Once an async singleton has settled, downstream sync resolution works again.

## Scopes and disposal

- `container.createScope()` creates an isolation unit; `scope.resolve()` / `scope.resolveAsync()` serve scoped instances from that scope, singletons from the root, transients fresh.
- Disposal recognizes `[Symbol.asyncDispose]`, `[Symbol.dispose]`, or a `dispose()` method — in that priority — and runs in **reverse creation order**, so dependents are disposed before their dependencies.
- `Scope` and `Container` both implement `Symbol.asyncDispose`:

```typescript
{
    await using scope = container.createScope();
    scope.resolve(RequestCtx);
} // disposed here, even on exceptions
```

- A failing disposer never blocks the rest; errors are collected and rethrown (as `AggregateError` when multiple).
- `dispose()` is idempotent; using a disposed container or scope throws `ContainerDisposedError`. Disposing a container first disposes its still-active scopes, and waits for in-flight async constructions so nothing leaks.
- **Captive dependency protection:** a `singleton` whose deps reach a `scoped` token throws `ScopedResolutionError` at resolution — the alternative (silently pinning one request's context inside an app-lifetime object) is one of the nastiest DI bugs to debug in production.

**Ownership rules** (deliberate, and worth knowing):
- `useValue` instances are never disposed — you created them, you own them.
- Transients are never tracked — tracking them in a long-lived container is an unbounded memory leak, so disposing a transient is the caller's job.

## Testing

No global state: every test gets a fresh container, and re-registering a token replaces it (last one wins, stale caches evicted) — which is exactly what overriding with a mock needs.

```typescript
function testContainer(overrides?: (c: Container) => void): Container {
    const c = buildContainer();
    c.register(Db, { useValue: fakePool }); // replace the real pool
    overrides?.(c);
    return c;
}
```

## API reference

```typescript
createToken<T>(description: string): Token<T>

class Container {
    register<T>(token: Token<T>, provider: Provider<T>): this
    resolve<T>(token: Token<T>): T
    resolveAsync<T>(token: Token<T>): Promise<T>
    has(token: Token<unknown>): boolean
    createScope(): Scope
    dispose(): Promise<void>            // also: await using
}

class Scope {
    resolve<T>(token: Token<T>): T
    resolveAsync<T>(token: Token<T>): Promise<T>
    has(token: Token<unknown>): boolean
    dispose(): Promise<void>            // also: await using
}

// Providers (lifetime: 'singleton' | 'scoped' | 'transient', default 'singleton')
{ useValue: T }
{ useClass: C, deps: [...tokens], lifetime? }
{ useFactory: (...deps) => T, deps: [...tokens], lifetime? }
{ useAsyncFactory: (...deps) => Promise<T>, deps: [...tokens], lifetime? }
{ useToken: Token<T> }
```

**Errors** (all extend `TypeWiredError`, all messages include the resolution path):

| Error | Thrown when |
|---|---|
| `UnregisteredTokenError` | resolving a token with no registration |
| `CircularDependencyError` | the dependency graph contains a cycle |
| `AsyncResolutionRequiredError` | `resolve()` reaches an async-registered or currently-constructing token |
| `ScopedResolutionError` | a scoped token is resolved without a scope, incl. singleton → scoped (captive dependency) |
| `ContainerDisposedError` | using a disposed container or scope |
| `InvalidProviderError` | a registration object matches no provider shape |

## Design decisions (FAQ)

**Why no decorators?** Decorator-based DI registers services as an import side effect, keys them by class name (breaks under minification), and needs `reflect-metadata` plus compiler flags. Explicit registration at a composition root is one file that shows your entire object graph, works under every bundler, and lets the type checker verify the wiring — which decorators fundamentally can't do for interfaces, since they're erased.

**Why is `singleton` the default lifetime?** Node services are long-lived processes where most dependencies (config, pools, clients, repositories) should be constructed once. Making the common case the default keeps registrations quiet; per-request state is an explicit `lifetime: 'scoped'`.

**Why does re-registration silently win?** With string keys, silent overwrite hides typo collisions. With symbol tokens, colliding by accident is impossible — re-registering is always deliberate, and it's the primitive that test overrides are built on.

**Why aren't transients disposed by the container?** Because the container can't know when you're done with one, tracking them means unbounded growth in a long-lived process. This is a documented footgun in other ecosystems; TypeWired picks the predictable rule instead.

## License

See [LICENSE](LICENSE).

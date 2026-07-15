import {
	Container,
	ContainerDisposedError,
	createToken,
	ScopedResolutionError,
} from '../../src';

class RequestContext {
	readonly items: string[] = [];
}

const CtxToken = createToken<RequestContext>('RequestContext');

describe('Scope', () => {
	let container: Container;

	beforeEach(() => {
		container = new Container();
	});

	describe('scoped lifetime', () => {
		it('caches one instance per scope and isolates scopes from each other', () => {
			container.register(CtxToken, { useClass: RequestContext, lifetime: 'scoped' });
			const scopeA = container.createScope();
			const scopeB = container.createScope();

			expect(scopeA.resolve(CtxToken)).toBe(scopeA.resolve(CtxToken));
			expect(scopeA.resolve(CtxToken)).not.toBe(scopeB.resolve(CtxToken));
		});

		it('shares singletons between the root and all scopes', () => {
			class Config {}
			const ConfigToken = createToken<Config>('Config');
			container.register(ConfigToken, { useClass: Config, lifetime: 'singleton' });
			const scope = container.createScope();

			expect(scope.resolve(ConfigToken)).toBe(container.resolve(ConfigToken));
		});

		it('creates transients fresh on every scope resolution', () => {
			class Job {}
			const JobToken = createToken<Job>('Job');
			container.register(JobToken, { useClass: Job, lifetime: 'transient' });
			const scope = container.createScope();

			expect(scope.resolve(JobToken)).not.toBe(scope.resolve(JobToken));
		});

		it('resolves scoped dependencies of transients from the same scope', () => {
			class Handler {
				constructor(public ctx: RequestContext) {}
			}
			const HandlerToken = createToken<Handler>('Handler');
			container.register(CtxToken, { useClass: RequestContext, lifetime: 'scoped' });
			container.register(HandlerToken, { useClass: Handler, deps: [CtxToken], lifetime: 'transient' });
			const scope = container.createScope();

			expect(scope.resolve(HandlerToken).ctx).toBe(scope.resolve(CtxToken));
		});

		it('throws when a scoped token is resolved from the root container', () => {
			container.register(CtxToken, { useClass: RequestContext, lifetime: 'scoped' });

			expect(() => container.resolve(CtxToken)).toThrow(ScopedResolutionError);
		});

		it('throws when a singleton captures a scoped dependency (captive dependency)', () => {
			class Cache {
				constructor(public ctx: RequestContext) {}
			}
			const CacheToken = createToken<Cache>('Cache');
			container.register(CtxToken, { useClass: RequestContext, lifetime: 'scoped' });
			container.register(CacheToken, { useClass: Cache, deps: [CtxToken], lifetime: 'singleton' });
			const scope = container.createScope();

			expect(() => scope.resolve(CacheToken)).toThrow(ScopedResolutionError);
			expect(() => scope.resolve(CacheToken)).toThrow('while resolving Cache → RequestContext');
		});

		it('evicts scoped caches when a token is re-registered', () => {
			container.register(CtxToken, { useClass: RequestContext, lifetime: 'scoped' });
			const scope = container.createScope();
			const first = scope.resolve(CtxToken);

			container.register(CtxToken, { useClass: RequestContext, lifetime: 'scoped' });

			expect(scope.resolve(CtxToken)).not.toBe(first);
		});
	});

	describe('disposal', () => {
		it('disposes scoped instances via dispose(), Symbol.dispose, and Symbol.asyncDispose', async () => {
			const disposed: string[] = [];
			class ByMethod {
				dispose() {
					disposed.push('method');
				}
			}
			class BySymbol {
				[Symbol.dispose]() {
					disposed.push('symbol');
				}
			}
			class ByAsyncSymbol {
				async [Symbol.asyncDispose]() {
					disposed.push('asyncSymbol');
				}
			}
			const a = createToken<ByMethod>('a');
			const b = createToken<BySymbol>('b');
			const c = createToken<ByAsyncSymbol>('c');
			container.register(a, { useClass: ByMethod, lifetime: 'scoped' });
			container.register(b, { useClass: BySymbol, lifetime: 'scoped' });
			container.register(c, { useClass: ByAsyncSymbol, lifetime: 'scoped' });

			const scope = container.createScope();
			scope.resolve(a);
			scope.resolve(b);
			scope.resolve(c);
			await scope.dispose();

			expect(disposed.sort()).toEqual(['asyncSymbol', 'method', 'symbol']);
		});

		it('disposes in reverse creation order (dependents before dependencies)', async () => {
			const order: string[] = [];
			class Dep {
				dispose() {
					order.push('dep');
				}
			}
			class Svc {
				constructor(public dep: Dep) {}
				dispose() {
					order.push('svc');
				}
			}
			const DepToken = createToken<Dep>('Dep');
			const SvcToken = createToken<Svc>('Svc');
			container.register(DepToken, { useClass: Dep, lifetime: 'scoped' });
			container.register(SvcToken, { useClass: Svc, deps: [DepToken], lifetime: 'scoped' });

			const scope = container.createScope();
			scope.resolve(SvcToken);
			await scope.dispose();

			expect(order).toEqual(['svc', 'dep']);
		});

		it('container.dispose() disposes active scopes first, then singletons, LIFO', async () => {
			const order: string[] = [];
			class Db {
				dispose() {
					order.push('db');
				}
			}
			class Repo {
				constructor(public db: Db) {}
				dispose() {
					order.push('repo');
				}
			}
			class Ctx {
				dispose() {
					order.push('ctx');
				}
			}
			const DbToken = createToken<Db>('Db');
			const RepoToken = createToken<Repo>('Repo');
			const ScopedCtx = createToken<Ctx>('Ctx');
			container.register(DbToken, { useClass: Db, lifetime: 'singleton' });
			container.register(RepoToken, { useClass: Repo, deps: [DbToken], lifetime: 'singleton' });
			container.register(ScopedCtx, { useClass: Ctx, lifetime: 'scoped' });

			const scope = container.createScope();
			container.resolve(RepoToken);
			scope.resolve(ScopedCtx);
			await container.dispose();

			expect(order).toEqual(['ctx', 'repo', 'db']);
		});

		it('does not dispose useValue instances or transients', async () => {
			const valueDispose = jest.fn();
			const transientDispose = jest.fn();
			class Worker {
				dispose = transientDispose;
			}
			const ValueToken = createToken<{ dispose: () => void }>('Value');
			const WorkerToken = createToken<Worker>('Worker');
			container.register(ValueToken, { useValue: { dispose: valueDispose } });
			container.register(WorkerToken, { useClass: Worker, lifetime: 'transient' });

			const scope = container.createScope();
			container.resolve(ValueToken);
			scope.resolve(WorkerToken);
			await container.dispose();

			expect(valueDispose).not.toHaveBeenCalled();
			expect(transientDispose).not.toHaveBeenCalled();
		});

		it('keeps disposing after a failing disposer and rethrows the error', async () => {
			const disposed: string[] = [];
			class Broken {
				dispose() {
					throw new Error('boom');
				}
			}
			class Fine {
				dispose() {
					disposed.push('fine');
				}
			}
			const BrokenToken = createToken<Broken>('Broken');
			const FineToken = createToken<Fine>('Fine');
			container.register(FineToken, { useClass: Fine, lifetime: 'scoped' });
			container.register(BrokenToken, { useClass: Broken, lifetime: 'scoped' });

			const scope = container.createScope();
			scope.resolve(FineToken);
			scope.resolve(BrokenToken);

			await expect(scope.dispose()).rejects.toThrow('boom');
			expect(disposed).toEqual(['fine']);
		});

		it('aggregates multiple disposal errors', async () => {
			class BrokenA {
				dispose() {
					throw new Error('a');
				}
			}
			class BrokenB {
				dispose() {
					throw new Error('b');
				}
			}
			const aToken = createToken<BrokenA>('BrokenA');
			const bToken = createToken<BrokenB>('BrokenB');
			container.register(aToken, { useClass: BrokenA, lifetime: 'scoped' });
			container.register(bToken, { useClass: BrokenB, lifetime: 'scoped' });

			const scope = container.createScope();
			scope.resolve(aToken);
			scope.resolve(bToken);

			await expect(scope.dispose()).rejects.toBeInstanceOf(AggregateError);
		});

		it('is idempotent and guards use after disposal', async () => {
			container.register(CtxToken, { useClass: RequestContext, lifetime: 'scoped' });
			const scope = container.createScope();
			scope.resolve(CtxToken);

			await scope.dispose();
			await expect(scope.dispose()).resolves.toBeUndefined();
			expect(() => scope.resolve(CtxToken)).toThrow(ContainerDisposedError);

			await container.dispose();
			await expect(container.dispose()).resolves.toBeUndefined();
			expect(() => container.resolve(CtxToken)).toThrow(ContainerDisposedError);
			expect(() => container.createScope()).toThrow(ContainerDisposedError);
			expect(() =>
				container.register(CtxToken, { useClass: RequestContext, lifetime: 'scoped' })
			).toThrow(ContainerDisposedError);
		});

		it('supports `await using` via Symbol.asyncDispose', async () => {
			const disposed = jest.fn();
			class Ctx {
				dispose = disposed;
			}
			const Token = createToken<Ctx>('Ctx');
			container.register(Token, { useClass: Ctx, lifetime: 'scoped' });

			{
				await using scope = container.createScope();
				scope.resolve(Token);
			}

			expect(disposed).toHaveBeenCalledTimes(1);
		});

		it('a disposed scope no longer participates in container disposal', async () => {
			const disposed = jest.fn();
			class Ctx {
				dispose = disposed;
			}
			const Token = createToken<Ctx>('Ctx');
			container.register(Token, { useClass: Ctx, lifetime: 'scoped' });

			const scope = container.createScope();
			scope.resolve(Token);
			await scope.dispose();
			await container.dispose();

			expect(disposed).toHaveBeenCalledTimes(1);
		});
	});
});

import {
	AsyncResolutionRequiredError,
	CircularDependencyError,
	Container,
	createToken,
	ScopedResolutionError,
} from '../../src';

class Database {
	closed = false;
	constructor(public readonly url: string) {}
	async close() {
		this.closed = true;
	}
	dispose() {
		this.closed = true;
	}
}

class UserRepo {
	constructor(public readonly db: Database) {}
}

const DbToken = createToken<Database>('Database');
const RepoToken = createToken<UserRepo>('UserRepo');

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

describe('async resolution', () => {
	let container: Container;

	beforeEach(() => {
		container = new Container();
	});

	it('resolves an async factory singleton', async () => {
		container.register(DbToken, {
			useAsyncFactory: async () => new Database('postgres://localhost'),
		});

		const db = await container.resolveAsync(DbToken);
		expect(db.url).toBe('postgres://localhost');
		expect(await container.resolveAsync(DbToken)).toBe(db);
	});

	it('resolves a mixed graph: sync class depending on an async dependency', async () => {
		container.register(DbToken, {
			useAsyncFactory: async () => new Database('postgres://localhost'),
		});
		container.register(RepoToken, { useClass: UserRepo, deps: [DbToken] });

		const repo = await container.resolveAsync(RepoToken);
		expect(repo.db).toBeInstanceOf(Database);
	});

	it('throws AsyncResolutionRequiredError when resolve() hits an async node', () => {
		container.register(DbToken, {
			useAsyncFactory: async () => new Database('postgres://localhost'),
		});
		container.register(RepoToken, { useClass: UserRepo, deps: [DbToken] });

		expect(() => container.resolve(DbToken)).toThrow(AsyncResolutionRequiredError);
		expect(() => container.resolve(RepoToken)).toThrow('while resolving UserRepo → Database');
	});

	it('allows resolve() for a sync token after its async construction settled', async () => {
		container.register(DbToken, {
			useAsyncFactory: async () => new Database('postgres://localhost'),
		});
		container.register(RepoToken, { useClass: UserRepo, deps: [DbToken] });

		const repo = await container.resolveAsync(RepoToken);
		expect(container.resolve(RepoToken)).toBe(repo);
	});

	it('memoizes in-flight singleton construction across concurrent resolves', async () => {
		let constructions = 0;
		const gate = deferred<void>();
		container.register(DbToken, {
			useAsyncFactory: async () => {
				constructions++;
				await gate.promise;
				return new Database('postgres://localhost');
			},
		});

		const [a, b, c] = [
			container.resolveAsync(DbToken),
			container.resolveAsync(DbToken),
			container.resolveAsync(DbToken),
		];
		gate.resolve();

		expect(await a).toBe(await b);
		expect(await b).toBe(await c);
		expect(constructions).toBe(1);
	});

	it('does not cache a failed construction — the next resolve retries', async () => {
		let attempts = 0;
		container.register(DbToken, {
			useAsyncFactory: async () => {
				attempts++;
				if (attempts === 1) {
					throw new Error('connection refused');
				}
				return new Database('postgres://localhost');
			},
		});

		await expect(container.resolveAsync(DbToken)).rejects.toThrow('connection refused');
		await expect(container.resolveAsync(DbToken)).resolves.toBeInstanceOf(Database);
		expect(attempts).toBe(2);
	});

	it('constructs async transients on every resolve', async () => {
		let constructions = 0;
		container.register(DbToken, {
			useAsyncFactory: async () => {
				constructions++;
				return new Database('postgres://localhost');
			},
			lifetime: 'transient',
		});

		const a = await container.resolveAsync(DbToken);
		const b = await container.resolveAsync(DbToken);
		expect(a).not.toBe(b);
		expect(constructions).toBe(2);
	});

	it('detects cycles in the async path', async () => {
		const AToken = createToken<unknown>('A');
		const BToken = createToken<unknown>('B');
		container.register(AToken, { useAsyncFactory: async (b: unknown) => ({ b }), deps: [BToken] });
		container.register(BToken, { useAsyncFactory: async (a: unknown) => ({ a }), deps: [AToken] });

		await expect(container.resolveAsync(AToken)).rejects.toThrow(CircularDependencyError);
	});

	describe('scoped async', () => {
		it('memoizes per scope and isolates scopes', async () => {
			let constructions = 0;
			container.register(DbToken, {
				useAsyncFactory: async () => {
					constructions++;
					return new Database('postgres://localhost');
				},
				lifetime: 'scoped',
			});
			const scopeA = container.createScope();
			const scopeB = container.createScope();

			const [a1, a2] = await Promise.all([
				scopeA.resolveAsync(DbToken),
				scopeA.resolveAsync(DbToken),
			]);
			const b = await scopeB.resolveAsync(DbToken);

			expect(a1).toBe(a2);
			expect(a1).not.toBe(b);
			expect(constructions).toBe(2);
		});

		it('enforces the captive dependency rule in the async path', async () => {
			class Cache {
				constructor(public db: Database) {}
			}
			const CacheToken = createToken<Cache>('Cache');
			container.register(DbToken, {
				useAsyncFactory: async () => new Database('x'),
				lifetime: 'scoped',
			});
			container.register(CacheToken, { useClass: Cache, deps: [DbToken], lifetime: 'singleton' });
			const scope = container.createScope();

			await expect(scope.resolveAsync(CacheToken)).rejects.toThrow(ScopedResolutionError);
			await expect(container.resolveAsync(DbToken)).rejects.toThrow(ScopedResolutionError);
		});
	});

	describe('disposal interplay', () => {
		it('container.dispose() waits for in-flight constructions and disposes them', async () => {
			const gate = deferred<void>();
			container.register(DbToken, {
				useAsyncFactory: async () => {
					await gate.promise;
					return new Database('postgres://localhost');
				},
			});

			const resolving = container.resolveAsync(DbToken);
			const disposing = container.dispose();
			gate.resolve();
			const [db] = await Promise.all([resolving, disposing]);

			expect(db.closed).toBe(true);
		});

		it('scope.dispose() waits for in-flight scoped constructions and disposes them', async () => {
			const gate = deferred<void>();
			container.register(DbToken, {
				useAsyncFactory: async () => {
					await gate.promise;
					return new Database('postgres://localhost');
				},
				lifetime: 'scoped',
			});

			const scope = container.createScope();
			const resolving = scope.resolveAsync(DbToken);
			const disposing = scope.dispose();
			gate.resolve();
			const [db] = await Promise.all([resolving, disposing]);

			expect(db.closed).toBe(true);
		});
	});

	it('does not cache an instance whose token was re-registered mid-flight', async () => {
		const gate = deferred<void>();
		container.register(DbToken, {
			useAsyncFactory: async () => {
				await gate.promise;
				return new Database('old');
			},
		});

		const oldResolve = container.resolveAsync(DbToken);
		container.register(DbToken, { useAsyncFactory: async () => new Database('new') });
		gate.resolve();

		expect((await oldResolve).url).toBe('old');
		expect((await container.resolveAsync(DbToken)).url).toBe('new');
	});

	it('type-checks async factories', async () => {
		container.register(DbToken, {
			// @ts-expect-error — async factory must resolve to the token's type
			useAsyncFactory: async () => 42,
		});
		container.register(RepoToken, {
			useAsyncFactory: async (db: number) => new UserRepo(db as never),
			// @ts-expect-error — deps tuple must match the factory's arguments
			deps: [DbToken],
		});
	});
});

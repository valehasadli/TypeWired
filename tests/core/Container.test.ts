import {
	CircularDependencyError,
	Container,
	createToken,
	UnregisteredTokenError,
} from '../../src';

interface ILogger {
	log(message: string): void;
}

class ConsoleLogger implements ILogger {
	messages: string[] = [];
	log(message: string) {
		this.messages.push(message);
	}
}

class Database {
	constructor(public readonly url: string) {}
}

class UserRepo {
	constructor(public readonly db: Database, public readonly logger: ILogger) {}
}

const LoggerToken = createToken<ILogger>('ILogger');
const DbUrlToken = createToken<string>('DbUrl');
const DbToken = createToken<Database>('Database');
const UserRepoToken = createToken<UserRepo>('UserRepo');

describe('Container (v1 core)', () => {
	let container: Container;

	beforeEach(() => {
		container = new Container();
	});

	it('resolves a value provider', () => {
		container.register(DbUrlToken, { useValue: 'postgres://localhost' });
		expect(container.resolve(DbUrlToken)).toBe('postgres://localhost');
	});

	it('resolves a class provider with dependencies', () => {
		container.register(DbUrlToken, { useValue: 'postgres://localhost' });
		container.register(DbToken, { useClass: Database, deps: [DbUrlToken] });
		container.register(LoggerToken, { useClass: ConsoleLogger });
		container.register(UserRepoToken, { useClass: UserRepo, deps: [DbToken, LoggerToken] });

		const repo = container.resolve(UserRepoToken);
		expect(repo).toBeInstanceOf(UserRepo);
		expect(repo.db.url).toBe('postgres://localhost');
		expect(repo.logger).toBeInstanceOf(ConsoleLogger);
	});

	it('does not require registration order to follow the dependency graph', () => {
		container.register(UserRepoToken, { useClass: UserRepo, deps: [DbToken, LoggerToken] });
		container.register(LoggerToken, { useClass: ConsoleLogger });
		container.register(DbToken, { useClass: Database, deps: [DbUrlToken] });
		container.register(DbUrlToken, { useValue: 'postgres://localhost' });

		expect(container.resolve(UserRepoToken)).toBeInstanceOf(UserRepo);
	});

	it('is lazy: nothing is constructed at registration time', () => {
		let constructed = 0;
		container.register(LoggerToken, {
			useFactory: () => {
				constructed++;
				return new ConsoleLogger();
			},
		});

		expect(constructed).toBe(0);
		container.resolve(LoggerToken);
		expect(constructed).toBe(1);
	});

	it('caches singletons and re-instantiates transients', () => {
		container.register(LoggerToken, { useClass: ConsoleLogger, lifetime: 'singleton' });
		expect(container.resolve(LoggerToken)).toBe(container.resolve(LoggerToken));

		container.register(LoggerToken, { useClass: ConsoleLogger, lifetime: 'transient' });
		expect(container.resolve(LoggerToken)).not.toBe(container.resolve(LoggerToken));
	});

	it('defaults to singleton lifetime', () => {
		container.register(LoggerToken, { useClass: ConsoleLogger });
		expect(container.resolve(LoggerToken)).toBe(container.resolve(LoggerToken));
	});

	it('resolves a factory provider with dependencies', () => {
		container.register(DbUrlToken, { useValue: 'postgres://localhost' });
		container.register(DbToken, { useFactory: (url: string) => new Database(url), deps: [DbUrlToken] });

		expect(container.resolve(DbToken).url).toBe('postgres://localhost');
	});

	it('resolves an alias (interface → implementation indirection)', () => {
		const ConcreteToken = createToken<ConsoleLogger>('ConsoleLogger');
		container.register(ConcreteToken, { useClass: ConsoleLogger });
		container.register(LoggerToken, { useToken: ConcreteToken });

		expect(container.resolve(LoggerToken)).toBe(container.resolve(ConcreteToken));
	});

	it('lets the last registration win and evicts the stale singleton', () => {
		container.register(DbUrlToken, { useValue: 'first' });
		container.register(LoggerToken, { useClass: ConsoleLogger });
		const first = container.resolve(LoggerToken);

		container.register(DbUrlToken, { useValue: 'second' });
		container.register(LoggerToken, { useFactory: () => new ConsoleLogger() });

		expect(container.resolve(DbUrlToken)).toBe('second');
		expect(container.resolve(LoggerToken)).not.toBe(first);
	});

	it('throws UnregisteredTokenError with the resolution path', () => {
		container.register(DbToken, { useClass: Database, deps: [DbUrlToken] });

		expect(() => container.resolve(DbUrlToken)).toThrow(UnregisteredTokenError);
		expect(() => container.resolve(DbToken)).toThrow(
			'No registration found for token "DbUrl" (while resolving Database → DbUrl)'
		);
	});

	it('detects circular dependencies and reports the chain', () => {
		class A { constructor(public b: unknown) {} }
		class B { constructor(public a: unknown) {} }
		const AToken = createToken<A>('A');
		const BToken = createToken<B>('B');

		container.register(AToken, { useClass: A, deps: [BToken] });
		container.register(BToken, { useClass: B, deps: [AToken] });

		expect(() => container.resolve(AToken)).toThrow(CircularDependencyError);
		expect(() => container.resolve(AToken)).toThrow('Circular dependency detected: A → B → A');
	});

	it('detects alias cycles', () => {
		const XToken = createToken<ILogger>('X');
		const YToken = createToken<ILogger>('Y');
		container.register(XToken, { useToken: YToken });
		container.register(YToken, { useToken: XToken });

		expect(() => container.resolve(XToken)).toThrow(CircularDependencyError);
	});

	it('reports has() from its own registrations', () => {
		expect(container.has(LoggerToken)).toBe(false);
		container.register(LoggerToken, { useClass: ConsoleLogger });
		expect(container.has(LoggerToken)).toBe(true);
	});

	it('isolates instances between containers', () => {
		const other = new Container();
		container.register(LoggerToken, { useClass: ConsoleLogger });
		other.register(LoggerToken, { useClass: ConsoleLogger });

		expect(container.resolve(LoggerToken)).not.toBe(other.resolve(LoggerToken));
	});

	it('distinguishes tokens with the same description', () => {
		const a = createToken<string>('same');
		const b = createToken<string>('same');
		container.register(a, { useValue: 'a' });
		container.register(b, { useValue: 'b' });

		expect(container.resolve(a)).toBe('a');
		expect(container.resolve(b)).toBe('b');
	});

	describe('compile-time safety', () => {
		it('rejects mismatched deps and untyped resolution', () => {
			// resolve() needs no type argument — the token carries the type.
			container.register(DbUrlToken, { useValue: 'postgres://localhost' });
			const url: string = container.resolve(DbUrlToken);
			expect(url).toBe('postgres://localhost');

			// @ts-expect-error — useValue must match the token's type
			container.register(DbUrlToken, { useValue: 42 });

			// @ts-expect-error — Database's constructor takes a string, not a Database
			container.register(DbToken, { useClass: Database, deps: [DbToken] });

			// @ts-expect-error — deps are required when the constructor has parameters
			container.register(DbToken, { useClass: Database });

			// @ts-expect-error — ConsoleLogger does not satisfy Token<Database>
			container.register(DbToken, { useClass: ConsoleLogger });

			// @ts-expect-error — alias target must be assignable to the token's type
			container.register(LoggerToken, { useToken: DbUrlToken });
		});
	});
});

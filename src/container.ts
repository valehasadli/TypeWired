import { Token } from './token';
import {
	AliasProvider,
	ClassProvider,
	FactoryProvider,
	Lifetime,
	Registration,
	ValueProvider,
} from './types';
import {
	CircularDependencyError,
	ContainerDisposedError,
	InvalidProviderError,
	ScopedResolutionError,
	UnregisteredTokenError,
} from './errors';
import { Scope } from './scope';
import { disposeInstances, throwDisposalErrors } from './disposal';

export class Container {
	private readonly registrations = new Map<symbol, Registration>();
	private readonly singletons = new Map<symbol, unknown>();
	// Instances this container created, in creation order; disposed in reverse.
	// useValue instances are never listed — the container does not own them.
	private readonly owned: unknown[] = [];
	private readonly scopes = new Set<Scope>();
	private disposed = false;

	register<T>(token: Token<T>, provider: ValueProvider<T>): this;
	register<T>(token: Token<T>, provider: AliasProvider<T>): this;
	register<T, C extends new (...args: never[]) => T>(token: Token<T>, provider: ClassProvider<T, C>): this;
	register<T, A extends readonly unknown[]>(token: Token<T>, provider: FactoryProvider<T, A>): this;
	register(token: Token<unknown>, provider: object): this {
		this.assertNotDisposed();
		this.registrations.set(token.id, Container.normalize(provider));
		// Re-registering a token must not serve a stale instance (last one wins).
		// An evicted singleton stays in `owned`, so it is still disposed later.
		this.singletons.delete(token.id);
		for (const scope of this.scopes) {
			scope.evict(token.id);
		}
		return this;
	}

	resolve<T>(token: Token<T>): T {
		this.assertNotDisposed();
		return this.resolveWithChain(token, [], undefined) as T;
	}

	has(token: Token<unknown>): boolean {
		return this.registrations.has(token.id);
	}

	createScope(): Scope {
		this.assertNotDisposed();
		const scope = new Scope(this, s => this.scopes.delete(s));
		this.scopes.add(scope);
		return scope;
	}

	/**
	 * Disposes every still-active scope, then every instance this container
	 * created, in reverse creation order. Idempotent: later calls are no-ops.
	 */
	async dispose(): Promise<void> {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		const errors: unknown[] = [];
		for (const scope of [...this.scopes].reverse()) {
			try {
				await scope.dispose();
			} catch (error) {
				errors.push(error);
			}
		}
		this.scopes.clear();
		errors.push(...(await disposeInstances(this.owned)));
		this.owned.length = 0;
		this.singletons.clear();
		throwDisposalErrors(errors);
	}

	async [Symbol.asyncDispose](): Promise<void> {
		return this.dispose();
	}

	/** @internal — entry point for Scope.resolve() */
	resolveInScope<T>(token: Token<T>, scope: Scope): T {
		this.assertNotDisposed();
		return this.resolveWithChain(token, [], scope) as T;
	}

	private assertNotDisposed(): void {
		if (this.disposed) {
			throw new ContainerDisposedError('container');
		}
	}

	private static normalize(provider: object): Registration {
		const p = provider as Record<string, unknown>;
		if ('useValue' in p) {
			return { kind: 'value', value: p['useValue'] };
		}
		if ('useToken' in p) {
			return { kind: 'alias', target: p['useToken'] as Token<unknown> };
		}
		const deps = (p['deps'] as readonly Token<unknown>[] | undefined) ?? [];
		const lifetime = (p['lifetime'] as Lifetime | undefined) ?? 'singleton';
		if ('useClass' in p) {
			const ctor = p['useClass'] as new (...args: unknown[]) => unknown;
			return { kind: 'instantiable', create: args => new ctor(...args), deps, lifetime };
		}
		if ('useFactory' in p) {
			const factory = p['useFactory'] as (...args: unknown[]) => unknown;
			return { kind: 'instantiable', create: args => factory(...args), deps, lifetime };
		}
		throw new InvalidProviderError();
	}

	private resolveWithChain(
		token: Token<unknown>,
		chain: readonly Token<unknown>[],
		scope: Scope | undefined
	): unknown {
		const registration = this.registrations.get(token.id);
		if (!registration) {
			throw new UnregisteredTokenError(token, chain);
		}
		if (chain.some(t => t.id === token.id)) {
			throw new CircularDependencyError([...chain, token]);
		}

		switch (registration.kind) {
			case 'value':
				return registration.value;
			case 'alias':
				return this.resolveWithChain(registration.target, [...chain, token], scope);
			case 'instantiable':
				return this.instantiate(token, registration, chain, scope);
		}
	}

	private instantiate(
		token: Token<unknown>,
		registration: Extract<Registration, { kind: 'instantiable' }>,
		chain: readonly Token<unknown>[],
		scope: Scope | undefined
	): unknown {
		const next = [...chain, token];

		switch (registration.lifetime) {
			case 'singleton': {
				if (this.singletons.has(token.id)) {
					return this.singletons.get(token.id);
				}
				// Singleton dependencies resolve without the scope: a singleton
				// outlives every scope, so capturing a scoped instance would be
				// a bug (captive dependency) — this makes it throw instead.
				const args = registration.deps.map(dep => this.resolveWithChain(dep, next, undefined));
				const instance = registration.create(args);
				this.singletons.set(token.id, instance);
				this.owned.push(instance);
				return instance;
			}
			case 'scoped': {
				if (!scope) {
					throw new ScopedResolutionError(token, chain);
				}
				if (scope.instances.has(token.id)) {
					return scope.instances.get(token.id);
				}
				const args = registration.deps.map(dep => this.resolveWithChain(dep, next, scope));
				const instance = registration.create(args);
				scope.instances.set(token.id, instance);
				scope.created.push(instance);
				return instance;
			}
			case 'transient': {
				// Transients are not tracked for disposal: the container cannot
				// know their lifetime, and tracking them would grow unboundedly.
				// Disposing a transient is the caller's responsibility.
				const args = registration.deps.map(dep => this.resolveWithChain(dep, next, scope));
				return registration.create(args);
			}
		}
	}
}

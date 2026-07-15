import type { Container } from './container';
import { Token } from './token';
import { ContainerDisposedError } from './errors';
import { disposeInstances, throwDisposalErrors } from './disposal';

/**
 * A resolution scope (e.g. one per HTTP request). Tokens registered with
 * `lifetime: 'scoped'` are cached here — one instance per scope — while
 * singletons delegate to the owning container. Disposing the scope disposes
 * every scoped instance it created, in reverse creation order.
 */
export class Scope {
	/** @internal — scoped instance cache, keyed by token id */
	readonly instances = new Map<symbol, unknown>();
	/** @internal — in-flight async scoped constructions */
	readonly promises = new Map<symbol, Promise<unknown>>();
	/** @internal — creation order; disposed in reverse */
	readonly created: unknown[] = [];
	private disposed = false;

	/** @internal — create scopes with container.createScope() */
	constructor(
		private readonly container: Container,
		private readonly onDisposed: (scope: Scope) => void
	) {}

	resolve<T>(token: Token<T>): T {
		if (this.disposed) {
			throw new ContainerDisposedError('scope');
		}
		return this.container.resolveInScope(token, this);
	}

	resolveAsync<T>(token: Token<T>): Promise<T> {
		if (this.disposed) {
			return Promise.reject(new ContainerDisposedError('scope'));
		}
		return this.container.resolveInScopeAsync(token, this);
	}

	has(token: Token<unknown>): boolean {
		return this.container.has(token);
	}

	/** @internal — drops a cached instance after its token is re-registered */
	evict(id: symbol): void {
		this.instances.delete(id);
		this.promises.delete(id);
	}

	async dispose(): Promise<void> {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		this.onDisposed(this);
		// Let in-flight async constructions settle so their instances land in
		// `created` and get disposed instead of leaking.
		await Promise.allSettled(this.promises.values());
		this.promises.clear();
		const errors = await disposeInstances(this.created);
		this.created.length = 0;
		this.instances.clear();
		throwDisposalErrors(errors);
	}

	async [Symbol.asyncDispose](): Promise<void> {
		return this.dispose();
	}
}

import { Token } from './token';

function formatChain(tokens: readonly Token<unknown>[]): string {
	return tokens.map(t => t.description).join(' → ');
}

export class TypeWiredError extends Error {
	constructor(message: string) {
		super(message);
		this.name = new.target.name;
	}
}

export class UnregisteredTokenError extends TypeWiredError {
	readonly token: Token<unknown>;

	constructor(token: Token<unknown>, chain: readonly Token<unknown>[]) {
		const path = chain.length > 0 ? ` (while resolving ${formatChain([...chain, token])})` : '';
		super(`No registration found for token "${token.description}"${path}`);
		this.token = token;
	}
}

export class CircularDependencyError extends TypeWiredError {
	readonly chain: readonly Token<unknown>[];

	constructor(chain: readonly Token<unknown>[]) {
		super(`Circular dependency detected: ${formatChain(chain)}`);
		this.chain = chain;
	}
}

export class InvalidProviderError extends TypeWiredError {
	constructor() {
		super('Invalid provider: expected one of useValue, useClass, useFactory, useToken');
	}
}

export class ScopedResolutionError extends TypeWiredError {
	readonly token: Token<unknown>;

	constructor(token: Token<unknown>, chain: readonly Token<unknown>[]) {
		const path = chain.length > 0 ? ` (while resolving ${formatChain([...chain, token])})` : '';
		super(
			`Cannot resolve scoped token "${token.description}" outside of a scope${path}. ` +
				'Create one with container.createScope(); note that singletons cannot depend on scoped services.'
		);
		this.token = token;
	}
}

export class AsyncResolutionRequiredError extends TypeWiredError {
	readonly token: Token<unknown>;

	constructor(token: Token<unknown>, chain: readonly Token<unknown>[]) {
		const path = chain.length > 0 ? ` (while resolving ${formatChain([...chain, token])})` : '';
		super(
			`Token "${token.description}" requires asynchronous resolution${path}. ` +
				'It is registered with useAsyncFactory or is currently being constructed asynchronously; use resolveAsync().'
		);
		this.token = token;
	}
}

export class ContainerDisposedError extends TypeWiredError {
	constructor(what: 'container' | 'scope') {
		super(`Cannot use a disposed ${what}`);
	}
}

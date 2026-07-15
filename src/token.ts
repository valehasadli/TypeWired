declare const TYPE: unique symbol;

/**
 * A typed injection token. `T` exists only at compile time (the phantom
 * property is never set at runtime); the `symbol` id guarantees two tokens
 * can never collide, even if they share a description.
 */
export interface Token<T> {
	readonly id: symbol;
	readonly description: string;
	readonly [TYPE]?: T;
}

export function createToken<T>(description: string): Token<T> {
	return Object.freeze({ id: Symbol(description), description });
}

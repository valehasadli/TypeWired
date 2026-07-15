import { Token } from './token';

export type Lifetime = 'singleton' | 'scoped' | 'transient';

/** Maps a parameter tuple to the tuple of tokens that provides it. */
export type TokensFor<Args extends readonly unknown[]> = {
	[K in keyof Args]: Token<Args[K]>;
};

/** `deps` may be omitted only when the constructor/factory takes no arguments. */
type DepsFor<Args extends readonly unknown[]> = Args extends readonly []
	? { readonly deps?: readonly [] }
	: { readonly deps: TokensFor<Args> };

export type ValueProvider<T> = {
	readonly useValue: T;
};

export type AliasProvider<T> = {
	readonly useToken: Token<T>;
};

export type ClassProvider<T, C extends new (...args: never[]) => T> = {
	readonly useClass: C;
	readonly lifetime?: Lifetime;
} & DepsFor<ConstructorParameters<C>>;

export type FactoryProvider<T, A extends readonly unknown[]> = {
	readonly useFactory: (...args: A) => T;
	readonly lifetime?: Lifetime;
} & DepsFor<A>;

export type AsyncFactoryProvider<T, A extends readonly unknown[]> = {
	readonly useAsyncFactory: (...args: A) => Promise<T>;
	readonly lifetime?: Lifetime;
} & DepsFor<A>;

/** Normalized internal form; class and factory providers collapse into `instantiable`. */
export type Registration =
	| { readonly kind: 'value'; readonly value: unknown }
	| { readonly kind: 'alias'; readonly target: Token<unknown> }
	| {
			readonly kind: 'instantiable';
			readonly create: (args: readonly unknown[]) => unknown;
			readonly deps: readonly Token<unknown>[];
			readonly lifetime: Lifetime;
			readonly isAsync: boolean;
	  };

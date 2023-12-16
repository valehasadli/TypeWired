import Container, { Constructor, INTERFACE_TOKENS } from '../container/Container';

// Decorator for registering a class as a singleton
export function InjectableSingleton(...dependencies: string[]) {
	return function <T>(constructor: Constructor<T>) {
		Container.registerSingleton(constructor.name, constructor, dependencies);
	};
}

// Decorator for registering a class as a transient (non-singleton)
export function InjectableTransient(...dependencies: string[]) {
	return function <T>(constructor: Constructor<T>) {
		Container.registerTransient(constructor.name, constructor, dependencies);
	};
}

// Decorator for registering a class as an implementation of an interface
export function InjectableInterface(token: symbol, ...dependencies: string[]) {
	return function <T>(constructor: Constructor<T>) {
		Container.registerInterface(token, constructor, dependencies);
	};
}

import Container, { Constructor } from '../container/Container';

// Decorator for registering a class as a singleton
export function InjectableSingleton(...dependencies: string[]) {
	return function <T>(constructor: Constructor<T>) {
		Container.registerSingleton(constructor.name, constructor, dependencies);
	};
}

// Decorator for registering a class as async singleton
export function InjectableSingletonAsync(...dependencies: string[]) {
	return function <T>(constructor: Constructor<T>) {
		// Register the constructor along with its dependencies for later asynchronous resolution
		Container.registerSingletonAsync(constructor.name, constructor, dependencies);
	};
}

// Decorator for registering a class as a transient (non-singleton)
export function InjectableTransient(...dependencies: string[]) {
	return function <T>(constructor: Constructor<T>) {
		Container.registerTransient(constructor.name, constructor, dependencies);
	};
}

// Decorator for registering a class as async transient (non-singleton)
export function InjectableTransientAsync(...dependencies: string[]) {
	return function <T>(constructor: Constructor<T>) {
		// Register the constructor along with its dependencies for later asynchronous resolution
		Container.registerTransientAsync(constructor.name, constructor, dependencies);
	};
}

// Decorator for registering a class as an implementation of an interface
export function InjectableInterface(token: symbol, ...dependencies: string[]) {
	return function <T>(constructor: Constructor<T>) {
		Container.registerInterface(token, constructor, dependencies);
	};
}

// Decorator for registering a class as an implementation of an async interface
export function InjectableInterfaceAsync(token: symbol, ...dependencies: string[]) {
	return function <T>(constructor: Constructor<T>) {
		// Register the constructor along with its dependencies for later asynchronous resolution
		Container.registerInterfaceAsync(token, constructor, dependencies);
	};
}

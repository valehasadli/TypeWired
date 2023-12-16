export type Constructor<T = any> = new (...args: any[]) => T;

export const INTERFACE_TOKENS = {
	IExampleInterface: Symbol.for('IExampleInterface'),
	// ... other interface tokens
};

class Container {
	private static singletons = new Map<string | symbol, any>();
	private static transientConstructors = new Map<string, Constructor>();
	private static dependencies = new Map<string | symbol, string[]>();

	static registerSingleton<T>(className: string | symbol, constructor: Constructor<T>, deps: string[] = []) {
		const instance = new constructor(...deps.map(dep => Container.resolve(dep)));
		Container.singletons.set(className, instance);
	}

	static registerTransient<T>(className: string, constructor: Constructor<T>, deps: string[] = []) {
		Container.transientConstructors.set(className, constructor);
		Container.dependencies.set(className, deps);
	}

	static registerInterface<T>(token: symbol, constructor: Constructor<T>, deps: string[] = []) {
		const instance = new constructor(...deps.map(dep => Container.resolve(dep)));
		Container.singletons.set(token, instance); // Interfaces could be singletons by default
	}

	static resolveSingleton<T>(className: string | symbol): T {
		const instance = Container.singletons.get(className);
		if (!instance) {
			throw new Error(`No singleton instance found for ${className.toString()}`);
		}
		return instance as T;
	}

	static resolveTransient<T>(className: string): T {
		const constructor = Container.transientConstructors.get(className);
		if (!constructor) {
			throw new Error(`No transient constructor found for ${className}`);
		}
		const dependencies = (Container.dependencies.get(className) || []).map(dep => Container.resolve(dep));
		return new constructor(...dependencies) as T;
	}

	static resolveInterface<T>(token: symbol): T {
		const instance = Container.singletons.get(token);
		if (!instance) {
			throw new Error(`No instance found for interface token ${String(token)}`);
		}
		return instance as T;
	}

	private static resolve(dep: string): any {
		const singleton = Container.singletons.get(dep);
		if (singleton) {
			return singleton;
		}

		const constructor = Container.transientConstructors.get(dep);
		if (constructor) {
			const dependencies = (Container.dependencies.get(dep) || []).map(innerDep => Container.resolve(innerDep));
			return new constructor(...dependencies);
		}

		throw new Error(`Dependency ${dep} not found`);
	}

	static clear() {
		Container.singletons.clear();
		Container.transientConstructors.clear();
		Container.dependencies.clear();
	}
}

export default Container;

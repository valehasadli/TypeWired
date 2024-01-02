export type Constructor<T = any> = new (...args: any[]) => T;

class Container {
	private static singletons = new Map<string | symbol, any>();
	private static transientConstructors = new Map<string, Constructor>();
	private static dependencies = new Map<string | symbol, string[]>();

	static registerSingleton<T>(className: string | symbol, constructor: Constructor<T>, deps: string[] = []) {
		const instance = new constructor(...deps.map(dep => Container.resolve(dep)));
		Container.singletons.set(className, instance);
	}

	static resolveSingleton<T>(className: string | symbol): T {
		const instance = Container.singletons.get(className);
		if (!instance) {
			throw new Error(`No singleton instance found for ${className.toString()}`);
		}
		return instance as T;
	}

	static async registerSingletonAsync<T>(token: string | symbol, constructor: Constructor<T>, deps: string[] = []): Promise<void> {
		const instances = await Promise.all(deps.map(dep => Container.resolveAsync(dep)));
		const instance = new constructor(...instances);
		Container.singletons.set(token, instance);
	}

	static async resolveSingletonAsync<T>(token: string | symbol): Promise<T> {
		if (!Container.singletons.has(token)) {
			throw new Error(`No singleton instance found for ${token.toString()}`);
		}
		return Container.singletons.get(token) as T;
	}

	static registerTransient<T>(className: string, constructor: Constructor<T>, deps: string[] = []) {
		Container.transientConstructors.set(className, constructor);
		Container.dependencies.set(className, deps);
	}

	static resolveTransient<T>(className: string): T {
		const constructor = Container.transientConstructors.get(className);
		if (!constructor) {
			throw new Error(`No transient constructor found for ${className}`);
		}
		const dependencies = (Container.dependencies.get(className) || []).map(dep => Container.resolve(dep));
		return new constructor(...dependencies) as T;
	}

	static async registerTransientAsync<T>(token: string, constructor: Constructor<T>, deps: string[] = []): Promise<void> {
		Container.transientConstructors.set(token, constructor);
		Container.dependencies.set(token, deps);
	}

	static async resolveTransientAsync<T>(token: string): Promise<T> {
		const constructor = Container.transientConstructors.get(token);
		if (!constructor) {
			throw new Error(`No transient constructor found for ${token}`);
		}
		const instances = await Promise.all((Container.dependencies.get(token) || []).map(dep => Container.resolveAsync(dep)));
		return new constructor(...instances) as T;
	}

	static registerInterface<T>(token: symbol, constructor: Constructor<T>, deps: string[] = []) {
		const instance = new constructor(...deps.map(dep => Container.resolve(dep)));
		Container.singletons.set(token, instance); // Interfaces could be singletons by default
	}

	static resolveInterface<T>(token: symbol): T {
		const instance = Container.singletons.get(token);
		if (!instance) {
			throw new Error(`No instance found for interface token ${String(token)}`);
		}
		return instance as T;
	}

	static async registerInterfaceAsync<T>(token: symbol, constructor: Constructor<T>, deps: string[] = []): Promise<void> {
		const instances = await Promise.all(deps.map(dep => Container.resolveAsync(dep)));
		const instance = new constructor(...instances);
		Container.singletons.set(token, instance); // Interfaces could be singletons by default
	}

	static async resolveInterfaceAsync<T>(token: symbol): Promise<T> {
		if (!Container.singletons.has(token)) {
			throw new Error(`No instance found for interface token ${token.toString()}`);
		}
		return Container.singletons.get(token) as T;
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

	static async resolveAsync<T>(token: string | symbol): Promise<T> {
		if (typeof token === 'string' && Container.transientConstructors.has(token)) {
			return this.resolveTransientAsync(token);
		} else if (Container.singletons.has(token)) {
			return this.resolveSingletonAsync(token);
		} else {
			throw new Error(`No resolver found for ${token.toString()}`);
		}
	}

	static clear() {
		Container.singletons.clear();
		Container.transientConstructors.clear();
		Container.dependencies.clear();
	}
}

export default Container;

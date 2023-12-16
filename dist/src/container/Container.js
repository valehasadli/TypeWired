"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Container {
    static registerSingleton(className, constructor, deps = []) {
        const instance = new constructor(...deps.map(dep => Container.resolve(dep)));
        Container.singletons.set(className, instance);
    }
    static registerTransient(className, constructor, deps = []) {
        Container.transientConstructors.set(className, constructor);
        Container.dependencies.set(className, deps);
    }
    static registerInterface(token, constructor, deps = []) {
        const instance = new constructor(...deps.map(dep => Container.resolve(dep)));
        Container.singletons.set(token, instance); // Interfaces could be singletons by default
    }
    static resolveSingleton(className) {
        const instance = Container.singletons.get(className);
        if (!instance) {
            throw new Error(`No singleton instance found for ${className.toString()}`);
        }
        return instance;
    }
    static resolveTransient(className) {
        const constructor = Container.transientConstructors.get(className);
        if (!constructor) {
            throw new Error(`No transient constructor found for ${className}`);
        }
        const dependencies = (Container.dependencies.get(className) || []).map(dep => Container.resolve(dep));
        return new constructor(...dependencies);
    }
    static resolveInterface(token) {
        const instance = Container.singletons.get(token);
        if (!instance) {
            throw new Error(`No instance found for interface token ${String(token)}`);
        }
        return instance;
    }
    static resolve(dep) {
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
Container.singletons = new Map();
Container.transientConstructors = new Map();
Container.dependencies = new Map();
exports.default = Container;

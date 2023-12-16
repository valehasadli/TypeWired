"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Container_1 = __importDefault(require("../../src/container/Container"));
const INTERFACE_TOKENS = {
    IExampleInterface: Symbol.for('IExampleInterface'),
    // ... other interface tokens
};
class DependencyService {
    constructor() {
        this.value = 'dependency';
    }
}
class ExampleService {
    constructor(dependency) {
        this.dependency = dependency;
    }
}
class ExampleInterfaceImplementation {
    constructor() {
        this.value = 'example interface implementation';
    }
}
describe('Container', () => {
    beforeEach(() => {
        Container_1.default.clear();
    });
    it('should correctly register and resolve a singleton', () => {
        Container_1.default.registerSingleton('DependencyService', DependencyService);
        Container_1.default.registerSingleton('ExampleService', ExampleService, ['DependencyService']);
        const instance1 = Container_1.default.resolveSingleton('ExampleService');
        const instance2 = Container_1.default.resolveSingleton('ExampleService');
        expect(instance1).toBeInstanceOf(ExampleService);
        expect(instance1).toBe(instance2); // Same instance (singleton)
        expect(instance1.dependency).toBeInstanceOf(DependencyService);
    });
    it('should correctly register and resolve a transient', () => {
        Container_1.default.registerTransient('DependencyService', DependencyService);
        Container_1.default.registerTransient('ExampleService', ExampleService, ['DependencyService']);
        const instance1 = Container_1.default.resolveTransient('ExampleService');
        const instance2 = Container_1.default.resolveTransient('ExampleService');
        expect(instance1).toBeInstanceOf(ExampleService);
        expect(instance1).not.toBe(instance2); // Different instances (transient)
        expect(instance1.dependency).toBeInstanceOf(DependencyService);
        expect(instance1.dependency).not.toBe(instance2.dependency); // Different dependency instances
    });
    it('should correctly register and resolve an interface implementation', () => {
        Container_1.default.registerInterface(INTERFACE_TOKENS.IExampleInterface, ExampleInterfaceImplementation);
        const interfaceInstance = Container_1.default.resolveInterface(INTERFACE_TOKENS.IExampleInterface);
        expect(interfaceInstance).toBeInstanceOf(ExampleInterfaceImplementation);
        expect(interfaceInstance.value).toBe('example interface implementation');
    });
    it('should throw an error for unregistered classes and interfaces', () => {
        expect(() => {
            Container_1.default.resolveSingleton('NonExistentService');
        }).toThrow();
        expect(() => {
            Container_1.default.resolveTransient('NonExistentService');
        }).toThrow();
        expect(() => {
            Container_1.default.resolveInterface(Symbol.for('NonExistentInterface'));
        }).toThrow();
    });
});

"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const Container_1 = __importStar(require("../../src/container/Container"));
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
        Container_1.default.registerInterface(Container_1.INTERFACE_TOKENS.IExampleInterface, ExampleInterfaceImplementation);
        const interfaceInstance = Container_1.default.resolveInterface(Container_1.INTERFACE_TOKENS.IExampleInterface);
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

import Container from "../../src/container/Container";

const INTERFACE_TOKENS = {
	IExampleInterface: Symbol.for('IExampleInterface'),
	// ... other interface tokens
};

// Mock classes and interfaces for testing
interface IExampleInterface {
	value: string;
}

class DependencyService {
	value = 'dependency';
}

class ExampleService {
	constructor(public dependency: DependencyService) {}
}

class ExampleInterfaceImplementation implements IExampleInterface {
	value = 'example interface implementation';
}

describe('Container', () => {
	beforeEach(() => {
		Container.clear();
	});

	it('should correctly register and resolve a singleton', () => {
		Container.registerSingleton('DependencyService', DependencyService);
		Container.registerSingleton('ExampleService', ExampleService, ['DependencyService']);

		const instance1 = Container.resolveSingleton<ExampleService>('ExampleService');
		const instance2 = Container.resolveSingleton<ExampleService>('ExampleService');

		expect(instance1).toBeInstanceOf(ExampleService);
		expect(instance1).toBe(instance2); // Same instance (singleton)
		expect(instance1.dependency).toBeInstanceOf(DependencyService);
	});

	it('should correctly register and resolve a transient', () => {
		Container.registerTransient('DependencyService', DependencyService);
		Container.registerTransient('ExampleService', ExampleService, ['DependencyService']);

		const instance1 = Container.resolveTransient<ExampleService>('ExampleService');
		const instance2 = Container.resolveTransient<ExampleService>('ExampleService');

		expect(instance1).toBeInstanceOf(ExampleService);
		expect(instance1).not.toBe(instance2); // Different instances (transient)
		expect(instance1.dependency).toBeInstanceOf(DependencyService);
		expect(instance1.dependency).not.toBe(instance2.dependency); // Different dependency instances
	});

	it('should correctly register and resolve an interface implementation', () => {
		Container.registerInterface(INTERFACE_TOKENS.IExampleInterface, ExampleInterfaceImplementation);

		const interfaceInstance = Container.resolveInterface<IExampleInterface>(INTERFACE_TOKENS.IExampleInterface);

		expect(interfaceInstance).toBeInstanceOf(ExampleInterfaceImplementation);
		expect(interfaceInstance.value).toBe('example interface implementation');
	});

	it('should throw an error for unregistered classes and interfaces', () => {
		expect(() => {
			Container.resolveSingleton('NonExistentService');
		}).toThrow();

		expect(() => {
			Container.resolveTransient('NonExistentService');
		}).toThrow();

		expect(() => {
			Container.resolveInterface<IExampleInterface>(Symbol.for('NonExistentInterface'));
		}).toThrow();
	});
});

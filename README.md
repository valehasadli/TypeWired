## TypeWired

TypeWired is a TypeScript library providing powerful and flexible dependency injection (DI) akin to the Spring framework for Java. It allows easy management of dependencies in TypeScript applications, enabling cleaner and more maintainable codebases.

Features
- **Spring-Like DI:** Familiar DI experience for those accustomed to Java Spring.
- **Singleton, Transient, and Interface Registrations:** Manage the lifecycle of your services easily with both synchronous and asynchronous options.
- **Decorators:** Streamline the registration of services and interfaces with both sync and async decorators.
- **Type Safety:** Fully leverage TypeScript's type system for safer code.
- **Asynchronous Support:** Register and resolve dependencies that require asynchronous operations, such as database connections or HTTP requests.

### Installation
Install `typewired` using npm or yarn:

```bash
npm install typewired
# or
yarn add typewired
```

### Basic Usage

### Example 1: Interface Injection

**Defining an Interface and its Implementation**

```typescript
// ILoggerService.ts
export interface ILoggerService {
    log(message: string): void;
}

// ConsoleLoggerService.ts
import { ILoggerService } from './ILoggerService';

export class ConsoleLoggerService implements ILoggerService {
    log(message: string) {
        console.log(message);
    }
}
```
**Registering and Resolving the Interface**

```typescript
import { Container } from 'typewired';
import { ILoggerService } from './ILoggerService';
import { ConsoleLoggerService } from './ConsoleLoggerService';

const LOGGER_SERVICE_TOKEN = Symbol.for('ILoggerService');

// Registering the interface with its implementation
Container.registerInterface(LOGGER_SERVICE_TOKEN, ConsoleLoggerService);

// Resolving the interface
const loggerService = Container.resolveInterface<ILoggerService>(LOGGER_SERVICE_TOKEN);
loggerService.log('This is an interface injection example.');
```

### Example 2: Singleton Injection

Singletons are instantiated once, and the same instance is reused across the application.

**Defining a Singleton Service**

```typescript
// AuthService.ts
export class AuthService {
    private user: string | null = null;

    login(user: string) {
        this.user = user;
        console.log(`User ${user} logged in`);
    }

    getCurrentUser() {
        return this.user;
    }
}
```

**Registering and Resolving the Singleton**

```typescript
import { Container } from 'typewired';
import { AuthService } from './AuthService';

// Registering the singleton
Container.registerSingleton('AuthService', AuthService);

// Resolving the singleton
const authService1 = Container.resolveSingleton<AuthService>('AuthService');
authService1.login('Alice');

const authService2 = Container.resolveSingleton<AuthService>('AuthService');
console.log('Current user:', authService2.getCurrentUser()); // Output: Alice
```

### Example 3: Transient Injection

Transients are re-instantiated every time they are resolved, providing a new instance.

**Defining a Transient Service**

```typescript
// RequestService.ts
export class RequestService {
    private requestId: number;

    constructor() {
        this.requestId = Math.floor(Math.random() * 1000);
    }

    getRequestID() {
        return this.requestId;
    }
}
```

**Registering and Resolving the Transient**

```typescript
import { Container } from 'typewired';
import { RequestService } from './RequestService';

// Registering the transient
Container.registerTransient('RequestService', RequestService);

// Resolving the transient
const requestService1 = Container.resolveTransient<RequestService>('RequestService');
console.log('Request ID 1:', requestService1.getRequestID());

const requestService2 = Container.resolveTransient<RequestService>('RequestService');
console.log('Request ID 2:', requestService2.getRequestID()); // Output will be different
```

**Asynchronous Dependency Injection**

New examples demonstrating asynchronous injection will be provided to showcase how you can deal with dependencies that require async operations during their construction.

### Example 4: Asynchronous Singleton Injection

Defining an Async Singleton Service

```typescript
// ConfigService.ts
export class ConfigService {
    private config: { [key: string]: any };

    async load() {
        // Imagine this config being loaded from a remote server
        this.config = await fetchConfigFromServer();
    }

    get(key: string) {
        return this.config[key];
    }
}
```

Registering and Resolving the Async Singleton

```typescript
import { Container } from 'typewired';
import { ConfigService } from './ConfigService';

// Registering the async singleton
await Container.registerSingletonAsync('ConfigService', ConfigService);

// Resolving the async singleton
const configService = await Container.resolveSingletonAsync<ConfigService>('ConfigService');
await configService.load();
console.log('Database host:', configService.get('databaseHost'));
```

### Example 5: Asynchronous Interface Injection

Defining an Interface and its Async Implementation

Suppose we have an interface for a data loader that fetches user data from an API.

```typescript
// IUserService.ts
export interface IUserService {
    loadUserData(userId: string): Promise<UserData>;
}

// UserData is a custom type representing user data
export type UserData = {
    id: string;
    name: string;
    email: string;
    // ... other user fields
};
```

Now, let's create an implementation of this interface that performs an asynchronous operation to load user data:

```typescript
// ApiUserService.ts
import { IUserService, UserData } from './IUserService';

export class ApiUserService implements IUserService {
    async loadUserData(userId: string): Promise<UserData> {
        // In a real scenario, you'd replace this with an actual API call
        const response = await fetch(`https://api.example.com/users/${userId}`);
        const data = await response.json();
        return data;
    }
}
```

Registering and Resolving the Async Interface

We need to register our interface with the async implementation and resolve it when needed. This is done asynchronously because the implementation requires an async operation.

```typescript
import { Container } from 'typewired';
import { IUserService } from './IUserService';
import { ApiUserService } from './ApiUserService';

const USER_SERVICE_TOKEN = Symbol.for('IUserService');

// Async registration of the interface with its implementation
await Container.registerInterfaceAsync(USER_SERVICE_TOKEN, ApiUserService);

// Async resolution of the interface
const userService = await Container.resolveInterfaceAsync<IUserService>(USER_SERVICE_TOKEN);

// Use the resolved service
const userId = '123';
userService.loadUserData(userId).then(userData => {
    console.log(`User Name: ${userData.name}`);
}).catch(error => {
    console.error('Failed to load user data:', error);
});
```

In this example, we have an IUserService interface with an asynchronous method loadUserData. The ApiUserService class implements this interface with an actual asynchronous fetch call to get the data. We then register the ApiUserService asynchronously with the DI container and resolve it when needed. The resolved service is used to load user data with the provided user ID, and since it returns a Promise, we handle it with .then() and .catch() to deal with the asynchronous result.

### Notes
- **Interface Injection:** Useful for when you want to abstract the concrete implementation of a service.
- **Singleton:** Best for services that maintain state or are expensive to create.
- **Transient:** Ideal for stateless services where each consumer should get a new instance.

Ensure that these types of dependency injections align with your application architecture and design principles.


### API Documentation
- Container.registerSingleton(...)
- Container.registerSingletonAsync(...)
- Container.registerTransient(...)
- Container.registerTransientAsync(...)
- Container.registerInterface(...)
- Container.registerInterfaceAsync(...)
- Container.resolveSingleton(...)
- Container.resolveSingletonAsync(...)
- Container.resolveTransient(...)
- Container.resolveTransientAsync(...)
- Container.resolveInterface(...)
- Container.resolveInterfaceAsync(...)
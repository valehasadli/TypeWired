## TypeWired

TypeWired is a TypeScript library providing powerful and flexible dependency injection (DI) akin to the Spring framework for Java. It allows easy management of dependencies in TypeScript applications, enabling cleaner and more maintainable codebases.

Features
- **Spring-Like DI:** Familiar DI experience for those accustomed to Java Spring.
- **Singleton and Transient Registrations:** Manage the lifecycle of your services easily.
- **Interface Injection:** Utilize TypeScript interfaces for clean and maintainable code.
- **Decorators:** Streamline the registration of services and interfaces.
- **Type Safety:** Fully leverage TypeScript's type system for safer code.

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

### Notes
- **Interface Injection:** Useful for when you want to abstract the concrete implementation of a service.
- **Singleton:** Best for services that maintain state or are expensive to create.
- **Transient:** Ideal for stateless services where each consumer should get a new instance.

Ensure that these types of dependency injections align with your application architecture and design principles.


### API Documentation
- Container.registerSingleton(...)
- Container.registerTransient(...)
- Container.registerInterface(...)
- Container.resolveSingleton(...)
- Container.resolveTransient(...)
- Container.resolveInterface(...)
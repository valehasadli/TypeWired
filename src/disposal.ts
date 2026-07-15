type DisposeCapable = {
	[Symbol.asyncDispose]?: () => unknown;
	[Symbol.dispose]?: () => unknown;
	dispose?: () => unknown;
};

async function disposeInstance(instance: unknown): Promise<void> {
	if (instance === null || typeof instance !== 'object') {
		return;
	}
	const target = instance as DisposeCapable;
	// Symbol.asyncDispose / Symbol.dispose may be absent on older runtimes.
	const asyncDispose = Symbol.asyncDispose ? target[Symbol.asyncDispose] : undefined;
	const syncDispose = Symbol.dispose ? target[Symbol.dispose] : undefined;
	if (typeof asyncDispose === 'function') {
		await asyncDispose.call(target);
	} else if (typeof syncDispose === 'function') {
		syncDispose.call(target);
	} else if (typeof target.dispose === 'function') {
		await target.dispose();
	}
}

/**
 * Disposes instances in reverse creation order (dependents before their
 * dependencies). A failing disposer never prevents the others from running;
 * errors are collected and returned.
 */
export async function disposeInstances(instances: readonly unknown[]): Promise<unknown[]> {
	const errors: unknown[] = [];
	for (let i = instances.length - 1; i >= 0; i--) {
		try {
			await disposeInstance(instances[i]);
		} catch (error) {
			errors.push(error);
		}
	}
	return errors;
}

export function throwDisposalErrors(errors: readonly unknown[]): void {
	if (errors.length === 1) {
		throw errors[0];
	}
	if (errors.length > 1) {
		throw new AggregateError(errors, 'Multiple errors during disposal');
	}
}

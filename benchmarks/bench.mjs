/**
 * Benchmarks TypeWired against tsyringe and awilix on identical object graphs,
 * using each library's decorator-free registration API.
 *
 * Run with: yarn build && yarn bench
 */
import 'reflect-metadata';
import { container as tsyringeRoot, instanceCachingFactory, Lifecycle } from 'tsyringe';
import { createContainer as createAwilix, asValue, asFunction, asClass } from 'awilix';
import { Container, createToken } from '../dist/index.mjs';

// The shared graph: Config -> Db -> RepoA, RepoB -> Service
class Db {
	constructor(config) {
		this.config = config;
	}
}
class RepoA {
	constructor(db) {
		this.db = db;
	}
}
class RepoB {
	constructor(db) {
		this.db = db;
	}
}
class Service {
	constructor(repoA, repoB) {
		this.repoA = repoA;
		this.repoB = repoB;
	}
}
class Ctx {}

const CONFIG = { url: 'postgres://localhost' };

// --- typewired ---------------------------------------------------------
const twConfig = createToken('Config');
const twDb = createToken('Db');
const twRepoA = createToken('RepoA');
const twRepoB = createToken('RepoB');
const twService = createToken('Service');
const twCtx = createToken('Ctx');

function typewiredBuild(lifetime) {
	return new Container()
		.register(twConfig, { useValue: CONFIG })
		.register(twDb, { useClass: Db, deps: [twConfig], lifetime })
		.register(twRepoA, { useClass: RepoA, deps: [twDb], lifetime })
		.register(twRepoB, { useClass: RepoB, deps: [twDb], lifetime })
		.register(twService, { useClass: Service, deps: [twRepoA, twRepoB], lifetime });
}

// --- tsyringe ----------------------------------------------------------
function tsyringeBuild(singleton) {
	const c = tsyringeRoot.createChildContainer();
	const wrap = singleton ? instanceCachingFactory : f => f;
	c.register('config', { useValue: CONFIG });
	c.register('db', { useFactory: wrap(cc => new Db(cc.resolve('config'))) });
	c.register('repoA', { useFactory: wrap(cc => new RepoA(cc.resolve('db'))) });
	c.register('repoB', { useFactory: wrap(cc => new RepoB(cc.resolve('db'))) });
	c.register('service', {
		useFactory: wrap(cc => new Service(cc.resolve('repoA'), cc.resolve('repoB'))),
	});
	return c;
}

// --- awilix ------------------------------------------------------------
function awilixBuild(lifetimeCall) {
	const c = createAwilix();
	c.register({
		config: asValue(CONFIG),
		db: asFunction(({ config }) => new Db(config))[lifetimeCall](),
		repoA: asFunction(({ db }) => new RepoA(db))[lifetimeCall](),
		repoB: asFunction(({ db }) => new RepoB(db))[lifetimeCall](),
		service: asFunction(({ repoA, repoB }) => new Service(repoA, repoB))[lifetimeCall](),
	});
	return c;
}

// --- harness -----------------------------------------------------------
function measure(fn, ms) {
	const end = performance.now() + ms;
	let ops = 0;
	while (performance.now() < end) {
		fn();
		ops++;
	}
	return ops / (ms / 1000);
}

function bench(fn, { warmupMs = 100, runMs = 300, runs = 5 } = {}) {
	measure(fn, warmupMs);
	const samples = Array.from({ length: runs }, () => measure(fn, runMs));
	samples.sort((a, b) => a - b);
	return samples[Math.floor(runs / 2)]; // median
}

const suites = {
	'cold: register 5 services + first resolve': {
		typewired: () => typewiredBuild('singleton').resolve(twService),
		tsyringe: () => tsyringeBuild(true).resolve('service'),
		awilix: () => awilixBuild('singleton').resolve('service'),
	},
	'warm singleton resolve': (() => {
		const tw = typewiredBuild('singleton');
		const ts = tsyringeBuild(true);
		const aw = awilixBuild('singleton');
		return {
			typewired: () => tw.resolve(twService),
			tsyringe: () => ts.resolve('service'),
			awilix: () => aw.resolve('service'),
		};
	})(),
	'transient resolve (full graph each time)': (() => {
		const tw = typewiredBuild('transient');
		const ts = tsyringeBuild(false);
		const aw = awilixBuild('transient');
		return {
			typewired: () => tw.resolve(twService),
			tsyringe: () => ts.resolve('service'),
			awilix: () => aw.resolve('service'),
		};
	})(),
	'create scope + scoped resolve': (() => {
		const tw = new Container().register(twCtx, { useClass: Ctx, lifetime: 'scoped' });
		const ts = tsyringeRoot.createChildContainer();
		ts.register('ctx', { useClass: Ctx }, { lifecycle: Lifecycle.ContainerScoped });
		const aw = createAwilix();
		aw.register({ ctx: asClass(Ctx).scoped() });
		return {
			typewired: () => tw.createScope().resolve(twCtx),
			tsyringe: () => ts.createChildContainer().resolve('ctx'),
			awilix: () => aw.createScope().resolve('ctx'),
		};
	})(),
};

const fmt = n =>
	n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}k` : n.toFixed(0);

console.log(`node ${process.version} · ${process.arch}\n`);
const results = {};
for (const [name, impls] of Object.entries(suites)) {
	results[name] = {};
	for (const [lib, fn] of Object.entries(impls)) {
		results[name][lib] = bench(fn);
	}
	const { typewired, tsyringe, awilix } = results[name];
	console.log(name);
	console.log(`  typewired  ${fmt(typewired).padStart(8)} ops/s`);
	console.log(`  tsyringe   ${fmt(tsyringe).padStart(8)} ops/s`);
	console.log(`  awilix     ${fmt(awilix).padStart(8)} ops/s`);
	console.log();
}

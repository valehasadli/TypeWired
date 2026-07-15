# Contributing to TypeWired

Thanks for your interest in contributing! TypeWired is a small, focused
library, and contributions of every size are welcome — bug reports, docs
fixes, tests, and features.

## Development setup

```bash
git clone https://github.com/valehasadli/typewired.git
cd typewired
yarn install
yarn test        # run the test suite
yarn build       # type-check and emit to dist/
```

Requirements: Node.js 20+ and Yarn.

## Project principles

Before proposing a feature, note the design constraints the library commits
to — PRs that break these won't be merged:

- **Zero runtime dependencies.** The published package depends on nothing.
- **No `reflect-metadata`, no decorators.** Wiring is explicit and verified
  by the type checker.
- **Compile-time safety is the product.** Any API change must keep wrong
  wiring (mismatched deps, wrong provider types) a *compile* error. The test
  suites assert this with `@ts-expect-error` — extend those checks when you
  extend the API.
- **Lazy resolution, honest async.** Nothing constructs at registration time;
  async work only happens in `resolveAsync`.

## Making changes

1. Fork the repo and create a branch from `master`.
2. Add or update tests for any behavior change — every feature and bug fix
   needs test coverage, including negative type-level tests where relevant.
3. Make sure `yarn test` and `yarn build` pass.
4. Keep the public API documented: update the README when you change
   behavior or add API surface.
5. Open a pull request using the template. Describe *why*, not just *what*.

## Reporting bugs

Use the bug report issue template. A minimal reproduction (a small snippet
registering tokens and showing the unexpected resolve/dispose behavior) makes
fixes dramatically faster.

## Commit style

Short imperative subject line ("Add scoped async memoization"), body
explaining the reasoning when it isn't obvious.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be kind.

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE).

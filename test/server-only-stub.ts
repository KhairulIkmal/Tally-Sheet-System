// Vitest stand-in for the `server-only` package. That package only exists as
// a bundler-time guard (Next.js aliases it during its own webpack/turbopack
// build); it isn't a real installed dependency, so it can't resolve under
// plain Vitest. Aliased in vitest.config.mts.
export {};

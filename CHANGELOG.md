# Changelog

All notable changes to this project will be documented in this file.

## [2.0.1] - 2026-11-09

### Changed (breaking for unsupported Node versions)

- The Node engine range now matches AVA 8: `^22.20.0 || ^24.12.0 || >=26.0.0`. Node 20, 23 and
  25 are no longer supported because AVA 8 cannot run there.
- CI matrix is Node 22 / 24 / 26 and includes the production dependency audit.

### Fixed

- Synced `package-lock.json` with the `2.0.1` package version.

## [2.0.0] - 2026-11-09

### Added

- Safety-aware retries:
  - Retryable status codes are `408`, `425`, `429`, `500`, `502`, `503`, `504`; network/fetch
    errors are retried too.
  - Only idempotent methods (`GET`, `HEAD`, `OPTIONS`, `PUT`, `DELETE`) are retried by default.
    `POST`/`PATCH` require `retryUnsafe: true`.
  - `retryOnStatus: false` disables status-code retries while keeping transport retries.
  - `Retry-After` response headers are honoured; otherwise the delay grows exponentially with
    jitter from `retryDelay`.
- Header redaction for console, HTML and MongoDB reports, enabled by default. Configurable with
  `redact: false`, `sensitiveHeaders` and `redactValue`; `redactHeaders`/`redactResults` are
  exported.
- MongoDB client injection via `mongoClient` (or the `client` alias) and a `closeClient(client)`
  cleanup hook. Injected clients are left open by default.
- CLI flags `--retries`, `--retry-delay`, `--timeout` and `-v`/`--version`; options may appear
  before or after the rules file.
- Opt-in live E2E smoke test (`E2E_LIVE=1`, `E2E_BASE_URL` override) against httpbin. It is
  skipped by default, including in CI. `npm run test:e2e` runs it explicitly.
- README positioning: when to use `apirequests`, and when Hurl, Newman/Postman or k6 fit better.
- Tests covering retry status codes, idempotency, `retryUnsafe`, `retryOnStatus`, global vs
  per-rule retry settings, CLI option ordering, version output, Mongo client injection/cleanup,
  and redaction.

### Changed (breaking)

- **Retry behavior changed.** In 1.x, `retries` applied to every method and every 5xx. In 2.0:
  - `POST` and `PATCH` are **not** retried unless `retryUnsafe: true`.
  - The retryable status list is explicit (see above); other 5xx responses are returned as-is.
  - `retryDelay` is the base of an exponential backoff with jitter and is a minimum for
    `Retry-After`, not a fixed interval.
  - The default is still `retries: 0`, so users who never enabled retries are unaffected.
- Factory-level `retries`, `retryDelay`, `timeout`, `retryUnsafe` and `retryOnStatus` now apply
  to rules and OpenAPI-generated tasks as defaults; per-rule values win.
- Injected MongoDB clients are no longer closed by default. Use `closeClient` to control cleanup.
- Updated runtime dependencies: `joi` 18.3.2, `js-yaml` 5.5.0, `mongodb` 7.8.0. Updated dev
  dependencies: `ava` 8.4.0, `eslint` 10.14.0, `globals` 17.14.0 and related plugins.

### Fixed

- Redaction no longer mutates the task headers used for requests, so `loop` runs keep sending
  the real credentials.
- The CLI no longer mistakes an option value (for example `xml` after `--output`) for the rules
  file.
- Redaction and report logic is shared through `redactResults`, removing duplicated code.
- Dependency overrides (`lodash`, `minimatch`, `glob`, `supertap` → `js-yaml`) keep
  `npm audit` clean without downgrading major tooling.
- CI runs the production dependency audit (`npm run audit:prod`).

## [1.0.0] - 2026-08-13

### Added

- OpenAPI 3 support: `servers[].url`, `content` media types, `example` / `examples[].value`
  for request bodies and responses (Swagger 2.0 stays supported).
- OpenAPI `$ref` resolution when building tasks: pathItems, operations, parameters, responses,
  requestBodies and `schema.$ref` examples.
- Fault-tolerant runs: a failing request no longer aborts the whole run; it is recorded as a
  failed result (print / HTML / XML / exit code) and the remaining tasks still execute.
- Per-rule retries: `retries` (default 0) with `retryDelay` ms (default 250) between attempts for
  transient fetch failures and 5xx responses.
- CLI binary `apirequests` (via `npm i -g` or `npx`): `--output`, `--output-path`,
  `--output-file`, `--loop`, `--print-only-failure`, `-h/--help`.
- GitHub Actions CI workflow (test, lint, coverage on Node 20 / 22 / 24).
- LICENSE file (MIT), CHANGELOG.
- Unit tests for `buildOpenApiTasks` (Swagger 2.0, OpenAPI 3 and `$ref`), `checkUri`,
  retries, CLI, and the invalid-regex handling.
- `files` whitelist and `exports` map in package.json so only runtime code is published.
- `prepack` / `prepublishOnly` scripts that run lint and tests before publishing.

### Changed (breaking)

- ESM-only package (`"type": "module"`, Node `>=20.19`). CommonJS consumers must switch to
  `import apirequests from 'apirequests'` (or use the `.default` property of a `require`).
- Replaced `request` / `sync-request` with native `fetch`; per-request timeout uses
  `AbortSignal.timeout`.
- Dropped the `delay` option in favor of `Promise`-based flow.
- Modernized dependencies: `joi` 13→18, `js-yaml` 3→5, `mongodb` 3→7, `log-symbols` 2→7,
  added `picocolors`; dev: `ava` 1→7, `nyc`→`c8`, `eslint` 5→10 with flat config.
- Removed dead/vulnerable dependencies: `request` (archived), `sync-request`, `colors`
  (2022 supply-chain hijack), `xml-writer`, `express`.
- `lib/output.js`: MongoDB store uses the v7 driver API and a `database` option
  (`opts.database`, default `apirequests`).
- `buildOpenApiTasks` moved from `index.js` into `lib/helper.js` and is exported.
- `checkUri` only accepts well-formed `http`/`https` URLs: strict `http(s)://` scheme prefix plus
  `new URL()` and hostname validation (rejects `ftp://` and malformed URLs such as
  `http:/www.google.com`).

### Fixed

- `lib/output.js` typo `databse` → `database`.
- HTML output now escapes special characters.
- Invalid `regex` patterns in a response rule no longer throw; they produce a
  `invalid regex: ...` failure message.
- README rewritten for ESM usage and modern options; removed dead demo endpoints and
  broken screenshot links.

[2.0.1]: https://github.com/DBProductions/apirequests/releases/tag/2.0.1
[2.0.0]: https://github.com/DBProductions/apirequests/releases/tag/2.0.0
[1.0.0]: https://github.com/DBProductions/apirequests/releases/tag/1.0.0

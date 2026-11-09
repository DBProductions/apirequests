# apirequests — Project State & Context

Last updated: 2026-11-09 (v2.0.0: smart retries, redaction, Mongo injection, live E2E, docs)

## What this project is

`apirequests` is a small npm package for running/configurable API smoke tests driven by
JSON/YAML rule files. It fires multiple HTTP requests (parallel for singles, sequential
for groups), validates responses against expected rules (status code, headers, time, body,
regex, Joi schema), and reports results to console, HTML, XML (JUnit), or MongoDB.
It can also build tasks from a Swagger 2.0 / OpenAPI 3 YAML document (needs `example`
fields).

## Architecture / module layout

```
index.js            Entry point (default export = factory). Parses rules (JSON file, YAML
                    file, or array), builds tasks, runs them, dispatches outputs, handles loop.
                    Per-task failure handling so one bad request doesn't abort the run.
lib/helper.js       ESM. checkUri, caller (native fetch + retries), buildTasks, buildOpenApiTasks
                    (Swagger 2.0 + OpenAPI 3 + $ref resolution), fillResults, setCommonOutput /
                    setOutputs / setGroupOutputs, Joi validation.
lib/output.js       ESM. printResults, writeHtml, writeXml, storeResults (MongoDB).
lib/xml.js          ESM. buildTestsuiteXml — JUnit-style XML report builder.
bin/apirequests.js  ESM CLI. Wraps the factory for rule files: --output, --output-path,
                    --output-file, --loop, --print-only-failure, --retries, --retry-delay,
                    --timeout, -v/--version, -h/--help. Options may precede the rules file.
test/test.helper.js ava unit suite (checkUri, buildOpenApiTasks, $ref, output helpers).
test/test.index.js  ava e2e suite (runs, outputs, loop, CLI, fault tolerance, retries,
                    redaction, Mongo injection).
test/test.e2e.js    opt-in live smoke (E2E_LIVE=1, E2E_BASE_URL); skipped by default.
```

Data flow: `run(rules)` → `helper.buildTasks` → `helper.caller` (fetch, parallel) →
`helper.fillResults` + `setOutputs` → `getGroupResults` (fetch, sequential, key extraction)
→ `helper.setGroupOutputs` → `handleOutputs` (print / html / xml / db / ci) → optional loop.

## Current state (all green)

- **Node engine**: `^22.20.0 || ^24.12.0 || >=26.0.0`, matched to AVA 8's supported runtimes
  (Node 20/23/25 intentionally unsupported). Uses global `fetch` and `AbortSignal.timeout`.
- **Module system**: ESM (`"type": "module"`) — **breaking for CJS consumers**: `require('apirequests')`
  returns `{ default }`; use `import` or `.default`.
- **Tests**: `npm test` → 57 pass, 1 skipped (live E2E) with ava 8
- **Lint**: `npm run lint` → clean (eslint 10, flat config `eslint.config.js`)
- **Coverage**: `npm run coverage` → ~92% stmts overall via c8 (index.js 97%, bin 85%, helper.js 90%,
  output.js 93%, xml.js 100%; Mongo connection paths and the loop "again" print remain untested)
- **Audit**: `npm audit` and `npm run audit:prod` → clean (overrides for lodash, minimatch, glob,
  supertap→js-yaml)
- **CI**: GitHub Actions `.github/workflows/ci.yml` (test/lint/coverage/audit:prod on Node 22/24/26)
- **Docs**: README has positioning (Hurl/Newman/k6), smart-retry rules, redaction, Mongo injection,
  CLI flags and live E2E instructions; CHANGELOG has 2.0.0 breaking notes; LICENSE (MIT).
- **Packaging**: `files` whitelist + `exports` map; tarball ships only `index.js`, `lib/`,
  README/LICENSE/CHANGELOG/package.json (~18.5 kB). `prepack`/`prepublishOnly` run lint + tests.
- **Version**: 2.0.0 (safety-aware retries, redaction, Mongo injection).

## 2026 modernization (what changed this session)

The repo was last touched in Jan 2020 and the working tree contained an **unfinished,
broken half-migration** (ESM `lib/*` + native fetch + `picocolors` + new `lib/xml.js`,
but `index.js` still CommonJS, `picocolors` missing from deps → tests crashed on load).
This session completed it:

- **package.json**: added `"type": "module"`, `engines >=18`, version → 0.5.0.
  - Removed dead/vulnerable deps: `request` (archived), `sync-request`, `colors` (2022
    supply-chain hijack), `xml-writer`, `express` (never used).
  - Added `picocolors` (was used but missing). Modernized `joi` 13→17, `js-yaml` 3→4,
    `mongodb` 3→6, `log-symbols` 2→6; dev: `ava` 1→6, `nyc`→`c8`, `eslint` 5→8 + standard 17.
  - `overrides: { lodash: "4.17.21" }`.
- **index.js**: full ESM rewrite. Group requests now use async native `fetch` instead of
  blocking `sync-request`; merged duplicate `start`/`startAgain` into one `start(tasks, opts, again)`;
  removed dead `getRefDefs`; extracted `loadRules` / `isOpenApiDoc` / `buildOpenApiTasks` /
  `printSummary`; kept Swagger-2.0-style OpenAPI task building (default host `http://localhost:4000`).
- **lib/helper.js**: `caller` is now `async`/fetch; validates `opts.uri` and throws
  `'undefined is not a valid uri or options object.'` (test contract). `form` serialized via
  `URLSearchParams`. Joi validation switched to `schema.validate()` (Joi 17 API).
- **lib/output.js**: ESM + async file writes; added HTML escaping; removed dead `countFailures`;
  fixed `"databse"` → `"database"` typo; MongoDB uses v6 driver API
  (`new MongoClient(...)`, `client.db(opts.database)`, `await client.close()`).
- **lib/xml.js**: kept (JUnit report generator, was untracked).
- **test/test.helper.js**: ESM named import (`import * as helper from '../lib/helper.js'`);
  Joi 17 message expectations (`"value" must be [xa]`); shared schema instance (Joi 17 objects
  aren't deepEqual); schema test cases include `headers: {'content-type': 'application/json'}`
  so the JSON body-parse path is exercised.
- **ESLint**: eslint 10 with a flat config (`eslint.config.js`). ESLint 10 dropped `.eslintrc`
  support, and `eslint-config-standard@17` peers `eslint ^8` (ERESOLVE on install), so the standard
  ruleset was ported directly into the flat config with 4-space indent + semicolons. Plugins:
  `eslint-plugin-import-x` (fork of eslint-plugin-import that supports eslint 10), `eslint-plugin-n`,
  `eslint-plugin-promise`, `globals`.

## 2026 follow-up session (what changed 2026-08-13)

- **OpenAPI 3 support** (`buildOpenApiTasks` now in `lib/helper.js`, exported): reads
  `servers[].url`, `content` media types, `example` / `examples[].value` for request bodies and
  responses; path params replaced by their example; Swagger 2.0 path unchanged. Base URL still
  defaults to `http://localhost:4000` when no host/servers.
- **checkUri** now only accepts `http`/`https` (rejects `ftp://` — native fetch can't handle FTP).
- **Docs**: README rewritten for ESM + modern options + OpenAPI section (removed dead
  `webservice-point.appspot.com` demo endpoints); added CHANGELOG.md and LICENSE (MIT).
- **CI**: added `.github/workflows/ci.yml`.
- **Packaging**: version → 1.0.0; added `files` whitelist + `exports` map; removed `.npmignore`
  (its `*.json` rule was a footgun); `prepack`/`prepublishOnly` run lint + tests. Invalid
  `regex` response patterns now fail with `invalid regex: ...` instead of throwing.
- **Node/CI alignment**: real minimum is Node `20.19` (joi 18 / mongodb 7 require it). `engines`
  corrected from `>=18` to `>=20.19.0`; CI matrix → Node 20/22/24; `ava` 8→7 (ava 8 needs Node 22.20+,
  so Node 20 couldn't be tested). actions/checkout & setup-node → v5 (Node 20 runner deprecation).

## 2026 follow-up session (what changed 2026-08-14)

- **Fault-tolerant runs**: a failing single/group request no longer aborts the run. `start()` and
  `getGroupResults()` catch per task (`errorResult()` in `index.js`) and record a normalized failed
  result; `setOutputs`/`setGroupOutputs` mark the result as failed (guarded for undefined result).
  The summary and exit code reflect the failure; print/HTML/XML render the error.
- **Retries**: `caller()` retries transient fetch failures/5xx up to `retries` (default 0) with
  `retryDelay` ms (default 250) between attempts; `buildTask` copies both onto the task.
- **checkUri**: now `^https?:\/\/` prefix test + `new URL()` + `hostname` check — rejects
  `ftp://`, bare hostnames, and malformed URLs that `new URL()` silently normalizes (e.g.
  `http:/www.google.com`). Existing checkUri test contract preserved.
- **CLI**: new `bin/apirequests.js` (Node shebang, ESM) + package.json `bin`/`files: ["bin/"]`.
  Flags: `--output`, `--output-path`, `--output-file`, `--loop`, `--print-only-failure`, `-h/--help`.
- **OpenAPI `$ref` resolution**: `resolveRef`/`maybeRef` in `lib/helper.js` resolve `$ref` for
  pathItems, operations, parameters, responses, requestBodies; `exampleFor(doc, schema)` resolves
  `schema.$ref` examples. Covered by a new helper unit test.
- **Test server**: `test/helpers/http-server.js` gained `/item`, `/users/:id`, `/flaky` (destroys the
  first connection to exercise retries).
- **Tests**: 26 → 46 tests (unparsable file, network failure, retries, group key append, OpenAPI 3
  YAML e2e, loop scheduling, CLI runs/help/usage, unsupported extension, group non-JSON body,
  html RUN branch + loop meta refresh, print-only-failure, writeHtml unit, ci output, yaml-not-a-spec).
  Tests that touch globals (`process.exitCode`, `console.log`, `globalThis.setTimeout`) are
  `test.serial()` because ava runs tests within a file concurrently.
- **Coverage**: ~85% → ~92% (index.js 97%, bin 94%). Remaining gaps: `db` output (needs a running
  MongoDB) and the loop "again" print branch (would require an infinite loop).

## 2026 follow-up session (what changed 2026-11-09, v2.0.0)

- **Smart retries**: `caller()` retries only idempotent methods (`GET`/`HEAD`/`OPTIONS`/`PUT`/
  `DELETE`) by default; `POST`/`PATCH` need `retryUnsafe: true`. Retryable statuses are
  `408, 425, 429, 500, 502, 503, 504`; `retryOnStatus: false` disables status retries. `Retry-After`
  is honoured; backoff is exponential with jitter from `retryDelay` (not a fixed interval).
  Factory-level retry/timeout options now apply to rules and OpenAPI tasks; per-rule values win.
- **Redaction**: `redactHeaders`/`redactResults` in `lib/output.js`; print/HTML/db redact sensitive
  headers by default (`redact: false`, `sensitiveHeaders`, `redactValue`). Task objects are cloned so
  loop runs keep real request headers.
- **Mongo injection**: `storeResults` accepts `mongoClient`/`client`; injected clients are not closed
  by default. `closeClient(client)` is an optional cleanup hook.
- **CLI**: added `--retries`, `--retry-delay`, `--timeout`, `-v/--version`; parser collects
  positionals so options can precede the rules file; unknown options fail.
- **Live E2E**: `test/test.e2e.js` is skipped unless `E2E_LIVE=1`; `E2E_BASE_URL` overrides the
  default `https://httpbin.org`. `npm run test:e2e` runs it.
- **Deps/audit**: bumps (joi 18.3.2, js-yaml 5.5.0, mongodb 7.8.0, ava 8.4.0, eslint 10.14.0,
  globals 17.14.0) and overrides (lodash 4.18.1, minimatch 11.0.5, glob 14.0.4,
  supertap→js-yaml 3.15.2) keep `npm audit` clean.
- **Node/CI alignment**: engine range changed from `>=20.19` to
  `^22.20.0 || ^24.12.0 || >=26.0.0` to match AVA 8 (Node 20/23/25 unsupported); CI matrix is
  Node 22/24/26 and runs `audit:prod`.
- **Docs**: README positioning/retry/redaction/Mongo/CLI/E2E sections; CHANGELOG 2.0.0 with explicit
  breaking retry notes and 2.0.1 Node engine note.

## Conventions to follow

- ESM everywhere (`import`/`export`), no `require`/`module.exports`.
- Native `fetch` for HTTP (no `request`/`sync-request`), `AbortSignal.timeout` for timeouts.
- `picocolors` (not `colors`) for console styling; `log-symbols` for ✓/✗ glyphs.
- 4-space indent, semicolons, standard JS style (enforced by `eslint.config.js`).
- `helper.caller` returns a normalized response `{ statusCode, headers (lowercased), body (string), num, reqend, request: { host }, requestTime }`.

## Commands

| Command              | Purpose                                |
|----------------------|----------------------------------------|
| `npm test`           | Run ava test suite                     |
| `npm run coverage`   | Run tests with c8 coverage             |
| `npm run lint`       | Lint `lib/`, `index.js`, `test/`       |
| `node smoke.mjs`     | (ad-hoc) run rules against real API    |

## Known limitations / suggested follow-ups

- OpenAPI support is example-driven (Swagger 2.0 `example`/`examples`, OpenAPI 3 `example`/
  `examples[].value`); no `schema`-based request generation (though `$ref` examples are resolved).
- `db` output (`output.storeResults`, `index.js` db branch) is untested — needs a running MongoDB.
- The loop "again" print branch (`loopCount` / "Start again with…") is untested — it needs a real
  looping run.
- Base URL defaults to `http://localhost:4000` when a spec has no `host`/`servers`.
- `handleOutputs` for `ci` runs print + XML; loop scheduling via `setTimeout` in `handleOutputs`.
- `mongodb` is a runtime dependency but only used for `output: 'db'` (lazy-imported); could be
  made optional if the install size matters.
- No TypeScript types (out of scope for now).
- Remaining `npm audit` items are dev-only, transitive, unfixable (lodash via ava→concordance;
  `npm run audit:prod` reports clean).

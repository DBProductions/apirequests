# apirequests

Calls several API resources in a simple way with JSON defined rules.  
Can test several backends if the resources are response like expected.

[![NPM](https://nodei.co/npm/apirequests.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/apirequests/)

## When to use / when not to use

`apirequests` is deliberately small: a Node-native runner for declarative HTTP smoke and
contract checks. It is not a load generator or a full API testing platform.

**Use it when**

- You want HTTP checks defined as JSON or YAML and run from Node or CI.
- You already use Node >= 20.19 and prefer one runtime instead of installing another binary.
- You need a mix of a JavaScript API (`await apitest.run(rules)`) and a CLI.
- You want simple response assertions (status, headers, body, regex, Joi), sequential CRUD
  groups, and console / HTML / JUnit XML / MongoDB reports.
- You want to generate a first set of requests from Swagger 2.0 or OpenAPI 3 examples.

**Reach for another tool when**

- **Hurl** — you want a standalone binary and a purpose-built text DSL for HTTP tests, including
  response captures and snapshots. `apirequests` is JSON/YAML plus Node.
- **Newman / Postman** — you need Postman collection import, environments, team collaboration,
  mock servers, or the wider Postman ecosystem. `apirequests` does not import collections.
- **k6** — you need load, stress, soak, or performance testing with virtual users and metrics.
  `apirequests` runs functional checks, not load generation.
- You need advanced scenario scripting, arbitrary assertion code, distributed runs, or a hosted
  test platform. Those are outside this package's scope.

These tools are often complementary: use Hurl/Newman for API workflows, k6 for performance, and
`apirequests` for lightweight Node/CI smoke checks.

## Requirements

Node.js >= 20.19 (uses the global `fetch` and `AbortSignal.timeout`).

This package is ESM-only, so it must be loaded with `import`.

## How to use

```javascript
import apirequests from 'apirequests';

const rules = [...];

const apitest = apirequests();
apitest.run(rules);
```

Use rules from a JSON file.

```javascript
import apirequests from 'apirequests';

const apitest = apirequests();
apitest.run('rules.json');
```

Use a YAML file with a Swagger 2.0 or OpenAPI 3 specification, needs examples to work!

```javascript
import apirequests from 'apirequests';

const apitest = apirequests();
apitest.run('api.yaml');
```

Use a store engine, like MongoDB, for storing the rules.

```javascript
import apirequests from 'apirequests';
import { MongoClient } from 'mongodb';

const connectionUrl = 'mongodb://127.0.0.1:27017/apirequests';
const client = new MongoClient(connectionUrl);
await client.connect();

const apitest = apirequests();
const results = await client.db().collection('urls').find().toArray();
await apitest.run(results);
await client.close();
```

#### Options
All options are optional or have set default values.

##### output
The default value is `print`, other possible values are `html`, `xml`, `db` and `ci`.  

* html - writes a HTML file (reports.html)  
* xml - writes a XML file (reports.xml)  
* db - writes to a MongoDB collection (results)  
* ci - print the output and writes a XML file

##### printOnlyFailure
When this flag is set `true` only the failures are printed out.  

##### outputFile and outputPath  
The default values are `reports.html` and `./`, will be used when output is set to html.  
When `output` is set to `xml` or to `ci` then the outputFile will be named `reports.xml`.  

```javascript
import apirequests from 'apirequests';

const apitest = apirequests({ output: 'html', outputFile: 'report.html' });
apitest.run('rules.json');
```

##### loop
When the requests should run in a `loop` with a timeout value.

```javascript
import apirequests from 'apirequests';

apirequests({ loop: 2000 }).run('rules.json');
```

##### retries, retryDelay, retryUnsafe and retryOnStatus
Retries are **safety-aware**. Network errors and these status codes are retryable:
`408`, `425`, `429`, `500`, `502`, `503`, `504`.

Only idempotent methods are retried by default: `GET`, `HEAD`, `OPTIONS`, `PUT` and `DELETE`.
`POST` and `PATCH` are **not** retried unless you opt in with `retryUnsafe: true`, because a
retry can duplicate a side effect. `retryOnStatus: false` disables status-code retries while
still retrying network/transport errors.

Defaults are `retries: 0` and `retryDelay: 250`. If a response has a `Retry-After` header, it
is honoured and never shorter than `retryDelay`. Otherwise the delay grows exponentially with
jitter: `retryDelay * (attempt + 1) + jitter`.

These can be set on the factory (global defaults) or per rule; a rule value wins:

```javascript
import apirequests from 'apirequests';

apirequests({ retries: 3, retryDelay: 500 }).run('rules.json');

const rules = [{
    method: 'post',
    uri: 'http://example.com/orders',
    retries: 2,
    retryUnsafe: true // POST is only retried when you accept the risk
}];
```

> **Breaking change in 2.0 (retries):** `retries` used to retry every method and every 5xx.
> Now non-idempotent requests (`POST`, `PATCH`) are not retried by default, the retryable status
> list is explicit, `Retry-After` is honoured, and `retryDelay` is the base of an exponential
> backoff rather than a fixed interval. The default is still `retries: 0`, so runs that did not
> opt into retries behave the same.

#### CLI
The package ships a `bin/apirequests.js` CLI (`npx apirequests rules.json`, or globally via
`npm i -g`). Flags:

* `--output <print|html|xml|db|ci>` output format (default `print`)
* `--output-path <dir>` directory for report files
* `--output-file <name>` report file name
* `--loop <ms>` repeat after a delay
* `--print-only-failure` only print failing tasks
* `--retries <n>` retry count for retryable failures (default `0`)
* `--retry-delay <ms>` base delay between retries (default `250`)
* `--timeout <ms>` per-request timeout (default `30000`)
* `-v`, `--version` print the installed version
* `-h`, `--help` show help

Options can appear before or after the rules file. Unknown options print an error and set a
non-zero exit code.

```sh
npx apirequests rules.json --output html --output-path ./reports
npx apirequests --retries 3 --retry-delay 500 --timeout 10000 rules.json
```

#### Fault tolerance
A failing request no longer aborts the whole run. The task is recorded as a failed result
(error message included) in the summary, the printed output, and the HTML/XML reports, and the
remaining tasks still execute. The process exit code reflects any failures.

##### connectionurl, database, collection and client injection
Used when `output` is `db`. Defaults are `mongodb://127.0.0.1:27017`, `apirequests` and
`results`.

You can inject an already-connected client with `mongoClient` (or the `client` alias). The
library reuses it and does **not** close it by default, so the caller keeps ownership of the
connection. Pass a `closeClient(client)` function if you want to hook cleanup after the run.

```javascript
import apirequests from 'apirequests';
import { MongoClient } from 'mongodb';

const connectionUrl = 'mongodb://127.0.0.1:27017';
const client = new MongoClient(connectionUrl);
await client.connect();

const rules = await client.db().collection('urls').find().toArray();
const apitest = apirequests({
    output: 'db',
    mongoClient: client,
    database: 'apirequests',
    collection: 'results'
});
await apitest.run(rules);

await client.close(); // caller owns the injected client
```

If no client is injected, `apirequests` creates one from `connectionurl`, connects, and closes it
after writing the results.

##### redact, sensitiveHeaders and redactValue
Reports redact sensitive request and response headers by default (console, HTML and MongoDB
output). The default list is `authorization`, `proxy-authorization`, `cookie`, `set-cookie`,
`x-api-key`, `api-key`, `x-auth-token` and `x-access-token`; values are replaced with
`[REDACTED]`.

```javascript
apirequests({
    redact: true,                                  // default; set false to disable
    sensitiveHeaders: ['authorization', 'x-token'], // replaces the default list
    redactValue: '***'
});
```

Redaction only changes report data. The headers sent on the wire (and reused by `loop`) keep
their real values.

##### timeout
Per-request timeout in milliseconds, defaults to `30000`. Can be set globally on the factory or
per rule; a rule value wins.

## How to define rules

A rule takes basically an `uri` to run, the `method` is optional, GET is the default value.  
To send custom headers use a `headers` object and define a `form` object inside of the rule to send data.  
To test the response, define inside of the rule a response object. The response object can have a `statuscode`, `host`, `time`, `data`, `regex` and a `headers` object, this headers object can check `contenttype`, `contentlength`, `cachecontrol` and `server`.

Some examples how to define rules.

```javascript
[{
    method: 'get',
    uri: 'http://example.com/test'
},
{
    method: 'post',
    uri: 'http://example.com/test',
    form: {
        name: 'apirequests',
        test: 'post'
    },
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
    },
    response: {
        statuscode: 200,
        data: '{"data": [{"test": "post"}, {"name": "apirequests"}], "response": "POST"}'
    }
},
{
    method: 'put',
    uri: 'http://example.com/test/123',
    response: {
        statuscode: 404,
        headers: {
            contenttype: 'text/html; charset=UTF-8',
            contentlength: '285'
        }
    }
},
{
    method: 'patch',
    uri: 'http://example.com/test/123',
    response: {
        statuscode: 404,
        headers: {
            contenttype: 'text/html; charset=UTF-8',
            contentlength: '285'
        }
    }
},
{
    method: 'delete',
    uri: 'http://example.com/test',
    response: {
        statuscode: 404,
        headers: {
            contenttype: 'text/html; charset=UTF-8'
        },
        data: 'error',
        regex: true
    }
}]
```

Response validation supports `joi` when `schema` flag is set.
```javascript
{
    // ...
    response: {
        statuscode: 200,
        data: Joi.object()
        .keys({
            response: Joi.string().alphanum().min(3).max(30).required()
        }),
        schema: true
    }
}
```

To send JSON data it's needed to define a `body` and send the specific header.
```javascript
{
    // ...
    body: JSON.stringify({ apirequest: 'post' }),
    headers: {
        'Content-Type': 'application/json'
    },
    response: {
        statuscode: 200,
        data: { apirequest: 'post' }
    }
}
```

It's possible to define groups to have depending requests or test CRUD functionality. The group requests are executed syncronous in order. `key` defines the field to find in the response like the id for the created entry to use this as reference for following calls.  
```javascript
{
    name: 'Group Test',
    key: '_id',
    group: [
        {
            method: 'post',
            uri: 'http://localhost:3000/users',
            body: JSON.stringify({ email: 'created@apirequests.com' }),
            headers: {
                'Content-Type': 'application/json'
            },
            response: {
                statuscode: 201
            }
        },
        {
            method: 'get',
            uri: 'http://localhost:3000/users',
            response: {
                statuscode: 200,
                data: '"email":"created@apirequests.com"',
                regex: true
            }
        },
        {
            method: 'put',
            uri: 'http://localhost:3000/users',
            body: JSON.stringify({ email: 'upgrated@apirequests.com' }),
            headers: {
                'Content-Type': 'application/json'
            },
            response: {
                statuscode: 200
            }
        },
        {
            method: 'get',
            uri: 'http://localhost:3000/users',
            response: {
                statuscode: 200,
                data: '"email":"upgrated@apirequests.com"',
                regex: true
            }
        },
        {
            method: 'delete',
            uri: 'http://localhost:3000/users',
            response: {
                statuscode: 200
            }
        }
    ]
}
```

## OpenAPI / Swagger files

When the rules file is a YAML document with a `paths` object, it is treated as an API
specification instead of an array of rules. Both Swagger 2.0 and OpenAPI 3 documents are
supported and need `example` (or `examples`) fields to build the requests:

* Swagger 2.0 uses `schemes`/`host`/`basePath`, per-operation `produces` and response
  `example` / `examples['application/json']`.
* OpenAPI 3 uses the first `servers[].url`, `content` media types and `example` /
  `examples[].value` on request bodies and responses.

Without a host (or servers) the base URL defaults to `http://localhost:4000`.

## Results

Per default the result is printed to the console, one line per task with a `PASS`, `FAIL` or
`RUN` marker (only `FAIL` lines when `printOnlyFailure` is set). A summary reports how many
tasks and groups finished, in how many milliseconds, and how many tests passed/failed.

The HTML file (`{output: 'html'}`) and the JUnit-style XML file (`{output: 'xml'}` or
`{output: 'ci'}`) contain the same information. Sensitive headers are redacted by default in
console, HTML and MongoDB output.

## Live E2E tests

`npm test` is fully offline; the live smoke test is skipped unless explicitly enabled. To run it
against httpbin:

```sh
npm run test:e2e
# or
E2E_LIVE=1 npm test
```

Use another service with `E2E_BASE_URL` (it must expose httpbin-compatible `/status/200`,
`/get` and `/headers` endpoints):

```sh
E2E_LIVE=1 E2E_BASE_URL=https://httpbin.example npm test
```

CI keeps the live test skipped by default, so builds do not depend on an external service.

## Feedback

Star this repo if you found it useful. Use the github issue tracker to give feedback on this repo.

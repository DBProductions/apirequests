import test from 'ava';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import apirequests from '../index.js';
import { writeHtml } from '../lib/output.js';
import { startServer } from './helpers/http-server.js';

let server;
let baseUrl;
test.before(async () => {
    server = await startServer();
    baseUrl = server.baseUrl;
});
test.after(async () => {
    await server.close();
});
test.afterEach(() => {
    process.exitCode = 0;
});

test('run resolves a summary and writes xml', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'apirequests-'));
    try {
        const apitest = apirequests({ output: 'xml', outputPath: dir });
        const summary = await apitest.run([
            { method: 'get', uri: `${baseUrl}/ok`, response: { statuscode: 200 } },
            { method: 'get', uri: `${baseUrl}/missing`, response: { statuscode: 200 } }
        ]);
        t.deepEqual(summary, { passed: 1, failed: 1 });
        const content = await fs.readFile(path.join(dir, 'reports.xml'), 'utf8');
        t.regex(content, /tests="2" failures="1"/);
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

test('run with html output writes a report', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'apirequests-'));
    try {
        const apitest = apirequests({ output: 'html', outputPath: dir });
        const summary = await apitest.run([
            { method: 'get', uri: `${baseUrl}/ok`, response: { statuscode: 200 } },
            { method: 'get', uri: `${baseUrl}/ok` },
            { name: 'Group', group: [{ method: 'get', uri: `${baseUrl}/ok`, response: { statuscode: 200 } }] }
        ]);
        t.deepEqual(summary, { passed: 2, failed: 0 });
        const content = await fs.readFile(path.join(dir, 'reports.html'), 'utf8');
        t.regex(content, /apirequests HTML Report/);
        t.regex(content, /\* RUN/);
        t.regex(content, /<h3>Group<\/h3>/);
        t.regex(content, /Finish 2 tasks 1 Groups \(1 tasks\)/);
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

test.serial('print output lists run tasks without a response expectation', async t => {
    const logs = [];
    const orig = console.log;
    console.log = (...args) => { logs.push(args.join(' ')); };
    try {
        const summary = await apirequests().run([
            { method: 'get', uri: `${baseUrl}/ok` }
        ]);
        t.deepEqual(summary, { passed: 0, failed: 0 });
    } finally {
        console.log = orig;
    }
    t.is(logs.join(' ').includes('RUN'), true);
});

test.serial('print only failure omits passing and run tasks', async t => {
    const logs = [];
    const orig = console.log;
    console.log = (...args) => { logs.push(args.join(' ')); };
    try {
        const summary = await apirequests({ printOnlyFailure: true }).run([
            { method: 'get', uri: `${baseUrl}/ok`, response: { statuscode: 200 } },
            { method: 'get', uri: `${baseUrl}/ok` }
        ]);
        t.deepEqual(summary, { passed: 1, failed: 0 });
    } finally {
        console.log = orig;
    }
    const output = logs.join(' ');
    t.is(output.includes('PASS'), false);
    t.is(output.includes('RUN'), false);
});

test('writeHtml includes a meta refresh when looping', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'apirequests-'));
    try {
        await writeHtml({
            single: [{ task: { num: 1 }, result: { statusCode: 200 }, output: { pass: true } }],
            group: []
        }, { outputPath: dir, outputFile: 'loop.html', loop: 2000 }, Date.now());
        const content = await fs.readFile(path.join(dir, 'loop.html'), 'utf8');
        t.regex(content, /meta http-equiv="refresh" content="2"/);
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

test('run runs group tasks sequentially', async t => {
    const apitest = apirequests();
    const summary = await apitest.run([{
        name: 'Group',
        group: [
            { method: 'get', uri: `${baseUrl}/ok`, response: { statuscode: 200 } },
            { method: 'get', uri: `${baseUrl}/ok`, response: { statuscode: 200 } }
        ]
    }]);
    t.deepEqual(summary, { passed: 2, failed: 0 });
});

test.serial('sets exit code 1 on failure and 0 on success', async t => {
    process.exitCode = 0;
    await apirequests().run([
        { method: 'get', uri: `${baseUrl}/missing`, response: { statuscode: 200 } }
    ]);
    t.is(process.exitCode, 1);

    process.exitCode = 0;
    await apirequests().run([
        { method: 'get', uri: `${baseUrl}/ok`, response: { statuscode: 200 } }
    ]);
    t.is(process.exitCode, 0);
});

test.serial('no rules resolves a zero summary', async t => {
    const logs = [];
    const orig = console.log;
    console.log = (...args) => { logs.push(args.join(' ')); };
    try {
        const summary = await apirequests().run([]);
        t.deepEqual(summary, { passed: 0, failed: 0 });
    } finally {
        console.log = orig;
    }
    t.is(logs.join(' ').includes('No rules!'), true);
});

test.serial('missing file resolves a zero summary', async t => {
    const logs = [];
    const orig = console.log;
    console.log = (...args) => { logs.push(args.join(' ')); };
    try {
        const summary = await apirequests().run('does-not-exist.json');
        t.deepEqual(summary, { passed: 0, failed: 0 });
    } finally {
        console.log = orig;
    }
    t.is(logs.join(' ').includes("doesn't exists!"), true);
});

test.serial('unparsable file resolves a zero summary', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'apirequests-'));
    const badFile = path.join(dir, 'rules.json');
    await fs.writeFile(badFile, '{not json');
    const logs = [];
    const orig = console.log;
    console.log = (...args) => { logs.push(args.join(' ')); };
    try {
        const summary = await apirequests().run(badFile);
        t.deepEqual(summary, { passed: 0, failed: 0 });
    } finally {
        console.log = orig;
        await fs.rm(dir, { recursive: true, force: true });
    }
    t.is(logs.join(' ').includes('Parse error!'), true);
});

test.serial('a network failure is recorded without aborting the run', async t => {
    const apitest = apirequests();
    const summary = await apitest.run([
        { method: 'get', uri: `${baseUrl}/ok`, response: { statuscode: 200 } },
        { method: 'get', uri: 'http://127.0.0.1:1/unreachable', response: { statuscode: 200 } }
    ]);
    t.deepEqual(summary, { passed: 1, failed: 1 });
});

test('retries a failing request until it succeeds', async t => {
    const failSummary = await apirequests().run([
        { method: 'get', uri: `${baseUrl}/flaky`, response: { statuscode: 200 } }
    ]);
    t.deepEqual(failSummary, { passed: 0, failed: 1 });

    const retrySummary = await apirequests().run([
        { method: 'get', uri: `${baseUrl}/flaky`, retries: 2, retryDelay: 10, response: { statuscode: 200 } }
    ]);
    t.deepEqual(retrySummary, { passed: 1, failed: 0 });
});

test('group tasks append the key from the previous response', async t => {
    const apitest = apirequests();
    const summary = await apitest.run([{
        name: 'Key Group',
        key: '_id',
        group: [
            { method: 'get', uri: `${baseUrl}/item`, response: { statuscode: 200 } },
            { method: 'get', uri: `${baseUrl}/users`, response: { statuscode: 200 } }
        ]
    }]);
    t.deepEqual(summary, { passed: 2, failed: 0 });
});

test('run builds tasks from an OpenAPI 3 yaml file', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'apirequests-'));
    const spec = [
        'openapi: 3.0.0',
        'servers:',
        `  - url: ${baseUrl}`,
        'paths:',
        '  /ok:',
        '    get:',
        '      responses:',
        "        '200':",
        '          description: ok',
        '          content:',
        '            application/json:',
        '              example:',
        '                status: ok',
        '                test: yes',
        ''
    ].join('\n');
    const specFile = path.join(dir, 'api.yaml');
    await fs.writeFile(specFile, spec);
    try {
        const apitest = apirequests({ output: 'xml', outputPath: dir });
        const summary = await apitest.run(specFile);
        t.deepEqual(summary, { passed: 1, failed: 0 });
        const report = await fs.readFile(path.join(dir, 'reports.xml'), 'utf8');
        t.regex(report, /tests="1" failures="0"/);
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

test.serial('loop schedules another run', async t => {
    const original = globalThis.setTimeout;
    let scheduled;
    globalThis.setTimeout = (fn, delay) => {
        if (delay === 50) {
            scheduled = fn;
        }
        return { unref: () => {}, ref: () => {}, hasRef: () => false };
    };
    try {
        await apirequests({ loop: 50 }).run([
            { method: 'get', uri: `${baseUrl}/ok`, response: { statuscode: 200 } }
        ]);
    } finally {
        globalThis.setTimeout = original;
    }
    t.is(typeof scheduled, 'function');
});

test('run with ci output prints and writes xml', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'apirequests-'));
    try {
        const apitest = apirequests({ output: 'ci', outputPath: dir });
        const summary = await apitest.run([
            { method: 'get', uri: `${baseUrl}/ok`, response: { statuscode: 200 } }
        ]);
        t.deepEqual(summary, { passed: 1, failed: 0 });
        const content = await fs.readFile(path.join(dir, 'reports.xml'), 'utf8');
        t.regex(content, /tests="1" failures="0"/);
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

test.serial('yaml file that is not rules or an OpenAPI spec resolves a zero summary', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'apirequests-'));
    const yamlFile = path.join(dir, 'rules.yaml');
    await fs.writeFile(yamlFile, 'name: foo\n');
    const logs = [];
    const orig = console.log;
    console.log = (...args) => { logs.push(args.join(' ')); };
    try {
        const summary = await apirequests().run(yamlFile);
        t.deepEqual(summary, { passed: 0, failed: 0 });
    } finally {
        console.log = orig;
        await fs.rm(dir, { recursive: true, force: true });
    }
    t.is(logs.join(' ').includes('YAML error!'), true);
});

test('a report write failure resolves a zero summary', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'apirequests-'));
    try {
        const apitest = apirequests({ output: 'xml', outputPath: path.join(dir, 'does-not-exist') });
        const summary = await apitest.run([
            { method: 'get', uri: `${baseUrl}/ok`, response: { statuscode: 200 } }
        ]);
        t.deepEqual(summary, { passed: 0, failed: 0 });
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

test('cli runs a rules file', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'apirequests-'));
    const rulesFile = path.join(dir, 'rules.json');
    await fs.writeFile(rulesFile, JSON.stringify([
        { method: 'get', uri: `${baseUrl}/ok`, response: { statuscode: 200 } }
    ]));
    const cli = path.join(process.cwd(), 'bin', 'apirequests.js');
    try {
        await promisify(execFile)(process.execPath, [cli, rulesFile, '--output', 'xml'], { cwd: dir });
        const report = await fs.readFile(path.join(dir, 'reports.xml'), 'utf8');
        t.regex(report, /tests="1" failures="0"/);
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

test('cli prints a summary with report options', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'apirequests-'));
    const rulesFile = path.join(dir, 'rules.json');
    await fs.writeFile(rulesFile, JSON.stringify([
        { method: 'get', uri: `${baseUrl}/ok`, response: { statuscode: 200 } }
    ]));
    const cli = path.join(process.cwd(), 'bin', 'apirequests.js');
    try {
        const { stdout } = await promisify(execFile)(
            process.execPath,
            [cli, rulesFile, '--output', 'html', '--print-only-failure', '--output-path', dir, '--output-file', 'custom.html'],
            { cwd: dir }
        );
        t.regex(stdout, /Report file .*custom\.html saved/);
        const report = await fs.readFile(path.join(dir, 'custom.html'), 'utf8');
        t.regex(report, /apirequests HTML Report/);
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

test('cli prints the summary with default print output', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'apirequests-'));
    const rulesFile = path.join(dir, 'rules.json');
    await fs.writeFile(rulesFile, JSON.stringify([
        { method: 'get', uri: `${baseUrl}/ok`, response: { statuscode: 200 } }
    ]));
    const cli = path.join(process.cwd(), 'bin', 'apirequests.js');
    try {
        const { stdout } = await promisify(execFile)(process.execPath, [cli, rulesFile], { cwd: dir });
        t.regex(stdout, /Find/);
        t.regex(stdout, /Tasks and/);
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

test('cli prints usage when no rules file is given', async t => {
    const cli = path.join(process.cwd(), 'bin', 'apirequests.js');
    const result = await promisify(execFile)(process.execPath, [cli], { cwd: process.cwd() })
        .catch((err) => err);
    t.is(result.code, 1);
    t.regex(result.stderr, /Usage: apirequests/);
});

test('cli shows help', async t => {
    const cli = path.join(process.cwd(), 'bin', 'apirequests.js');
    const { stdout } = await promisify(execFile)(process.execPath, [cli, '--help']);
    t.regex(stdout, /Usage: apirequests <rules/);
});

test('unsupported file extension resolves a zero summary', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'apirequests-'));
    const txtFile = path.join(dir, 'rules.txt');
    await fs.writeFile(txtFile, 'nothing');
    try {
        const summary = await apirequests().run(txtFile);
        t.deepEqual(summary, { passed: 0, failed: 0 });
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

test('group tasks skip key handling when the response body is not json', async t => {
    const apitest = apirequests();
    const summary = await apitest.run([{
        name: 'Group',
        key: 'id',
        group: [
            { method: 'get', uri: `${baseUrl}/nope`, response: { statuscode: 404 } },
            { method: 'get', uri: `${baseUrl}/item`, response: { statuscode: 200 } }
        ]
    }]);
    t.deepEqual(summary, { passed: 2, failed: 0 });
});

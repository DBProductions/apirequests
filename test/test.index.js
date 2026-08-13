import test from 'ava';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import apirequests from '../index.js';
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
            { method: 'get', uri: `${baseUrl}/ok`, response: { statuscode: 200 } }
        ]);
        t.deepEqual(summary, { passed: 1, failed: 0 });
        const content = await fs.readFile(path.join(dir, 'reports.html'), 'utf8');
        t.regex(content, /apirequests HTML Report/);
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

test('sets exit code 1 on failure and 0 on success', async t => {
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

test('no rules resolves a zero summary', async t => {
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

test('missing file resolves a zero summary', async t => {
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

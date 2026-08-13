import test from 'ava';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as output from '../lib/output.js';

const makeItem = (pass, msg = []) => ({
    task: { num: 1, method: 'GET', uri: 'http://x/a', response: { statuscode: 200 } },
    result: { requestTime: 10 },
    output: { pass, msg }
});

test('countResults counts passed and failed', t => {
    const results = {
        single: [makeItem(true), makeItem(false)],
        group: [
            {
                name: 'G',
                tasks: [makeItem(true), makeItem(false, ['boom'])]
            }
        ]
    };
    t.deepEqual(output.countResults(results), { passed: 2, failed: 2 });
});

test('countResults ignores tasks without a response', t => {
    const results = {
        single: [{ task: { num: 1, uri: 'http://x/a' }, result: {}, output: {} }],
        group: []
    };
    t.deepEqual(output.countResults(results), { passed: 0, failed: 0 });
});

test('printResults prints summary and returns counts', t => {
    const logs = [];
    const orig = console.log;
    console.log = (...args) => { logs.push(args.join(' ')); };
    try {
        const counts = output.printResults(
            { single: [makeItem(true), makeItem(false, ['status mismatch'])], group: [] },
            { printOnlyFailure: false },
            Date.now()
        );
        t.deepEqual(counts, { passed: 1, failed: 1 });
    } finally {
        console.log = orig;
    }
    t.is(logs.join('\n').includes('Have passed 1 and failed 1 tests'), true);
});

test('printResults honors printOnlyFailure', t => {
    const logs = [];
    const orig = console.log;
    console.log = (...args) => { logs.push(args.join(' ')); };
    try {
        output.printResults(
            { single: [makeItem(true), makeItem(false)], group: [] },
            { printOnlyFailure: true },
            Date.now()
        );
    } finally {
        console.log = orig;
    }
    t.is(logs.join('\n').includes('PASS'), false);
    t.is(logs.join('\n').includes('FAIL'), true);
});

test('writeXml writes a report file', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'apirequests-'));
    try {
        const results = { single: [makeItem(true)], group: [] };
        await output.writeXml(results, { outputPath: dir, outputFile: 'reports.xml' }, Date.now());
        const content = await fs.readFile(path.join(dir, 'reports.xml'), 'utf8');
        t.regex(content, /<testsuite name="apirequests" tests="1" failures="0"/);
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

test('writeHtml writes an html report with escaping', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'apirequests-'));
    try {
        const results = {
            single: [{
                task: { num: 1, method: 'GET', uri: 'http://x/a?q=<x>&r=1', response: {} },
                result: { requestTime: 10 },
                output: { pass: false, msg: ['a < b'] }
            }],
            group: []
        };
        await output.writeHtml(results, { outputPath: dir, outputFile: 'report.html' }, Date.now());
        const content = await fs.readFile(path.join(dir, 'report.html'), 'utf8');
        t.regex(content, /apirequests HTML Report/);
        t.regex(content, /q=&lt;x&gt;&amp;r=1/);
        t.regex(content, /a &lt; b/);
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

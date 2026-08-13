import test from 'ava';
import { buildTestsuiteXml } from '../lib/xml.js';

test('buildTestsuiteXml empty', t => {
    const xml = buildTestsuiteXml({ single: [], group: [] }, 1.5);
    t.is(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), true);
    t.regex(xml, /<testsuite name="apirequests" tests="0" failures="0" time="1.5"/);
});

test('buildTestsuiteXml counts single and group tasks', t => {
    const results = {
        single: [
            {
                task: { num: 1, uri: 'http://x/a', response: {} },
                result: { requestTime: 500 },
                output: { pass: true, msg: [] }
            },
            {
                task: { num: 2, uri: 'http://x/b', response: {} },
                result: { requestTime: 700 },
                output: { pass: false, msg: ['bad status'] }
            }
        ],
        group: [
            {
                name: 'G',
                tasks: [
                    {
                        task: { num: 'g1-1', uri: 'http://x/c', response: {} },
                        result: { requestTime: 300 },
                        output: { pass: false, msg: ['nope'] }
                    }
                ]
            }
        ]
    };
    const xml = buildTestsuiteXml(results, 2);
    t.regex(xml, /tests="3" failures="2" time="2"/);
    t.regex(xml, /<testcase name="http:\/\/x\/a" time="0.5"><\/testcase>/);
    t.regex(xml, /<error message="bad status"><\/error>/);
    t.regex(xml, /<error message="nope"><\/error>/);
});

test('buildTestsuiteXml escapes xml special characters', t => {
    const results = {
        single: [
            {
                task: { num: 1, uri: 'http://x/a?q=1&r=<2>', response: {} },
                result: { requestTime: 1000 },
                output: { pass: false, msg: ['a & b < c'] }
            }
        ],
        group: []
    };
    const xml = buildTestsuiteXml(results, 1);
    t.regex(xml, /name="http:\/\/x\/a\?q=1&amp;r=&lt;2&gt;"/);
    t.regex(xml, /message="a &amp; b &lt; c"/);
});

test('buildTestsuiteXml runs have no failure without response', t => {
    const results = {
        single: [
            {
                task: { num: 1, uri: 'http://x/a' },
                result: { requestTime: 200 },
                output: { pass: undefined, msg: [] }
            }
        ],
        group: []
    };
    const xml = buildTestsuiteXml(results, 0.5);
    t.regex(xml, /tests="1" failures="0"/);
});

import test from 'ava';
import apirequests from '../index.js';

const live = process.env.E2E_LIVE === '1';
const baseUrl = (process.env.E2E_BASE_URL || 'https://httpbin.org').replace(/\/$/, '');

/**
 * Opt-in smoke test against a real HTTP service.
 * Run with `E2E_LIVE=1 npm test` (or `npm run test:e2e`).
 * Point it somewhere else with `E2E_BASE_URL=https://httpbin.example`.
 */
const smoke = live ? test : test.skip;

smoke('live E2E: httpbin smoke test', async (t) => {
    const summary = await apirequests({
        printOnlyFailure: true,
        retries: 2,
        retryDelay: 250,
        timeout: 15000
    }).run([
        {
            method: 'get',
            uri: `${baseUrl}/status/200`,
            response: { statuscode: 200 }
        },
        {
            method: 'get',
            uri: `${baseUrl}/get?case=apirequests`,
            response: {
                statuscode: 200,
                headers: { contenttype: 'application/json' },
                data: '"case": "apirequests"',
                regex: true
            }
        },
        {
            method: 'get',
            uri: `${baseUrl}/headers`,
            headers: { 'X-Smoke': 'apirequests' },
            response: {
                statuscode: 200,
                data: '"X-Smoke": "apirequests"',
                regex: true
            }
        }
    ]);
    t.deepEqual(summary, { passed: 3, failed: 0 });
});

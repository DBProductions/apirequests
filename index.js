/**
 * APIrequests
 * Take rules as JSON and execute requests.
 */
import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';
import pc from 'picocolors';
import logSymbols from 'log-symbols';
import cliSpinner from 'cli-spinner';
import * as helper from './lib/helper.js';
import * as output from './lib/output.js';

const Spinner = cliSpinner.Spinner;
const spinner = new Spinner('Requesting %s');

let loopCount = 1;

const isYaml = (filename) => ['.yaml', '.yml'].includes(path.extname(filename).toLowerCase());

const isOpenApiDoc = (doc) => doc && typeof doc === 'object' && !Array.isArray(doc) && doc.paths;

const loadRules = (filename) => {
    const ext = path.extname(filename).toLowerCase();
    const raw = fs.readFileSync(filename, 'utf8');
    if (ext === '.json') {
        return JSON.parse(raw);
    }
    if (ext === '.yaml' || ext === '.yml') {
        return yaml.load(raw);
    }
    throw new Error(`Unsupported file extension: ${ext}`);
};

const printSummary = (tasks, opts, filename) => {
    if (opts.output !== 'print') {
        return;
    }
    if (filename) {
        console.log('Find',
            tasks.singles.length,
            'in',
            filename,
            'start with',
            tasks.singles.length,
            'Tasks and',
            tasks.groups.length,
            'Groups');
    } else {
        console.log('Start with',
            tasks.singles.length,
            'Tasks and',
            tasks.groups.length,
            'Groups');
    }
    spinner.setSpinnerString('|/-\\');
    spinner.start();
};

/**
 * Build a normalized failed result for a request that threw.
 */
const errorResult = (task, err) => ({
    statusCode: 0,
    headers: {},
    body: '',
    num: task.num,
    reqend: Date.now(),
    request: { host: '' },
    requestTime: Math.round(Date.now() - task.reqstart),
    error: err.message
});

/**
 * get results for a group
 */
const getGroupResults = async (tasks) => {
    const groupResults = [];
    for (const group of tasks.groups) {
        const results = { tasks: [], name: group.name };
        for (let i = 0; i < group.tasks.length; i++) {
            const task = group.tasks[i];
            task.reqstart = Date.now();
            const response = await helper.caller(task).catch((err) => errorResult(task, err));
            const next = group.tasks[i + 1];
            if (next) {
                let data;
                try {
                    data = JSON.parse(response.body);
                } catch (e) {
                    data = null;
                }
                if (data) {
                    if (group.key && data[group.key]) {
                        group.key = data[group.key];
                    }
                    if (next.uri && group.key) {
                        const keyString = group.key.toString();
                        if (!next.uri.endsWith(keyString)) {
                            next.uri += next.uri.endsWith('/') ? group.key : `/${group.key}`;
                        }
                    }
                }
            }
            results.tasks.push({ task, result: response });
        }
        groupResults.push(results);
    }
    return groupResults;
};

/**
 * handle different outputs
 */
const handleOutputs = async (tasks, results, opts, startTime) => {
    if (opts.output === 'print') {
        spinner.stop();
        console.log('\n');
        output.printResults(results, opts, startTime);
    } else if (opts.output === 'html') {
        await output.writeHtml(results, opts, startTime);
    } else if (opts.output === 'xml') {
        await output.writeXml(results, opts, startTime);
    } else if (opts.output === 'db') {
        await output.storeResults(results, opts);
    } else if (opts.output === 'ci') {
        output.printResults(results, opts, startTime);
        await output.writeXml(results, opts, startTime);
    }
    if (opts.loop) {
        setTimeout(() => { start(tasks, opts, true); }, opts.loop);
    }
};

/**
 * start the calls and check the responses
 */
const start = async (tasks, opts, again = false) => {
    if (again && opts.output === 'print') {
        loopCount += 1;
        console.log('Start again with',
            tasks.singles.length,
            'Tasks',
            'made ' + loopCount + ' runs');
    }
    const startTime = Date.now();
    process.exitCode = 0;
    const promRequests = tasks.singles.map((task) => {
        task.reqstart = Date.now();
        return helper.caller(task).catch((err) => errorResult(task, err));
    });
    try {
        const values = await Promise.all(promRequests);
        const results = helper.setOutputs(helper.fillResults(tasks, values));
        // do group requests
        const groupResults = helper.setGroupOutputs(await getGroupResults(tasks));
        const allResults = { single: results, group: groupResults };
        const summary = output.countResults(allResults);
        await handleOutputs(tasks, allResults, opts, startTime);
        if (summary.failed > 0) {
            process.exitCode = 1;
        }
        return summary;
    } catch (err) {
        console.log(logSymbols.error, pc.red(err));
        process.exitCode = 1;
        return { passed: 0, failed: 0 };
    }
};

export default (opts = {}) => {
    // set default values
    opts.output = opts.output || 'print';
    opts.printOnlyFailure = opts.printOnlyFailure || false;
    opts.outputFile = opts.outputFile || 'reports.html';
    opts.outputPath = opts.outputPath || './';
    opts.connectionurl = opts.connectionurl || 'mongodb://127.0.0.1:27017';
    opts.database = opts.database || 'apirequests';
    opts.collection = opts.collection || 'results';
    if (opts.output === 'xml' || opts.output === 'ci') {
        if (opts.outputFile === 'reports.html') {
            opts.outputFile = 'reports.xml';
        }
    }

    return {
        /**
         * checks the rules then build the tasks and start to work
         */
        run: function (rules) {
            if (!rules || (Array.isArray(rules) && rules.length === 0)) {
                console.log(logSymbols.error,
                    pc.red('No rules!'),
                    'Rules are needed to build and run tasks.');
                return Promise.resolve({ passed: 0, failed: 0 });
            }
            if (typeof rules === 'string') {
                const filename = rules;
                if (!fs.existsSync(filename)) {
                    console.log(logSymbols.error,
                        pc.red(`${filename} doesn't exists!`));
                    process.exitCode = 1;
                    return Promise.resolve({ passed: 0, failed: 0 });
                }
                try {
                    const source = loadRules(filename);
                    if (isYaml(filename) && !Array.isArray(source) && !isOpenApiDoc(source)) {
                        console.log(logSymbols.error,
                            pc.red('YAML error!'),
                            `${filename} is not an array of rules or an OpenAPI spec.`);
                        process.exitCode = 1;
                        return Promise.resolve({ passed: 0, failed: 0 });
                    }
                    const tasks = (isYaml(filename) && isOpenApiDoc(source))
                        ? helper.buildOpenApiTasks(source)
                        : helper.buildTasks(opts, source);
                    printSummary(tasks, opts, filename);
                    return start(tasks, opts);
                } catch (e) {
                    console.log(logSymbols.error,
                        pc.red('Parse error!'),
                        `${filename} is not parsable`);
                    process.exitCode = 1;
                    return Promise.resolve({ passed: 0, failed: 0 });
                }
            } else {
                const tasks = helper.buildTasks(opts, rules);
                printSummary(tasks, opts);
                return start(tasks, opts);
            }
        }
    };
};

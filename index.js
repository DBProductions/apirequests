/**
 * APIrequests
 * Take rules as JSON and execute requests.
 */
const fs = require('fs');
const colors = require('colors');
const logSymbols = require('log-symbols');
const syncRequest = require('sync-request');
const Spinner = require('cli-spinner').Spinner;
const _spinner = new Spinner('Requesting %s');
const helper = require('./lib/helper');
const _output = require('./lib/output');

let LOOPCOUNT = 1;

module.exports = (opts = {}) => {
    // set default values
    opts.output = opts.output || 'print';
    opts.onlyFailures = opts.onlyFailures || null;
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

    /**
     * get results for a group
     */
    const getGroupResults = (tasks) => {
        let groupResults = [];
        for (let group in tasks.groups) {
            let results = {tasks: []};
            for (let task in tasks.groups[group].tasks) {
                results.name = tasks.groups[group].name;
                tasks.groups[group].tasks[task].reqstart = Date.now();
                let response = syncRequest(tasks.groups[group].tasks[task].method,
                    tasks.groups[group].tasks[task].uri,
                    tasks.groups[group].tasks[task]);

                if (tasks.groups[group].tasks[Number(task) + 1]) {
                    let data;
                    try {
                        data = JSON.parse(response.body);
                    } catch (e) {
                        console.log(logSymbols.error,
                            colors.red('No JSON response!'),
                            response.body);
                    }
                    if (data) {
                        if (tasks.groups[group].key && data[tasks.groups[group].key]) {
                            tasks.groups[group].key = data[tasks.groups[group].key];
                        }
                        if (tasks.groups[group].tasks[Number(task) + 1].uri) {
                            if (tasks.groups[group].key) {
                                let keyLength = tasks.groups[group].key.toString().length;
                                if (tasks.groups[group].key.toString() !== tasks.groups[group].tasks[Number(task) + 1].uri.slice(keyLength * -1)) {
                                    if (tasks.groups[group].tasks[Number(task) + 1].uri.slice(-1) !== '/') {
                                        tasks.groups[group].tasks[Number(task) + 1].uri += `/${tasks.groups[group].key}`;
                                    } else {
                                        tasks.groups[group].tasks[Number(task) + 1].uri += tasks.groups[group].key;
                                    }
                                }
                            }
                        }
                    }
                }
                response.reqend = Date.now();
                response.requestTime = Math.round((response.reqend - tasks.groups[group].tasks[task].reqstart));
                results.tasks.push({task: tasks.groups[group].tasks[task], result: response});
            }
            groupResults.push(results);
        }
        return groupResults;
    };

    /**
     * handle different outputs
     */
    let handleOutputs = (tasks, results, opts, startTime) => {
        if (opts.output === 'print') {
            _spinner.stop();
            console.log('\n');
            _output.printResults(results, opts, startTime);
        } else if (opts.output === 'html') {
            _output.writeHtml(results, opts, startTime);
        } else if (opts.output === 'xml') {
            _output.writeXml(results, opts, startTime);
        } else if (opts.output === 'db') {
            _output.storeResults(results, opts, startTime);
        } else if (opts.output === 'ci') {
            opts.loop = true;
            _output.printResults(results, opts, startTime);
            opts.loop = false;
            _output.writeXml(results, opts, startTime);
        }
        if (opts.loop) {
            setTimeout(() => { startAgain(opts, tasks); }, opts.loop);
        }
    };

    /**
     * start the calls and check the responses
     */
    let start = async (tasks) => {
        let startTime = Date.now();
        let promRequests = [];
        tasks.singles.map((currentValue) => {
            currentValue.reqstart = Date.now();
            promRequests.push(helper.caller(currentValue));
        });
        Promise.all(promRequests).then(values => {
            let results = helper.fillResults(tasks, values);
            results = helper.setOutputs(results);
            // do group requests
            let groupResults = getGroupResults(tasks);
            groupResults = helper.setGroupOutputs(groupResults);

            let allResults = {
                single: results,
                group: groupResults
            };
            handleOutputs(tasks, allResults, opts, startTime);
        }).catch(err => {
            console.log(err);
        });
    };

    /**
     * start the calls and check the responses again
     */
    let startAgain = (opts, tasks) => {
        LOOPCOUNT += 1;
        let startTime = Date.now();
        if (opts.output === 'print') {
            console.log('Start again with',
                tasks.singles.length,
                'Tasks',
                'made ' + LOOPCOUNT + ' runs');
        }
        let promRequests = [];
        tasks.singles.map((currentValue) => {
            currentValue.reqstart = Date.now();
            promRequests.push(helper.caller(currentValue));
        });
        Promise.all(promRequests).then(values => {
            let results = helper.fillResults(tasks, values);
            results = helper.setOutputs(results);
            // do group requests
            let groupResults = getGroupResults(tasks);
            groupResults = helper.setGroupOutputs(groupResults);

            let allResults = {
                single: results,
                group: groupResults
            };
            handleOutputs(tasks, allResults, opts, startTime);
        });
    };

    return {
        /**
         * checks the rules then build the tasks and start to work
         */
        run: function (rules) {
            if (!rules || rules.length === 0) {
                console.log(logSymbols.error,
                    colors.red('No rules!'),
                    'Rules are needed to build and run tasks.');
            } else if (typeof rules === 'string') {
                let filename = rules;
                fs.stat(filename, (err) => {
                    if (err === null) {
                        fs.readFile(filename, (err, data) => {
                            if (err) { throw err; }
                            try {
                                rules = JSON.parse(data.toString());
                                let tasks = helper.buildTasks(opts, rules);
                                if (opts.output === 'print') {
                                    console.log('Find',
                                        rules.length,
                                        'in',
                                        filename,
                                        'start with',
                                        tasks.singles.length,
                                        'Tasks and',
                                        tasks.groups.length,
                                        'Groups');
                                    _spinner.setSpinnerString('|/-\\');
                                    _spinner.start();
                                }
                                start(tasks);
                            } catch (e) {
                                console.log(logSymbols.error,
                                    colors.red('JSON parse error!'),
                                    `${filename} is not parsable`);
                            }
                        });
                    } else if (err.code === 'ENOENT') {
                        console.log(logSymbols.error,
                            colors.red(filename + " doesn't exists!"));
                    } else {
                        console.log(logSymbols.error,
                            colors.red(err.code));
                    }
                });
            } else {
                let tasks = helper.buildTasks(opts, rules);
                if (opts.output === 'print') {
                    console.log('Start with',
                        tasks.singles.length,
                        'Tasks and',
                        tasks.groups.length,
                        'Groups');
                    _spinner.setSpinnerString('|/-\\');
                    _spinner.start();
                }
                start(tasks);
            }
        }
    };
};

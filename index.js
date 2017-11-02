/**
 * APIrequests
 * Take rules as JSON and execute requests.
 */
'use strict';
const fs = require('fs');
const colors = require('colors');
const logSymbols = require('log-symbols');
const Spinner = require('cli-spinner').Spinner;
const _spinner = new Spinner('Requesting %s');
const helper = require('./lib/helper');
const _output = require('./lib/output');

let startTime = 0;
let loopCount = 1;
let RESPONSES = [];

module.exports = (opts) => {
    if (!opts) { opts = {}; }
    opts.output = opts.output || 'print';
    opts.mode = opts.mode || 'all';
    opts.onlyFailures = opts.onlyFailures || null;
    opts.outputFile = opts.outputFile || 'reports.html';
    opts.outputPath = opts.outputPath || './';
    opts.connectionurl = opts.connectionurl || 'mongodb://127.0.0.1:27017/apirequests';
    opts.collection = opts.collection || 'results';

    /**
     * Check the responses
     */
    let checkResponses = (opts, tasks) => {
        if (tasks.length === RESPONSES.length) {
            let results = fillResults(tasks, RESPONSES);
            results = helper.setOutputs(results);
            handleOutputs(tasks, results, opts, startTime);
        } else {
            setTimeout(() => { checkResponses(opts, tasks); }, 1);
        }
    }
    /**
     * Fill results with matching tasks and responses
     */
    let fillResults = (tasks, responses) => {
        let results = [];
        for (let i = 0; i < tasks.length; i++) {
            for (let j = 0; j < responses.length; j++) {
                if (tasks[i].num === responses[j].num) {
                    let requestTime = Math.round((responses[j].reqend - tasks[i].reqstart));
                    responses[j].requestTime = requestTime;
                    results.push({task: tasks[i], result: responses[j]});
                    responses.splice(j, 1);
                }
            }
        }
        return results;
    }
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
    }
    /**
     * start the calls and check the responses
     */
    let start = (tasks) => {
        tasks.map((currentValue) => {
            currentValue.reqstart = Date.now();
            if (currentValue.delay) {
                setTimeout(() => {
                    helper.caller(currentValue).then(response => {
                        collectResponse(response);
                    }).catch(err => {
                        console.log(err);
                    });
                }, currentValue.delay);
            } else {
                helper.caller(currentValue).then(response => {
                    collectResponse(response);
                }).catch(err => {
                    console.log(err);
                });
            }
        });
        checkResponses(opts, tasks);
    }
    /**
     * start the calls and check the responses
     */
    let startAgain = (opts, tasks) => {
        loopCount += 1;
        startTime = Date.now();
        if (opts.output === 'print') {
            console.log('Start again with',
                        tasks.length,
                        'Tasks',
                        'made ' + loopCount + ' runs');
        }
        RESPONSES = [];
        tasks.map((currentValue) => {
            currentValue.reqstart = Date.now();
            helper.caller(currentValue).then(response => {
                collectResponse(response);
            }).catch(err => {
                console.log(err);
            });
        });
        checkResponses(opts, tasks);
    }
    /**
     * Collect the responses
     */
    let collectResponse = (response) => {
        RESPONSES.push(response);
    }

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
                            } catch(e) {
                               rules = [];
                            }
                            let tasks = helper.buildTasks(opts, rules);
                            startTime = Date.now();
                            if (opts.output === 'print') {
                                console.log('Find',
                                            rules.length,
                                            'in',
                                            filename,
                                            'start with',
                                            tasks.length,
                                            'Tasks\n');
                                _spinner.setSpinnerString('|/-\\');
                                _spinner.start();
                            }
                            start(tasks);
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
                startTime = Date.now();
                if (opts.output === 'print') {
                    console.log('Start with',
                                tasks.length,
                                'Tasks');
                    _spinner.setSpinnerString('|/-\\');
                    _spinner.start();
                }
                start(tasks);
            }
        }
    };
};

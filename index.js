/**
 * APIrequests
 * Take rules as JSON and execute requests.
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
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
                        try {
                            console.log(response.body.toString());
                            data = JSON.parse(response.body.toString());
                        } catch (e) {
                            console.log(logSymbols.error,
                                colors.red('No Buffer response!'),
                                response.body);
                        }
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

    let getRefDefs = (doc, ref) => {
        let refdef = {};
        let refParts = ref.split('/');
        if (refParts[1] === 'definitions') {
            let def = doc.definitions[refParts[2]];
            for (let property in def.properties) {
                if (def.properties[property]['$ref']) {
                    refdef[property] = getRefDefs(doc, def.properties[property]['$ref']);
                } else {
                    if (def.properties[property].type === 'array') {
                        let arr = [];
                        if (def.properties[property].items['$ref']) {
                            arr.push(getRefDefs(doc, def.properties[property].items['$ref']));
                        } else {
                            arr.push(def.properties[property].items.type);
                        }
                        refdef[property] = arr;
                    } else {
                        refdef[property] = def.properties[property].type;
                    }
                }
            }
        }
        return refdef;
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
                        const fileext = path.extname(filename);
                        if (fileext === '.json') {
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
                        } else if (fileext === '.yaml') {
                            try {
                                const doc = yaml.safeLoad(fs.readFileSync(filename, 'utf8'));
                                if (doc.paths) {
                                    let host = 'http://localhost:4000';
                                    if (doc.basePath) {
                                        host += doc.basePath;
                                    }
                                    let task;
                                    let tasks = {
                                        groups: [],
                                        singles: []
                                    };
                                    let num = 1;
                                    for (let i in doc.paths) {
                                        let uriPath = i;
                                        for (let j in doc.paths[i]) {
                                            // iterate over responses
                                            for (let k in doc.paths[i][j].responses) {
                                                task = {
                                                    num,
                                                    method: j.toUpperCase(),
                                                    headers: {
                                                        'Content-Type': 'application/json',
                                                        'Accept': 'application/json'
                                                    }
                                                };

                                                if (doc.paths[i][j].parameters) {
                                                    if (doc.paths[i][j].parameters[0] && doc.paths[i][j].parameters[0].in === 'path') {
                                                        if (doc.paths[i][j].parameters[0].example) {
                                                            // cut off needs to replaced! to keep rest which is lost currently
                                                            uriPath = i.slice(0, i.indexOf('{')) + doc.paths[i][j].parameters[0].example;
                                                        }
                                                    } else if (doc.paths[i][j].parameters[0] && doc.paths[i][j].parameters[0].in === 'query') {
                                                        uriPath = i + '?' + doc.paths[i][j].parameters[0].name;
                                                    } else if (doc.paths[i][j].parameters[0] && doc.paths[i][j].parameters[0].in === 'body') {
                                                        if (doc.paths[i][j].parameters[0] && doc.paths[i][j].parameters[0].schema && doc.paths[i][j].parameters[0].schema['$ref']) {
                                                            task.body = JSON.stringify(doc.paths[i][j].parameters[0].example);
                                                        }
                                                    }
                                                }

                                                let data = doc.paths[i][j].responses[k].example;

                                                if (doc.paths[i][j].responses[k].examples) {
                                                    try {
                                                        data = doc.paths[i][j].responses[k].examples['application/json'];
                                                    } catch (e) {
                                                        console.log('examples parse error');
                                                    }
                                                }

                                                let uri = host + uriPath;
                                                task.uri = uri;
                                                task.response = {
                                                    statuscode: Number(k),
                                                    headers: { contenttype: doc.paths[i][j].produces[0] },
                                                    data
                                                };
                                                console.log(task);
                                                tasks.singles.push(task);
                                                num += 1;
                                            }
                                        }
                                    }
                                    if (opts.output === 'print') {
                                        console.log('Find',
                                            Object.keys(doc.paths).length,
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
                                }
                            } catch (e) {
                                console.log(e);
                            }
                        }
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

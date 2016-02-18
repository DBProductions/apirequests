/**
 * APIrequests
 * Take rules as JSON and execute requests.
 */
'use strict';
let request = require('request'),
    _async = require('async'),
    colors = require('colors'),
    logSymbols = require('log-symbols'),
    fs = require('fs'),
    apirequests,
    startTime = 0,
    loopCount = 1,
    TASKS = [],
    RESPONSES = [],
    methods = ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'];

apirequests = function apirequests(opts) {
    if (!opts) { opts = {}; }
    opts.output = opts.output || 'print';
    opts.mode = opts.mode || 'all';
    opts.outputfile = opts.outputfile || 'reports.html';
    opts.outputpath = opts.outputpath || './';
    opts.outputpath = opts.outputpath || './';
    opts.connectionurl = opts.connectionurl || null;
    opts.collection = opts.collection || 'results';

    /**
     * Print results on console
     */
    function printResults(results) {
        let passed = 0,
            failed = 0,
            msg = '',
            requestTime,
            finishMsg,
            i,
            difference = Math.round((new Date().getTime() - startTime));
        for (i = 0; i < results.length; i++) {
            msg = '';
            requestTime = Math.round((results[i].result.reqend - results[i].task.reqstart));
            requestTime +=  ' milliseconds';
            if (results[i].task.delay) {
                requestTime +=  ' delayed with ' + results[i].task.delay;
            }
            requestTime +=  '\n';
            if (!results[i].output.pass && results[i].task.response) {
                if (results[i].output.msg.length > 0) {
                    results[i].output.msg.forEach(function(value) {
                        msg += '\t- ' + value.trim() + '\n';
                    });
                }
                console.log(logSymbols.error, colors.red('FAIL') + '  - ' + results[i].task.num, results[i].task.method, results[i].task.uri, 'in ' + requestTime, msg);
                failed += 1;
            } else {
                if (results[i].task.response) {
                    console.log(logSymbols.success, colors.green('PASS') + '  - ' + results[i].task.num, results[i].task.method, results[i].task.uri, 'in ' + requestTime);
                    passed += 1;
                } else {
                    console.log(logSymbols.info, colors.blue('RUN') + '  - ' + results[i].task.num, results[i].task.method, results[i].task.uri, 'in ' + requestTime);
                }
            }
        }
        finishMsg = 'Finish ' + results.length;
        finishMsg +=  ' tasks in ' + difference + ' milliseconds.';
        console.log(finishMsg);
        msg = 'Have passed ' + passed + ' and failed ' + failed;
        if (failed === 1) {
            msg += ' task.\n';
        } else {
            msg += ' tasks.\n';
        }
        if (failed > 0) {
            console.log(colors.red(msg));
        } else {
            console.log(colors.green(msg));
        }
    }

    /**
     * Check uri
     */
    function checkUri(s) {
        var r = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
        return r.test(s);
    }

    /**
     * Do the request
     */
    function call(opts, cb) {
        request(opts, function(err, res, body) {
            if (err) {
                cb(err);
            } else {
                res.num = opts.num;
                res.reqend = (+new Date());
                cb(res, body);
            }
        });
    }

    /**
     * Collect the responses
     */
    function getResponse(response) {
        RESPONSES.push(response);
    }

    /**
     * Check the responses
     */
    function checkResponses(opts) {
        if (TASKS.length === RESPONSES.length) {
            var results = fillResults(TASKS, RESPONSES);
            results = setOutputs(results);
            if (opts.output === 'print') {
                printResults(results);
            } else if (opts.output === 'html') {
                writeResults(results, opts);
            } else if (opts.output === 'db') {
                storeResults(results, opts);
            }
        } else {
            setTimeout(function(){ checkResponses(opts); }, 1);
        }
    }

    /**
     * Fill results with matching tasks and responses
     */
    function fillResults(tasks, responses) {
        var results = [];
        for (var i = 0; i < tasks.length; i++) {
            for (var j = 0; j < responses.length; j++) {
                if (tasks[i].num === responses[j].num) {
                    results.push({task: tasks[i], result: responses[j]});
                    responses.splice(j, 1);
                }
            }
        }
        return results;
    }

    /**
     * Set the output property of the results object
     */
    function setOutputs(results) {
        for (var i = 0; i < results.length; i++) {
            results[i].output = {};
            results[i].output.msg = [];
            if (results[i].task.response) {
                results[i].output.pass = false;
                // Status code
                if (results[i].task.response.statuscode !== results[i].result.statusCode) {
                    results[i].output.msg.push(results[i].task.response.statuscode + ' is not equal ' + results[i].result.statusCode);
                }
                // Host
                if (results[i].task.response.host) {
                    if (results[i].task.response.host !== results[i].result.request.host) {
                        results[i].output.msg.push(results[i].task.response.host + ' is not equal ' + results[i].result.request.host);
                    }
                }
                // Headers
                if (results[i].task.response.headers) {
                    // Contenttype
                    if (results[i].task.response.headers.contenttype) {
                        if (results[i].task.response.headers.contenttype !== results[i].result.headers['content-type']) {
                            results[i].output.msg.push(results[i].task.response.headers.contenttype + ' is not equal ' + results[i].result.headers['content-type']);
                        }
                    }
                    // Contentlength
                    if (results[i].task.response.headers.contentlength) {
                        if (results[i].task.response.headers.contentlength !== results[i].result.headers['content-length']) {
                            results[i].output.msg.push(results[i].task.response.headers.contentlength + ' is not equal ' + results[i].result.headers['content-length']);
                        }
                    }
                    // Server
                    if (results[i].task.response.headers.server) {
                        if (results[i].task.response.headers.server !== results[i].result.headers.server) {
                            results[i].output.msg.push(results[i].task.response.headers.server + ' is not equal ' + results[i].result.headers.server);
                        }
                    }
                    // Cachecontrol
                    if (results[i].task.response.headers.cachecontrol) {
                        if (results[i].task.response.headers.cachecontrol !== results[i].result.headers['cache-control']) {
                            results[i].output.msg.push(results[i].task.response.headers.cachecontrol + ' is not equal ' + results[i].result.headers['cache-control']);
                        }
                    }
                }
                // Body
                if (results[i].task.response.data) {
                    if (results[i].task.response.regex) {
                        var re = new RegExp(results[i].task.response.data);
                        if (!re.exec(results[i].result.body)) {
                            results[i].output.msg.push(results[i].result.body + ' not includes ' + results[i].task.response.data);
                        }
                    } else {
                        if (results[i].task.response.data !== results[i].result.body) {
                            results[i].output.msg.push(results[i].task.response.data + ' is not equal ' + results[i].result.body);
                        }
                    }
                }
                if (results[i].output.msg.length === 0) {
                    results[i].output.pass = true;
                }
            }
        }
        return results;
    }

    /**
     * Build the tasks, make some checks and skip wrong data
     */
    function buildTasks(rules) {
        var i, options, rulesLength = rules.length;
        for(i = 0; i < rulesLength; i++) {
            options = {};
            options.num = i + 1;
            if (rules[i].method) {
                options.method = rules[i].method.toUpperCase();
                if (methods.indexOf(options.method) < 0) {
                    options.method = false;
                }
            } else {
                options.method = 'GET';
            }
            if (rules[i].uri) {
                options.uri = rules[i].uri;
                if (!checkUri(options.uri)) {
                    options.uri = false;
                }
            }
            if (rules[i].responseKey) {
                options.responseKey = rules[i].responseKey;
            }
            if (rules[i].delay) {
                options.delay = rules[i].delay;
            }
            if (rules[i].form) {
                options.form = rules[i].form;
            }
            if (rules[i].headers) {
                options.headers = rules[i].headers;
            }
            if (rules[i].response) {
                options.response = rules[i].response;
            }
            if ((options.methods || options.method) && options.uri) {
                TASKS.push(options);
            } else {
                console.log(colors.red('* SKIP') + ' - ' + rules[i].method + ' ' + rules[i].uri);
            }
        }
        //console.log(TASKS);
    }
    /**
     * start the calls and check the responses
     */
    function start() {
        if (opts.mode === 'all') {
            TASKS.map(function(currentValue) {
                currentValue.reqstart = (+new Date());
                if (currentValue.delay) {
                    setTimeout(function() {
                        call(currentValue, function(response) {
                            getResponse(response);
                        });
                    }, currentValue.delay);
                } else {
                  if (!currentValue.methods) {
                    call(currentValue, function(response) {
                        getResponse(response);
                    });
                  } else {
                    console.log(currentValue.uri, currentValue.responseKey);
                    currentValue.methods.map(function(method) {
                        console.log(method);
                    });
                    getResponse(true);
                  }
                }
            });
            checkResponses(opts);
        } else {
            /*for (let task of TASKS) {
                task.reqstart = (+new Date());
                call(task, function(response) {
                    console.log(task.responseKey, response.body);
                    getResponse(response);
                });
            }
            checkResponses(opts);*/

            /*let Caller = {
                call: function (task, callback) {
                    task.reqstart = (+new Date());
                    call(task, function(response) {
                        callback(null, response);
                    });
                }
            };
            _async.map(TASKS, Caller.call.bind(Caller), function(err, result) {
                for (let item of result) {
                    getResponse(item);
                }
                checkResponses(opts);
            });*/
            let results = [];
            _async.waterfall([
                function (callback) {
                    TASKS[0].reqstart = (+new Date());
                    call(TASKS[0], function(response) {
                        console.log(TASKS[0].responseKey, response.body);
                        getResponse(response);
                        callback(null, response);
                    });
                },
                function (data, callback) {
                    TASKS[1].reqstart = (+new Date());
                    call(TASKS[1], function(response) {
                        console.log(TASKS[1].responseKey, response.body);
                        getResponse(response);
                        callback(null, response);
                    });
                },
                function (data, callback) {
                    TASKS[2].reqstart = (+new Date());
                    call(TASKS[2], function(response) {
                        console.log(TASKS[2].responseKey, response.body);
                        getResponse(response);
                        callback(null, response);
                    });
                },

                function (data, callback) {
                    console.log('process done');
                    callback(null, 'done');
                }
            ], function() {
                console.log('waterfall done');
                checkResponses(opts);
            });
        }
    }

    return {
        /**
         * run method checks the rules, build tasks and start the requests
         */
        run: function(rules) {
            if (!rules) {
                console.log(logSymbols.error, colors.red('No rules!'), 'Rules are needed to build and run tasks.');
            } else if (typeof rules === 'string') {
                var filename = rules;
                fs.stat(filename, function(err) {
                    if (err === null) {
                        fs.readFile(filename, function (err, data) {
                            if (err) { throw err; }
                            rules = JSON.parse(data.toString());
                            buildTasks(rules);
                            startTime = (+new Date());
                            if (opts.output === 'print') {
                                console.log('Find', rules.length, 'in', filename, 'start with', TASKS.length, 'Tasks\n');
                            }
                            start();
                        });
                    } else if(err.code === 'ENOENT') {
                        console.log(logSymbols.error, colors.red('File ' + filename + ' does not exists!'));
                    } else {
                        console.log(logSymbols.error, colors.red(err.code));
                    }
                });
            } else {
                buildTasks(rules);
                startTime = (+new Date());
                if (opts.output === 'print') {
                    console.log('Start with', TASKS.length, 'Tasks\n');
                }
                start();
            }
        }
    };
};

module.exports = apirequests;
